import { z } from "zod";

import {
  BEATS,
  BLOCK_SIZES,
  DROP_POSITIONS,
  DYNAMIC_MARKS,
  ENGINE_IDS,
  FEELS,
  METER_EXTENSIONS,
  NEGATIVE_CLASSES,
  PATCH_OPS,
  PATCH_SOURCES,
  PATCH_STATUSES,
  POCKET_KINDS,
  PROVENANCE_KINDS,
  REFERENCE_KINDS,
  REFERENCE_ROLES,
  RESTATEMENTS,
  SECTION_KINDS,
  SIGNATURES,
  SUBDIVISIONS,
  TEMPO_SOURCES,
  TRANSITION_KINDS,
  type BarMath,
  type BundleUse,
  type ContrastPhrase,
  type CrossBundle,
  type InstrumentationDelta,
  type IRPatch,
  type MeterLock,
  type NegativeSpace,
  type OpenPocket,
  type OutputIntentDelta,
  type PatchOp,
  type PickupBar,
  type Provenance,
  type Reference,
  type Section,
  type SectionCap,
  type SectionScope,
  type SectionStart,
  type SilenceDrop,
  type Structure,
  type SynthRolePosition,
  type SynthRoleUse,
  type Tempo,
  type Transition,
  type VocalsDelta,
} from "./types";

/**
 * Runtime schemas for the IR v0.3 delta types, one per interface in `types.ts`.
 *
 * A schema checks shape and the primitive ranges the type comments state (integer BPM, a
 * pickup of 1–3 beats, weights in 0–1, a JSON-pointer patch path). Semantic rules such as an
 * empty `returnRule` (CP-1) or a swung feel under the lock (ML-3) belong to the linter, so a
 * spec that is still being edited can hold the problem and the lint panel can show it.
 * Objects are strict: an unknown key is a typo in a spec editor, not an extension point.
 * `satisfies` keeps each schema's output assignable to its type; `tests/unit/schema.test.ts`
 * asserts the reverse direction, so the two files cannot drift apart.
 *
 * `MusicSpec` and `StyleProfile` schemas arrive in S1b with the v0.2 containers.
 */

/** RFC 6901 pointer with at least one reference token; "" (the whole document) is not a patch target. */
export const JSON_POINTER = /^(?:\/(?:[^~/]|~[01])*)+$/;

const unitInterval = z.number().min(0).max(1);
const positiveInt = z.int().positive();
const nonNegative = z.number().nonnegative();

// ---- §1 shared types

export const BeatsSchema = z.literal(BEATS);
export const SignatureSchema = z.enum(SIGNATURES);
export const FeelSchema = z.enum(FEELS);
export const DynamicMarkSchema = z.enum(DYNAMIC_MARKS);
export const SectionKindSchema = z.enum(SECTION_KINDS);
export const TempoSourceSchema = z.enum(TEMPO_SOURCES);
export const EngineIdSchema = z.enum(ENGINE_IDS);

/** `Weighted<T>`: serializers order by weight, then by dimension priority. */
export function weightedSchema<T extends z.ZodType>(value: T) {
  return z.strictObject({ value, weight: unitInterval });
}

// ---- §2 D6 theory: tempo and meter lock

export const TempoSchema = z.strictObject({
  bpm: positiveInt,
  source: TempoSourceSchema,
  feltBpm: z.number().positive().optional(),
}) satisfies z.ZodType<Tempo>;

export const MeterLockSchema = z.strictObject({
  enabled: z.boolean(),
  signature: SignatureSchema,
  feel: FeelSchema,
  subdivision: z.literal(SUBDIVISIONS),
  driftSuppression: z.boolean(),
  allowedExtensions: z.array(z.enum(METER_EXTENSIONS)),
  restatement: z.enum(RESTATEMENTS),
}) satisfies z.ZodType<MeterLock>;

// ---- §3 D7 structure

export const PickupBarSchema = z.strictObject({
  beats: BeatsSchema,
  content: z.string(),
  returnTo: SignatureSchema,
}) satisfies z.ZodType<PickupBar>;

export const SilenceDropSchema = z.strictObject({
  beats: z.int().min(1).max(8),
  position: z.enum(DROP_POSITIONS),
}) satisfies z.ZodType<SilenceDrop>;

export const ContrastPhraseSchema = z.strictObject({
  styleId: z.string(),
  bars: positiveInt,
  position: z.enum(DROP_POSITIONS),
  changes: z.array(z.string()),
  returnRule: z.string(),
}) satisfies z.ZodType<ContrastPhrase>;

export const TransitionSchema = z.strictObject({
  kind: z.enum(TRANSITION_KINDS),
  bars: positiveInt.optional(),
  beats: positiveInt.optional(),
  note: z.string().optional(),
}) satisfies z.ZodType<Transition>;

export const SectionScopeSchema = z.strictObject({
  instrumentIds: z.array(z.string()),
  synthRoleIds: z.array(z.string()),
  techniqueIds: z.array(z.string()),
  percussionRhythmIds: z.array(z.string()),
}) satisfies z.ZodType<SectionScope>;

export const OpenPocketSchema = z.strictObject({
  kind: z.enum(POCKET_KINDS),
  note: z.string().optional(),
}) satisfies z.ZodType<OpenPocket>;

export const SectionSchema = z.strictObject({
  id: z.string(),
  kind: SectionKindSchema,
  label: z.string(),
  bars: positiveInt,
  dynamics: DynamicMarkSchema,
  scope: SectionScopeSchema,
  drumState: z.string(),
  bassState: z.string(),
  leadNote: z.string().optional(),
  textureNote: z.string().optional(),
  harmony: z.string().optional(),
  modeId: z.string().optional(),
  openPocket: OpenPocketSchema,
  pickupBefore: PickupBarSchema.optional(),
  contrast: ContrastPhraseSchema.optional(),
  silenceAfter: SilenceDropSchema.optional(),
  transitionOut: TransitionSchema,
}) satisfies z.ZodType<Section>;

export const SectionStartSchema = z.strictObject({
  sectionId: z.string(),
  bar: nonNegative,
  sec: nonNegative,
}) satisfies z.ZodType<SectionStart>;

export const BarMathSchema = z.strictObject({
  barSec: nonNegative,
  block8Sec: nonNegative,
  block16Sec: nonNegative,
  runtimeSec: nonNegative,
  sectionStarts: z.array(SectionStartSchema),
}) satisfies z.ZodType<BarMath>;

export const StructureSchema = z.strictObject({
  sections: z.array(SectionSchema),
  blockSize: z.literal(BLOCK_SIZES),
  runtimeTargetSec: z.number().positive().optional(),
  derived: BarMathSchema.optional(),
}) satisfies z.ZodType<Structure>;

// ---- §4 D5 instrumentation

export const CrossBundleSchema = z.strictObject({
  withBundleId: z.string(),
  reason: z.string(),
}) satisfies z.ZodType<CrossBundle>;

export const BundleUseSchema = z.strictObject({
  bundleId: z.string(),
  anchorInstrumentId: z.string(),
  crossBundle: CrossBundleSchema.optional(),
}) satisfies z.ZodType<BundleUse>;

export const SynthRolePositionSchema = z.strictObject({
  sectionIds: z.array(z.string()),
  phrases: z.array(positiveInt),
  beats: z.array(positiveInt),
}) satisfies z.ZodType<SynthRolePosition>;

export const SynthRoleUseSchema = z.strictObject({
  synthRoleId: z.string(),
  position: SynthRolePositionSchema,
  proseOverride: z.string().optional(),
}) satisfies z.ZodType<SynthRoleUse>;

export const SectionCapSchema = z
  .strictObject({
    warnAt: positiveInt,
    blockAt: positiveInt,
  })
  .refine((cap) => cap.blockAt >= cap.warnAt, {
    error: "sectionCap.blockAt must be at least sectionCap.warnAt",
  }) satisfies z.ZodType<SectionCap>;

export const InstrumentationDeltaSchema = z.strictObject({
  bundles: z.array(BundleUseSchema),
  synthRoles: z.array(SynthRoleUseSchema),
  sectionCap: SectionCapSchema,
}) satisfies z.ZodType<InstrumentationDelta>;

// ---- §5 D8 vocals, D10 output intent, references, intake patch

export const VocalsDeltaSchema = z.strictObject({
  instrumental: z.boolean(),
  lyricsPassthrough: z.string().optional(),
}) satisfies z.ZodType<VocalsDelta>;

export const NegativeSpaceSchema = z.strictObject({
  class: z.enum(NEGATIVE_CLASSES),
  terms: z.array(z.string()),
  auto: z.boolean().optional(),
}) satisfies z.ZodType<NegativeSpace>;

export const OutputIntentDeltaSchema = z.strictObject({
  targets: z.array(EngineIdSchema),
  activeTarget: EngineIdSchema,
  houseBudgets: z.record(z.string(), nonNegative),
  negativeSpace: z.array(NegativeSpaceSchema),
}) satisfies z.ZodType<OutputIntentDelta>;

export const ProvenanceSchema = z.strictObject({
  kind: z.enum(PROVENANCE_KINDS),
  sourceRef: z.string().optional(),
  analysedOn: z.string().optional(),
  model: z.string().optional(),
}) satisfies z.ZodType<Provenance>;

export const ReferenceSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(REFERENCE_KINDS),
  roles: z.array(z.enum(REFERENCE_ROLES)),
  assetId: z.string().optional(),
  resolvedStyleProfileId: z.string().optional(),
  weight: unitInterval,
  provenance: ProvenanceSchema,
}) satisfies z.ZodType<Reference>;

export const PatchOpSchema = z.strictObject({
  op: z.enum(PATCH_OPS),
  path: z.string().regex(JSON_POINTER, { error: "path must be a JSON pointer into the MusicSpec, e.g. /D6/tempo/bpm" }),
  value: z.unknown().optional(),
  confidence: unitInterval,
  rationale: z.string(),
}) satisfies z.ZodType<PatchOp>;

export const IRPatchSchema = z.strictObject({
  id: z.string(),
  source: z.enum(PATCH_SOURCES),
  createdAt: z.string(),
  model: z.string().optional(),
  ops: z.array(PatchOpSchema),
  status: z.enum(PATCH_STATUSES),
  acceptedPaths: z.array(z.string()),
  rejectedPaths: z.array(z.string()),
}) satisfies z.ZodType<IRPatch>;
