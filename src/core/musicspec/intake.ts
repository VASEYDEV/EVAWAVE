/**
 * Intake patches (docs/SPEC.md §1.7 steps 4–5, §2.4). Intake never writes prose payloads;
 * it proposes an `IRPatch`, a person accepts or rejects each op in a diff, and only the
 * accepted ops apply. `draftFromAudio` is the deterministic features → patch mapping for
 * audio import: traits, never identity.
 */
import { defaultMusicSpec } from "./ir/defaults";
import type { AudioFeatures, IRPatch, PatchOp, PitchClass, StyleProfile } from "./ir/types";
import { scrubDeep, scrubNames } from "./lineage";
import { applyOps, parsePointer } from "./patch";
import { hash53 } from "./text";

/** Identifies the mapping below in `IRPatch.model`, so a patch says what drafted it. */
export const AUDIO_DRAFT_MODEL = "evawave-audio-draft-v1";

/** PT-2: intake may never edit these top-level keys. */
export const PROTECTED_ROOTS: ReadonlySet<string> = new Set(["references", "patches"]);

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function op(path: string, value: unknown, confidence: number, rationale: string, kind: PatchOp["op"] = "set"): PatchOp {
  return { op: kind, path, value, confidence: round(Math.max(0, Math.min(1, confidence)), 2), rationale };
}

/** Mood words from measured traits. Low confidence by design: they are suggestions (PT-1). */
function moodWords(features: AudioFeatures): string[] {
  const words: string[] = [];
  const energy = features.energyCurve.length ? features.energyCurve.reduce((a, b) => a + b, 0) / features.energyCurve.length : 0;
  if (features.spectral.brightness < 0.15) words.push("dark");
  else if (features.spectral.brightness > 0.4) words.push("bright");
  if (features.key.mode === "minor" && features.key.confidence > 0) words.push("brooding");
  if (energy > 0.6 && features.spectral.transientDensity > 2) words.push("driving");
  else if (energy < 0.35) words.push("restrained");
  return words;
}

export interface DraftMeta {
  /** When the analysis ran; the core never reads the clock. */
  createdAt: string;
  /** The ReferenceAsset the features came from (its sha256 before it has an id). */
  sourceRef: string;
}

/**
 * Proposes StyleProfile fields from audio features. Every op targets a path in the profile
 * spec that `audioProfileBase()` already holds, so accepting any subset is valid.
 */
export function draftFromAudio(features: AudioFeatures, meta: DraftMeta, lineageNames: readonly string[] = []): IRPatch {
  const ops: PatchOp[] = [];
  const { bpm, meter, key, loudness, spectral } = features;
  if (bpm.value > 0) {
    ops.push(
      op("/D6/tempo", { bpm: Math.round(bpm.value), source: "analysis" }, bpm.confidence, `Onset autocorrelation measures ${round(bpm.value)} BPM (half-time ${round(bpm.halfTimeCandidate)}, double-time ${round(bpm.doubleTimeCandidate)}).`, "merge"),
    );
  }
  if (meter.signature !== "unknown") {
    ops.push(op("/D6/meterLock/signature", meter.signature, meter.confidence, `Accent periodicity suggests ${meter.signature}.`));
  }
  if (key.confidence > 0) {
    ops.push(
      op("/D6/key", { tonic: key.tonic as PitchClass, modeId: key.mode === "minor" ? "aeolian" : "ionian" }, key.confidence, `Chroma correlates best with ${key.tonic} ${key.mode}.`, "merge"),
    );
  }
  const moods = moodWords(features);
  if (moods.length) {
    ops.push(op("/D2/moods", moods.map((value) => ({ value, weight: 1 })), 0.4, "Mood words from brightness, energy and mode; suggestions only."));
  }
  const character = [`integrated loudness ${round(loudness.integratedLufs)} LUFS, loudness range ${round(loudness.loudnessRange)} LU`];
  if (spectral.subWeight > 0.3) character.push("sub-heavy low end");
  if (spectral.transientDensity > 4) character.push("dense transients");
  ops.push(op("/D9/character", character, 0.8, "Measured loudness and spectrum."));

  // Rule 4 (.claude/rules/musicspec-core.md): the lineage pass runs on every intake value.
  const scrub = (text: string) => scrubNames(text, lineageNames);
  const scrubbed = ops.map((o) => ({ ...o, value: scrubDeep(o.value, scrub), rationale: scrub(o.rationale) }));
  return {
    id: `audio-${hash53(`${meta.sourceRef}|${meta.createdAt}`)}`,
    source: "audio-analysis",
    createdAt: meta.createdAt,
    model: AUDIO_DRAFT_MODEL,
    ops: scrubbed,
    status: "proposed",
    acceptedPaths: [],
    rejectedPaths: [],
  };
}

/** The spec an audio-analysis profile starts from: the default D1–D6, D8 and D9. */
export function audioProfileBase(): StyleProfile["spec"] {
  const d = defaultMusicSpec();
  return { D1: d.D1, D2: d.D2, D3: d.D3, D4: d.D4, D5: d.D5, D6: d.D6, D8: d.D8, D9: d.D9 };
}

/** Records the person's decision per op path; undecided ops count as rejected. */
export function reviewPatch(patch: IRPatch, accepted: ReadonlySet<string>): IRPatch {
  const paths = patch.ops.map((o) => o.path);
  const acceptedPaths = paths.filter((p) => accepted.has(p));
  const rejectedPaths = paths.filter((p) => !accepted.has(p));
  const status = acceptedPaths.length === 0 ? "rejected" : rejectedPaths.length === 0 ? "accepted" : "partial";
  return { ...patch, status, acceptedPaths, rejectedPaths };
}

export interface AppliedPatch<T> {
  doc: T;
  applied: PatchOp[];
  /** Ops that were accepted but refused: protected paths (PT-2). */
  refused: PatchOp[];
}

/**
 * Applies only the accepted ops of a reviewed patch. A proposed or rejected patch changes
 * nothing (§2.4), and an op on a protected root is refused even when accepted (PT-2).
 */
export function applyReviewedPatch<T>(doc: T, patch: IRPatch): AppliedPatch<T> {
  if (patch.status === "proposed" || patch.status === "rejected") return { doc, applied: [], refused: [] };
  const accepted = new Set(patch.acceptedPaths);
  const chosen = patch.ops.filter((o) => accepted.has(o.path));
  const refused = chosen.filter((o) => PROTECTED_ROOTS.has(parsePointer(o.path)[0] ?? ""));
  const applied = chosen.filter((o) => !refused.includes(o));
  return { doc: applyOps(doc, applied).doc, applied, refused };
}
