/**
 * MusicSpec IR v1 types. Generated from docs/SPEC.md §2.2 by scripts/sync-ir-types.mjs.
 * Do not edit by hand: change the spec, then run `node scripts/sync-ir-types.mjs`.
 */
// ─── Shared primitives ────────────────────────────────────────────────────────

export type Dimension = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9' | 'D10';
export type EngineId = 'suno' | 'eleven' | 'flow' | 'udio';
export type Confidence = 'verified' | 'partial' | 'community' | 'unverified';
export type Reliability = 'reliable' | 'approximate' | 'unreliable' | 'unverified';
export type Role =
  | 'lead' | 'stab' | 'sub' | 'bass' | 'pad' | 'arp' | 'texture' | 'rhythm' | 'drone' | 'counter'
  | 'keys' | 'pluck';
export type Register = 'sub' | 'bass' | 'low-mid' | 'mid' | 'high-mid' | 'high';
export type PitchClass =
  | 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb' | 'E' | 'F' | 'F#' | 'Gb' | 'G' | 'G#' | 'Ab' | 'A' | 'A#' | 'Bb' | 'B';

export type Beats = 1 | 2 | 3;                      // a pickup is sub-bar by definition
export type Signature = '4/4' | '3/4' | '6/8' | '12/8' | '5/4' | '7/8';
export type Feel = 'straight' | 'half-time' | 'double-time' | 'swung' | 'shuffled';
export type DynamicMark = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
export type SectionKind =
  | 'intro' | 'build' | 'hook' | 'verse' | 'pre' | 'bridge' | 'break' | 'drop' | 'finale' | 'outro' | 'custom';
export type TempoSource = 'manual' | 'tap' | 'analysis' | 'profile';

/** Per-trait weighting. weight is 0–1, default 1. Serializers order by weight, then by position. */
export interface Weighted<T> {
  value: T;
  weight: number;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface MusicSpec {
  irVersion: 1;
  D1: GenreStack;
  D2: ToneMood;
  D3: DynamicsExpression;
  D4: EraLineage;
  D5: Instrumentation;
  D6: TheoryProfile;
  D7: Structure;
  D8: Vocals;
  D9: ProductionMix;
  D10: OutputIntent;
  references: Reference[];
  patches: IRPatch[];                               // working copy only; never part of a Variant snapshot
}

// ─── D1 genre stack ───────────────────────────────────────────────────────────

export type GenreRole = 'core' | 'regional' | 'contrast' | 'finale' | 'influence';

export interface GenreUse {
  genreId: string;                                  // Genre record
  role: GenreRole;
}

export interface GenreStack {
  stack: Weighted<GenreUse>[];                      // Jinn: Egyptian trap (regional), Atlanta trap (core), drill (contrast), cinematic hybrid (finale)
  formPhrase: string;                               // the emitted genre/form clause: 'Egyptian Atlanta trap beat'
}

// ─── D2 tone and mood ─────────────────────────────────────────────────────────

export interface PaletteSwatch {
  hex: string;                                      // '#b5562a'
  weight: number;                                   // 0–1
}

export interface ToneMood {
  moods: Weighted<string>[];                        // emitted in weight order: 'desert dusk', 'ominous'
  imagery: string[];                                // narrative and cover notes; drafting input, not emitted by Suno
  palette: PaletteSwatch[];                         // from an image reference; [] until image intake exists
}

// ─── D3 dynamics and expression ───────────────────────────────────────────────

export type TechniqueTarget =
  | { kind: 'song' }
  | { kind: 'instrument'; instrumentId: string; sectionIds: string[] };   // [] = every section the instrument plays

export interface TechniqueUse {
  techniqueId: string;                              // Technique record
  target: TechniqueTarget;                          // section-level techniques live in Section.scope.techniqueIds
}

export interface DynamicsExpression {
  techniques: TechniqueUse[];
  arc?: DynamicMark[];                              // derived from Section.dynamics in order; never hand-edited
}

// ─── D4 era and lineage ───────────────────────────────────────────────────────

export interface LineageTrait {
  trait: string;                                    // a description, never a name (LN-1): 'pitch-bending distorted saw lead with glide'
  era?: string;                                     // '2000s'
  scene?: string;                                   // a place or scene, never a person: 'Southern rap'
}

export interface EraLineage {
  traits: Weighted<LineageTrait>[];
}

// ─── D5 instrumentation ───────────────────────────────────────────────────────

export interface InstrumentUse {
  instrumentId: string;                             // Instrument record
  bundleId?: string;                                // emitted inside that bundle's clause
  phraseOverride?: string;                          // song-level wording; wins over EngineProfile.aliases and Instrument.promptPhrase
}

export interface BundleUse {
  bundleId: string;                                 // RegionalBundle record
  anchorInstrumentId: string;                       // the load-bearing bridge into the low end (doholla, guembri)
  crossBundle?: { withBundleId: string; reason: string };   // required to mix bundles (RB-1)
  label?: string;                                   // clause label in style-equivalent fields: 'Egyptian instruments'
  rhythmIds: string[];                              // bundle rhythms named song-wide: ['maqsum', 'baladi']; checked by ML-2
}

export interface DrumGrammarUse {
  patternIds: string[];                             // DrumPattern records; the first is the core pattern
  label?: string;                                   // 'Trap drums'
  proseOverride?: string;                           // song-level wording; wins over DrumPattern.prose
}

export interface SynthRolePosition {
  sectionIds: string[];
  phrases: number[];                                // 1-based phrase indices within the section; [] = all
  beats: number[];                                  // 1-based beats within the bar; [] = free
}

export interface SynthRoleUse {
  synthRoleId: string;                              // SynthRole record (characteristics live there)
  position: SynthRolePosition;
  proseOverride?: string;                           // song-wide wording; wins over SynthRole.promptPhrase
}

export interface SectionCap {
  warnAt: number;                                   // default 6
  blockAt: number;                                  // default 8
}

export interface Instrumentation {
  instruments: Weighted<InstrumentUse>[];           // the song-wide palette
  bundles: BundleUse[];
  drums: DrumGrammarUse;
  synthRoles: SynthRoleUse[];
  textures: Weighted<string>[];                     // 'wordless epic choir', 'dark pads'
  sectionCap: SectionCap;
}

// ─── D6 theory ────────────────────────────────────────────────────────────────

export interface Tempo {
  bpm: number;                                      // integer
  source: TempoSource;
  feltBpm?: number;                                 // derived: bpm/2 half-time, bpm*2 double-time; never hand-set
}

export interface MeterLock {
  enabled: boolean;
  signature: Signature;
  feel: Feel;                                       // 'swung' | 'shuffled' are rejected while enabled (ML-3)
  subdivision: 8 | 16 | 32;                         // the grid named in the payload ("straight 16ths")
  driftSuppression: boolean;
  allowedExtensions: ('pickup-bar' | 'silence-drop' | 'contrast-phrase')[];
  restatement: 'style-only' | 'style-and-sections';
}

export interface KeyCenter {
  tonic: PitchClass;
  modeId: string;                                   // Mode record: 'hijaz'
  phraseOverride?: string;                          // 'D Hijaz maqam, dark minor'
}

export interface TheoryProfile {
  tempo: Tempo;
  meterLock: MeterLock;
  key: KeyCenter;
  harmony: string[];                                // song-level harmony notes for the word-MIDI blueprint; not sent to engines
}

// ─── D7 structure ─────────────────────────────────────────────────────────────

export interface PickupBar {
  beats: Beats;
  content: string;                                  // 'snare roll, riser'
  returnTo: Signature;                              // must equal MeterLock.signature while locked (PB-1)
  announce?: boolean;                               // default true: "Two-beat pickup bar – <content>, back to <returnTo>"; false: content only
}

export interface SilenceDrop {
  beats: number;                                    // 1–8
  position: 'start' | 'end';
}

export interface ContrastPhrase {
  styleId: string;                                  // Genre or DrumPattern id: 'drill-contrast'
  bars: number;                                     // CP-2: ≤ 25 % of the section by default
  position: 'start' | 'end';
  changes: string[];                                // 'sliding 808s', 'displaced snare'
  returnRule: string;                               // required, non-empty: 'then back to trap grid' (CP-1)
  label?: string;                                   // style word in the clause: 'drill'; default the referenced record's name
}

export type TransitionKind =
  | 'riser' | 'filter-sweep-open' | 'filter-sweep-close' | 'reverse-cymbal' | 'snare-roll'
  | 'timpani-roll' | 'choir-swell' | 'sub-drop' | 'hard-stop' | 'silence' | 'crossfade' | 'none';

export interface Transition {
  kind: TransitionKind;
  bars?: number;                                    // lead-in length; default 2
  beats?: number;                                   // for hard-stop / silence
  note?: string;                                    // wording: 'Timpani roll, choir swell, sub drop'
  bracket?: boolean;                                // bracket-style payloads: true = its own bracket after the section; default false = clause at the end
}

export interface SectionScope {
  instrumentIds: string[];
  synthRoleIds: string[];
  techniqueIds: string[];
  percussionRhythmIds: string[];                    // regional rhythms; each checked against MeterLock (ML-2)
}

export interface OpenPocket {
  kind: 'rap' | 'sung' | 'none';
  note?: string;                                    // 'open pocket for rap'
}

export type CueSlot =
  | 'drums' | 'bass' | 'groove' | 'percussion' | 'lead' | 'synth' | 'texture' | 'harmony' | 'fx' | 'mood'
  | 'pocket' | 'contrast';

export interface SectionCue {
  slot: CueSlot;
  text?: string;                                    // required except for 'pocket' and 'contrast', which render from openPocket and contrast
  ref?: string;                                     // the record the cue voices (Instrument, SynthRole, Rhythm, Technique id)
  phrases?: number[];                               // limits the cue to these 1-based phrases; rendered as a label: "phrases 2 and 4: …"
}

export interface Section {
  id: string;
  kind: SectionKind;                                // bracket head: 'hook' → "Hook"; 'custom' uses label
  label: string;                                    // 'Hook B'; UI and chunk names
  bars: number;                                     // positive integer; 8/16 by convention
  dynamics: DynamicMark;
  scope: SectionScope;
  cues: SectionCue[];                               // ordered payload clauses
  styleClause?: string;                             // one clause for the style-equivalent field: "Bridge: <styleClause>."
  harmony?: string;                                 // 'Dm · B♭ · Gm · A, two bars each'; blueprint-side
  notes?: string[];                                 // word-MIDI blueprint notes; linted like cues, never sent to engines
  modeId?: string;                                  // per-section mode override: 'saba' intro, 'hijaz-kar' finale
  openPocket: OpenPocket;
  pickupBefore?: PickupBar;
  contrast?: ContrastPhrase;
  silenceAfter?: SilenceDrop;
  transitionOut: Transition;
}

export interface BarMath {                          // derived, never hand-edited
  barSec: number;
  block8Sec: number;
  block16Sec: number;
  runtimeSec: number;
  sectionStarts: { sectionId: string; bar: number; sec: number }[];
}

export interface BlockTransitionRule {
  kinds: TransitionKind[];                          // ['riser', 'filter-sweep-open']
  everyBars: number[];                              // [8, 16]
  phraseOverride?: string;                          // 'Risers and filter sweeps at 8 and 16 bars'
}

export interface Structure {
  sections: Section[];
  blockSize: 8 | 16;
  blockRule?: BlockTransitionRule;                  // stated once in the style-equivalent field
  runtimeTargetSec?: number;
  derived?: BarMath;
}

// ─── D8 vocals ────────────────────────────────────────────────────────────────

export interface Vocals {
  instrumental: boolean;
  lyricsPassthrough?: string;                       // user-authored only; EVAWAVE never writes lyrics
  voice: string[];                                  // vocal character when not instrumental: 'breathy alto'
}

// ─── D9 production and mix ────────────────────────────────────────────────────

export interface ProductionMix {
  character: string[];                              // 'side-chain pump in the finale'; unweighted by design
  techniqueIds: string[];                           // production-class Technique records
}

// ─── D10 negative space and output intent ─────────────────────────────────────

export type NegativeClass = 'vocals' | 'meter-drift' | 'genre-bleed' | 'instrument-ambiguity' | 'custom';

export interface NegativeSpace {
  class: NegativeClass;
  terms: string[];
  auto?: boolean;                                   // true when populated by MeterLock or the instrumental flag
}

export interface OutputIntent {
  targets: EngineId[];
  activeTarget: EngineId;                           // a view, not a mutation
  houseBudgets: Record<string, number>;             // '<engine>.<field>' or '<engine>.total' → soft cap
  negativeSpace: NegativeSpace[];                   // serialized in class order: vocals, meter drift, genre bleed, instrument ambiguity, custom
  title?: string;
  acknowledgedDrops?: string[];                     // '<engine>:<path>' coverage items the user accepted as dropped (CV-2)
}

// ─── References and intake patches ────────────────────────────────────────────

export type ReferenceKind = 'audio' | 'image' | 'song' | 'style-profile' | 'text';
export type ReferenceRole =
  | 'style' | 'mood' | 'palette' | 'structure' | 'tempo' | 'drum-grammar' | 'instrumentation';

export interface Provenance {
  kind: 'audio-analysis' | 'hand-built' | 'imported' | 'derived-from-song';
  sourceRef?: string;                               // ReferenceAsset id or Song id
  analysedOn?: string;
  model?: string;                                   // tagger or LLM identifier used to draft it
}

export interface Reference {
  id: string;
  kind: ReferenceKind;
  roles: ReferenceRole[];
  assetId?: string;                                 // ReferenceAsset (local-only), Song or StyleProfile id
  resolvedStyleProfileId?: string;                  // traits only; payloads never see the reference itself
  weight: number;                                   // 0–1
  provenance: Provenance;
}

export interface PatchOp {
  op: 'set' | 'merge' | 'append' | 'remove';
  path: string;                                     // RFC 6901 pointer into the MusicSpec: '/D6/tempo/bpm'
  value?: unknown;
  confidence: number;                               // 0–1
  rationale: string;                                // one sentence, shown in the review diff
}

export interface IRPatch {
  id: string;
  source: 'text' | 'audio-analysis' | 'voice-memo' | 'image' | 'style-profile';
  createdAt: string;
  model?: string;
  ops: PatchOp[];
  status: 'proposed' | 'accepted' | 'partial' | 'rejected';
  acceptedPaths: string[];
  rejectedPaths: string[];
}

// ─── Taxonomy records (curated banks) ─────────────────────────────────────────

export interface Genre {
  id: string;
  name: string;
  parentId?: string;
  definition: string;
  criteria: {
    tempoBpm: [number, number];
    meters: string[];
    feel: ('straight' | 'half-time' | 'double-time' | 'swung' | 'shuffled')[];
    drumPatternIds: string[];
    coreInstrumentIds: string[];
    theoryDefaults: { modeIds: string[]; harmonyStyle: 'drone' | 'chordal' | 'modal' | 'mixed' };
    mixCharacter: string[];
  };
  profilingInstruction: string;
  driftRisks: string[];
  engineNotes: Partial<Record<EngineId, string>>;
  eraTags: string[];
}

export interface Instrument {
  id: string;
  name: string;
  family: 'string' | 'wind' | 'brass' | 'percussion' | 'keyboard' | 'voice' | 'electronic' | 'other';
  region?: string | null;
  register: Register[];
  timbre: string[];
  articulationIds: string[];                        // Technique ids of class 'articulation'
  playStyles: string[];
  idiomaticRoles: Role[];
  aliases: Partial<Record<EngineId, string>>;
  reliability: Partial<Record<EngineId, Reliability>>;
  bundleIds: string[];
  description: string;
  promptPhrase: string;                             // emitted text; generic, never an artist or producer name
  commonNames: string[];                            // brand-derived or colloquial terms users type
}

export interface Technique {
  id: string;
  name: string;
  class: 'articulation' | 'dynamics' | 'ornament' | 'harmony' | 'rhythm' | 'form' | 'texture' | 'production';
  description: string;
  applicableTo: ('instrument' | 'section' | 'song')[];
  meterRisk: boolean;                               // hemiola, polymeter, rubato → warn under meter lock (TQ-1)
  promptPhrase: string;
  engineReliability: Partial<Record<EngineId, Reliability>>;
}

export interface Rhythm {
  id: string;
  name: string;                                     // 'maqsum'
  meter: string;                                    // '4/4'
  fourFourSafe: boolean;
  notation: string;                                 // doum/tek: 'D T - T D - T -'
  region: string;
  role: string;
}

export interface Mode {
  id: string;
  name: string;                                     // 'Hijaz'
  family: 'western' | 'maqam' | 'raga' | 'pentatonic' | 'synthetic';
  intervalsCents: number[];                         // from the tonic; 150 marks a neutral second
  quarterTones: boolean;
  reliability: Partial<Record<EngineId, Reliability>>;
  colour: string;
}

export interface RegionalBundle {
  id: string;
  name: string;
  region: string;
  instrumentIds: string[];
  rhythmIds: string[];
  modeIds: string[];
  techniqueIds: string[];
  anchorInstrumentId: string;
  notes: string[];
}

export type KitPiece =
  | 'kick' | '808' | 'snare' | 'clap' | 'rim' | 'hat-closed' | 'hat-open' | 'perc-1' | 'perc-2' | 'crash' | 'ride';

export interface DrumPattern {
  id: string;
  name: string;
  genreId?: string;
  bpmRange: [number, number];
  feel: 'straight' | 'half-time' | 'double-time' | 'swung';
  grid: Partial<Record<KitPiece, number[]>>;        // 16th-slot indices 0–15 per bar
  rolls: { piece: KitPiece; subdivision: 32 | 64; slots: number[] }[];
  regional: { rhythmId: string; instrumentId: string }[];
  prose: string;
}

export interface SynthCharacteristics {
  osc: ('saw' | 'square' | 'sine' | 'triangle' | 'noise' | 'wavetable' | 'fm')[];
  unisonVoices: number;
  detuneCents: number;
  distortion: 'none' | 'overdrive' | 'amp-sim' | 'hard-clip' | 'bitcrush' | 'saturation';
  filter: 'none' | 'lowpass' | 'highpass' | 'bandpass';
  envelope: 'pluck' | 'stab' | 'sustain' | 'swell';
  glide: boolean;
  bendRangeSemitones: number;
  voicing: 'mono' | 'legato' | 'poly';
}

export interface SynthRole {
  id: string;
  name: string;                                     // 'pitch-bending distorted saw lead'
  role: Role;
  characteristics: SynthCharacteristics;
  promptPhrase: string;                             // trait wording; never a patch or producer name
  commonNames: string[];
}

/** The resolved taxonomy a compile or lint run reads. Built from src/data/taxonomy/ and src/data/lineage/. */
export interface Catalog {
  genres: Record<string, Genre>;
  instruments: Record<string, Instrument>;
  techniques: Record<string, Technique>;
  rhythms: Record<string, Rhythm>;
  modes: Record<string, Mode>;
  bundles: Record<string, RegionalBundle>;
  drumPatterns: Record<string, DrumPattern>;
  synthRoles: Record<string, SynthRole>;
  lineageNames: string[];                           // artist and producer names the lineage pass removes (LN-1); curated data
}

// ─── Engine profiles (data) ───────────────────────────────────────────────────

export interface EngineField {
  id: string;                                       // 'style' | 'exclude' | 'lyrics' | 'prompt' | 'composition_plan' | 'sound' | ...
  label: string;
  kind: 'text' | 'json' | 'boolean' | 'number' | 'file';
  hardLimit?: number;                               // engine character cap (text fields only)
  softLimit?: number;                               // house character ceiling (text fields only)
  min?: number;                                     // numeric lower bound (number fields only)
  max?: number;                                     // numeric upper bound (number fields only)
  serializesFrom: Dimension[];
  order: number;                                    // paste order in the engine UI
  notes?: string;
}

export interface EngineToggle {
  id: string;
  label: string;
  effect: string;
}

export interface EngineSelectorOption {
  value: string;
  note: string;
  default?: boolean;
}

export interface EngineSelector {
  id: string;
  label: string;
  affects: 'render' | 'lyrics' | 'orchestration';
  options: EngineSelectorOption[];
}

export interface EngineVerification {
  method: string;                                   // the source, named
  verified: string[];
  community?: string[];
  unverified: string[];
}

export interface EngineHalt {
  by: string;
  on: string;
  decision: string;                                 // 'A12'
  reasons: string[];
  reinstate: string;
}

export interface RepairRule {
  symptom: string;
  action: string;
}

export interface EngineExport {
  id: string;
  filename: string;
  content: string;
}

export interface EngineProfile {
  id: EngineId;
  displayName: string;
  version: string;
  verifiedOn: string;
  confidence: Confidence;
  status: 'live' | 'stub';
  verification?: EngineVerification;                // absent on a halted stub
  halted?: EngineHalt;                              // present when status is 'stub'
  fields: EngineField[];
  toggles: EngineToggle[];
  selectors: EngineSelector[];
  driftWords: string[];
  bannedTerms: string[];
  aliases: Record<string, string>;                  // instrument id → engine-safe term; '<id>:drift-fallback' keys apply on a drift rerun only
  weighting: 'front-loaded' | 'uniform' | 'unknown';
  supports: Record<Dimension, 'native' | 'approximate' | 'none'>;
  houseBudgets?: Record<string, number>;
  postRender: string[];
  repairRules?: RepairRule[];
  exports?: EngineExport[];
  notes: string[];
  driftWordsNote?: string;
  bannedTermsNote?: string;
  aliasesNote?: string;
  weightingNote?: string;
  supportsNotes?: Partial<Record<Dimension, string>>;
  houseBudgetsNote?: string;
}

// ─── Compile output and coverage ──────────────────────────────────────────────

export interface ElevenGenerationChunk {
  text: string;                                     // '[Hook B]\n{instrumental break}'
  duration_ms: number;                              // bars × barSec, rounded
  positive_styles: string[];
  negative_styles: string[];
  context_adherence?: number;
}

export interface ElevenCompositionPlan {
  chunks: ElevenGenerationChunk[];                  // ≤ 30
}

export type CompiledValue = string | number | boolean | ElevenCompositionPlan;

export type CoverageState = 'expressed' | 'approximated' | 'dropped';
export type CoverageReason = 'no-field' | 'over-budget' | 'engine-filter' | 'unsupported-dimension' | 'alias-substituted';

export interface CoverageItem {
  path: string;
  dimension: Dimension;
  state: CoverageState;
  reason?: CoverageReason;
  detail?: string;
}

export interface CoverageReport {
  engine: EngineId;
  compiledAt?: string;                              // stamped by the app layer, never by the core
  items: CoverageItem[];
  score: number;                                    // expressed / total
}

export interface CompiledPayload {
  engine: EngineId;
  profileVersion: string;
  fields: Record<string, CompiledValue>;            // keyed by EngineField.id
  toggles: Record<string, boolean>;                 // keyed by EngineToggle.id
  coverage: CoverageReport;
  hash: string;                                     // content hash of fields + toggles
}

export interface CompileError {
  code: 'engine-halted' | 'engine-unknown' | 'profile-invalid';
  engine: string;
  message: string;
}

export interface TargetOverride {
  engine: EngineId;
  fieldId: string;
  text: string;
  basedOnCompiledHash: string;
  createdAt: string;
}

// ─── Lint ─────────────────────────────────────────────────────────────────────

export type LintRuleId =
  | 'ML-1' | 'ML-2' | 'ML-3' | 'ML-4' | 'PB-1' | 'PB-2' | 'CP-1' | 'CP-2' | 'CP-3'
  | 'SC-1' | 'SC-2' | 'RB-1' | 'RB-2' | 'RB-3' | 'TQ-1' | 'LN-1' | 'BG-1' | 'BG-2' | 'BT-1'
  | 'CV-1' | 'CV-2' | 'OV-1' | 'PT-1' | 'PT-2' | 'PV-1';
export type LintSeverity = 'info' | 'warn' | 'block';

export interface LintResult {
  ruleId: LintRuleId;
  severity: LintSeverity;
  path: string;                                     // JSON pointer into the spec, or '<engine>.<fieldId>' for a payload hit
  message: string;
  engine?: EngineId;
  fix?: PatchOp[];                                  // auto-fix proposal (ML-4)
}

// ─── Library ──────────────────────────────────────────────────────────────────

export interface AudioFeatures {
  durationSec: number;
  bpm: { value: number; confidence: number; halfTimeCandidate: number; doubleTimeCandidate: number };
  meter: { signature: '4/4' | '3/4' | '6/8' | '12/8' | 'unknown'; confidence: number };
  key: { tonic: string; mode: string; confidence: number };
  loudness: { integratedLufs: number; loudnessRange: number };
  energyCurve: number[];                            // 0–1, one value per 4 bars at the detected bpm
  sections: { startSec: number; endSec: number; label?: string; energy: number }[];
  spectral: { centroidHz: number; brightness: number; subWeight: number; transientDensity: number };
  tags: { label: string; score: number; source: string }[];
}

export interface StyleProfile {
  id: string;
  ownerId: string;
  name: string;
  provenance: Provenance;
  spec: Partial<Pick<MusicSpec, 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D8' | 'D9'>>;
  features?: AudioFeatures;                         // present when provenance.kind is 'audio-analysis'
  genreIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceAsset {
  id: string;
  ownerId: string;
  kind: 'audio' | 'image';
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  localOnly: true;                                  // v1 invariant (A6)
  features?: AudioFeatures;
  palette?: PaletteSwatch[];
  createdAt: string;
}

export interface Tag {
  id: string;
  ownerId: string;
  label: string;
  colour?: string;
}

export interface Song {
  id: string;
  ownerId: string;
  title: string;
  brand: 'VASEY.AUDIO';                             // output brand; the tool is VASEY/AI
  spec: MusicSpec;                                  // working copy
  activeTarget: EngineId;
  styleProfileIds: string[];
  overrides: TargetOverride[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FieldDiff {
  path: string;
  before: unknown;
  after: unknown;
}

export interface Variant {
  id: string;
  songId: string;
  label: string;                                    // 'v1.0', 'v1.1', 'v1.2'
  parentVariantId?: string;
  specSnapshot: MusicSpec;
  diff: FieldDiff[];
  overrides: TargetOverride[];
  coverage: Partial<Record<EngineId, CoverageReport>>;
  createdAt: string;
}

export type DriftKind =
  | 'meter' | 'tempo' | 'key' | 'vocals-appeared' | 'section-skipped'
  | 'instrument-misread' | 'genre-bleed' | 'length' | 'other';

export interface Take {
  id: string;
  variantId: string;
  engine: EngineId;
  engineVersion: string;
  renderRef?: string;                               // engine-side id or URL, never the audio
  verdict: 'keep' | 'kill' | 'extend' | 'rerun';
  drifted: DriftKind[];
  wordsBlamed: string[];
  notes: string;
  createdAt: string;
}
