/**
 * MusicSpec IR types: the v0.3 delta (docs/musicspec/ir-v0.3-delta.md §1–§5).
 *
 * This file holds the v0.3 delta only. The v0.2 base types, the D1–D10 dimension
 * containers that make up `MusicSpec`, are owner-supplied and merge here per the delta's §7
 * attachment map in S1b (https://github.com/VASEYDEV/EVAWAVE/issues/3). Until then there is
 * no `MusicSpec` type, and every function that takes a spec is generic over its shape.
 * Nothing here is reconstructed from the docs (ADR 0002, decision 2).
 *
 * Interfaces and field names are the delta's. String unions are written once as `as const`
 * arrays so `schema.ts` derives its enums from the same source; the resulting types are the
 * delta's unions unchanged. Names are added only for the delta's inline unions and objects
 * (`Subdivision`, `SectionStart`, `CrossBundle`, …) so a schema can refer to them.
 */

// ---- §1 shared types

/** A pickup is sub-bar by definition. */
export const BEATS = [1, 2, 3] as const;
export type Beats = (typeof BEATS)[number];

export const SIGNATURES = ["4/4", "3/4", "6/8", "12/8", "5/4", "7/8"] as const;
export type Signature = (typeof SIGNATURES)[number];

export const FEELS = ["straight", "half-time", "double-time", "swung", "shuffled"] as const;
export type Feel = (typeof FEELS)[number];

export const DYNAMIC_MARKS = ["pp", "p", "mp", "mf", "f", "ff"] as const;
export type DynamicMark = (typeof DYNAMIC_MARKS)[number];

export const SECTION_KINDS = ["intro", "build", "hook", "verse", "pre", "bridge", "break", "drop", "finale", "outro", "custom"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const TEMPO_SOURCES = ["manual", "tap", "analysis", "profile"] as const;
export type TempoSource = (typeof TEMPO_SOURCES)[number];

export const ENGINE_IDS = ["suno", "eleven", "flow", "udio"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

/** Per-trait weighting, generalized beyond D1 (carried from the v0.2 horizon list). */
export interface Weighted<T> {
  value: T;
  /** 0–1; an absent wrapper means 1. Serializers order by weight, then by dimension priority. */
  weight: number;
}

// ---- §2 D6 theory: tempo and meter lock

export interface Tempo {
  /** Integer. */
  bpm: number;
  /** Default 'manual'. */
  source: TempoSource;
  /** Derived: bpm/2 for half-time, bpm*2 for double-time; never hand-set. */
  feltBpm?: number;
}

/** The grid named in the payload ("straight 16ths"). */
export const SUBDIVISIONS = [8, 16, 32] as const;
export type Subdivision = (typeof SUBDIVISIONS)[number];

/** The only permitted meter events while the lock is on. */
export const METER_EXTENSIONS = ["pickup-bar", "silence-drop", "contrast-phrase"] as const;
export type MeterExtension = (typeof METER_EXTENSIONS)[number];

/** Where the lock text is emitted. */
export const RESTATEMENTS = ["style-only", "style-and-sections"] as const;
export type Restatement = (typeof RESTATEMENTS)[number];

export interface MeterLock {
  /** Default false. */
  enabled: boolean;
  /** Default '4/4'. */
  signature: Signature;
  /** 'swung' | 'shuffled' are rejected while enabled (lint ML-3). */
  feel: Feel;
  /** Default 16. */
  subdivision: Subdivision;
  /** Default true when enabled. */
  driftSuppression: boolean;
  allowedExtensions: MeterExtension[];
  /** Default 'style-and-sections'. */
  restatement: Restatement;
}

// ---- §3 D7 structure: sections, pickups, contrast, silence, transitions

export interface PickupBar {
  beats: Beats;
  /** "snare roll, riser" */
  content: string;
  /** Must equal MeterLock.signature when the lock is on (lint PB-1). */
  returnTo: Signature;
}

export const DROP_POSITIONS = ["start", "end"] as const;
export type DropPosition = (typeof DROP_POSITIONS)[number];

export interface SilenceDrop {
  /** 1–8. */
  beats: number;
  position: DropPosition;
}

export interface ContrastPhrase {
  /** Genre or DrumPattern id, e.g. 'drill-contrast'. */
  styleId: string;
  /** Lint CP-2: ≤ 25% of the section by default. */
  bars: number;
  position: DropPosition;
  /** 'sliding 808s', 'displaced snare', '3-3-2 hats' */
  changes: string[];
  /** REQUIRED, non-empty: "then back to trap grid" (lint CP-1). */
  returnRule: string;
}

export const TRANSITION_KINDS = [
  "riser",
  "filter-sweep-open",
  "filter-sweep-close",
  "reverse-cymbal",
  "snare-roll",
  "timpani-roll",
  "choir-swell",
  "sub-drop",
  "hard-stop",
  "silence",
  "crossfade",
  "none",
] as const;
export type TransitionKind = (typeof TRANSITION_KINDS)[number];

export interface Transition {
  kind: TransitionKind;
  /** Lead-in length; default 2. */
  bars?: number;
  /** For hard-stop / silence. */
  beats?: number;
  note?: string;
}

export interface SectionScope {
  instrumentIds: string[];
  synthRoleIds: string[];
  techniqueIds: string[];
  /** Regional iqa'at etc.; each checked against MeterLock (lint ML-2). */
  percussionRhythmIds: string[];
}

export const POCKET_KINDS = ["rap", "sung", "none"] as const;
export type PocketKind = (typeof POCKET_KINDS)[number];

export interface OpenPocket {
  /** Default 'none'. */
  kind: PocketKind;
  /** "open pocket for rap" */
  note?: string;
}

export interface Section {
  id: string;
  kind: SectionKind;
  /** 'Hook B' */
  label: string;
  /** Any positive integer; 8/16 by convention. */
  bars: number;
  dynamics: DynamicMark;
  scope: SectionScope;
  /** 'full Atlanta trap' | 'stripped: 808 root, kick, snare, hats in 8ths' | 'none' */
  drumState: string;
  /** '808 on D, no glides' | 'soft 808 pulse' | 'low oud only' */
  bassState: string;
  leadNote?: string;
  textureNote?: string;
  /** 'Dm · B♭ · Gm · A, two bars each' */
  harmony?: string;
  /** Per-section override: 'saba' intro, 'hijaz-kar' finale. */
  modeId?: string;
  openPocket: OpenPocket;
  pickupBefore?: PickupBar;
  contrast?: ContrastPhrase;
  silenceAfter?: SilenceDrop;
  /** Default { kind: 'none' }. */
  transitionOut: Transition;
}

export interface SectionStart {
  sectionId: string;
  bar: number;
  sec: number;
}

/** Derived, never hand-edited. */
export interface BarMath {
  barSec: number;
  block8Sec: number;
  block16Sec: number;
  runtimeSec: number;
  sectionStarts: SectionStart[];
}

export const BLOCK_SIZES = [8, 16] as const;
export type BlockSize = (typeof BLOCK_SIZES)[number];

export interface Structure {
  sections: Section[];
  /** Default 8. */
  blockSize: BlockSize;
  runtimeTargetSec?: number;
  derived?: BarMath;
}

// ---- §4 D5 instrumentation: bundles, synth roles with position, caps

/** Required to mix bundles (lint RB-1). */
export interface CrossBundle {
  withBundleId: string;
  reason: string;
}

export interface BundleUse {
  /** RegionalBundle id. */
  bundleId: string;
  /** The load-bearing bridge into the low end (doholla, guembri). */
  anchorInstrumentId: string;
  crossBundle?: CrossBundle;
}

export interface SynthRolePosition {
  sectionIds: string[];
  /** 1-based phrase indices within the section; [] = all. */
  phrases: number[];
  /** 1-based beats within the bar; [] = free. */
  beats: number[];
}

export interface SynthRoleUse {
  /** SynthRole record (characteristics live there). */
  synthRoleId: string;
  position: SynthRolePosition;
  /** Replaces the record's promptPhrase for this song only. */
  proseOverride?: string;
}

export interface SectionCap {
  /** Default 6. */
  warnAt: number;
  /** Default 8. */
  blockAt: number;
}

export interface InstrumentationDelta {
  bundles: BundleUse[];
  synthRoles: SynthRoleUse[];
  sectionCap: SectionCap;
}

// ---- §5 D8 vocals, D10 output intent, references, intake patch

export interface VocalsDelta {
  /** Default false. */
  instrumental: boolean;
  /** User-authored only; EVAWAVE never writes lyrics. */
  lyricsPassthrough?: string;
}

export const NEGATIVE_CLASSES = ["vocals", "meter-drift", "genre-bleed", "instrument-ambiguity", "custom"] as const;
export type NegativeClass = (typeof NEGATIVE_CLASSES)[number];

export interface NegativeSpace {
  class: NegativeClass;
  terms: string[];
  /** True when populated by MeterLock or the instrumental flag. */
  auto?: boolean;
}

export interface OutputIntentDelta {
  /** Pre-selected; default ['suno']. */
  targets: EngineId[];
  /** A view, not a mutation. */
  activeTarget: EngineId;
  /** '<engine>.<field>' or '<engine>.total' → soft cap. */
  houseBudgets: Record<string, number>;
  negativeSpace: NegativeSpace[];
}

export const REFERENCE_KINDS = ["audio", "image", "song", "style-profile", "text"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const REFERENCE_ROLES = ["style", "mood", "palette", "structure", "tempo", "drum-grammar", "instrumentation"] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export const PROVENANCE_KINDS = ["audio-analysis", "hand-built", "imported", "derived-from-song"] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export interface Provenance {
  kind: ProvenanceKind;
  sourceRef?: string;
  analysedOn?: string;
  model?: string;
}

export interface Reference {
  id: string;
  kind: ReferenceKind;
  roles: ReferenceRole[];
  /** ReferenceAsset (local-only) or Song / StyleProfile id. */
  assetId?: string;
  /** Traits only; payloads never see the reference itself. */
  resolvedStyleProfileId?: string;
  /** 0–1. */
  weight: number;
  provenance: Provenance;
}

export const PATCH_OPS = ["set", "merge", "append", "remove"] as const;
export type PatchOpKind = (typeof PATCH_OPS)[number];

export interface PatchOp {
  op: PatchOpKind;
  /** JSON pointer into the MusicSpec, e.g. '/D6/tempo/bpm'. */
  path: string;
  value?: unknown;
  /** 0–1. */
  confidence: number;
  /** One sentence, shown in the review diff. */
  rationale: string;
}

export const PATCH_SOURCES = ["text", "audio-analysis", "voice-memo", "image", "style-profile"] as const;
export type PatchSource = (typeof PATCH_SOURCES)[number];

export const PATCH_STATUSES = ["proposed", "accepted", "partial", "rejected"] as const;
export type PatchStatus = (typeof PATCH_STATUSES)[number];

export interface IRPatch {
  id: string;
  source: PatchSource;
  createdAt: string;
  model?: string;
  ops: PatchOp[];
  status: PatchStatus;
  acceptedPaths: string[];
  rejectedPaths: string[];
}
