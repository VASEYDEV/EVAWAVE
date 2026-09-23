# EVAWAVE — Product Scope v0.2

VASEY/AI · 2026-09-16 · status: PROPOSED (decision-gated; see §1 for what is confirmed)
Repo target: `docs/evawave/scope-v0.2.md`

Changelog v0.2 (2026-09-16): Udio halted and greyed out; engine gate defined (A12); Flow Music surface verified from Sean's screenshots and profile written (`engine-profile-flow.json`); instrument bank seed floor defined (A13, `instrument-bank-seed-v0.1.md`); EngineProfile gains `selectors` and a `file` field kind; Instrument gains `promptPhrase` and `commonNames`.

---

## 0. Positioning

- **EVAWAVE** — Enabling Variants & Automation; "wave" for sound; "eva" as forever. Canonical string `EVAWAVE`, one word. Lockup candidate `EVA/WAVE` (splits on the acronym boundary; matches VASEY/AI and D/OCULUS slash grammar) — brand pass decides.
- A **VASEY/AI** product. Its output serves **VASEY.AUDIO**. The two brands never appear conflated in copy, naming or architecture.
- **EVAWAVE does not generate audio.** It composes, hones and versions musical intent; compiles that intent into the exact input fields of external AI music engines; exports plain files. Rendering happens in the engine's own app.
- Architecture (inherited from the VASEY.AUDIO × VASEY/AI compiler): **MusicSpec IR is the single source of truth**; engine profiles are data; serializers are pure functions of (IR, profile); the composer UI is a field library over the IR; the linter runs on the IR and on each compiled payload.

---

## 1. Decision log

| ID | Decision | Status | Note |
|----|----------|--------|------|
| A1 | Same codebase as the compiler. EVAWAVE is the product; `musicspec` is a pure core package with a lint-enforced import boundary (no React/Next in core). | proposed, unopposed | `APP_NAME`/`BRAND_LOCKUP` resolve to EVAWAVE. Phase C = retrofit starter kit v3.0, CLAUDE.md v2.0 → v3.0. |
| A2 | Name: EVAWAVE. | **confirmed (Sean)** | MAESTRØ / ØVERTURE / OPUS•X return to the NERØ pool. |
| A3 | v1 engine targets: Suno, ElevenLabs Music, Google Flow Music. Udio greyed out and halted (§2.4). | **confirmed (Sean, 2026-09-16)** | Build order Suno → Eleven → Flow. |
| A4 | v1 intake: à la carte composer + text intake + **audio import & analysis → StyleProfile** (Sean). Voice-memo ASR review UI stays v1.1. | **revised by Sean**; accepted with the rules in §5 | "DSP listens, Claude writes." Raw audio stays on-device. |
| A5 | Target switching is a projection, not a mutation. Lossless at the IR by construction; per-target payload ships with a coverage report. Manual payload edits are target-scoped overrides. | proposed | Replaces "no loss of info" with a truthful, enforceable contract (§2.3). |
| A6 | Reference audio never leaves the device in v1. Extracted features + the resulting StyleProfile persist. | proposed | Copyright, cost, and the brief's existing rule. |
| A7 | Library entities per §4. Supabase (RLS) for entities; OPFS/IndexedDB for local audio. | proposed | |
| A8 | Taxonomy strategy: schema first; curated launch seed; growth by Claude-drafted, Sean-approved batches. No user-generated taxonomy in v1. | proposed | "Every instrument in the world" is a pipeline, not a launch gate. |
| A9 | Metronome + tap tempo per §6. | accepted (Sean) | |
| A10 | One hue + one monoline icon per composer module per §7. | accepted (Sean); hue map proposed | Icon set produced under the Vector Iconography project. |
| A11 | All v1 targets are **paste/file surfaces**, not API dispatch. | proposed | Follows Sean's "output as plain files usable in the apps' input fields." API dispatch is a later phase. |
| A12 | Udio halted and greyed out by decision. No engine-wide litigation gate and no risk flags in v1; Suno, ElevenLabs Music and Flow Music are unaffected. Re-adding Udio is an explicit decision, not a threshold. | **confirmed (Sean, 2026-09-16)** | Litigation state stays in the profile `notes` as data. See §2.4. |
| A13 | Instrument bank seed floor: GM Level 1 + GM percussion map + GM2 kits as the enumerable baseline; orchestral, band, contemporary, synth archetypes, acoustic kits, drum machines and digitized-sample kits, genre kits, world sets (incl. everything used in Jinn v1.0–v1.2) on top. | **confirmed (Sean's clarification)**; list proposed in `instrument-bank-seed-v0.1.md` | "Every instrument in the world" remains the growth goal; this is the launch floor. |
| A14 | Schema deltas: `EngineProfile.selectors` (Flow's Instrument / Ghostwriter / Producer pickers), `EngineField.kind` adds `'file'`, `Instrument.promptPhrase` and `Instrument.commonNames`. | proposed | Driven by the Flow surface and the brand-term handling in the bank. |
| A15 | Stack: Next.js 16, pinned at 16.3.6 or later, replacing Next.js 15 in BUILD-BRIEF §2. It follows the 16 conventions: `proxy.ts` for the Supabase session refresh; ESLint invoked directly in `package.json` and CI; Turbopack by default, with PWA/service-worker tooling checked against it and options reported instead of a `--webpack` fallback. Auth is Supabase Auth, and Clerk does not come over. Node ≥ 22.13.0 in engines and CI. | **confirmed (Sean, 2026-09-23)** | The musicspec core is lint-barred from importing `next`, so nothing in the compiler can require 15. The Node floor was requested at 20.9 and raised with Sean's approval, because current releases require more: supabase-js 2.117 needs ≥ 22, vitest 5 needs ≥ 22.12, and eslint-visitor-keys (via typescript-eslint) needs ≥ 22.13. ESLint stays on 9 because `eslint-config-next` 16.3.6 fails under ESLint 10. See ADR 0002. |

---

## 2. Engine targets

### 2.1 Verified state (re-verify before build; engine facts move monthly)

| Engine | Version | Input surface (paste target) | Verified | Confidence |
|--------|---------|------------------------------|----------|------------|
| Suno | v6 (v6 / v6-wild / v6-mini) | Style ≤1,000; Exclude Styles ≤1,000 (Advanced Options); Lyrics ≤5,000 hard / ~3,000 soft; Instrumental toggle ON honours bracket tags; artist names stripped/flagged | 2026-09-15 | verified |
| ElevenLabs Music | v2 | Web app: prompt + optional lyrics + length + instrumental toggle. API: chunk-based composition plan (`GenerationChunk` / `AudioRefChunk`), mid-track genre transitions, embedded SFX | as of memory import 2026-09-10 | partial — field limits need a live check |
| Google Flow Music | Lyria 3.5 (flagship) / Lyria 3 Pro (legacy). Flow Music launched 2026-04-18 (ProducerAI rebrand); Lyria 3.5 shipped 2026-07-29 | Two surfaces. **Compose sheet:** Lyrics (text) + Instrumental toggle; Sound (text); Dynamics: Model, Seed (auto/number), BPM (auto/number), Length (auto/duration); Details: Title, Cover image. **Producer chat:** free text, numbered multi-step commands incl. edit ops (e.g. trim to a time range), attachments via +. Settings selectors: Instrument (music model), Ghostwriter (lyric LLM: Standard/Pro), Producer (orchestrator: Standard/Fast). | 2026-09-16 (Sean's iOS screenshots; press for dates) | surface verified; char limits, section-tag handling in Lyrics, Instrumental+Lyrics interaction, BPM lock strength unverified |
| Udio | transitional | Downloads disabled since the UMG walled-garden transition; licensed relaunch promised for 2026, no date; Sony's original SDNY case active plus a second Sony suit filed 2026-07-20 (30,117 recordings); input surface unknown | 2026-09-16 (press) | **halted — greyed out, no serializer** |

### 2.2 EngineProfile (data, not code)

```ts
export type EngineId = 'suno' | 'eleven' | 'flow' | 'udio';
export type Dimension = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9' | 'D10';
export type Confidence = 'verified' | 'partial' | 'community' | 'unverified';

export interface EngineField {
  id: string;                       // 'style' | 'lyrics' | 'exclude' | 'prompt' | 'composition_plan' | 'title'
  label: string;
  kind: 'text' | 'json' | 'boolean' | 'number' | 'file';
  hardLimit?: number;               // engine-enforced character cap
  softLimit?: number;               // house ceiling (e.g. Suno lyrics 3,000)
  serializesFrom: Dimension[];      // which IR dimensions feed this field
  order: number;                    // paste order in the engine UI
}

export interface EngineToggle {
  id: string;                       // 'instrumental'
  label: string;
  effect: string;                   // what it changes about field interpretation
}

export interface EngineSelector {
  id: string;                       // 'instrument' | 'ghostwriter' | 'producer' (Flow)
  label: string;
  affects: 'render' | 'lyrics' | 'orchestration';
  options: { value: string; note: string; default?: boolean }[];
}

export interface EngineProfile {
  id: EngineId;
  displayName: string;
  version: string;                  // 'v6' | 'music-v2' | 'lyria-3.5' | 'transitional'
  verifiedOn: string;               // ISO date of last verification
  confidence: Confidence;
  status: 'live' | 'stub';          // stub = selectable, serializer withheld, coverage report only
  fields: EngineField[];
  toggles: EngineToggle[];
  selectors: EngineSelector[];      // model/agent pickers exposed by the engine UI
  driftWords: string[];             // terms that push this engine toward compound/odd meter
  bannedTerms: string[];            // engine-side filtered vocabulary (artist names handled by lineage pass)
  aliases: Record<string, string>;  // canonical instrument id → engine-safe term
  weighting: 'front-loaded' | 'uniform' | 'unknown';
  supports: Record<Dimension, 'native' | 'approximate' | 'none'>;
  postRender: string[];             // e.g. 'Suno Studio → Manual BPM lock before stem export'
  notes: string[];
}
```

### 2.3 Target switching semantics

1. The active target is a **view**. Changing it re-runs `compile(spec, profile)`; the IR is untouched. Undo is free because nothing was mutated.
2. Every compile emits a **CoverageReport**: per IR field, `expressed | approximated | dropped`, with the reason (`no-field`, `over-budget`, `engine-filter`, `unsupported-dimension`). Shown inline on the export pane. This is the honest replacement for "no loss of info": the intent is never lost; what a given engine cannot say is reported, not hidden.
3. **Manual edits to compiled text** are stored as `TargetOverride { engine, fieldId, text, basedOnCompiledHash }`. They survive target switches (they are scoped to their engine), and when the IR changes the override is shown as a three-way diff (base compile → override → new compile) rather than silently discarded.
4. Budget meters and lint run per target; switching target re-lints. A payload that passes Suno may fail Flow on length; the report says so.

```ts
export type CoverageState = 'expressed' | 'approximated' | 'dropped';
export type CoverageReason = 'no-field' | 'over-budget' | 'engine-filter' | 'unsupported-dimension' | 'alias-substituted';

export interface CoverageItem { path: string; dimension: Dimension; state: CoverageState; reason?: CoverageReason; detail?: string; }
export interface CoverageReport { engine: EngineId; compiledAt: string; items: CoverageItem[]; score: number; } // score = expressed / total

export interface TargetOverride { engine: EngineId; fieldId: string; text: string; basedOnCompiledHash: string; createdAt: string; }
```

### 2.4 Udio

Halted by decision (A12). Profile retained at `status: 'stub'`, rendered greyed out in the target picker with a "halted" label, no serializer, no coverage report. Reasons on record as of 2026-09-16: downloads disabled since the UMG walled-garden transition, no relaunch date, input surface unknown, and Sony's SDNY cases (original plus a second suit filed 2026-07-20) unresolved. Re-adding Udio requires an explicit decision by Sean; there is no automatic threshold.

No other target carries a litigation gate or a risk flag in v1. Litigation state for any engine is recorded in its profile `notes` as data and re-verified quarterly; it does not surface in the UI.

---

## 3. Composer modules

Page order mirrors Suno's Style priority order; the serializer front-loads in the same order. Each module owns a hue and an icon (§7).

| # | Module | Owns | Notes |
|---|--------|------|-------|
| 1 | Engine + Form | target picker; meter lock (signature + drift-word suppression); tempo; feel (straight / half-time / double-time); runtime target → bar math | metronome + tap tempo live here (§6) |
| 2 | Key + Mode | key; scale / maqam / raga picker with per-engine render-reliability flag | Hijaz, Nahawand reliable on Suno; Saba, Bayati, Rast approximate |
| 3 | Drum Grammar | kit pieces on a 16th grid per pattern; regional percussion in doum/tek; rolls and fills; serializes to prose | pattern bank per genre |
| 4 | Regional Bundle | region → instruments, rhythms (4/4-safe flag), modes, articulations, per-engine aliases | cross-bundle use requires an explicit flag |
| 5 | Instruments + Synth Roles | world instrument bank (§4 `Instrument`); synth roles (role × characteristics × position); stack per section | lineage packs resolve names into this shape |
| 6 | Expression + Technique | articulations, play styles, dynamics marks, ornaments, theory techniques (§4 `Technique`); assignable to instrument, section or song | techniques with `meterRisk` warn under meter lock |
| 7 | Textures | choir, pads, drones, ambience | |
| 8 | Transitions | 8/16-bar rule; pickup bar (beats, return); silence drop; contrast phrase (style, bars, return rule — required) | |
| 9 | Sections | template on 8/16-bar blocks; per-section scoping of instruments/synths/techniques; 5–8 named-instrument cap with warning; dynamics mark; open-pocket flag; voice/vocal spec per section (D8) | |
| 10 | Mood + Imagery | mood vocab; cover/image-derived palette notes | |
| 11 | Negative Space + Output | exclude classes (vocals, meter drift, genre bleed, instrument ambiguity); target field map; budgets | |

Cross-cutting: live budget meters (engine hard + house soft); linter panel (§8); Variants (immutable versions, field-level diff, take log); exports (§3.1); house presets (Jinn Egyptian-trap bundle seeded first); intake (§5); library (§4).

### 3.1 Export set (per target)

- **Suno:** three-field paste (Style / Exclude / Lyrics-structure) as `.txt` with field headers and live counts; toggle state noted.
- **ElevenLabs Music:** web-app paste (prompt + lyrics) as `.txt`; v2 composition-plan `.json` for API users.
- **Google Flow Music:** Compose-sheet paste (`Sound`, `Lyrics`/structure, `BPM`, `Length`, `Title`, Instrumental state) as `.txt` with per-field blocks, plus a **Producer script**: numbered instructions compiled from the D7 structure and, for a Variant, from the diff against its parent — bar-numbered changes converted to time ranges via bar math (e.g. "trim from 40s to 48s"). Seed from the Take log is printed when reproducing a kept take. Profile: `engine-profile-flow.json`.
- **Udio:** halted; no export.
- **Engine-agnostic:** JSON preset (per `formatting-ui-preset-exports`), word-MIDI blueprint `.md` (DAW-side truth; never pasted into an engine), MusicSpec `.json`.

---

## 4. Library

### 4.1 Entities

| Entity | Purpose | Persistence |
|--------|---------|-------------|
| StyleProfile | reusable partial spec (no structure, no output intent) with provenance and tags | Supabase |
| Song | a MusicSpec plus its Variants and Takes | Supabase |
| Variant | immutable version of a Song's spec with diff to parent and per-target overrides | Supabase |
| Take | one external render logged against a Variant: engine, verdict, drift, words blamed | Supabase |
| Genre | definition, criteria, profiling instruction, drift risks, engine notes | Supabase (curated) |
| Instrument, Technique, Rhythm, Mode, RegionalBundle, DrumPattern, SynthRole | taxonomy banks | Supabase (curated), cached client-side |
| Tag | free labels with optional colour, applied to any entity | Supabase |
| ReferenceAsset | local audio/image reference; only metadata + features leave the device | OPFS/IndexedDB (blob) + Supabase (metadata, features) |

### 4.2 Schema

```ts
export type Role = 'lead' | 'stab' | 'sub' | 'bass' | 'pad' | 'arp' | 'texture' | 'rhythm' | 'drone' | 'counter';
export type Reliability = 'reliable' | 'approximate' | 'unreliable';

export interface Provenance {
  kind: 'audio-analysis' | 'hand-built' | 'imported' | 'derived-from-song';
  sourceRef?: string;               // ReferenceAsset id or Song id
  analysedOn?: string;
  model?: string;                   // LLM/tagger identifiers used to draft it
}

export interface StyleProfile {
  id: string;
  ownerId: string;
  name: string;
  provenance: Provenance;
  spec: Partial<Pick<MusicSpec, 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D8' | 'D9'>>;
  features?: AudioFeatures;         // present when provenance.kind === 'audio-analysis'
  genreIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AudioFeatures {
  durationSec: number;
  bpm: { value: number; confidence: number; halfTimeCandidate: number; doubleTimeCandidate: number };
  meter: { signature: '4/4' | '3/4' | '6/8' | '12/8' | 'unknown'; confidence: number };
  key: { tonic: string; mode: string; confidence: number };      // mode from a fixed vocabulary incl. maqam names
  loudness: { integratedLufs: number; loudnessRange: number };
  energyCurve: number[];            // normalised 0–1, one value per 4 bars at detected bpm
  sections: { startSec: number; endSec: number; label?: string; energy: number }[];
  spectral: { centroidHz: number; brightness: number; subWeight: number; transientDensity: number };
  tags: { label: string; score: number; source: string }[];      // instrument/genre/mood tags from the tagging model
}

export interface Song {
  id: string;
  ownerId: string;
  title: string;
  brand: 'VASEY.AUDIO';             // output brand; the tool is VASEY/AI
  spec: MusicSpec;                  // working copy
  activeTarget: EngineId;
  styleProfileIds: string[];        // profiles applied at creation or later
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FieldDiff { path: string; before: unknown; after: unknown; }

export interface Variant {
  id: string;
  songId: string;
  label: string;                    // 'v1.0', 'v1.1', 'v1.2'
  parentVariantId?: string;
  specSnapshot: MusicSpec;
  diff: FieldDiff[];                // against parent
  overrides: TargetOverride[];
  coverage: Record<EngineId, CoverageReport>;
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
  renderRef?: string;               // engine-side id or URL, never the audio
  verdict: 'keep' | 'kill' | 'extend' | 'rerun';
  drifted: DriftKind[];
  wordsBlamed: string[];            // structured; feeds EngineProfile.driftWords review queue
  notes: string;
  createdAt: string;
}

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
  profilingInstruction: string;     // the instruction Claude follows when drafting a StyleProfile in this genre
  driftRisks: string[];
  engineNotes: Partial<Record<EngineId, string>>;
  eraTags: string[];
}

export interface Instrument {
  id: string;
  name: string;
  family: 'string' | 'wind' | 'brass' | 'percussion' | 'keyboard' | 'voice' | 'electronic' | 'other';
  region?: string;
  register: ('sub' | 'bass' | 'low-mid' | 'mid' | 'high-mid' | 'high')[];
  timbre: string[];                 // 'nasal', 'breathy', 'buzzing', 'plucked', 'bowed'
  articulationIds: string[];        // Technique ids of class 'articulation'
  playStyles: string[];             // 'taqsim', 'tremolo runs', 'pizzicato'
  idiomaticRoles: Role[];
  aliases: Partial<Record<EngineId, string>>;        // 'tabla' → 'Egyptian tabla darbuka' on suno
  reliability: Partial<Record<EngineId, Reliability>>;
  bundleIds: string[];
  description: string;
  promptPhrase: string;             // emitted text; generic, never an artist or producer name
  commonNames: string[];            // brand-derived or colloquial terms users type ("808", "Rhodes")
}

export interface Technique {
  id: string;
  name: string;
  class: 'articulation' | 'dynamics' | 'ornament' | 'harmony' | 'rhythm' | 'form' | 'texture' | 'production';
  description: string;
  applicableTo: ('instrument' | 'section' | 'song')[];
  meterRisk: boolean;               // hemiola, polymeter, rubato → warn under meter lock
  promptPhrase: string;             // the exact wording the serializer emits
  engineReliability: Partial<Record<EngineId, Reliability>>;
}

export interface Rhythm {
  id: string;
  name: string;                     // 'maqsum'
  meter: string;                    // '4/4'
  fourFourSafe: boolean;
  notation: string;                 // 'D T - T D - T -'
  region: string;
  role: string;                     // 'default groove', 'trance', 'finale drive'
}

export interface Mode {
  id: string;
  name: string;                     // 'Hijaz'
  family: 'western' | 'maqam' | 'raga' | 'pentatonic' | 'synthetic';
  intervalsCents: number[];         // from tonic; 150 marks a neutral second
  quarterTones: boolean;
  reliability: Partial<Record<EngineId, Reliability>>;
  colour: string;                   // 'dark, mournful, cinematic'
}

export interface RegionalBundle {
  id: string;
  name: string;                     // 'Egypt — takht + Sa'idi + Nubian'
  region: string;
  instrumentIds: string[];
  rhythmIds: string[];
  modeIds: string[];
  techniqueIds: string[];
  anchorInstrumentId: string;       // the load-bearing bridge into the trap layer (doholla, guembri)
  notes: string[];
}

export type KitPiece = 'kick' | '808' | 'snare' | 'clap' | 'rim' | 'hat-closed' | 'hat-open' | 'perc-1' | 'perc-2' | 'crash' | 'ride';

export interface DrumPattern {
  id: string;
  name: string;
  genreId?: string;
  bpmRange: [number, number];
  feel: 'straight' | 'half-time' | 'double-time' | 'swung';
  grid: Partial<Record<KitPiece, number[]>>;       // 16th-slot indices 0–15 per bar
  rolls: { piece: KitPiece; subdivision: 32 | 64; slots: number[] }[];
  regional: { rhythmId: string; instrumentId: string }[];
  prose: string;                    // serializer output cache
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
  name: string;                     // 'pitch-bending distorted saw lead'
  role: Role;
  characteristics: SynthCharacteristics;
  position: { sectionIds: string[]; phrases: number[]; beats: number[] };
  prose: string;
}

export interface Tag { id: string; ownerId: string; label: string; colour?: string; }

export interface ReferenceAsset {
  id: string;
  ownerId: string;
  kind: 'audio' | 'image';
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  localOnly: true;                  // v1 invariant
  features?: AudioFeatures;         // audio
  palette?: { hex: string; weight: number }[];   // image
  createdAt: string;
}
```

### 4.3 Library page

- Tabs: Songs · Style Profiles · Banks (Instruments, Techniques, Rhythms, Modes, Bundles, Drum Patterns, Synth Roles) · References · Tags.
- Any StyleProfile → "New song from profile" (applies D1–D6, D8, D9; leaves D7/D10 to the composer) or "Apply to current song" (field-level merge with diff review).
- Any Variant → "Fork" (new Variant), "Compare" (field diff + payload diff per target), "Log take".
- Banks are read-only for users in v1; Sean's curator role can edit.

---

## 5. Intake pipelines

### 5.1 Reference audio → StyleProfile (v1)

1. **Import** (drag/drop, file picker, iOS share sheet). Blob to OPFS; sha256 for dedupe. Never uploaded.
2. **Analyse on-device** (Web Audio + WASM): duration, bpm with half/double-time candidates, meter estimate, key/mode estimate (chroma; maqam candidates only when the chroma profile is inconsistent with 12-TET modes), integrated loudness and range, energy curve, section boundaries (novelty), spectral descriptors, transient density.
3. **Tag** (server, optional): a music-tagging model returns instrument/genre/mood tags with scores. Input is an embedding or a downsampled, time-limited excerpt computed client-side — never the full-resolution file. Model choice is an open item (§11); it must be swappable and its identifier is stored in `Provenance.model`.
4. **Draft**: Claude receives `AudioFeatures` + the matched `Genre.profilingInstruction` + Sean's house rules, and returns a proposed `StyleProfile.spec` as an IR patch. Claude writes from structured features; it does not listen to the file. That keeps the step deterministic to audit, cheap, and independent of whichever model can or cannot take raw audio this quarter.
5. **Review**: proposed fields appear in the composer as a diff; accept/reject per field; save to Library.
6. **Invariants**: the profile describes traits, never identity — no artist or producer names, no song-ID/fingerprint lookup; lineage invariant applies to the draft step's output; the raw file is `localOnly: true`.

### 5.2 Voice memo → IR patch (v1.1)

Upload → ASR job → **correction-review screen** (mishears listed back, not silently fixed) → Claude maps confirmed transcript to IR patch → field diff review. Deferred because the review screen is a real UI; the v1 workaround is transcribe locally and paste (§5.3).

### 5.3 Text / brief → IR patch (v1)

Paste any brief or transcript → Claude proposes an IR patch → field diff review. Same review component as §5.1 step 5.

### 5.4 Image → mood/palette (v1.1)

Image stays local; palette extraction on-device; Claude maps palette + user notes to D2 mood vocab and D9 mix character. Deferred with §5.2.

---

## 6. Metronome + tap tempo (Module 1)

- **Metronome**: Web Audio lookahead scheduler (25 ms tick, 100 ms lookahead); accent on 1; optional half-time accent mode (accents 1 and 3 as felt-tempo downbeats so a 140 half-time trap grid can be auditioned as 70); subdivision click off / 8ths / 16ths; volume; runs in the background tab where the platform allows.
- **Tap tempo**: intervals between consecutive taps; rolling mean of the last N (default 4, configurable 4–8); discard any interval > ±25 % from the running mean; reset after 2 s without a tap; display live BPM with ±1 tolerance and the half/double candidates; **Assign** writes the rounded integer into Form.tempo and records `tempoSource: 'tap'`.
- Bar math updates immediately (bar length, 8/16-bar block durations) — the same numbers the word-MIDI blueprint prints.

---

## 7. Module iconography

Rules: one hue per module, used for the icon stroke, the module header rule and the active-state glow only; panels stay void-dark glass. Monoline icons, single stroke weight, 400×400 viewBox per the existing SVG convention, no fills except the brand teal beam where a module is "armed". Hues expressed in OKLCH with fixed L/C for contrast on void dark: `oklch(78% 0.14 H)`.

| Module | Token | H | Icon motif |
|--------|-------|---|-----------|
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

Final palette and icon geometry are a Vector Iconography project deliverable; this table fixes the hue budget and motif so the two projects don't drift.

---

## 8. Linter rules (v1)

Inherited from the Jinn thread:
1. Meter lock on → flag every drift word and every non-4/4 rhythm name in the IR and in each compiled payload.
2. Cap named instruments per section (default 8, warn at 6).
3. Scrub artist/producer names from payloads (lineage pass runs before serialization; second pass on the compiled text).
4. Per-field budgets, hard and soft, with live counts.
5. Style output ordered by priority, not by UI field order.
6. Every contrast phrase carries a bounded return rule.
7. Regional consistency: instruments, rhythms and modes from one bundle unless a cross is flagged.

New in this scope:
8. Coverage floor: warn when a target's `CoverageReport.score` < 0.8; block export when a `dropped` item is in D6 (theory) or D7 (structure) without acknowledgement.
9. Reliability: warn when a Mode or Instrument is `approximate`/`unreliable` for the active target; suggest the nearest reliable substitute.
10. Technique–meter conflict: any `meterRisk` technique under meter lock warns.
11. Engine banned terms: flag `EngineProfile.bannedTerms` hits per target.
12. Override staleness: a `TargetOverride` whose `basedOnCompiledHash` no longer matches the current compile is flagged for review.
13. Profile provenance: a StyleProfile with `provenance.kind === 'audio-analysis'` and `features.bpm.confidence` < 0.6 shows a low-confidence badge until a human edits tempo.

---

## 9. Taxonomy seed plan

Launch seed (fully populated, curated by Sean). The instrument floor is defined in `instrument-bank-seed-v0.1.md`: General MIDI Level 1 (128 programs) plus the GM percussion key map and GM2 drum kits as the enumerable baseline, then orchestral/symphonic, concert/brass/marching band, jazz big band, contemporary popular (guitars, basses, keys), synth archetypes, acoustic kits, drum machines and digitized-sample kits, genre kits, and world sets including everything used in Jinn v1.0–v1.2.
- **Bundles:** Egypt (takht, Sa'idi, Nubian; anchor: doholla + low oud) from Jinn v1.1; Morocco/Amazigh (anchor: guembri) from Jinn v1.0 as the second bundle to prove the cross-bundle flag.
- **Drum patterns:** Atlanta trap core (half-time, 808 to key, clap-snare on 3, 16th hats, 32nd rolls) and drill contrast (sliding 808, displaced snare, 3-3-2 hats) from Jinn v1.2; Egyptian iqa'at in doum/tek with `fourFourSafe` flags (maqsum, baladi, Sa'idi, wahda, malfuf, ayyub = true; samai thaqil, karsilama, yuruk semai = false).
- **Modes:** D Hijaz, Nahawand, Hijaz Kar, Saba, Bayati, Rast, plus the Western set.
- **Synth roles:** pitch-bending amp-sim-distorted saw lead with glide; ripping crackling distorted hypersaw stab; saturated saw sub for low-mid glue; dark pad; low-passed arp. Described by trait, never by patch or producer name in payloads.
- **Genres:** Egyptian trap, Atlanta trap, drill (as contrast), cinematic hybrid finale, each with `profilingInstruction` and `driftRisks`.
- **Techniques:** articulations (slide, bend, tremolo, glissando, staccato, legato, trill), dynamics (pp–ff, crescendo, sub drop), ornaments (Sa'idi trill, taqsim), harmony (drone, pedal, Neapolitan hinge, modal interchange), rhythm (pickup bar, hemiola — `meterRisk: true`), form (call/answer, contrast phrase, silence drop), production (side-chain pump, filter sweep, auto-pan).

Growth pipeline: Claude drafts batches against the schema (one bundle or one instrument family per batch) → Sean approves in the curator view → published to the bank with a `verifiedOn`. No user-generated taxonomy in v1.

---

## 10. Build order (revised)

Phase B — Spec (Claude, Sean approves)
- IR v0.3 delta: meter lock, pickup bar, contrast phrase, synth role + position, per-section cap, open pocket, typed reference block (StyleProfile is its resolved form), intake patch.
- EngineProfile JSON for Suno v6 (verified), Eleven v2 (partial → verify in the live app), Flow / Lyria 3.5 (surface verified 2026-09-16; `engine-profile-flow.json`), Udio (halted stub).
- Composer IA + component contracts per module; library IA.
- Capability matrix update: Suno v6, Flow Music / Lyria 3.5, Udio status.

Phase C — Build (Claude Code, Sean reviews)
- Retrofit starter kit v3.0 + CLAUDE.md v3.0 on the compiler repo; carve `musicspec` core with the import boundary.
- Serializers in order: Suno v6 → Eleven v2 → Flow (Compose sheet + Producer script). Udio: none.
- Library + Variants + Takes; tap/metronome; text intake; audio analysis (on-device features first, tagging model second).
- Seed taxonomy per §9; wire linter (§8).

Phase D — Validate
- Rebuild Jinn v1.2 through the app. Oracle is three checks: clause coverage (every v1.2 clause maps to a field or rule), lint/budget parity, A/B render on Suno holds 4/4. Text diff is informational only.
- Import one of Sean's own finished tracks; the resulting StyleProfile must reproduce its D1/D6/D9 within Sean's tolerance without naming anyone.

---

## 11. Open items and verifications pending

- Google Flow Music: character limits on Sound and Lyrics; whether Lyrics accepts section tags with Instrumental ON (placeholder switches to "Instrumental"; may be disabled); Length units and maximum; whether Compose BPM is a hard lock or guidance; Producer-chat command grammar for section-level edits. Surface itself verified from screenshots 2026-09-16.
- ElevenLabs Music v2: web-app field limits and instrumental behaviour; confirm v2 (not v1) as the serializer target — sections in the v2 plan map directly to D7.
- Udio: halted by decision; profile notes re-verified quarterly, no UI surface.
- Tagging model for §5.1 step 3 (candidates via Hugging Face; must run on client-computed embeddings or short excerpts; store model id in provenance).
- Whether any LLM in the stack accepts raw audio is irrelevant to the design above and was not verified this session.
- Domain/trademark screen on EVAWAVE (declined in-session; Sean).
- iOS PWA storage: OPFS quota and eviction behaviour for reference audio; decide an on-device cap and an eviction warning.
- Lockup: `EVAWAVE` vs `EVA/WAVE` — brand pass.
