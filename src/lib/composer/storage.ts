/**
 * The composer's working copy in this browser (docs/SPEC.md §1.5, §3 S3): the spec and its
 * undo history, under one localStorage key. The composer and the library both read it, so
 * the key and the parser live here, once. Storage can be unavailable (private mode,
 * blocked site data); every call here fails soft.
 */
import type { Step } from "@/core/musicspec/history";
import type { MusicSpec } from "@/core/musicspec/ir/types";

export const COMPOSER_KEY = "evawave:composer:v1";

/** The saved working copy, or null when `raw` is missing or not one. */
export function parseComposer(raw: string | null): Step<MusicSpec> | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as { spec?: { irVersion?: unknown }; history?: { nodes?: unknown; cursor?: unknown } };
  if (v.spec?.irVersion !== 1 || !Array.isArray(v.history?.nodes) || typeof v.history?.cursor !== "number") return null;
  return value as Step<MusicSpec>;
}

export function readComposer(): Step<MusicSpec> | null {
  try {
    return parseComposer(window.localStorage.getItem(COMPOSER_KEY));
  } catch {
    return null;
  }
}

/** Writes the working copy; a full or blocked store must not break editing. */
export function writeComposer(step: Step<MusicSpec>): void {
  try {
    window.localStorage.setItem(COMPOSER_KEY, JSON.stringify(step));
  } catch {
    // Persisting is a convenience; the composer keeps working without it.
  }
}
