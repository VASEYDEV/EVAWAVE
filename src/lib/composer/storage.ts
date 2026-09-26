/**
 * The composer's working copy in this browser (docs/SPEC.md §1.5, §3 S3, S6): the spec, its
 * undo history, and the song it is attached to, if any, under one localStorage key and
 * written in one `setItem`, so a spec can never sit beside another song's attachment. The
 * composer and the library both read it, so the key and the parser live here, once.
 * Storage can be unavailable (private mode, blocked site data); every call here fails soft.
 */
import { emptyHistory, type Step } from "@/core/musicspec/history";
import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import type { MusicSpec, TargetOverride } from "@/core/musicspec/ir/types";
import { specHash } from "@/core/musicspec/variants";

export const COMPOSER_KEY = "evawave:composer:v1";

/** Which library song the working copy belongs to, and the state it was last saved at. */
export interface SongAttachment {
  songId: string;
  /** The account the song belongs to; another account may only save a copy as a new song. */
  ownerId: string;
  title: string;
  /** The song's revision when this copy was read or saved; a save must match it. */
  revision: number;
  /** `specHash` of the spec as last saved, to tell saved from unsaved. */
  savedHash: string;
  /** The variant this copy descends from: the parent of the next freeze. */
  baseVariantId: string | null;
  baseLabel: string | null;
  /** The song's variant labels, for the next label's preview. */
  variantLabels: string[];
  /**
   * The target overrides that belong to this copy (the song's, or the opened variant's).
   * Nothing edits them yet (SPEC §1.4), but a save or freeze must carry them, never drop them.
   */
  overrides: TargetOverride[];
}

export interface SavedComposer extends Step<MusicSpec> {
  song?: SongAttachment;
}

function isAttachment(value: unknown): value is SongAttachment {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.overrides)) return false;
  const text = (key: string) => typeof v[key] === "string";
  const textOrNull = (key: string) => v[key] === null || typeof v[key] === "string";
  return (
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

/** Writes the working copy and its attachment together; a full or blocked store must not break editing. */
export function writeComposer(saved: SavedComposer): void {
  try {
    window.localStorage.setItem(COMPOSER_KEY, JSON.stringify(saved));
  } catch {
    // Persisting is a convenience; the composer keeps working without it.
  }
}

/**
 * True when replacing this working copy would lose work: an attached copy that differs from
 * its last save, or an unattached copy that differs from a fresh spec.
 */
export function hasUnsavedWork(saved: SavedComposer | null): boolean {
  if (!saved) return false;
  const hash = specHash(saved.spec);
  return saved.song ? hash !== saved.song.savedHash : hash !== specHash(defaultMusicSpec());
}

/** The working copy for `spec` opened from a song: a fresh undo history and its attachment. */
export function openedCopy(spec: MusicSpec, song: SongAttachment): SavedComposer {
  return { history: emptyHistory(), spec, song };
}
