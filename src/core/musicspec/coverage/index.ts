/**
 * Coverage reports (docs/SPEC.md §1, A5; §2.6). Every compile ships with a report of how
 * each piece of the IR reached the engine: `expressed` in a native place, `approximated`
 * through prose or an inline workaround, or `dropped`. Items are path-level, so the target
 * switcher can show exactly what a projection loses. The score is expressed / total.
 *
 * Blueprint-only content (`Section.notes`, `Section.harmony`, `TheoryProfile.harmony`) and
 * `references` are never sent to an engine by design, so they are not coverage items.
 */
import type { CoverageItem, CoverageReason, CoverageReport, CoverageState, Dimension, EngineId, EngineProfile, MusicSpec } from "../ir/types";

/** The IR primitives whose rendering differs by engine (the §2.6 contract table). */
export type Primitive =
  | "section"
  | "dynamics"
  | "pickup"
  | "contrast"
  | "silence"
  | "transition"
  | "block-rule"
  | "tempo"
  | "meter-lock"
  | "key"
  | "negative-space"
  | "title"
  | "lyrics"
  | "technique";

interface Rendering {
  state: CoverageState;
  reason?: CoverageReason;
  detail?: string;
}

const expressed: Rendering = { state: "expressed" };
const approx = (detail: string): Rendering => ({ state: "approximated", detail });
const dropped = (reason: CoverageReason, detail: string): Rendering => ({ state: "dropped", reason, detail });

const TECHNIQUE_GAP = dropped("no-field", "Techniques are not rendered by the v1 serializers; word them in a cue or phraseOverride.");

/** How each live engine's serializer renders each primitive. Udio is halted and has none. */
const RENDERING: Readonly<Record<Exclude<EngineId, "udio">, Readonly<Record<Primitive, Rendering>>>> = {
  suno: {
    section: expressed,
    dynamics: approx("No dynamics control; intensity comes from cue wording only."),
    pickup: expressed,
    contrast: expressed,
    silence: expressed,
    transition: expressed,
    "block-rule": expressed,
    tempo: approx("BPM in Style is guidance; set Manual BPM after render."),
    "meter-lock": approx("Prose in Style plus the meter-drift Exclude class; no meter tag."),
    key: approx("Key and mode as prose."),
    "negative-space": expressed,
    title: expressed,
    lyrics: expressed,
    technique: TECHNIQUE_GAP,
  },
  eleven: {
    section: expressed,
    dynamics: expressed,
    pickup: approx("Folded into the preceding chunk as an inline direction; chunks are 3 s minimum."),
    contrast: expressed,
    silence: approx("Inline {silence} direction at the chunk edge."),
    transition: approx("Inline direction at the chunk end."),
    "block-rule": expressed,
    tempo: expressed,
    "meter-lock": approx("Lock terms in the first chunk's styles; chunk durations carry the grid."),
    key: approx("Key and mode as a style term."),
    "negative-space": expressed,
    title: dropped("no-field", "ElevenLabs Music has no title field."),
    lyrics: approx("Passthrough lyrics are split across chunks by their section headers."),
    technique: TECHNIQUE_GAP,
  },
  flow: {
    section: approx("Structure travels in the Producer script; Lyrics structure tags are unverified."),
    dynamics: approx("Per-section dynamics only through the Producer script."),
    pickup: approx("Producer script line."),
    contrast: approx("Producer script line with its return."),
    silence: approx("Producer script line."),
    transition: approx("Producer script line."),
    "block-rule": expressed,
    tempo: expressed,
    "meter-lock": approx("Prose in Sound only; Flow has no meter lock."),
    key: approx("Key and mode as prose."),
    "negative-space": { state: "approximated", reason: "no-field", detail: "No exclude field; negatives are an inline sentence at the end of Sound." },
    title: expressed,
    lyrics: expressed,
    technique: TECHNIQUE_GAP,
  },
};

/** One IR path the report covers, with the primitive that decides its rendering. */
export interface CoverageTarget {
  path: string;
  dimension: Dimension;
  /** Absent for plain dimension content, which follows the profile's `supports`. */
  primitive?: Primitive;
}

/** The IR paths that carry content in this spec, in document order. */
export function coverageTargets(spec: MusicSpec): CoverageTarget[] {
  const out: CoverageTarget[] = [];
  const add = (path: string, dimension: Dimension, primitive?: Primitive) => out.push(primitive ? { path, dimension, primitive } : { path, dimension });

  if (spec.D1.formPhrase || spec.D1.stack.length) add("/D1", "D1");
  if (spec.D2.moods.length || spec.D2.imagery.length) add("/D2", "D2");
  spec.D3.techniques.forEach((_, i) => add(`/D3/techniques/${i}`, "D3", "technique"));
  if (spec.D4.traits.length) add("/D4", "D4");
  spec.D5.instruments.forEach((_, i) => add(`/D5/instruments/${i}`, "D5"));
  spec.D5.bundles.forEach((_, i) => add(`/D5/bundles/${i}`, "D5"));
  if (spec.D5.drums.patternIds.length || spec.D5.drums.proseOverride) add("/D5/drums", "D5");
  spec.D5.synthRoles.forEach((_, i) => add(`/D5/synthRoles/${i}`, "D5"));
  if (spec.D5.textures.length) add("/D5/textures", "D5");
  add("/D6/tempo", "D6", "tempo");
  if (spec.D6.meterLock.enabled) add("/D6/meterLock", "D6", "meter-lock");
  add("/D6/key", "D6", "key");
  spec.D7.sections.forEach((section, i) => {
    const base = `/D7/sections/${i}`;
    add(base, "D7", "section");
    add(`${base}/dynamics`, "D3", "dynamics");
    section.scope.techniqueIds.forEach((_, j) => add(`${base}/scope/techniqueIds/${j}`, "D3", "technique"));
    if (section.pickupBefore) add(`${base}/pickupBefore`, "D7", "pickup");
    if (section.contrast) add(`${base}/contrast`, "D7", "contrast");
    if (section.silenceAfter) add(`${base}/silenceAfter`, "D7", "silence");
    if (section.transitionOut.kind !== "none") add(`${base}/transitionOut`, "D7", section.transitionOut.kind === "silence" ? "silence" : "transition");
  });
  if (spec.D7.blockRule) add("/D7/blockRule", "D7", "block-rule");
  add("/D8/instrumental", "D8");
  if (spec.D8.lyricsPassthrough) add("/D8/lyricsPassthrough", "D8", "lyrics");
  if (spec.D9.character.length) add("/D9/character", "D9");
  spec.D9.techniqueIds.forEach((_, i) => add(`/D9/techniqueIds/${i}`, "D9", "technique"));
  if (spec.D10.negativeSpace.length || spec.D6.meterLock.enabled) add("/D10/negativeSpace", "D10", "negative-space");
  if (spec.D10.title) add("/D10/title", "D10", "title");
  return out;
}

function renderingFor(target: CoverageTarget, profile: EngineProfile): Rendering {
  const support = profile.supports[target.dimension];
  if (support === "none") return dropped("unsupported-dimension", `${profile.displayName} does not support ${target.dimension}.`);
  if (target.primitive && profile.id !== "udio") return RENDERING[profile.id][target.primitive];
  if (support === "approximate") return approx(profile.supportsNotes?.[target.dimension] ?? "Prose only.");
  return expressed;
}

/**
 * The coverage report for `profile`. `overrides` replaces the rendering at specific paths
 * (an alias substitution, lyrics that could not be placed), keyed by path.
 */
export function coverageReport(spec: MusicSpec, profile: EngineProfile, overrides: Readonly<Record<string, Rendering>> = {}): CoverageReport {
  const items: CoverageItem[] = coverageTargets(spec).map((target) => {
    const rendering = overrides[target.path] ?? renderingFor(target, profile);
    return { path: target.path, dimension: target.dimension, ...rendering };
  });
  const expressedCount = items.filter((item) => item.state === "expressed").length;
  return { engine: profile.id, items, score: items.length ? expressedCount / items.length : 1 };
}

/** An alias replaced the record's own wording (docs/SPEC.md §2.4). */
export const ALIAS_SUBSTITUTED: Rendering = { state: "approximated", reason: "alias-substituted", detail: "Engine alias used in place of the record's phrase." };

export type { Rendering };
