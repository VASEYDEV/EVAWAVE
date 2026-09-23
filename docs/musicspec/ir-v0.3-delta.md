# MusicSpec IR — v0.3 Delta

VASEY/AI · 2026-09-16 · status: PROPOSED (decision-gated) · applies on top of MusicSpec IR v0.2 (D1–D10)
Repo target: `docs/musicspec/ir-v0.3-delta.md`

---

## 0. Scope and assumptions

- **Additive only.** Every new field is optional with a stated default; a valid v0.2 document is a valid v0.3 document without migration.
- The v0.2 type file is not in this session. Field names below are the delta's own; §7 says which v0.2 dimension container each attaches to. Where v0.2 already carries an equivalent, keep the v0.2 name and adopt the semantics here. Merge is a Phase C task.
- Sources: the Jinn v1.0→v1.2 thread (meter drift failure and fix, pickup bars, bounded drill contrast, synth roles with positions, per-section instrument caps, regional bundles) and EVAWAVE scope v0.2 (typed references, intake patches, target coverage). The per-trait weighting item is carried from the v0.2 horizon list.
- Serializers stay pure: every primitive below has a deterministic compile rule per engine (§6). Nothing here changes the payload firewall.

---

## 1. Shared types

```ts
export type Beats = 1 | 2 | 3;                      // a pickup is sub-bar by definition
export type Signature = '4/4' | '3/4' | '6/8' | '12/8' | '5/4' | '7/8';
export type Feel = 'straight' | 'half-time' | 'double-time' | 'swung' | 'shuffled';
export type DynamicMark = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
export type SectionKind =
  | 'intro' | 'build' | 'hook' | 'verse' | 'pre' | 'bridge' | 'break' | 'drop' | 'finale' | 'outro' | 'custom';
export type TempoSource = 'manual' | 'tap' | 'analysis' | 'profile';
export type EngineId = 'suno' | 'eleven' | 'flow' | 'udio';

/** Per-trait weighting, generalized beyond D1 (carried from the v0.2 horizon list). */
export interface Weighted<T> {
  value: T;
  weight: number;                                   // 0–1; absent wrapper = 1. Serializers order by weight, then by dimension priority.
}
```

---

## 2. D6 theory — tempo and meter lock

```ts
export interface Tempo {
  bpm: number;                                      // integer
  source: TempoSource;                              // default 'manual'
  feltBpm?: number;                                 // derived: bpm/2 for half-time, bpm*2 for double-time; never hand-set
}

export interface MeterLock {
  enabled: boolean;                                 // default false
  signature: Signature;                             // default '4/4'
  feel: Feel;                                       // 'swung' | 'shuffled' are rejected while enabled (lint ML-3)
  subdivision: 8 | 16 | 32;                         // the grid named in the payload ("straight 16ths"); default 16
  driftSuppression: boolean;                        // default true when enabled
  allowedExtensions: ('pickup-bar' | 'silence-drop' | 'contrast-phrase')[];  // the only permitted meter events
  restatement: 'style-only' | 'style-and-sections'; // where the lock text is emitted; default 'style-and-sections'
}
```

Semantics: when `enabled`, the lock text is front-loaded in the engine's style-equivalent field, the meter-drift negative class is populated automatically (§5), and every rhythm reference in every section is checked against `signature` (lint ML-1, ML-2). Sections are still allowed to *describe* tempo feel ("perceived tempo halves in the bridge") because that is dynamics, not meter.

---

## 3. D7 structure — sections, pickups, contrast, silence, transitions

```ts
export interface PickupBar {
  beats: Beats;
  content: string;                                  // "snare roll, riser"
  returnTo: Signature;                              // must equal MeterLock.signature when the lock is on (lint PB-1)
}

export interface SilenceDrop {
  beats: number;                                    // 1–8
  position: 'start' | 'end';
}

export interface ContrastPhrase {
  styleId: string;                                  // Genre or DrumPattern id, e.g. 'drill-contrast'
  bars: number;                                     // lint CP-2: ≤ 25% of the section by default
  position: 'start' | 'end';
  changes: string[];                                // 'sliding 808s', 'displaced snare', '3-3-2 hats'
  returnRule: string;                               // REQUIRED, non-empty: "then back to trap grid" (lint CP-1)
}

export type TransitionKind =
  | 'riser' | 'filter-sweep-open' | 'filter-sweep-close' | 'reverse-cymbal' | 'snare-roll'
  | 'timpani-roll' | 'choir-swell' | 'sub-drop' | 'hard-stop' | 'silence' | 'crossfade' | 'none';

export interface Transition {
  kind: TransitionKind;
  bars?: number;                                    // lead-in length; default 2
  beats?: number;                                   // for hard-stop / silence
  note?: string;
}

export interface SectionScope {
  instrumentIds: string[];
  synthRoleIds: string[];
  techniqueIds: string[];
  percussionRhythmIds: string[];                    // regional iqa'at etc.; each checked against MeterLock (lint ML-2)
}

export interface OpenPocket {
  kind: 'rap' | 'sung' | 'none';                    // default 'none'
  note?: string;                                    // "open pocket for rap"
}

export interface Section {
  id: string;
  kind: SectionKind;
  label: string;                                    // 'Hook B'
  bars: number;                                     // any positive integer; 8/16 by convention
  dynamics: DynamicMark;
  scope: SectionScope;
  drumState: string;                                // 'full Atlanta trap' | 'stripped: 808 root, kick, snare, hats in 8ths' | 'none'
  bassState: string;                                // '808 on D, no glides' | 'soft 808 pulse' | 'low oud only'
  leadNote?: string;
  textureNote?: string;
  harmony?: string;                                 // 'Dm · B♭ · Gm · A, two bars each'
  modeId?: string;                                  // per-section override: 'saba' intro, 'hijaz-kar' finale
  openPocket: OpenPocket;
  pickupBefore?: PickupBar;
  contrast?: ContrastPhrase;
  silenceAfter?: SilenceDrop;
  transitionOut: Transition;                        // default { kind: 'none' }
}

export interface BarMath {                          // derived, never hand-edited
  barSec: number;
  block8Sec: number;
  block16Sec: number;
  runtimeSec: number;
  sectionStarts: { sectionId: string; bar: number; sec: number }[];
}

export interface Structure {
  sections: Section[];
  blockSize: 8 | 16;                                // default 8
  runtimeTargetSec?: number;
  derived?: BarMath;
}
```

Section-count and bar arithmetic: `runtimeSec = Σ(section.bars + pickupBeats/beatsPerBar) × barSec`, with `barSec = beatsPerBar × 60 / bpm`. Pickups are counted; contrast phrases are inside their section's bars; silence drops are counted in beats.

---

## 4. D5 instrumentation — bundles, synth roles with position, caps

```ts
export interface BundleUse {
  bundleId: string;                                 // RegionalBundle id
  anchorInstrumentId: string;                       // the load-bearing bridge into the low end (doholla, guembri)
  crossBundle?: { withBundleId: string; reason: string };  // required to mix bundles (lint RB-1)
}

export interface SynthRolePosition {
  sectionIds: string[];
  phrases: number[];                                // 1-based phrase indices within the section; [] = all
  beats: number[];                                  // 1-based beats within the bar; [] = free
}

export interface SynthRoleUse {
  synthRoleId: string;                              // SynthRole record (characteristics live there)
  position: SynthRolePosition;
  proseOverride?: string;                           // replaces the record's promptPhrase for this song only
}

export interface SectionCap {
  warnAt: number;                                   // default 6
  blockAt: number;                                  // default 8
}

export interface InstrumentationDelta {
  bundles: BundleUse[];
  synthRoles: SynthRoleUse[];
  sectionCap: SectionCap;
}
```

A section's "named instruments" for the cap = `scope.instrumentIds ∪ synthRoleIds ∪ percussionRhythm instruments`. Sections and ensembles count as one each (an Instrument record of a section is one item).

---

## 5. D8 vocals, D10 output intent, references, intake patch

```ts
// ---- D8
export interface VocalsDelta {
  instrumental: boolean;                            // default false
  lyricsPassthrough?: string;                       // user-authored only; EVAWAVE never writes lyrics
}

// ---- D10
export type NegativeClass = 'vocals' | 'meter-drift' | 'genre-bleed' | 'instrument-ambiguity' | 'custom';

export interface NegativeSpace {
  class: NegativeClass;
  terms: string[];
  auto?: boolean;                                   // true when populated by MeterLock or the instrumental flag
}

export interface OutputIntentDelta {
  targets: EngineId[];                              // pre-selected; default ['suno']
  activeTarget: EngineId;                           // a view, not a mutation
  houseBudgets: Record<string, number>;             // '<engine>.<field>' or '<engine>.total' → soft cap
  negativeSpace: NegativeSpace[];
}

// ---- Root-level references (typed reference block)
export type ReferenceKind = 'audio' | 'image' | 'song' | 'style-profile' | 'text';
export type ReferenceRole =
  | 'style' | 'mood' | 'palette' | 'structure' | 'tempo' | 'drum-grammar' | 'instrumentation';

export interface Provenance {
  kind: 'audio-analysis' | 'hand-built' | 'imported' | 'derived-from-song';
  sourceRef?: string;
  analysedOn?: string;
  model?: string;
}

export interface Reference {
  id: string;
  kind: ReferenceKind;
  roles: ReferenceRole[];
  assetId?: string;                                 // ReferenceAsset (local-only) or Song / StyleProfile id
  resolvedStyleProfileId?: string;                  // traits only; payloads never see the reference itself
  weight: number;                                   // 0–1
  provenance: Provenance;
}

// ---- Intake patch
export interface PatchOp {
  op: 'set' | 'merge' | 'append' | 'remove';
  path: string;                                     // JSON-pointer into the MusicSpec, e.g. '/D6/tempo/bpm'
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
```

Patches are applied only through the review diff; a patch with `status: 'proposed'` never touches the working spec. The lineage pass runs on every `value` before it is shown, so an artist name in an intake proposal is stripped before the user sees it.

---

## 6. Serializer contracts per primitive

| Primitive | Suno v6 | ElevenLabs Music v2 (composition plan) | Google Flow Music |
|-----------|---------|----------------------------------------|-------------------|
| MeterLock | Front-loads Style: "strict 4/4 common time, 140 BPM half-time, straight 16ths, no swing". Populates Exclude with the meter-drift class. With `restatement: 'style-and-sections'`, each bracket restates the feel once. | First chunk `positive_styles` gets the lock terms; every chunk's `negative_styles` gets the drift class. `duration_ms` per chunk is computed from bars × barSec, which enforces the grid better than prose. | Front-loads Sound; writes `BPM` numerically; negatives inline at the end of Sound (approximated: no exclude field). |
| Tempo | "140 BPM half-time" in Style; Manual BPM step in post-render notes. | BPM in first chunk `positive_styles`; chunk durations carry the real timing. | `BPM` field plus restatement in Sound. |
| PickupBar | Its own bracket: `[Two-beat pickup bar – snare roll, riser, back to 4/4]`. | Folded into the tail of the preceding chunk's `text` as an inline direction `{two-beat pickup: snare roll, riser}` because chunks have a minimum length. | Producer script line ("add a two-beat snare-roll pickup before the second hook"); Lyrics tag only if section-tag support verifies. |
| ContrastPhrase | Appended clause inside the section bracket: "last 4 bars drill contrast: sliding 808s, displaced snare, then back to trap grid". | Its own chunk: `positive_styles` from the contrast style, `duration_ms = bars × barSec`, `negative_styles` inherited; the next chunk restates the core style (the return rule). | Producer script: "for the last 4 bars of the second hook, switch to sliding 808s and a displaced snare, then return to the trap grid". |
| SilenceDrop | `[Drop to silence]` as its own bracket. | `{silence}` at the end of the chunk's `text` (sub-minimum, so inline). | Producer script: "cut everything to silence for one beat before the bridge". |
| Transition | Clause at the end of the bracket ("riser and reverse cymbal into the hook"); the 8/16-bar rule stated once in Style. | Inline `{riser}` / `{reverse cymbal}` at chunk end. | Sound clause ("risers and filter sweeps at 8 and 16 bars") plus Producer lines where per-section. |
| SectionScope + cap | Bracket lists instruments in the fixed order: drum state, bass, lead, texture, FX, pocket. Lint SC-1 warns at 6, blocks at 8. | Chunk `positive_styles` lists the section's instruments (≤50 qualities per plan chunk). | Producer per-section lines; Sound lists the song-wide palette. |
| SynthRoleUse | promptPhrase in Style (song-wide) and in the brackets of `position.sectionIds`; beats/phrases become prose ("hypersaw stabs on 2 and 4"). | promptPhrase in the `positive_styles` of the positioned chunks only. | Sound (song-wide) + Producer lines. |
| BundleUse | Bundle instruments and 4/4-safe rhythms named in Style; aliases applied. | Same into first-chunk styles; aliases applied. | Same into Sound. |
| OpenPocket | "open pocket for rap" inside the bracket. | Chunk `text` = `[Hook]\n{instrumental break}`; chunk `negative_styles` += "lead vocals". | Producer line; Instrumental toggle covers the song-wide case. |
| VocalsDelta | Instrumental toggle ON; Lyrics field = structure only. Passthrough lyrics go to Lyrics with toggle OFF. | Lyrics as plain lines in chunk `text`; instrumental via `{instrumental break}` per chunk or the request flag. | Instrumental toggle; passthrough lyrics into Lyrics. |
| NegativeSpace | Exclude Styles field, classes in order: vocals, meter drift, genre bleed, instrument ambiguity, custom. | First chunk `negative_styles` (global) plus per-chunk copies. | Inline sentence at the end of Sound; coverage report marks `approximated`. |
| Reference | Never serialized. Resolved StyleProfile traits flow through D1–D9. | Same. `AudioRefChunk` is deliberately unused in v1 (would upload audio). | Same; Flow's own reference upload is left to the user. |
| Weighted<T> | Orders terms within a field; nothing else. | Orders `positive_styles`; first chunk gets the top-weighted. | Orders Sound. |

---

## 7. Attachment map (v0.2 container → v0.3 field)

| v0.3 field | Attaches to | Default |
|------------|-------------|---------|
| `Tempo` | D6 theory profile | `{ bpm: 120, source: 'manual' }` |
| `MeterLock` | D6 theory profile | `{ enabled: false, signature: '4/4', feel: 'straight', subdivision: 16, driftSuppression: true, allowedExtensions: [], restatement: 'style-and-sections' }` |
| `Structure` (sections with pickups, contrast, silence, transitions, scope, pocket) | D7 structure — replaces any flat section list additively (old sections map to `kind`, `label`, `bars`) | `{ sections: [], blockSize: 8 }` |
| `InstrumentationDelta` | D5 instrumentation | `{ bundles: [], synthRoles: [], sectionCap: { warnAt: 6, blockAt: 8 } }` |
| `VocalsDelta` | D8 vocals | `{ instrumental: false }` |
| `OutputIntentDelta` | D10 negative space + output intent | `{ targets: ['suno'], activeTarget: 'suno', houseBudgets: {}, negativeSpace: [] }` |
| `references: Reference[]` | MusicSpec root (new) | `[]` |
| `patches: IRPatch[]` | MusicSpec root (new); working-copy only, not part of a Variant snapshot | `[]` |
| `Weighted<T>` | D1 (already), D2 mood terms, D4 lineage traits, D5 instrument entries | wrapper absent = weight 1 |

---

## 8. Linter rules keyed to primitives

| Id | Rule | Severity |
|----|------|----------|
| ML-1 | MeterLock on → any `driftWords` (per engine profile) in any prose field, section note, technique `promptPhrase` or instrument `playStyles` | warn (block on `driftSuppression` and the term is in the engine's list) |
| ML-2 | MeterLock on → any `percussionRhythmIds` whose `Rhythm.meter ≠ signature` or `fourFourSafe === false` under 4/4 | block |
| ML-3 | MeterLock on with `feel` swung/shuffled | block |
| ML-4 | MeterLock on → negative-space class `meter-drift` absent | auto-fix (populate, `auto: true`) |
| PB-1 | `PickupBar.returnTo ≠ MeterLock.signature` while locked | block |
| PB-2 | Pickup or silence used while not listed in `allowedExtensions` | warn |
| CP-1 | `ContrastPhrase.returnRule` empty | block |
| CP-2 | `ContrastPhrase.bars > 0.25 × section.bars` | warn |
| CP-3 | Contrast `styleId` shares no meter with the lock | block |
| SC-1 | Named instruments in a section ≥ `warnAt` / ≥ `blockAt` | warn / block |
| SC-2 | A `synthRoleId` positioned in a section not in its `scope` | warn |
| RB-1 | Two bundles used without `crossBundle` | warn |
| RB-2 | A section `modeId` outside every used bundle's `modeIds` with no cross flag | warn |
| RB-3 | Instrument or mode `reliability` is `approximate`/`unreliable` for the active target | warn with substitute |
| TQ-1 | A technique with `meterRisk` under MeterLock | warn |
| LN-1 | Artist or producer name in any prose field, patch value or override | block (lineage pass) |
| BG-1 | Text field over `hardLimit`, or number field outside `min`/`max` | block |
| BG-2 | Field over `softLimit` or `houseBudgets` | warn |
| CV-1 | Coverage score < 0.8 for the active target | warn |
| CV-2 | A `dropped` item in D6 or D7 without acknowledgement | block export |
| OV-1 | TargetOverride `basedOnCompiledHash` stale | warn |
| PT-1 | Patch op with `confidence < 0.5` | shown as low-confidence in the diff |
| PT-2 | Patch op targeting `references` or `patches` paths | block (patches may not edit provenance) |

---

## 9. Worked example — Jinn v1.2, Hook B as a `Section`

```json
{
  "id": "hook-b",
  "kind": "hook",
  "label": "Hook B",
  "bars": 8,
  "dynamics": "f",
  "scope": {
    "instrumentIds": ["tabla-egyptian", "mizmar", "qanun", "oud", "kick-808-sub", "snare-clap-stack", "hat-16th"],
    "synthRoleIds": ["stab-hypersaw-crackling", "lead-saw-pitchbend"],
    "techniqueIds": ["saidi-trill", "tremolo-runs"],
    "percussionRhythmIds": ["saidi"]
  },
  "drumState": "full Atlanta trap, harder than Hook A",
  "bassState": "808 on D with glides",
  "leadNote": "mizmar lead stabs over the oud hook; qanun runs",
  "textureNote": "ripping crackling distorted synth stabs; hypersaw stabs on 2 and 4",
  "modeId": "hijaz",
  "openPocket": { "kind": "rap", "note": "open pocket for rap" },
  "pickupBefore": { "beats": 2, "content": "filter sweep closing, two-beat drum-roll pickup", "returnTo": "4/4" },
  "contrast": {
    "styleId": "drill-contrast",
    "bars": 4,
    "position": "end",
    "changes": ["sliding 808s", "displaced snare"],
    "returnRule": "then back to trap grid"
  },
  "silenceAfter": { "beats": 4, "position": "end" },
  "transitionOut": { "kind": "silence", "beats": 4 }
}
```

Suno compile of this section (deterministic):

```
[Filter sweep closing, two-beat drum-roll pickup]

[Hook – harder, Sa'idi tabla, mizmar lead stabs, ripping crackling distorted synth stabs, hypersaw stabs on 2 and 4, qanun runs; last 4 bars drill contrast: sliding 808s, displaced snare, then back to trap grid; open pocket for rap]

[Drop to silence]
```

Eleven v2 compile: two chunks — `[Hook B]` at 4 × 1.714 s = 6857 ms with the Sa'idi/mizmar/hypersaw styles, then `[Hook B drill tail]` at 6857 ms with `positive_styles` from `drill-contrast` and the text `{sliding 808s, displaced snare}\n{silence}`; the Bridge chunk that follows restates the core style. Flow compile: Sound unchanged; Producer script lines 4–6 carry the pickup, the four-bar contrast with its return, and the one-beat cut.

---

## 10. Open items

- Confirm v0.2 field names for D5/D6/D7/D8/D10 containers and apply the attachment map (Phase C, first merge).
- Decide whether `Weighted<T>` applies to D9 mix terms as well; excluded here to keep serializer ordering simple.
- Eleven chunk minimum duration for pickups and silence: folding them inline is the current rule; if verification shows chunks under 3 s are accepted, promote them to chunks.
- Flow: if Lyrics accepts section tags with Instrumental ON, the Suno bracket compiler is reused for Flow's Lyrics field and the Producer script shrinks to revisions only.
