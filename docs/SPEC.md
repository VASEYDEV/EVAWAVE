# EVAWAVE — Specification

VASEY/AI · 2026-09-26 · status: **authoritative** (ADR 0004)

This file is the single spec for EVAWAVE. It replaces the Build Brief v0.1, scope v0.2 and
the IR v0.3 delta, which now live in [`docs/archive/`](archive/) as history. EVAWAVE owns
the MusicSpec IR. No code imports from, and no decision waits on, the legacy
VASEY.AUDIO × VASEY/AI compiler.

Still in force beside this file, unchanged:

- The engine profiles, which are data and the source of truth for engine facts:
  `src/core/musicspec/engines/profiles/{suno,eleven,flow,udio}.json`.
- The instrument bank seed: [`evawave/instrument-bank-seed-v0.1.md`](evawave/instrument-bank-seed-v0.1.md).
- The reference set in [`evawave/reference/`](evawave/reference/). The Jinn files there are
  ground truth. Nothing in this project writes or edits them.

Contents: §1 product scope and confirmed decisions · §2 MusicSpec IR v1 · §3 build plan.

---

## 1. Product scope

### 1.1 Positioning

- **EVAWAVE** stands for Enabling Variants & Automation; "wave" for sound, "eva" for
  forever. The canonical string is `EVAWAVE`, one word. The lockup (`EVAWAVE` vs
  `EVA/WAVE`) is open for the brand pass.
- It is a **VASEY/AI** product. Its output serves **VASEY.AUDIO**. The two brands never
  appear conflated in copy, naming or architecture.
- **EVAWAVE does not generate audio.** It composes, hones and versions musical intent. It
  compiles that intent into the exact input fields of external AI music engines and
  exports plain files. Rendering happens in the engine's own app.
- **The MusicSpec IR is the single source of truth.** Engine profiles are data.
  Serializers are pure functions of the IR, the profile and the taxonomy catalog. The
  composer UI is a field library over the IR. The linter runs on the IR and on each
  compiled payload.

### 1.2 Decision log

Carried from scope v0.2 §1. **Confirmed** means Sean confirmed it. **Adopted** means the
2026-09-26 plan in §3 schedules it, which makes it binding for this build.

| ID | Decision | Status |
| --- | --- | --- |
| A1 | One codebase. EVAWAVE is the product. `musicspec` is a pure core inside it, behind a lint-enforced import boundary with no React, Next.js or Supabase in the core | adopted (in place since Session 0) |
| A2 | Name: EVAWAVE | **confirmed** |
| A3 | v1 engine targets: Suno, ElevenLabs Music and Google Flow Music are **live**. Udio is greyed out and **halted**. Build order: Suno, then Eleven, then Flow | **confirmed** 2026-09-16 |
| A4 | v1 intake: the à la carte composer plus audio import and analysis into a StyleProfile ("DSP listens, Claude writes"). Raw audio stays on the device. Text intake and the voice-memo review UI are not scheduled in S1–S5 | audio import adopted (S5) |
| A5 | Target switching is a projection, not a mutation. It is lossless at the IR by construction, and every per-target payload ships with a coverage report. Manual payload edits are target-scoped overrides | adopted (S2) |
| A6 | Reference audio never leaves the device in v1. Extracted features and the resulting StyleProfile persist | adopted (S4, S5) |
| A7 | Library entities per §1.6. Supabase with RLS for entities, OPFS/IndexedDB for local audio | adopted in part (S4 scope below) |
| A8 | Taxonomy is schema first, from a curated launch seed. It grows through Claude-drafted, Sean-approved batches. No user-generated taxonomy in v1 | adopted |
| A9 | Metronome and tap tempo per §1.8 | **accepted** by Sean; adopted (S5) |
| A10 | One hue and one monoline icon per composer module per §1.9 | **accepted** by Sean; adopted (S5) |
| A11 | Every v1 target is a paste or file surface, never API dispatch | adopted |
| A12 | Udio is halted and greyed out by decision. No engine-wide litigation gate and no risk flags in v1. Re-adding Udio is an explicit decision by Sean, not a threshold | **confirmed** 2026-09-16 |
| A13 | Instrument bank seed floor: GM Level 1, the GM percussion map and GM2 kits as the baseline, then orchestral, band, contemporary, synth archetypes, kits, drum machines, genre kits and world sets, including everything used in Jinn v1.0–v1.2 | **confirmed** |
| A14 | `EngineProfile.selectors`; `EngineField.kind` gains `'file'`; `Instrument.promptPhrase` and `Instrument.commonNames` | adopted (in the profiles and §2) |
| A15 | Stack: Next.js 16.3.6 with the 16 conventions (`src/proxy.ts`, ESLint invoked directly, Turbopack); Supabase Auth, no Clerk; Node `^22.13.0 \|\| ^24.0.0 \|\| >=26.0.0` | **confirmed** 2026-09-23 |
| A16 | EVAWAVE owns MusicSpec IR v1 (§2). No legacy compiler dependency. Legacy files, if any arrive, live in `docs/archive/legacy/` as reference only | **confirmed** 2026-09-26 (ADR 0004) |

### 1.3 Engine targets

The profiles are the source of truth. This table summarizes them as of their `verifiedOn`
dates. Engine facts move monthly, so re-verify before a serializer ships.

| Engine | Version | Paste surface | Verified | Status |
| --- | --- | --- | --- | --- |
| Suno | v6 (v6, v6-wild, v6-mini) | Style ≤ 1,000 · Exclude Styles ≤ 1,000 · Lyrics ≤ 5,000 hard, 3,000 soft · Title ≤ 100 · Instrumental toggle (ON reads brackets as directions) | 2026-09-15, verified | **live** |
| ElevenLabs Music | music_v2 | Composition plan (≤ 30 chunks: text, duration_ms, positive/negative styles), `music_length_ms` 3,000–600,000, one-shot prompt, instrumental flag. Web-app form unverified | 2026-09-16, partial | **live** |
| Google Flow Music | Lyria 3.5 | Compose sheet: Lyrics, Instrumental, Sound, Model, Seed, BPM, Length, Title, Cover image. Producer chat: numbered commands. Character limits unverified | 2026-09-16, surface verified | **live** |
| Udio | transitional | Unknown | 2026-09-16 | **halted**: `status: 'stub'`, no serializer, no coverage report, `compile()` refuses it with a typed error |

### 1.4 Target switching

1. The active target is a view. Changing it re-runs `compile(spec, profile, catalog)`, and
   the IR is untouched.
2. Every compile emits a `CoverageReport`. It lists, per IR path, whether the target
   expressed, approximated or dropped it, and why (`no-field`, `over-budget`,
   `engine-filter`, `unsupported-dimension`, `alias-substituted`). Intent is never lost.
   What an engine cannot say is reported, not hidden.
3. Manual edits to compiled text are `TargetOverride`s scoped to one engine and one field.
   They survive target switches. When the IR changes, a stale override is shown as a
   three-way diff (base compile, override, new compile), never silently discarded.
4. Budgets and lint run per target, and switching target re-lints.

### 1.5 Composer modules

Page order mirrors Suno's Style priority order, and the serializer front-loads in the same
order.

| # | Module | Owns (IR) |
| --- | --- | --- |
| 1 | Engine + Form | target picker; `D6.meterLock`; `D6.tempo`; feel; runtime target; metronome and tap tempo |
| 2 | Key + Mode | `D6.key`; per-engine render-reliability flag per mode |
| 3 | Drum Grammar | `D5.drums`; kit pieces on a 16th grid per pattern; regional percussion in doum/tek |
| 4 | Regional Bundle | `D5.bundles`; cross-bundle use needs an explicit flag |
| 5 | Instruments + Synth Roles | `D5.instruments`, `D5.synthRoles` (role × characteristics × position) |
| 6 | Expression + Technique | `D3.techniques`, section `scope.techniqueIds` |
| 7 | Textures | `D5.textures` |
| 8 | Transitions | `D7.blockRule`; pickup bars, silence drops, contrast phrases (return rule required) |
| 9 | Sections | `D7.sections`: bars on 8/16 blocks, per-section scope and cues, the 5–8 instrument cap, dynamics, open pocket, per-section vocal note |
| 10 | Mood + Imagery | `D2`, `D4` |
| 11 | Negative Space + Output | `D10`: exclude classes, target field map, budgets, title |

Cross-cutting: live budget meters (engine hard and house soft), the lint panel, target
switcher with coverage report, export pane, and non-destructive undo/redo on every input
(§3, S3).

Exports per target: Suno three-field paste as `.txt`; Eleven composition plan `.json` and
prompt `.txt`; Flow Compose-sheet `.txt` plus a numbered Producer script. Engine-agnostic:
MusicSpec `.json` and the word-MIDI blueprint `.md` (DAW-side truth, never pasted into an
engine). Udio: none.

### 1.6 Library

| Entity | Purpose | Persistence |
| --- | --- | --- |
| StyleProfile | Reusable partial spec (no structure, no output intent) with provenance, genres and tags | Supabase (S4) |
| File | Metadata for a user file: a local reference asset (audio or image). The blob stays on the device (A6) | Supabase metadata (S4) + OPFS blob (S5) |
| Genre | Curated definition, criteria, profiling instruction, drift risks, engine notes | Supabase, curated, read-only for users (S4) |
| Tag | Free label with optional colour. Genre tags link genres to profiles and files | Supabase (S4) |
| Song, Variant, Take | Working spec, immutable versions with diffs and overrides, render log | Types in §2; persistence not scheduled in S1–S5 |
| Instrument, Technique, Rhythm, Mode, RegionalBundle, DrumPattern, SynthRole | Taxonomy banks | Curated JSON in `src/data/taxonomy/` |

### 1.7 Audio import to StyleProfile

1. **Import** by drag and drop, file picker or share sheet. The blob goes to OPFS, with a
   sha256 for dedupe. It is never uploaded.
2. **Analyse on-device** with Web Audio: duration, BPM with half/double-time candidates,
   meter estimate, key and mode estimate, integrated loudness and range, energy curve,
   section boundaries, spectral descriptors and transient density.
3. **Tag** (optional): a tagging model behind an interface. v1 ships the null
   implementation. Model choice is an open item.
4. **Draft**: a deterministic mapping from `AudioFeatures` to a proposed `StyleProfile.spec`,
   expressed as an `IRPatch`. An LLM draft step, when added, receives features only, never
   audio.
5. **Review**: proposed fields appear as a diff, accepted or rejected per field.
6. **Invariants**: traits, never identity. No artist or producer names, no song-ID or
   fingerprint lookup, `localOnly: true` on the raw file.

### 1.8 Metronome and tap tempo

- **Metronome**: Web Audio lookahead scheduler (25 ms tick, 100 ms lookahead); accent on
  beat 1; optional half-time accent mode (accents on 1 and 3, so a 140 half-time grid
  auditions as 70); subdivision click off, 8ths or 16ths; volume.
- **Tap tempo**: BPM = 60,000 ÷ the mean interval across the **last 4 taps** (3
  intervals). A tap whose interval is more than ±25 % from the running mean is discarded.
  2 s without a tap resets. The display shows live BPM with the half- and double-time
  candidates. **Assign** writes the rounded integer to `D6.tempo.bpm` with
  `source: 'tap'`.
- Bar math updates immediately (§2.5).

### 1.9 Module iconography

One hue per module, used for the icon stroke, the module header rule and the active glow.
Panels stay void-dark glass. Icons are monoline, one stroke weight, 400×400 viewBox, with
no fills except the brand teal beam when a module is armed. Hues are `oklch(78% 0.14 H)`.

| Module | Token | H | Icon motif |
| --- | --- | --- | --- |
| Engine + Form | `--mod-form` | 190 (brand teal) | metronome pendulum inside a bar frame |
| Key + Mode | `--mod-key` | 300 | key glyph with a bent second |
| Drum Grammar | `--mod-drums` | 60 | 16-slot grid with three lit slots |
| Regional Bundle | `--mod-bundle` | 35 | globe with a single meridian |
| Instruments + Synths | `--mod-instruments` | 340 | oud body overlapping a saw wave |
| Expression + Technique | `--mod-technique` | 250 | slur line over two noteheads |
| Textures | `--mod-textures` | 270 | layered waves |
| Transitions | `--mod-transitions` | 120 | riser arrow with a hard stop |
| Sections | `--mod-sections` | 215 | eight blocks, one raised |
| Mood + Imagery | `--mod-mood` | 20 | horizon with a low sun |
| Negative Space + Output | `--mod-output` | 0 chroma (neutral) | shield over a field frame |
| Library | `--mod-library` | 160 | three stacked cards |
| Intake | `--mod-intake` | 95 | waveform entering a bracket |

The final icon geometry belongs to the Vector Iconography project. S5 ships provisional
monoline icons to this table and flags them as provisional.

### 1.10 Out of scope for v1

Audio generation; API dispatch to engines; lyric writing; uploading reference audio
anywhere; a Udio serializer; user-generated taxonomy; voice-memo ASR review and
image-to-mood intake (v1.1).

Not scheduled in S1–S5, still in scope for later: text intake; Song, Variant and Take
persistence with the take log; the Flow Producer script for Variant diffs; the
end-to-end Jinn rebuild through the UI with an A/B Suno render.

### 1.11 Open items

- **Flow**: character limits on Sound and Lyrics; whether Lyrics accepts section tags with
  Instrumental ON; Length units and maximum (S2 writes whole seconds; the Jinn v1.2 runtime
  is 194 s, over the press figure of 3 min); whether BPM is a hard lock; the Producer
  command grammar (S2 writes descriptive numbered lines, §2.6).
- **Eleven**: web-app field set and limits; `force_instrumental` name on v2; whether
  chunks under 3,000 ms are rejected or clamped; whether long sentence-length style
  qualities read as well as short ones (S2 sends the first chunk's palette as sentences).
- **Inline negatives** (Flow Sound, Eleven prompt): whether an "Avoid: …" sentence
  suppresses the listed terms or primes them. Take logs decide; coverage already reports
  Flow's negative space as `approximated`.
- **Seed curation.** The seed's §4–§7 and kit sections are prose, not records. They wait
  for curation batches (seed §10). Generated world instruments carry `family: 'other'`
  unless the seed lists them under percussion.
- **Techniques** (`D3.techniques`, section `scope.techniqueIds`, `D9.techniqueIds`) are not
  rendered by any v1 serializer. Coverage reports them `dropped`, and a cue or
  `phraseOverride` carries the wording today.
- **Compound meters**: `beatsPerBar` is the signature's numerator, and `bpm` counts that
  unit (6/8 = six eighth-note beats). If BPM should mean the felt pulse in x/8, it is a
  one-table change. Not on the critical path (the lock is 4/4).
- ~~**ML-2 and the seed's rhythm flags**~~ Resolved in S1. The v1.1 blueprint's own
  rhythm key lists zar/ayyub and malfuf as 2/4, so `src/data/taxonomy/rhythms.json` records
  them as `meter: '2/4'` with the seed's `fourFourSafe: true`, and ML-2 blocks them under a
  4/4 lock on the meter check. `fourFourSafe` still decides for a 4/4 rhythm.
- **Tagging model** for audio import (§1.7 step 3). v1 ships the null tagger (`tags: []`).
- **Share-sheet import** (§1.7 step 1) needs a PWA manifest with `share_target`. The PWA
  tooling is not set up (A15), so S5 ships file picker and drag and drop only.
- **Analysis off the main thread.** S5 analyses on the main thread after the status
  paints. A Web Worker is the upgrade once Turbopack worker bundling is verified.
- **Loudness at rates other than 48 kHz** uses the RBJ equivalents of the K-weighting
  filters, as pyloudnorm does: within 0.2 LU of the 48 kHz reference in the tests.
- **iOS PWA storage**: OPFS quota and eviction for reference audio. Browsers without OPFS
  `createWritable` keep the blob in the tab's memory; the import says which.
- **Lockup**: `EVAWAVE` vs `EVA/WAVE`.

---

## 2. MusicSpec IR v1

### 2.1 Principles

- **Self-contained.** Every type the IR uses is defined in §2.2. Nothing is imported from
  the legacy compiler, and nothing refers to its v0.2 types.
- **Folded from the v0.3 delta.** Every delta primitive is here: meter lock, tempo,
  pickup bars, silence drops, contrast phrases, transitions, section scope, open pocket,
  bundles, synth roles with position, section caps, vocals, negative space, output
  intent, typed references, intake patches and per-trait weighting. Where the delta
  referenced a v0.2 container, §2.2 defines it from what the delta and scope require.
  §2.8 lists every type defined here rather than carried over.
- **Structured fields and cues.** Structured fields (tempo, bars, pickups, contrast,
  scope) drive lint, bar math, coverage and the blueprint. Payload wording lives in
  phrases and ordered section cues, so a bracket-style engine can reproduce hand-built
  text exactly while the linter still sees every clause.
- **Pure compilation.** `compile(spec, profile, catalog)` is deterministic: same inputs,
  same bytes. No clock, no randomness, no I/O. Timestamps are stamped by the app layer.
- **Ids.** Curated records use kebab-case ids, unique across banks. User records use
  opaque ids.

### 2.2 Types

```ts
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
```

### 2.3 Defaults

Every container has a default, so an empty spec is valid.

| Path | Default |
| --- | --- |
| `irVersion` | `1` |
| `D1` | `{ stack: [], formPhrase: '' }` |
| `D2` | `{ moods: [], imagery: [], palette: [] }` |
| `D3` | `{ techniques: [] }` |
| `D4` | `{ traits: [] }` |
| `D5` | `{ instruments: [], bundles: [], drums: { patternIds: [] }, synthRoles: [], textures: [], sectionCap: { warnAt: 6, blockAt: 8 } }` |
| `D6.tempo` | `{ bpm: 120, source: 'manual' }` |
| `D6.meterLock` | `{ enabled: false, signature: '4/4', feel: 'straight', subdivision: 16, driftSuppression: true, allowedExtensions: [], restatement: 'style-and-sections' }` |
| `D6.key` | `{ tonic: 'C', modeId: 'ionian' }` |
| `D6.harmony` | `[]` |
| `D7` | `{ sections: [], blockSize: 8 }` |
| `D8` | `{ instrumental: false, voice: [] }` |
| `D9` | `{ character: [], techniqueIds: [] }` |
| `D10` | `{ targets: ['suno'], activeTarget: 'suno', houseBudgets: {}, negativeSpace: [] }` |
| `references`, `patches` | `[]` |
| New section | `{ dynamics: 'mf', scope: { all four lists [] }, cues: [], openPocket: { kind: 'none' }, transitionOut: { kind: 'none' } }` |
| `Weighted.weight` | `1` |
| `Transition.bars` | `2` |
| `PickupBar.announce` | `true` |

### 2.4 Semantics

- **Meter lock.** When enabled, the lock text is front-loaded in the engine's
  style-equivalent field, the `meter-drift` negative class is populated automatically
  (ML-4), and every rhythm reference is checked against `signature` (ML-1, ML-2). Sections
  may still describe tempo feel ("perceived tempo halves in the bridge"), because that is
  dynamics, not meter.
- **Named instruments for the cap** (SC-1) = `scope.instrumentIds ∪ scope.synthRoleIds`,
  each id once. A rhythm in `scope.percussionRhythmIds` adds nothing: the instrument that
  plays it is already in the scope. A section or ensemble record ("epic orchestra",
  "wordless choir", "layered trap kit") counts as one.
- **Silence.** `silenceAfter` is the timeline event. A `transitionOut` of kind `silence`
  beside a `silenceAfter` renders once.
- **Cues.** Cues render in order. The `pocket` cue renders `openPocket.note`, only where
  the cue sits; an `openPocket` with no pocket cue renders nothing in the bracket. The
  `contrast` cue renders the contrast clause; a contrast with no cue is appended after the
  last cue, so its return rule is never lost. A cue with `phrases` renders as
  "phrases 2 and 4: <text>". A cue with `phrases`, and any contrast clause, is set off with
  `; ` on both sides. Other clauses join with `, `. `Section.notes` are word-MIDI blueprint
  notes: linted like cues, never sent to an engine.
- **Transitions.** A `transitionOut` other than `none` or `silence` renders as its `note`
  (or the kind's phrase). Without `bracket` it is the bracket's last clause; with `bracket`
  it is its own bracket after the section. With `restatement: 'style-and-sections'`, each
  section bracket ends with the clause `strict <signature>`.
- **Edits and undo.** Every composer edit is a list of `PatchOp`s addressed by RFC 6901
  pointers (`patch.ts`):
  - `set` creates or replaces, and `-` appends.
  - `merge` shallow-merges an object.
  - `append` concatenates onto an array.
  - `remove` deletes.

  Application is copy-on-write. Each op returns an inverse (`set` or `remove`) that
  restores exactly what it changed. When an op created intermediate objects, the inverse
  removes the outermost one. The history (`history.ts`) is an append-only tree:
  - Undo applies the cursor node's inverse and moves to its parent.
  - Redo applies a child's ops. By default it takes the newest child.
  - An edit after an undo adds a sibling, so every branch stays reachable (`jumpTo`).
  - Consecutive typing into one field folds into one node until another edit, an undo or
    a redo seals it.
- **Patches.** A patch applies only through the review diff, and a `proposed` patch never
  touches the working spec. Ops apply only at exactly accepted paths. Patches may not edit
  `references` or `patches` (PT-2). The lineage pass runs on every op value before it is
  shown.
- **Wording precedence** for an instrument: `InstrumentUse.phraseOverride`, then the
  active engine profile's alias, then the record's own `aliases[engine]`, then
  `Instrument.promptPhrase`. Alias keys ending `:drift-fallback` apply only on a drift rerun
  and are never read by a normal compile. Alias substitution is reported in coverage as
  `alias-substituted`.
- **Lineage pass.** Every compiled field runs through the lineage scrub against
  `Catalog.lineageNames` before it is returned. LN-1 blocks a listed name in any prose
  field, cue, note, passthrough lyric, patch op value or target override, and in any
  compiled payload. Overrides live on `Song` and `Variant`, so the caller passes them to
  `lint(…, { overrides })`. The scrub also runs on passthrough lyrics. LN-1 blocks there,
  so the change is never silent.
- **Coverage.** Every compile returns a path-level `CoverageReport` (`coverage/`). The
  items are the IR paths that carry content: dimensions, palette entries, each section,
  its dynamics, pickup, contrast, silence and transition, the block rule, tempo, meter
  lock, key, vocals, lyrics, negative space, title and techniques. Each engine renders a
  primitive as `expressed`, `approximated` or `dropped` (the §2.6 table). A dimension the
  profile marks `none` drops every item in it. Blueprint-only content (`notes`,
  `harmony`) and `references` are never items. The score is expressed / total.

### 2.5 Bar math

`barSec = beatsPerBar × 60 / bpm`, where `beatsPerBar` is the signature's numerator.
`runtimeSec = Σ (section.bars + pickupBeats / beatsPerBar + silenceBeats / beatsPerBar) × barSec`.
Pickups and silence drops count. Contrast phrases sit inside their section's bars.
`sectionStarts[i]` is the 0-based bar and second at which section *i*'s own material
begins, its pickup first. Vectors: 142 BPM gives 1.690 s per bar, 13.52 s per 8 bars and
27.04 s per 16. 140 BPM gives 1.714 s per bar, and 4 bars at 140 BPM give 6,857 ms.

### 2.6 Serializer contracts

Style-equivalent fields (Suno Style, Eleven first-chunk styles and prompt, Flow Sound) are
ordered by priority, never by UI field order:

1. form, meter and tempo ("Instrumental" when `D8.instrumental`, `D1.formPhrase`, the
   meter-lock text, `D6.tempo`)
2. key and mode (`D6.key`)
3. drum grammar (`D5.drums`: its label, then its prose override or the core pattern's prose)
4. regional instruments and their 4/4 rhythms (`D5.bundles`: melodic instruments, then
   percussion after `; `, then "on <rhythms> rhythms in <signature>")
5. instruments outside a bundle (`D5.instruments`)
6. synths by role (`D5.synthRoles`, each role once)
7. textures (`D5.textures`)
8. production character (`D9.character`)
9. the block transition rule (`D7.blockRule`)
10. section style clauses in section order (`Section.styleClause`)
11. lineage traits (`D4.traits`, descriptions only)
12. mood (`D2.moods`)
13. inline negation last ("No vocals, no lyrics." when instrumental)

Weighted lists order by weight, highest first; ties keep their order. Sentences join with
a single space.

| Primitive | Suno v6 | ElevenLabs Music v2 (composition plan) | Google Flow Music |
| --- | --- | --- | --- |
| MeterLock | Front-loads Style: "strict 4/4 common time, 140 BPM half-time, straight 16ths, no swing". Populates Exclude with the meter-drift class. With `style-and-sections`, each bracket restates the feel once | First chunk `positive_styles` gets the lock terms. Every chunk's `negative_styles` gets the drift class. `duration_ms` per chunk comes from bar math | Front-loads Sound; writes `BPM` numerically; negatives inline at the end of Sound (approximated: no exclude field) |
| Tempo | "140 BPM half-time" in Style; Manual BPM step in post-render notes | BPM in first-chunk styles; chunk durations carry the real timing | `BPM` field plus restatement in Sound |
| PickupBar | Its own bracket: `[Two-beat pickup bar – snare roll, riser, back to 4/4]`, or content only when `announce` is false | Folded into the tail of the preceding chunk's `text` as `{two-beat pickup: snare roll, riser}` | Producer script line |
| ContrastPhrase | Clause inside the section bracket: "last 4 bars drill contrast: sliding 808s, displaced snare, then back to trap grid" | Its own chunk with the contrast styles and `duration_ms = bars × barSec`; the next chunk restates the core style | Producer script line with its return |
| SilenceDrop | `[Drop to silence]`, its own bracket | `{silence}` at the end of the chunk's `text` | Producer script line |
| Transition | Clause at the end of the bracket, or its own bracket when `bracket` is true | Inline `{riser}` at chunk end | Sound clause plus Producer lines |
| Section cues | One bracket per section: `[<Kind> – <cues>]` | Chunk `positive_styles` list the section's instruments (≤ 50 qualities) | Producer per-section lines; Sound lists the song-wide palette |
| SynthRoleUse | Wording in Style (song-wide) and in the brackets of positioned sections | Wording in the positioned chunks only | Sound plus Producer lines |
| BundleUse | "<label>: <instruments>; <percussion> on <rhythms> rhythms in 4/4" in Style, aliases applied | Same into first-chunk styles | Same into Sound |
| OpenPocket | The `pocket` cue's position in the bracket | Chunk `text` = `[<label>]\n{instrumental break}`; `negative_styles` += "lead vocals" | Producer line |
| Vocals | Instrumental toggle ON, Lyrics = structure only. Passthrough lyrics go to Lyrics with the toggle OFF | Lyrics as plain lines in chunk `text` | Instrumental toggle; passthrough lyrics into Lyrics |
| NegativeSpace | Exclude Styles, classes in order | First chunk `negative_styles` plus per-chunk copies | Inline sentence at the end of Sound; coverage `approximated` |
| Reference | Never serialized. Resolved StyleProfile traits flow through D1–D9 | Same. `AudioRefChunk` is unused in v1 | Same |
| Weighted&lt;T&gt; | Orders terms within a field | Orders `positive_styles` | Orders Sound |

`compile(spec, engineId, catalog)` resolves the installed profile and returns
`{ ok: true, payload }` or `{ ok: false, error: CompileError }`. It never throws for an
engine: `engine-unknown` covers no profile, `engine-halted` covers a stub (Udio, A12), and
`profile-invalid` covers a profile with no matching serializer.

**ElevenLabs specifics (S2).**

- Chunk text starts `[<label>]`, and a contrast chunk starts
  `[<label> – <word> contrast]`. Next comes the user's lyric lines for that section, or
  `{instrumental break}`, then inline directions in order:
  - the transition (lower-cased);
  - `{silence}`;
  - the next section's pickup: `{two-beat pickup: <content>}`, or the content alone when
    `announce` is false.

  A contrast chunk ends with `{<returnRule>}`.
- `duration_ms` is rounded on the cumulative timeline, so chunk durations sum exactly to
  `music_length_ms`, which is the rounded bar-math runtime. Folded pickups and silences
  add their time to the chunk that carries them.
- The first chunk's `positive_styles` open with the Style sentences as qualities. They
  leave out section clauses, positioned synth roles and the closing negation. Every
  chunk then lists its section's qualities:
  - the dynamics word (`pp` "very soft" … `ff` "very loud");
  - the cues in order;
  - the synth roles positioned there;
  - its `styleClause`;
  - with `style-and-sections`, `strict <signature>`.

  A contrast chunk lists the dynamics word, "<word> contrast" and the changes.
- Every chunk's `negative_styles` carry the negative space in class order. An open pocket
  with no lyrics adds "lead vocals". Passthrough lyrics split on `[Header]` lines, and each
  block goes to the first unused section whose label or bracket head matches it. Lines
  that match no section are left out, and coverage reports them.
- `prompt` is the Style sentences plus "Avoid: <negative terms>." `model_id` is
  `music_v2`.

**Flow specifics (S2).**

- Sound is the Style sentences plus "Avoid: <negative terms>."
- Lyrics are empty for an instrumental. Otherwise they are the passthrough lyrics,
  unchanged.
- BPM is `D6.tempo.bpm`. Length is the bar-math runtime in whole seconds.
- The Producer script is numbered lines timed by bar math (`m:ss`, or "at m:ss" when a
  range rounds to one second). Per section, in order:
  - a start-position silence;
  - `Pickup into <label>, <range>: <pickup text>.`;
  - `<label>, <range> (<n> bars), <dynamics word>: <cue clauses>.`;
  - `<label> contrast, <range>: <contrast clause>.`;
  - `End of <label>, at <time>: <transition>.`;
  - `Silence after <label>, <range>: drop to silence for <n> beats.`

### 2.7 Lint rules

| Id | Rule | Severity | Session |
| --- | --- | --- | --- |
| ML-1 | Meter lock on: any profile `driftWords` term in any prose field, cue, technique `promptPhrase` or instrument `playStyles` | warn; block with `driftSuppression` when the term is in the engine's list | S1 |
| ML-2 | Meter lock on: a rhythm (section scope or bundle use) whose `meter ≠ signature`, or `fourFourSafe === false` under 4/4 | block | S1 |
| ML-3 | Meter lock on with `feel` swung or shuffled | block | S1 |
| ML-4 | Meter lock on and the `meter-drift` class absent | warn with a `fix` patch that populates the class from the profile's `driftWords` (`auto: true`); compile applies the same class | S1 |
| PB-1 | `PickupBar.returnTo ≠ MeterLock.signature` while locked | block | S1 |
| PB-2 | Pickup or silence used while not in `allowedExtensions` | warn | S1 |
| CP-1 | `ContrastPhrase.returnRule` empty | block | S1 |
| CP-2 | Contrast `bars > 0.25 × section.bars` | warn | S1 |
| CP-3 | Contrast `styleId` shares no meter with the lock | block | S1 |
| SC-1 | Named instruments in a section ≥ `warnAt` / ≥ `blockAt` | warn / block | S1 |
| SC-2 | A synth role positioned in a section whose scope omits it | warn | S1 |
| RB-1 | Two bundles used without `crossBundle` | warn | S1 |
| RB-2 | A section `modeId` outside every used bundle's modes with no cross flag | warn | S1 |
| RB-3 | A mode or instrument `approximate`/`unreliable` for the active target | warn with substitute | S1 |
| TQ-1 | A `meterRisk` technique under meter lock | warn | S1 |
| LN-1 | An artist or producer name in any prose field, cue, note, passthrough lyric, patch value or override (S2), or in a payload | block | S1 |
| BG-1 | Text field over `hardLimit`, number field outside `min`/`max`, or (S2) an Eleven plan over 30 chunks | block | S1 |
| BG-2 | Field over `softLimit` or a `houseBudgets` entry: per field, `<engine>.total`, or (S2) `eleven.styles_per_chunk` | warn | S1 |
| BT-1 | An `EngineProfile.bannedTerms` hit in a payload | warn | S1 |
| CV-1 | Coverage score < 0.8 for the active target (`D10.activeTarget`) | warn | S2 |
| CV-2 | A `dropped` item in D6 or D7 not listed in `D10.acknowledgedDrops` as `<engine>:<path>` | block export | S2 |
| OV-1 | A `TargetOverride` whose `basedOnCompiledHash` is stale | warn | S2 |
| PT-1 | A patch op with `confidence < 0.5` | info (low-confidence in the diff) | S5 |
| PT-2 | A patch op targeting `references` or `patches` | block | S5 |
| PV-1 | An audio-analysis StyleProfile with `features.bpm.confidence < 0.6` | info (low-confidence badge until a human edits tempo) | S5 |

LN-1 reads a curated name denylist (data). Fixtures and tests use invented names only.

### 2.8 Worked example: Jinn v1.2 Hook B as a `Section`

```json
{
  "id": "hook-b",
  "kind": "hook",
  "label": "Hook B",
  "bars": 8,
  "dynamics": "f",
  "scope": {
    "instrumentIds": ["tabla-egyptian", "mizmar", "qanun"],
    "synthRoleIds": ["stab-hypersaw-crackling"],
    "techniqueIds": [],
    "percussionRhythmIds": ["saidi"]
  },
  "cues": [
    { "slot": "drums", "text": "harder" },
    { "slot": "percussion", "text": "Sa'idi tabla", "ref": "saidi" },
    { "slot": "lead", "text": "mizmar lead stabs", "ref": "mizmar" },
    { "slot": "synth", "text": "ripping crackling distorted synth stabs", "ref": "stab-hypersaw-crackling" },
    { "slot": "synth", "text": "hypersaw stabs on 2 and 4", "ref": "stab-hypersaw-crackling" },
    { "slot": "lead", "text": "qanun runs", "ref": "qanun" },
    { "slot": "contrast" }
  ],
  "modeId": "hijaz",
  "openPocket": { "kind": "none" },
  "pickupBefore": { "beats": 2, "content": "filter sweep closing, two-beat drum-roll pickup", "returnTo": "4/4", "announce": false },
  "contrast": {
    "styleId": "drill-contrast",
    "bars": 4,
    "position": "end",
    "changes": ["sliding 808s", "displaced snare"],
    "returnRule": "then back to trap grid",
    "label": "drill"
  },
  "silenceAfter": { "beats": 1, "position": "end" },
  "transitionOut": { "kind": "none" }
}
```

Suno compile of this section, matching the Jinn v1.2 Lyrics field:

```
[Filter sweep closing, two-beat drum-roll pickup]

[Hook – harder, Sa'idi tabla, mizmar lead stabs, ripping crackling distorted synth stabs, hypersaw stabs on 2 and 4, qanun runs; last 4 bars drill contrast: sliding 808s, displaced snare, then back to trap grid]

[Drop to silence]
```

The v0.3 delta's version of this example appended "; open pocket for rap". Jinn v1.2 has
no pocket in Hook B, and the Jinn file is ground truth.

### 2.9 Defined, not inherited

Every type below was defined for IR v1, not carried over verbatim from the v0.3 delta or
scope v0.2. The first table lists new types. The second lists carried types changed here.
Every other type in §2.2 is carried over as written.

**New types**

| Type | Basis | Why |
| --- | --- | --- |
| `MusicSpec` | new | The root. The delta addressed `/D1`…`/D10` and scope used `Pick<MusicSpec, 'D1'…>`, but the type lived in the absent v0.2 file |
| `GenreStack`, `GenreUse`, `GenreRole` | new | D1 container. The delta says D1 already carries `Weighted<T>`; the handoff's D1 is a genre stack with core, regional, contrast and finale layers |
| `ToneMood`, `PaletteSwatch` | new (`PaletteSwatch` named from scope's inline `palette` shape) | D2 container. The delta weights D2 mood terms; the composer's Mood + Imagery module owns mood vocabulary and palette notes |
| `DynamicsExpression`, `TechniqueUse`, `TechniqueTarget` | new | D3 container. Scope's Expression + Technique module assigns techniques to instrument, section or song; section dynamics already live on `Section` |
| `EraLineage`, `LineageTrait` | new | D4 container. The delta weights D4 lineage traits; the lineage invariant requires traits, never names |
| `InstrumentUse`, `DrumGrammarUse` | new | D5 needs the song-wide palette (the delta weights D5 instrument entries) and the drum-grammar module's pattern choice |
| `TheoryProfile`, `KeyCenter`, `PitchClass` | new | D6 container. The delta attaches `Tempo` and `MeterLock` to it; the Key + Mode module needs a tonic and a mode |
| `CueSlot`, `SectionCue` | new | Ordered, typed payload clauses. Needed to reproduce the Jinn v1.2 brackets exactly (§2.8) while keeping every clause lintable |
| `BlockTransitionRule` | new | The delta's "8/16-bar rule stated once in Style" had no type |
| `ProductionMix` | new | D9 container. The delta keeps D9 unweighted; scope's Style priority and the handoff's D9 notes need mix character and production techniques |
| `Catalog` | new | Serializers and lint resolve taxonomy ids, and the lineage pass reads its curated `lineageNames`. Compilation is `compile(spec, profile, catalog)`, still pure |
| `Register` | named from scope's inline `Instrument.register` union | Reused by the seed and the composer picker |
| `EngineSelectorOption` | named from scope's inline `EngineSelector.options` shape | Reused by the profile loader |
| `EngineVerification`, `EngineHalt`, `RepairRule`, `EngineExport` | new | The installed profile JSON carries these blocks; scope's `EngineProfile` did not type them |
| `ElevenGenerationChunk`, `ElevenCompositionPlan`, `CompiledValue`, `CompiledPayload`, `CompileError` | new | Typed compile output. The Eleven chunk shape follows the Eleven profile's verified plan grammar; `CompileError` is Udio's typed refusal |
| `LintRuleId`, `LintSeverity`, `LintResult` | new | Typed linter output. `BT-1` (banned terms) and `PV-1` (profile provenance) are new ids for scope rules 11 and 13, which had no delta id |

**Carried, then changed**

| Type | Change | Why |
| --- | --- | --- |
| `Instrumentation` (was `InstrumentationDelta`) | Renamed; gains `instruments`, `drums`, `textures` | It is now the whole D5 container, not a delta onto one |
| `Vocals` (was `VocalsDelta`) | Renamed; gains `voice` | Whole D8 container; scope's Sections module has a voice spec |
| `OutputIntent` (was `OutputIntentDelta`) | Renamed; gains `title` and `acknowledgedDrops` | Whole D10 container; the Suno and Flow profiles have a title field fed by D10. CV-2 needs somewhere to record a drop the user accepted |
| `Section` | `drumState`, `bassState`, `leadNote`, `textureNote` fold into `cues` (slots `drums`, `bass`, `lead`, `texture`); gains `styleClause` and `notes` | The delta's §9 compile could not be produced from those fields; ordered cues reproduce Jinn v1.2 exactly. `notes` hold the blueprint's word-MIDI lines, which lint must read (the v1.1 "two cycles per bar") but no engine receives |
| `BundleUse` | Gains `label` and `rhythmIds` | The Style clause names the bundle's instruments and its 4/4 rhythms |
| `PickupBar` | Gains `announce` | Jinn v1.2 renders one pickup announced and one as content only |
| `ContrastPhrase` | Gains `label` | The style word in the contrast clause ("drill") |
| `Transition` | Gains `bracket` | Jinn v1.2 renders "Timpani roll, choir swell, sub drop" as its own bracket |
| `Structure` | Gains `blockRule` | See `BlockTransitionRule` |
| `SynthRole` | Drops `position` and `prose`; gains `promptPhrase` and `commonNames` | Position is per song (`SynthRoleUse`); the delta already refers to the record's `promptPhrase`; the seed's archetypes carry lookup names |
| `Instrument` | `region` may be `null`; `register` uses `Register` | The seed's example records use `region: null` |
| `Role` | Gains `keys` and `pluck` | The seed's GM families and synth archetypes use both |
| `Reliability` | Gains `unverified` | The seed's example records start engines at `unverified` |
| `EngineField` | Gains `notes` | Every installed profile field carries notes |
| `EngineProfile` | Gains `verification`, `halted`, `houseBudgets`, `repairRules`, `exports` and the note fields | They are in the installed profile JSON |
| `CoverageReport` | `compiledAt` optional | Serializers are pure; the app layer stamps time |
| `Song` | Gains `overrides` | Scope stores overrides on `Variant` only; the working copy needs them for target switching |
| `Variant` | `coverage` is `Partial<Record<…>>` | A halted engine has no coverage report |
| `ReferenceAsset` | `palette` uses `PaletteSwatch` | Shared with `ToneMood` |

---

## 3. Build plan

One PR per session, in order. Each PR runs the gate green (`bash scripts/gate.sh`),
uses Conventional Commits, states what, why and verified in its body, and is merged
when CI is green. An IR change lands in this file in the same PR as the code. Inputs
missing from the repo are written and flagged in the PR body, or cut and said so. The
exception is the Jinn files, which are never written or edited.

### S1: IR v1 types, linter, Suno serializer

- `src/core/musicspec/ir/types.ts` holds §2.2 exactly, plus `defaults.ts` (§2.3) and
  `barmath.ts` (§2.5).
- `src/core/musicspec/lint/`: every rule marked S1 in §2.7, one module per rule id.
- `src/core/musicspec/serialize/suno.ts`: `compileSuno(spec, profile, catalog)` →
  `CompiledPayload` with `style`, `exclude`, `lyrics` and `title`.
- `src/data/taxonomy/`: the catalog records the Jinn fixtures reference.
- No UI.

Acceptance:

- **Golden file.** `tests/fixtures/jinn-v1.2.spec.json` compiles under Suno to the three
  fenced blocks of `docs/evawave/reference/jinn-v1.2-condensed.md` byte for byte (Style
  998, Exclude 222, Lyrics 1,559 characters). The test reads the Jinn file at run time and
  never copies it. Lint on the v1.2 spec returns no block-severity result.
- **Negative fixture.** `tests/fixtures/jinn-v1.1.spec.json` encodes
  `docs/evawave/reference/jinn-v1.1-egypt-blueprint.md` and fails ML-1 on its drift
  vocabulary ("shuffled 16ths", "light shuffle", "rubato", "trance rhythm", "two cycles
  per bar") and ML-2 on its non-4/4 rhythms.
- Bar-math vectors per §2.5. CP-1 blocks an empty return rule. LN-1 blocks an invented
  producer name seeded in a cue. SC-1 blocks a nine-instrument section. BG-1 blocks a
  Style over 1,000 characters.

Stop conditions: the session stops and reports if the Jinn v1.2 golden test cannot pass
without altering a Jinn file, or if a Jinn prompt file is missing.

Input status: `jinn-v1.2-condensed.md` and `jinn-v1.1-egypt-blueprint.md` are both in
`docs/evawave/reference/`. The blueprint was uploaded on 2026-09-26 and filed under the
handoff package's target name, byte-identical.

Known risk: the Jinn v1.2 Finale names about eleven instruments. It passes SC-1 only
when "epic orchestra" counts as one ensemble record, which is the counting rule in §2.4.
Result: the v1.2 Finale scope holds seven records and warns; the v1.1 Finale holds nine
and blocks.

Delivered: all of the above, plus `src/core/musicspec/{catalog,lineage,text}.ts`, the
engine profile loader (`engines/`), the curated lineage list (`src/data/lineage/`) and
`scripts/sync-ir-types.mjs`, which generates `ir/types.ts` from §2.2 (a test fails on
drift). The v1.1 fixture's section brackets compile to the blueprint's Lyrics field,
less its closing `[End]` tag.

### S2: ElevenLabs and Flow serializers, target switching

- `serialize/eleven.ts` (composition plan, `music_length_ms`, prompt) and
  `serialize/flow.ts` (Sound, Lyrics, BPM, Length, Title, Producer script).
- `serialize/index.ts`: `compile(spec, engineId, catalog)`; Udio returns a `CompileError`
  with code `engine-halted`.
- `coverage/`: `CoverageReport` per target; lint rules CV-1, CV-2 and OV-1.

Acceptance:

- **Lossless projection.** For the Jinn v1.2 spec, switching Suno → Eleven → Flow → Suno
  leaves the spec deep-equal and unmutated (frozen input), and the final Suno payload
  hash equals the first.
- **Round trips across all three.** Every ordered pair of targets round-trips the same
  way.
- Eleven: chunk durations sum to `music_length_ms`; the contrast phrase is its own chunk;
  pickups and silence fold inline. Flow: BPM numeric; one Producer line per section plus
  the contrast and pickup lines; negative space reported `approximated`.

Delivered:

- `serialize/eleven.ts`, `serialize/flow.ts` and `serialize/index.ts` (`compile`,
  `CompileResult`), with `coverage/`.
- `sectionTimeline` in `barmath.ts`.
- CV-1, CV-2 and OV-1.
- Extensions: BG-1 for the chunk limit, BG-2 for styles per chunk, and LN-1 for lyrics
  and overrides.
- `OutputIntent.acknowledgedDrops`.

Jinn v1.2 scores 0.76 on Suno, which warns CV-1 while Suno is active. Its dynamics are
approximated. It scores 0.84 on Eleven and 0.49 on Flow, where most structure is
approximated through the Producer script. No target blocks.

### S3: Composer UI

- The eleven modules of §1.5 in order, each input bound to an IR path; budget meters,
  lint panel, target switcher with coverage report, export pane.
- The instrument bank generated from `docs/evawave/instrument-bank-seed-v0.1.md` into
  `src/data/taxonomy/instruments/*.json` by a deterministic script. The seed file stays
  unchanged.
- Non-destructive undo/redo on every input: an append-only history of `PatchOp`s with
  inverses. Undo and redo move a cursor. An edit after an undo starts a branch and keeps
  the old branch reachable.
- Mobile-first, WCAG 2.2 AA, reduced motion honoured. The spec persists locally until S4.

Acceptance: Playwright on a mobile viewport builds Hook B from §2.8 through the UI, and
the compiled bracket matches. Undo walks every edit back to the empty spec, and redo
restores it. An edit after an undo keeps the undone branch reachable.

Delivered:

- **Composer** (`src/components/composer/`). The eleven modules, with every control
  naming its IR path in `data-ir-path`. Budget meters, the lint panel, the coverage
  report, the export pane and the history panel with branches. Ctrl/Cmd+Z works outside
  text entry. The export pane covers per-engine files per §1.5, the MusicSpec JSON and the
  word-MIDI blueprint (`blueprint.ts`).
- **Core:** `patch.ts` and `history.ts` (§2.4).
- **Instrument bank.** `scripts/build-instrument-bank.mjs` generates
  `src/data/taxonomy/instruments/` from the seed's enumerable sections: §1 GM programs,
  §2 GM percussion, §8.2 drum machines and §9 world sets. That is 312 records beside the 24
  curated ones. `manifest.json` records the seed's sha256, every merge into an existing
  record and the sections left for curation, with the reason: §3, §4–§6 (prose lists),
  §7 (SynthRole), §8.1, §8.3 and the GM2 kits (DrumPattern).
- **Verification:** `tests/e2e/composer.spec.ts` (Pixel 7 viewport) and
  `tests/e2e/a11y.spec.ts`, an axe scan for WCAG 2.2 A and AA with every module open. The
  gate runs both on the production build.

### S4: Supabase library with RLS

- `supabase/migrations/`: `style_profiles`, `files` (reference asset metadata; blobs stay
  on the device per A6), `genres` (curated, read-only for users), `tags`, and the
  genre-tag links for profiles and files.
- RLS on every user-scoped table from the first migration: owners read and write only
  their rows.
- The library page: style profiles, files, genre tags.

Acceptance: an RLS test proves user B cannot read or write user A's rows in every
user-scoped table.

Delivered:

- **`supabase/migrations/20260926000000_library.sql`.** Seven user-scoped tables:
  `style_profiles`, `files`, `tags`, and the link tables `style_profile_genres`,
  `style_profile_tags`, `file_genres` and `file_tags`. Plus the curated `genres`.
  - RLS is on everywhere, with owner-only policies. Link inserts must join rows that the
    same user owns.
  - `anon` gets nothing, and `authenticated` gets only what the policies allow.
  - `files.local_only` is checked true (A6).
- **`20260926000100_seed_genres.sql`**, generated from `genres.json` by
  `scripts/build-genre-seed.mjs`, with a `--check` mode.
- **Library page** (`/library`): style profiles saved from the composer's spec (D1–D6, D8,
  D9), files, tags, and genre and tag links. Sign-in is by Supabase Auth email link
  (`/login`, `/auth/confirm` with a same-site redirect guard, POST `/auth/signout`).
  Setup: `docs/runbooks/supabase.md`.
- **RLS test.** `tests/integration/library-rls.test.ts` runs the real migrations in PGlite
  (Postgres in WASM) on a shim of Supabase's auth schema and API roles
  (`tests/support/supabase-shim.sql`). For each user-scoped table, user B can neither
  read, update, delete, forge a row owned by A, link A's rows, nor move a row to A. Anon
  can reach no table. Genres are read-only. The table columns match
  `src/lib/library/schema.ts`.

### S5: Audio import, metronome and tap tempo, module iconography

- Audio import to StyleProfile per §1.7, on-device. A test that mocks `fetch` asserts no
  request ever carries audio. Lint rules PT-1, PT-2 and PV-1.
- Metronome and tap tempo per §1.8: 4 taps 428 ms apart give 140 BPM; an outlier tap is
  discarded; a 2 s gap resets.
- Module hues as CSS tokens and provisional monoline icons per §1.9.

Acceptance: an imported WAV yields a StyleProfile with `provenance.kind =
'audio-analysis'`, reviewed as a patch diff. The tap tempo vectors pass. Every module
header shows its hue and icon.

Delivered:

- **Analysis** (`src/core/musicspec/analysis/`), pure and deterministic:
  - tempo: spectral-flux onsets with autocorrelation over 60–200 BPM and a 120 BPM
    log-normal prior;
  - meter: an accent envelope at 4-beat against 3-beat lags;
  - key: chroma against the Krumhansl–Kessler profiles;
  - loudness: BS.1770 K-weighting with gating, and the loudness range from 3 s windows;
  - energy per 4 bars, sections by energy change, and spectral descriptors;
  - a WAV decoder and encoder.

  Vectors: a −20 dBFS 1 kHz sine at 48 kHz reads −23.01 LUFS; click tracks give their
  tempo within 1.5 BPM and their 4/4 or 3/4 accents; triads give their key.
- **Intake** (`intake.ts`):
  - `draftFromAudio` maps features to a proposed `IRPatch`: tempo, meter, key, mood words
    at 0.4 confidence (PT-1), and measured character.
  - `reviewPatch` and `applyReviewedPatch` apply accepted paths only. A proposed or
    rejected patch changes nothing, and protected roots are refused (PT-2).
  - A profile starts from the default D1–D6, D8 and D9.
- **Tempo** (`tempo.ts`): tap tempo is the mean of the last 3 intervals. An interval
  more than ±25 % off the running mean is discarded, and a 2 s gap resets. A second
  discard in a row starts a new sequence from that tap, so a tempo change or a late tap
  recovers without waiting for the reset. Metronome clicks come from a 25 ms tick with
  100 ms lookahead, accenting beat 1, or beats 1 and 3 in half-time mode, with optional
  8th or 16th clicks. Changing the subdivision or meter while it runs moves the next
  click onto the next beat. The controls sit in module 1 and
  `Assign` writes the rounded BPM with `source: 'tap'`.
- **Lint:** PT-1 and PT-2 are spec-level rules and also run per patch
  (`lowConfidenceOps`, `protectedOps`). PV-1 is `lintStyleProfile`.
- **App:**
  - `/import`: file picker or drop, hashing, OPFS storage with a memory fallback, and
    Web Audio decoding. It shows the measured features, then a per-field review with
    low-confidence suggestions left unticked. The resulting profile carries the PV-1
    badge, can be saved to the library (file metadata and the profile only, through
    `saveImport`) or downloaded.
  - Module hues as `--mod-*` tokens. Provisional icons come from
    `assets/icons/modules.json`, with standalone SVGs generated by
    `scripts/build-module-icons.mjs`.
- **Tests:**
  - `tests/unit/audio-import.test.ts` records every fetch through import, review and a
    real Supabase client's save. Import makes no request. The save sends two JSON rows
    that carry no audio, in any encoding or alignment.
  - E2e on the phone viewport covers the WAV import, tap tempo with a controlled clock,
    and hue and icon on every module. There is also a no-sideways-scroll check on every
    page.
