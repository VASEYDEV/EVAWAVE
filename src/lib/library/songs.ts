/**
 * Songs and variants (docs/SPEC.md §1.6, §3 S6). Every call runs as the signed-in user, so
 * row level security decides what is visible. A song is saved only at the revision it was
 * read at: a stale tab gets a `LibraryError`, never a silent overwrite. Variants are
 * frozen through `public.freeze_variant`, which saves the working copy and snapshots it in
 * one transaction; they are never updated or deleted, except with their song. A variant's
 * diff and coverage are derived from the snapshots when it is read, never stored.
 */
import { ENGINE_IDS } from "@/core/musicspec/engines";
import type { Catalog, DriftKind, EngineId, FieldDiff, MusicSpec, Song, Take, Variant } from "@/core/musicspec/ir/types";
import { diffSpecs, freezeBlockers, normalise, variantCoverage } from "@/core/musicspec/variants";
import { workingHash, type SongOpening } from "@/lib/composer/storage";

import { check, LibraryError, type LibraryClient } from "./repository";
import type { SongRow, TakeRow, VariantRow } from "./schema";

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

/**
 * Rows asked for per request. PostgREST cuts every response at its `max-rows` setting
 * (1,000 on Supabase unless changed) without an error, so one request can return the first
 * page of a long history and look complete.
 */
const PAGE_ROWS = 1000;

/** Variant ids per `in.(…)` filter: 100 UUIDs keep a request's URL near 4 KB. */
const IDS_PER_REQUEST = 100;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null; count: number | null }>;

/**
 * Every row a query matches, a page at a time, until the exact count is reached or a page
 * comes back empty. It moves on by the rows the server actually returned, so a `max-rows`
 * below `PAGE_ROWS` still reads everything. `page(from, to)` must ask for
 * `count: "exact"` and order by a unique, stable key, or rows could repeat or go missing
 * between pages.
 */
async function allRows<T>(what: string, page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const result = await page(rows.length, rows.length + PAGE_ROWS - 1);
    const batch = check(result, what);
    rows.push(...batch);
    if (!batch.length || (result.count !== null && rows.length >= result.count)) return rows;
  }
}

/** Newest first by `created_at`, then by id, so equal times keep one order. */
function newestFirst(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  return Date.parse(b.created_at) - Date.parse(a.created_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
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

/**
 * A stored variant as the IR's `Variant`, with what the database does not store derived
 * from the snapshots (SPEC §2.4): the field diff from `parent` (its parent's snapshot) and
 * the coverage the current compiler gives its snapshot. A stored copy of either could only
 * be what the client sent.
 */
export function toVariant(row: VariantRow, parent: MusicSpec | null, catalog: Catalog): Variant {
  return {
    id: row.id,
    songId: row.song_id,
    label: row.label,
    ...(row.parent_variant_id ? { parentVariantId: row.parent_variant_id } : {}),
    specSnapshot: row.spec_snapshot,
    diff: parent ? diffSpecs(parent, row.spec_snapshot) : [],
    overrides: row.overrides,
    coverage: variantCoverage(row.spec_snapshot, catalog),
    createdAt: row.created_at,
  };
}

/** The caller's songs, most recently saved first, each with its variant count. */
export async function listSongs(client: LibraryClient): Promise<SongSummary[]> {
  // Paged by id, which a save never changes, and sorted here by when each was saved.
  const [songs, variants] = await Promise.all([
    allRows("songs", (from, to) => client.from("songs").select("id, owner_id, title, revision, updated_at", { count: "exact" }).order("id").range(from, to)),
    allRows("songs: variants", (from, to) => client.from("variants").select("song_id", { count: "exact" }).order("id").range(from, to)),
  ]);
  const counts = new Map<string, number>();
  for (const v of variants) counts.set(v.song_id, (counts.get(v.song_id) ?? 0) + 1);
  return songs.sort((a, b) => newestFirst({ created_at: a.updated_at, id: a.id }, { created_at: b.updated_at, id: b.id })).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    revision: row.revision,
    updatedAt: row.updated_at,
    variantCount: counts.get(row.id) ?? 0,
  }));
}

export function toTake(row: TakeRow): Take {
  return {
    id: row.id,
    variantId: row.variant_id,
    engine: row.engine,
    engineVersion: row.engine_version,
    ...(row.render_ref ? { renderRef: row.render_ref } : {}),
    verdict: row.verdict,
    drifted: row.drifted,
    wordsBlamed: row.words_blamed,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** Lets the browser paint and take input before more work runs on the main thread. */
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * A song with its variants, oldest first, and their takes, newest first. Each variant's
 * diff is taken against its parent's snapshot, which is always among the song's own.
 * Deriving costs a few milliseconds a variant (three compiles and a diff), which a slow
 * phone multiplies, so the work yields every 16 ms: a long history never holds the main
 * thread in one task.
 */
export async function loadSong(client: LibraryClient, id: string, catalog: Catalog): Promise<StoredSong & { variants: Variant[]; takes: Take[] }> {
  // The song first, then every variant, however long the history. Variants only ever
  // arrive (they leave only with their song), so whatever base the song names is among
  // those read after it; read at the same time, a freeze landing between the two reads
  // could name a base the variant list does not hold, and a save from that copy would
  // clear it.
  const song = await client.from("songs").select("*").eq("id", id).maybeSingle();
  if (song.error) throw new LibraryError(`load song: ${song.error.message}`);
  if (!song.data) throw new LibraryError("load song: no such song for this account; it may have been deleted");
  const rows = await allRows("load song: variants", (from, to) => client.from("variants").select("*", { count: "exact" }).eq("song_id", id).order("seq", { ascending: true }).range(from, to));
  const baseId = song.data.base_variant_id;
  if (baseId && !rows.some((row) => row.id === baseId)) throw new LibraryError("load song: the song changed while it loaded; reload it");
  const snapshots = new Map(rows.map((row) => [row.id, row.spec_snapshot]));
  const loaded: Variant[] = [];
  let slice = performance.now();
  for (const row of rows) {
    loaded.push(toVariant(row, row.parent_variant_id ? (snapshots.get(row.parent_variant_id) ?? null) : null, catalog));
    if (performance.now() - slice > 16) {
      await yieldToMain();
      slice = performance.now();
    }
  }
  // Takes for a few variants at a time, so the id list never makes the URL too long for a
  // proxy; each batch paged by id, then all sorted newest first here.
  const batches: string[][] = [];
  for (let i = 0; i < loaded.length; i += IDS_PER_REQUEST) batches.push(loaded.slice(i, i + IDS_PER_REQUEST).map((v) => v.id));
  const takeRows = await Promise.all(
    batches.map((ids) => allRows("load song: takes", (from, to) => client.from("takes").select("*", { count: "exact" }).in("variant_id", ids).order("id").range(from, to))),
  );
  const takes = takeRows.flat().sort(newestFirst).map(toTake);
  return { ...toSong(song.data), variants: loaded, takes };
}

/** Saves `spec` as a new song. The owner comes from the session (auth.uid()). */
export async function createSong(client: LibraryClient, spec: MusicSpec): Promise<StoredSong> {
  const row = check(await client.from("songs").insert({ title: songTitle(spec), spec: normalise(spec) }).select("*").single(), "save as new song");
  return toSong(row);
}

/**
 * What a save or freeze sends. Target overrides are not part of it: nothing edits them yet
 * (SPEC §1.4), so the database does not let the client write them, and a freeze copies the
 * song's own.
 */
export interface WorkingCopy {
  songId: string;
  /** The revision this copy was read or last saved at. */
  revision: number;
  spec: MusicSpec;
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
      .update({ title: songTitle(copy.spec), spec: normalise(copy.spec), base_variant_id: copy.baseVariantId })
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
 * Freezes the working copy as the song's next variant, with the copy's base variant as its
 * parent. Refused while LN-1 blocks, because a frozen variant cannot be edited. Only the
 * spec and the parent are sent: the variant takes the song's stored overrides, and its diff
 * and coverage are derived when it is read.
 */
export async function freezeVariant(client: LibraryClient, copy: WorkingCopy, catalog: Catalog): Promise<Frozen> {
  const blocks = freezeBlockers(copy.spec, catalog);
  if (blocks.length) {
    throw new LibraryError(`freeze: remove the artist or producer name first (LN-1 at ${[...new Set(blocks.map((b) => b.path))].join(", ")}); a frozen variant cannot be edited`);
  }
  const frozen = check(
    await client
      .rpc("freeze_variant", {
        p_song_id: copy.songId,
        p_expected_revision: copy.revision,
        p_title: songTitle(copy.spec),
        p_spec: normalise(copy.spec),
        // Sent as null, never left out: PostgREST matches functions by their argument names.
        p_parent_variant_id: copy.baseVariantId ?? null,
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

/** The coverage score of each engine with a report for a variant, in the engines' build order (A3). */
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
 * song's working copy, spec and base together, so a variant opened over a different copy
 * shows as unsaved, even when its snapshot equals the song's spec.
 */
export function songAttachment(stored: StoredSong, variants: readonly Variant[], base: Variant | null): SongOpening {
  return {
    songId: stored.song.id,
    ownerId: stored.song.ownerId,
    title: stored.song.title,
    revision: stored.revision,
    savedHash: workingHash(stored.song.spec, stored.song.baseVariantId ?? null),
    baseVariantId: base?.id ?? null,
    baseLabel: base?.label ?? null,
    variantLabels: variants.map((v) => v.label),
  };
}

/** The kinds of drift a take can record, in the order the take form lists them. */
export const DRIFT_KINDS: readonly DriftKind[] = ["meter", "tempo", "key", "vocals-appeared", "section-skipped", "instrument-misread", "genre-bleed", "length", "other"];

/** The take log's limits (the checks in the takes migration). */
export const TAKE_LIMITS = { engineVersion: 80, renderRef: 2048, words: 50, notes: 4000 } as const;

/**
 * Text as a field may hold it while it is typed: cut to `max` code points, the unit Postgres
 * counts, and otherwise untouched. A native `maxLength` counts UTF-16 code units, which
 * halves the limit for emoji and refuses text the database accepts.
 */
export function clampText(text: string, max: number): string {
  const points = Array.from(text);
  return points.length > max ? points.slice(0, max).join("") : text;
}

/** The words blamed for a drift, from a comma-separated field: trimmed, empties dropped, each once. */
export function wordsBlamed(text: string): string[] {
  return [...new Set(text.split(",").map((w) => w.trim()).filter(Boolean))];
}

/**
 * A render reference as a link the page may follow: only `https:` URLs. Anything else (an
 * engine-side id, or a scheme the page should not open) is shown as text.
 */
export function renderLink(ref: string | undefined): string | null {
  if (!ref) return null;
  try {
    const url = new URL(ref);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export interface TakeInput {
  variantId: string;
  engine: Take["engine"];
  engineVersion: string;
  renderRef: string;
  verdict: Take["verdict"];
  drifted: readonly DriftKind[];
  wordsBlamed: readonly string[];
  notes: string;
}

/**
 * Logs a take on one of the caller's variants. The render reference is an engine-side id or
 * link, never the audio (A6): a `data:` URL is refused here, as the database refuses it.
 */
export async function logTake(client: LibraryClient, input: TakeInput): Promise<Take> {
  const renderRef = input.renderRef.trim();
  if (/^\s*data:/i.test(renderRef)) throw new LibraryError("log take: a render reference is a link or an id from the engine, never the audio itself");
  const engineVersion = input.engineVersion.trim();
  if (!engineVersion) throw new LibraryError("log take: say which engine version rendered it");
  if (input.wordsBlamed.length > TAKE_LIMITS.words) throw new LibraryError(`log take: blame at most ${TAKE_LIMITS.words} words`);
  if (Array.from(input.wordsBlamed.join("")).length > TAKE_LIMITS.notes) throw new LibraryError(`log take: the words blamed run past ${TAKE_LIMITS.notes} characters`);
  const row = check(
    await client
      .from("takes")
      .insert({
        variant_id: input.variantId,
        engine: input.engine,
        engine_version: engineVersion,
        render_ref: renderRef || null,
        verdict: input.verdict,
        drifted: [...new Set(input.drifted)],
        words_blamed: [...input.wordsBlamed],
        notes: input.notes.trim(),
      })
      .select("*")
      .single(),
    "log take",
  );
  return toTake(row);
}

/** Deletes one of the caller's takes; a delete that removes no row fails. */
export async function deleteTake(client: LibraryClient, id: string): Promise<void> {
  const deleted = check(await client.from("takes").delete().eq("id", id).select("id"), "delete take");
  if (deleted.length !== 1) throw new LibraryError("delete take: no such take for this account; reload the song");
}

