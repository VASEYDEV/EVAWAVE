/**
 * The composer's working copy in this browser (docs/SPEC.md §1.5, §3 S3, S6): the spec, its
 * undo history, and the song it is attached to, if any, under one localStorage key and
 * written in one `setItem`, so a spec can never sit beside another song's attachment. The
 * composer and the library both read it, so the key and the parser live here, once.
 * Storage can be unavailable (private mode, blocked site data); every call here fails soft.
 */
import { emptyHistory, type Step } from "@/core/musicspec/history";
import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import type { MusicSpec } from "@/core/musicspec/ir/types";
import { specHash } from "@/core/musicspec/variants";

export const COMPOSER_KEY = "evawave:composer:v1";

/** Which library song the working copy belongs to, and the state it was last saved at. */
export interface SongAttachment {
  /**
   * This copy's own id: new each time a song or variant is opened (or a copy is saved as a
   * new song), kept through edits. Two openings of the same song, base and revision are
   * still two copies, and a save or freeze attaches its result only to the one it began on.
   */
  copyId: string;
  songId: string;
  /** The account the song belongs to; another account may only save a copy as a new song. */
  ownerId: string;
  title: string;
  /** The song's revision when this copy was read or saved; a save must match it. */
  revision: number;
  /** `workingHash` of the copy as last saved, spec and base variant, to tell saved from unsaved. */
  savedHash: string;
  /** The variant this copy descends from: the parent of the next freeze. */
  baseVariantId: string | null;
  baseLabel: string | null;
  /** The song's variant labels, for the next label's preview. */
  variantLabels: string[];
}

export interface SavedComposer extends Step<MusicSpec> {
  song?: SongAttachment;
}

function isAttachment(value: unknown): value is SongAttachment {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const text = (key: string) => typeof v[key] === "string";
  const textOrNull = (key: string) => v[key] === null || typeof v[key] === "string";
  return (
    text("copyId") &&
    text("songId") &&
    text("ownerId") &&
    text("title") &&
    text("savedHash") &&
    Number.isInteger(v.revision) &&
    textOrNull("baseVariantId") &&
    textOrNull("baseLabel") &&
    Array.isArray(v.variantLabels) &&
    v.variantLabels.every((label) => typeof label === "string")
  );
}

/**
 * The saved working copy, or null when `raw` is missing or not one. A value written before
 * songs existed has no attachment and loads as it did; a malformed attachment is dropped,
 * never trusted.
 */
export function parseComposer(raw: string | null): SavedComposer | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as { spec?: { irVersion?: unknown }; history?: { nodes?: unknown; cursor?: unknown }; song?: unknown };
  if (v.spec?.irVersion !== 1 || !Array.isArray(v.history?.nodes) || typeof v.history?.cursor !== "number") return null;
  const { song, ...step } = value as SavedComposer;
  return isAttachment(song) ? { ...step, song } : step;
}

export function readComposer(): SavedComposer | null {
  try {
    return parseComposer(window.localStorage.getItem(COMPOSER_KEY));
  } catch {
    return null;
  }
}

/**
 * Writes the working copy and its attachment together, and says whether the browser kept
 * it. A full or blocked store must not break editing, so it never throws; a caller whose
 * only way to hand the copy over is this write (opening a song) checks the result.
 */
export function writeComposer(saved: SavedComposer): boolean {
  try {
    window.localStorage.setItem(COMPOSER_KEY, JSON.stringify(saved));
    return true;
  } catch {
    // Persisting is a convenience while editing; the composer keeps working without it.
    return false;
  }
}

/**
 * A working copy as a song saves it: its spec and the variant it descends from. The base
 * counts, because it is the next freeze's parent and a save stores it: a variant opened
 * over a song whose spec it equals is still a different copy.
 */
export function workingHash(spec: MusicSpec, baseVariantId: string | null): string {
  return `${specHash(spec)}:${baseVariantId ?? ""}`;
}

/**
 * True when replacing this working copy would lose work: an attached copy that differs from
 * its last save, in its spec or its base variant, or an unattached copy that differs from a
 * fresh spec.
 */
export function hasUnsavedWork(saved: SavedComposer | null): boolean {
  if (!saved) return false;
  if (saved.song) return workingHash(saved.spec, saved.song.baseVariantId) !== saved.song.savedHash;
  return specHash(saved.spec) !== specHash(defaultMusicSpec());
}

/** Which copy of which song an action started from: the copy, its song, base variant and revision. */
export type AttachmentIdentity = Pick<SongAttachment, "copyId" | "songId" | "baseVariantId" | "revision">;

export function identityOf(song: SongAttachment | undefined): AttachmentIdentity | null {
  return song ? { copyId: song.copyId, songId: song.songId, baseVariantId: song.baseVariantId, revision: song.revision } : null;
}

/**
 * True when the working copy is still the one an action started from: the same copy,
 * attached to the same song, base variant and revision, or still unattached. A save or
 * freeze that finishes after another tab opened something else, even another opening of
 * the same song at the same base and revision, must not attach its result to that copy,
 * or the next save or freeze would follow the wrong lineage.
 */
export function stillCurrent(current: SongAttachment | undefined, from: AttachmentIdentity | null): boolean {
  if (!from) return !current;
  return !!current && current.copyId === from.copyId && current.songId === from.songId && current.baseVariantId === from.baseVariantId && current.revision === from.revision;
}

/** A new copy id (see `SongAttachment.copyId`). */
export function newCopyId(): string {
  return crypto.randomUUID();
}

/** An attachment for a song being opened, before it is given its copy's id. */
export type SongOpening = Omit<SongAttachment, "copyId">;

/** The working copy for `spec` opened from a song: a fresh undo history, and a new copy. */
export function openedCopy(spec: MusicSpec, song: SongOpening): SavedComposer {
  return { history: emptyHistory(), spec, song: { ...song, copyId: newCopyId() } };
}
