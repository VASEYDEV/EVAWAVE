/**
 * Songs and variants (docs/SPEC.md §1.6, §3 S6). Every call runs as the signed-in user, so
 * row level security decides what is visible. A song is saved only at the revision it was
 * read at: a stale tab gets a `LibraryError`, never a silent overwrite. Variants are
 * frozen through `public.freeze_variant`, which saves the working copy and snapshots it in
 * one transaction; they are never updated or deleted, except with their song.
 */
import { ENGINE_IDS } from "@/core/musicspec/engines";
import type { Catalog, EngineId, FieldDiff, MusicSpec, Song, TargetOverride, Variant } from "@/core/musicspec/ir/types";
import { diffSpecs, freezeBlockers, normalise, specHash, variantCoverage } from "@/core/musicspec/variants";
import type { SongAttachment } from "@/lib/composer/storage";

import { check, LibraryError, type LibraryClient } from "./repository";
import type { SongRow, VariantRow } from "./schema";

/** `songs.title` holds 1–200 characters (the check in the songs migration). */
export const SONG_TITLE_MAX = 200;

/**
 * A song's title: the spec's own title (D10), trimmed and cut to the limit in code points as
 * Postgres counts them, or "Untitled". Derived on every save, so the two never disagree.
 */
export function songTitle(spec: MusicSpec): string {
  const cut = Array.from((spec.D10.title ?? "").trim()).slice(0, SONG_TITLE_MAX).join("").trim();
  return cut || "Untitled";
}

/** A song as the app holds it: the IR record plus the revision a save must match. */
export interface StoredSong {
  song: Song;
  revision: number;
}

/** One line of the song list: no spec, so the list stays small. */
export interface SongSummary {
  id: string;
  ownerId: string;
  title: string;
  revision: number;
  updatedAt: string;
  variantCount: number;
}

export function toSong(row: SongRow): StoredSong {
  return {
    song: {
      id: row.id,
      ownerId: row.owner_id,
      title: row.title,
      brand: row.brand,
      spec: row.spec,
      // The active target is a view of the spec (A5), so it is read from D10, not stored twice.
      activeTarget: row.spec.D10.activeTarget,
      // Song links to style profiles and tags are not stored yet (SPEC §3 S6).
      styleProfileIds: [],
      overrides: row.overrides,
      tags: [],
      ...(row.base_variant_id ? { baseVariantId: row.base_variant_id } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    revision: row.revision,
  };
}

export function toVariant(row: VariantRow): Variant {
  return {
    id: row.id,
    songId: row.song_id,
    label: row.label,
    ...(row.parent_variant_id ? { parentVariantId: row.parent_variant_id } : {}),
    specSnapshot: row.spec_snapshot,
    diff: row.diff,
    overrides: row.overrides,
    coverage: row.coverage,
    createdAt: row.created_at,
  };
}

export async function listSongs(client: LibraryClient): Promise<SongSummary[]> {
  const [songs, variants] = await Promise.all([
    client.from("songs").select("id, owner_id, title, revision, updated_at").order("updated_at", { ascending: false }),
    client.from("variants").select("song_id"),
  ]);
  const counts = new Map<string, number>();
  for (const v of check(variants, "songs: variants")) counts.set(v.song_id, (counts.get(v.song_id) ?? 0) + 1);
  return check(songs, "songs").map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    revision: row.revision,
    updatedAt: row.updated_at,
    variantCount: counts.get(row.id) ?? 0,
  }));
}

/** A song with its variants, oldest first. */
export async function loadSong(client: LibraryClient, id: string): Promise<StoredSong & { variants: Variant[] }> {
  const [song, variants] = await Promise.all([
    client.from("songs").select("*").eq("id", id).maybeSingle(),
    client.from("variants").select("*").eq("song_id", id).order("seq", { ascending: true }),
  ]);
  if (song.error) throw new LibraryError(`load song: ${song.error.message}`);
  if (!song.data) throw new LibraryError("load song: no such song for this account; it may have been deleted");
  return { ...toSong(song.data), variants: check(variants, "load song: variants").map(toVariant) };
}

/** Saves `spec` as a new song. The owner comes from the session (auth.uid()). */
export async function createSong(client: LibraryClient, spec: MusicSpec, overrides: readonly TargetOverride[] = []): Promise<StoredSong> {
  const row = check(await client.from("songs").insert({ title: songTitle(spec), spec: normalise(spec), overrides: [...overrides] }).select("*").single(), "save as new song");
  return toSong(row);
}

export interface WorkingCopy {
  songId: string;
  /** The revision this copy was read or last saved at. */
  revision: number;
  spec: MusicSpec;
  overrides: readonly TargetOverride[];
  baseVariantId: string | null;
}

/**
 * Saves the working copy over the song, only if the song is still at `copy.revision`.
 * Resolves to the new revision. Zero rows means another tab or device saved first, or the
 * song was deleted: that is a failure, never an overwrite.
 */
export async function saveSong(client: LibraryClient, copy: WorkingCopy): Promise<number> {
  const saved = check(
    await client
      .from("songs")
      .update({ title: songTitle(copy.spec), spec: normalise(copy.spec), overrides: [...copy.overrides], base_variant_id: copy.baseVariantId })
      .eq("id", copy.songId)
      .eq("revision", copy.revision)
      .select("revision"),
    "save song",
  );
  const [row] = saved;
  if (saved.length !== 1 || !row) throw new LibraryError("save song: the song changed elsewhere or was deleted; reload it before saving");
  return row.revision;
}

export interface Frozen {
  variantId: string;
  label: string;
  revision: number;
  ownerId: string;
}

/**
 * Freezes the working copy as the song's next variant. The parent is the copy's base
 * variant, and the diff is taken against that variant's snapshot. Refused while LN-1
 * blocks, because a frozen variant cannot be edited. Coverage is stamped with `now`.
 */
export async function freezeVariant(client: LibraryClient, copy: WorkingCopy, catalog: Catalog, now: () => Date = () => new Date()): Promise<Frozen> {
  const blocks = freezeBlockers(copy.spec, catalog);
  if (blocks.length) {
    throw new LibraryError(`freeze: remove the artist or producer name first (LN-1 at ${[...new Set(blocks.map((b) => b.path))].join(", ")}); a frozen variant cannot be edited`);
  }
  let parentSpec: MusicSpec | null = null;
  if (copy.baseVariantId) {
    const parent = await client.from("variants").select("spec_snapshot").eq("id", copy.baseVariantId).maybeSingle();
    if (parent.error) throw new LibraryError(`freeze: ${parent.error.message}`);
    if (!parent.data) throw new LibraryError("freeze: the variant this copy came from is gone; reload the song");
    parentSpec = parent.data.spec_snapshot;
  }
  const compiledAt = now().toISOString();
  const coverage = Object.fromEntries(Object.entries(variantCoverage(copy.spec, catalog)).map(([engine, report]) => [engine, { ...report, compiledAt }])) as Variant["coverage"];
  const frozen = check(
    await client
      .rpc("freeze_variant", {
        p_song_id: copy.songId,
        p_expected_revision: copy.revision,
        p_title: songTitle(copy.spec),
        p_spec: normalise(copy.spec),
        p_overrides: [...copy.overrides],
        // Sent as null, never left out: PostgREST matches functions by their argument names.
        p_parent_variant_id: copy.baseVariantId ?? null,
        p_diff: parentSpec ? diffSpecs(parentSpec, copy.spec) : [],
        p_coverage: coverage,
      })
      .single(),
    "freeze",
  );
  return { variantId: frozen.variant_id, label: frozen.variant_label, revision: frozen.song_revision, ownerId: frozen.owner };
}

/** Deletes one of the caller's songs and, with it, its variants. A delete of no row fails. */
export async function deleteSong(client: LibraryClient, id: string): Promise<void> {
  const deleted = check(await client.from("songs").delete().eq("id", id).select("id"), "delete song");
  if (deleted.length !== 1) throw new LibraryError("delete song: no such song for this account; reload the library");
}

/**
 * The coverage score of each engine a variant recorded, in the engines' build order (A3).
 * Postgres `jsonb` reorders object keys, so the stored order means nothing.
 */
export function coverageScores(variant: Pick<Variant, "coverage">): { engine: EngineId; score: number }[] {
  return ENGINE_IDS.flatMap((engine) => {
    const report = variant.coverage[engine];
    return report ? [{ engine, score: report.score }] : [];
  });
}

/** A JSON value as one short line, cut by code points, so a diff never runs off the page. */
export function shortValue(value: unknown, max = 120): string {
  const text = JSON.stringify(value) ?? "undefined";
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

/** One diff entry in words: added, removed, or before → after. */
export function describeChange(change: FieldDiff): string {
  if (!("before" in change)) return `added ${shortValue(change.after)}`;
  if (!("after" in change)) return `removed ${shortValue(change.before)}`;
  return `${shortValue(change.before)} → ${shortValue(change.after)}`;
}

/**
 * The composer attachment for opening a stored song, from `base` (a variant, for a fork) or
 * from the song's own working copy (`base` its base variant). The saved state is always the
 * song's working copy, so a variant opened over a different copy shows as unsaved.
 */
export function songAttachment(stored: StoredSong, variants: readonly Variant[], base: Variant | null): SongAttachment {
  return {
    songId: stored.song.id,
    ownerId: stored.song.ownerId,
    title: stored.song.title,
    revision: stored.revision,
    savedHash: specHash(stored.song.spec),
    baseVariantId: base?.id ?? null,
    baseLabel: base?.label ?? null,
    variantLabels: variants.map((v) => v.label),
  };
}
