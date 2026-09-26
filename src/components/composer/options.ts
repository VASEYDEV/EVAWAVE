/**
 * Option lists for the composer's pickers: IR enums (docs/SPEC.md §2.2) and catalog records.
 */
import type { Catalog, EngineId, Reliability } from "@/core/musicspec/ir/types";

import type { Option } from "./fields";

const plain = (values: readonly string[]): Option[] => values.map((value) => ({ value, label: value }));

export const SECTION_KINDS = plain(["intro", "build", "hook", "verse", "pre", "bridge", "break", "drop", "finale", "outro", "custom"]);
export const DYNAMICS = plain(["pp", "p", "mp", "mf", "f", "ff"]);
export const SIGNATURES = plain(["4/4", "3/4", "6/8", "12/8", "5/4", "7/8"]);
export const FEELS = plain(["straight", "half-time", "double-time", "swung", "shuffled"]);
export const SUBDIVISIONS: Option[] = [8, 16, 32].map((n) => ({ value: String(n), label: `${n}ths` }));
export const RESTATEMENTS: Option[] = [
  { value: "style-only", label: "Style field only" },
  { value: "style-and-sections", label: "Style field and every section" },
];
export const EXTENSIONS = ["pickup-bar", "silence-drop", "contrast-phrase"] as const;
export const TRANSITION_KINDS = plain(["none", "riser", "filter-sweep-open", "filter-sweep-close", "reverse-cymbal", "snare-roll", "timpani-roll", "choir-swell", "sub-drop", "hard-stop", "silence", "crossfade"]);
export const CUE_SLOTS = plain(["drums", "bass", "groove", "percussion", "lead", "synth", "texture", "harmony", "fx", "mood", "pocket", "contrast"]);
export const PITCH_CLASSES = plain(["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]);
export const NEGATIVE_CLASSES = plain(["vocals", "meter-drift", "genre-bleed", "instrument-ambiguity", "custom"]);
export const GENRE_ROLES = plain(["core", "regional", "contrast", "finale", "influence"]);
export const POCKET_KINDS = plain(["none", "rap", "sung"]);
export const BEATS: Option[] = [1, 2, 3].map((n) => ({ value: String(n), label: `${n} beat${n === 1 ? "" : "s"}` }));
export const POSITIONS: Option[] = [
  { value: "start", label: "Start" },
  { value: "end", label: "End" },
];
export const ENGINES: { id: EngineId; label: string }[] = [
  { id: "suno", label: "Suno" },
  { id: "eleven", label: "ElevenLabs Music" },
  { id: "flow", label: "Google Flow Music" },
  { id: "udio", label: "Udio" },
];

const WEAK: ReadonlySet<Reliability> = new Set(["approximate", "unreliable"]);

export function instrumentOptions(catalog: Catalog): Option[] {
  return Object.values(catalog.instruments).map((i) => ({ value: i.id, label: i.name }));
}

export function synthRoleOptions(catalog: Catalog): Option[] {
  return Object.values(catalog.synthRoles).map((r) => ({ value: r.id, label: r.name }));
}

export function rhythmOptions(catalog: Catalog): Option[] {
  return Object.values(catalog.rhythms).map((r) => ({ value: r.id, label: `${r.name} (${r.meter})` }));
}

export function techniqueOptions(catalog: Catalog): Option[] {
  return Object.values(catalog.techniques).map((t) => ({ value: t.id, label: t.name }));
}

/** Modes, flagged when the active engine renders them only approximately (§1.5, module 2). */
export function modeOptions(catalog: Catalog, engine: EngineId): Option[] {
  return Object.values(catalog.modes).map((m) => {
    const level = m.reliability[engine];
    return { value: m.id, label: level && WEAK.has(level) ? `${m.name} (${level} on ${engine})` : m.name };
  });
}

export function genreOptions(catalog: Catalog): Option[] {
  return Object.values(catalog.genres).map((g) => ({ value: g.id, label: g.name }));
}

export function drumPatternOptions(catalog: Catalog): Option[] {
  return Object.values(catalog.drumPatterns).map((p) => ({ value: p.id, label: p.name }));
}

export function bundleOptions(catalog: Catalog): Option[] {
  return Object.values(catalog.bundles).map((b) => ({ value: b.id, label: b.name }));
}

/** Contrast styles: genres and drum patterns (ContrastPhrase.styleId). */
export function contrastStyleOptions(catalog: Catalog): Option[] {
  return [...drumPatternOptions(catalog), ...genreOptions(catalog)];
}

/** Every record a cue may voice (SectionCue.ref). */
export function cueRefOptions(catalog: Catalog): Option[] {
  return [...instrumentOptions(catalog), ...synthRoleOptions(catalog), ...rhythmOptions(catalog), ...techniqueOptions(catalog)];
}
