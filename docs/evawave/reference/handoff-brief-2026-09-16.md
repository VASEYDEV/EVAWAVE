# AI Song Prompt Generator — Handoff Brief

Source thread: "Jinn on the Dune" Suno prompt build (v1.0 → v1.2), Sept 14–16, 2026.
Purpose: give a new Claude chat everything it needs to (1) understand how that prompt was researched, constructed and formatted, (2) how Suno's fields shaped the composition, and (3) guide Sean's brainstorming and build of a bespoke, open-ended AI song-prompting app (name TBD).

Brand note: the app is a VASEY/AI tool. Its output serves VASEY.AUDIO. The two are separate brands; never conflate them in copy, naming or architecture.

---

## 0. How to reference this thread in the new chat

Attach to the first message:
1. This brief.
2. `Jinn_On_The_Dune_Suno_Prompt_v1.1_Egypt.md` (full blueprint: bar map, harmony, drum grammar, rhythm key, cover-to-sound mapping).
3. `Jinn_On_The_Dune_Suno_v1.2_condensed.md` (final three-field Suno paste, 2,779 chars).
4. The research brief artifact ("Egyptian-Influenced Atlanta Trap Beat: Suno v6 Prompt Rewrite and Sound Design Brief").

Chat search caveat: Claude's past-chat search is scoped. This thread lives outside any Project. If you open the new chat inside the "VASEY.AUDIO x VASEY/AI" Project, Claude cannot search this thread; the attached files are the record. If you open it outside a Project, you can additionally say: "Search my past chats for 'Jinn on the Dune Suno prompt' and read how the prompt was built."

Opening message template:

> Read the attached handoff brief first, then the two prompt files. Treat the brief's Section 1 as your working instructions for this session. I'm building an AI song-prompting app (name TBD). Start with the goals list in Section 7, confirm the Phase A decisions with me, then help me flesh out features. Decisions over options; state assumptions; push back when I'm wrong.

---

## 1. Instructions to Claude (paste-ready)

Role: senior product/architecture partner to Sean for a music-prompt-composer app. Sean is a producer/engineer with 20+ years and a full-stack architect; assume expert fluency in audio, theory, Next.js/PWA and design systems.

Read first, in order: this brief; the v1.2 condensed prompt; the v1.1 blueprint; the research brief. Then check memory for the existing "VASEY.AUDIO x VASEY/AI" compiler project (MusicSpec IR, compileSuno, engine capability matrix). Do not re-derive what those already contain.

Working style: terse, technically precise, dry. Decisions over options. State assumptions up front; one clarifying question max, only when blocked. Complete artifacts, no placeholders. Push back on theory, engineering or product errors. Specification-first and decision-gated on architecture and scope: propose, don't unilaterally resolve.

Hard rules:
- Artist and producer names never appear in compiled prompt payloads. Describe the sound; resolve names to trait bundles (Lineage invariant).
- Never claim engine specs, limits or version behaviours without a verification date; label community lore as unverified.
- Never reproduce lyrics.
- VASEY.AUDIO and VASEY/AI stay separate.

Session output contract: (a) a confirmed decision log, (b) an updated goals/to-do list with owners and status, (c) any specs or schemas produced as repo-liftable markdown, (d) a short "items to consider" delta at the end of each working block.

---

## 2. What the source thread did, step by step

Inputs collected
- A 3-minute voice memo (m4a with a .wav extension), transcribed locally with faster-whisper. ASR errors were listed back for confirmation rather than silently corrected ("zoludes" → ouds, "Catholic Dorians" → Gregorian choirs, "30 seconds" → 32nds, etc.).
- The album cover image, read for palette and mood and converted into a cover-to-sound mapping (horizon → drones, footprints → 808/doholla pulse, wind → nay breath and risers, sun → the Hijaz hook, indigo → sub depth, amber → brass and choir).
- Memory: the Jinn album context (Arabic desert mythology, amber/rust/indigo palette).
- Sean's own skill files, read before drafting: `generating-beat-prompts`, `auditing-audio-prompts`. Later relevant: `designing-prompt-composer-flows`, `drafting-agent-system-instructions`, `formatting-ui-preset-exports`, `designing-synth-patches`, `mapping-synth-parameters`, `translating-plugin-controls`, `building-negative-prompt-lists`.
- A research pass (Sept 15) covering: the Yamaha Motif "Dirty Hook" patch, Trackboyz credits and sound, Access Virus HyperSaw/unison/distortion, Suno v6 field behaviour, Egyptian iqa'at meters, Atlanta trap vs drill drum conventions.

Decision method
- Decide, don't list options. Every version opened with a "Decisions made" block.
- Push back on theory: the memo asked for Dorian; the raised 6th is Western, so the track went to D Hijaz (hooks), D Nahawand (bridge), D Hijaz Kar (finale cadence, leading tone matches the A-major dominant).
- Scope the palette per section (5–8 named instruments per section, not twenty in one prompt).
- Anchor authenticity on one load-bearing instrument that bridges to the trap layer (Morocco: guembri → 808; Egypt: doholla + low oud → 808).
- Give every synth a role and a position (which section, which phrase, which beats), not just a name.

Iteration history
- v1.0 (Morocco/Amazigh/Gnawa, 142 BPM, drill-forward).
- v1.1 (Egypt: Cairo takht, Sa'idi folk, Nubian tanbura, firqa unison strings, mahraganat org keyboard; zar ritual as thematic anchor; mizmar as drill lead; 4/4 iqa'at key with doum/tek notation).
- v1.2 (strict 4/4 after the generation drifted; Atlanta trap as the core, drill reduced to a 4-bar contrast tail; Motif-style pitch-bending saw lead, Virus-style hypersaw stabs, ripping crackling distorted stabs, saw sub for low-mid; 140 BPM; Instrumental toggle ON for v6; condensed to ≤3,000 chars total).

Failure and fix (the most reusable lesson)
- Symptom: the Suno render slipped into 6/8 and odd-length passages, unusable for a rap pocket.
- Root cause: drift vocabulary in v1.1 ("shuffled 16ths", "light shuffle", "rubato", "trance rhythm", "two cycles per bar", 2/4 folk rhythm names) plus per-section instrument overload.
- Fix: "strict 4/4 common time, straight 16ths, no swing" front-loaded in Style; drift words moved to Exclude; only 4/4 iqa'at named (maqsum, baladi, Sa'idi, wahda); meter extensions written as "two-beat pickup bar … back to 4/4"; drill isolated as a labelled contrast phrase.

Corrections surfaced by research (kept out of the prompt, fixed in notes)
- Motif "Dirty Hook" is PRE1 #43 / C11, Synth Lead, analog, with an Amp Simulator insert. Not #46.
- No primary source links Mannie Fresh to the Motif or that patch; describe the sound instead.
- "That Girl" is 2006; "Lean Low" originally 2003; no Ebony Eyez track "Stand Up" exists (likely "In Ya Face").

---

## 3. Suno mechanics as applied (Suno v6, verified Sept 15, 2026)

Verified
- v6 launched Sept 9, 2026 (v6, v6-wild, v6-mini). v5/v4.5 removed from the picker.
- Field limits: Style ~1,000 chars; Lyrics 5,000 (practical ceiling ~3,000 before the model rushes); Title 100; Exclude Styles maxlength 1,000 (Custom Mode → Advanced Options).
- Instrumental toggle ON + bracket tags in the Lyrics field: tags are read as directions, not sung. Structure control survives the toggle on v6.
- Exclude Styles is more reliable than inline "no X" in the Style field.
- BPM in the prompt is guidance, not a lock. Renders show tempo drift; Suno Studio → Manual BPM conforms stems to a fixed grid.
- Artist names in Style prompts get flagged or stripped; sonic description is the only safe path (and matches the Lineage invariant).

Community practice, not official
- Front-loaded tags carry more weight than later ones; order the Style field by priority.
- No official time-signature tag. "[4/4]" style meta-tags are community conventions. Writing "strict 4/4, straight time, no swing, no triplet feel" in Style plus Exclude entries is the working method.
- Drift words toward compound/odd feels: shuffle, swing, triplet feel, waltz, rubato, trance, and folk rhythm names in 6/8, 9/8, 10/8.

Update needed in the existing engine capability matrix: Suno entry says v5.5 (clipboard export). It is v6 now; Exclude limit 1,000; Instrumental toggle behaviour above.

---

## 4. How each field factored into the composition

Style field = the physics and the palette, in priority order:
1. Form and meter and tempo ("instrumental Egyptian Atlanta trap beat, strict 4/4 common time, 140 BPM half-time, straight 16ths, no swing").
2. Key and mode ("D Hijaz maqam, dark minor").
3. Drum grammar (808 character and tuning, snare/clap placement, rimshot fill role, hat subdivision).
4. Regional instruments and the 4/4 rhythms they play.
5. Synths by role (lead with glide and pitch-bend; ripping distorted hypersaw stabs; saw sub for low-mid).
6. Textures (wordless choir, pads).
7. Transition rules (risers and sweeps at 8 and 16 bars).
8. Bridge and finale behaviour in one clause each.
9. Mood and imagery.
10. Inline negation last ("No vocals, no lyrics").

Exclude Styles field = drift guards, four classes: vocals/lyrics, meter drift words, genre bleed (pop, EDM, reggaeton, jazz), instrument ambiguity (sitar, Bollywood, flamenco).

Lyrics field = the timeline. One bracket per section. Each bracket carries, in this order: section name; drum state; bass/808 state; lead instrument(s); texture; transition or FX; vocal pocket note. Pickup bars are their own bracket. Silence is its own bracket. Contrast phrases are labelled and bounded ("last 4 bars drill contrast … then back to trap grid").

Companion blueprint (word-MIDI) = never pasted into Suno. It holds the DAW-side truth: bar numbers and timestamps at the chosen BPM, hook motif in scale degrees, harmony per section, drum grammar by beat position, rhythm key in doum/tek notation, dynamics per section, FX automation with bar numbers. It exists so the Suno take can be reproduced or repaired by hand.

Character budgeting was done with a script, per field, before every delivery.

---

## 5. Mapping the thread onto the existing compiler (MusicSpec IR D1–D10)

The thread was a manual run of `compileSuno`. Every decision lands in an existing dimension:

- D1 genre stack: Egyptian trap → Atlanta trap core → drill as bounded contrast → cinematic finale.
- D2 tone/mood: desert dusk, ominous, lonely wanderer.
- D3 dynamics/energy: per-section curve pp → mf → f → mp → f → p → ff → pp.
- D4 era/lineage: 2000s Southern rap pitch-bend lead; St. Louis distorted-stab lineage. Resolved by description, never by name.
- D5 instrumentation: regional layer (takht, Sa'idi, Nubian), trap kit, synth roles with positions.
- D6 theory profile: D Hijaz / D Nahawand / D Hijaz Kar; 140 BPM half-time; strict 4/4 with pickup-bar extensions; 4/4-only iqa'at.
- D7 structure: eight sections on 8/16-bar blocks with named transitions.
- D8 vocals: instrumental with explicit open pockets for rap.
- D9 production/mix: 808 tuned to D1, distorted and reverberant; saw sub layer; side-chain in finale.
- D10 negative space + output intent: Exclude list; Suno v6 target; ≤3,000-char total; Instrumental ON.

Gaps the thread exposed (candidate IR v0.3 items): a meter-lock flag with drift-word suppression; a "pickup bar" structural primitive; a "contrast phrase" primitive with length and return rule; synth-role-with-position typing; per-section instrument caps; regional consistency (region → instruments → rhythms → modes) as a validated bundle; an intake block for voice memo transcripts and reference images.

---

## 6. The app as described, and the proposal

Sean's statement (faithful restatement): an app whose very first page is an open-ended "build a song prompt" surface containing musical vocabulary, styles, instrument names and types for any conceivable real or synthesized instrument, with synth characteristics pickable; à la carte from dropdowns and knowledge bases, but also guided by Sean's own works, intentions and instructions; more features and build details to come in the next chat; name TBD.

Proposal (needs Sean's confirmation, Phase A below): this is the Composer front-end of the existing VASEY.AUDIO x VASEY/AI compiler, not a new codebase. The IR is already the spine; the composer is the field library on top of it; serializers stay pure. Name candidates already on file in the NERØ lineage: MAESTRØ, ØVERTURE, OPUS•X.

Knowledge bases the composer needs (the field library)
- Genre/style stack with sub-genres and era tags.
- Regional traditions as bundles: instruments, rhythms (with meter flags: 4/4-safe vs compound/odd), modes/maqamat/ragas, idiomatic articulations, ambiguity aliases (tabla → Egyptian tabla darbuka; rababa vs rebab; org vs organ).
- Real instruments: family, register, articulation, idiom, typical role.
- Synth characteristics: oscillator type, unison count/detune, distortion type, filter, envelope shape, glide, pitch-bend behaviour, mono/poly, role (lead, stab, sub, pad, arp), position (section, phrase, beats).
- Drum grammar: kit pieces, per-genre placement patterns by beat, fills and rolls, regional percussion patterns in doum/tek.
- Structure templates and transition types, including pickup bars, silence drops, contrast phrases.
- Dynamics curves, mix character, mood/imagery vocab.
- Engine profiles: field limits, toggle behaviours, drift words, weighting, verification dates.
- Negative/exclude libraries by class.
- Intent intake: voice memo → transcript → structured fields; reference image → mood/palette mapping; Sean's own tracks as references (typed reference block pending in IR v0.3).

Linter rules learned in this thread
- Meter lock on → flag every drift word and every non-4/4 rhythm name.
- Cap named instruments per section (5–8) and warn on overload.
- Scrub artist/producer names from payloads.
- Enforce per-field character budgets; show live counts.
- Order the Style output by priority, not by UI field order.
- Require a bounded return rule for any contrast phrase.
- Regional consistency check: instruments, rhythms and modes must come from the same bundle unless an intentional cross is flagged.

---

## 7. Goals and to-do list for the next chat

Phase A — Decide
- [ ] Same codebase as the compiler, or a separate app? (Proposal: same.)
- [ ] Name. (Candidates on file: MAESTRØ, ØVERTURE, OPUS•X.)
- [ ] First engine target for the composer page. (Proposal: Suno v6.)
- [ ] Composer page scope for v1: à la carte only, or à la carte plus intent intake?

Phase B — Spec
- [ ] Composer page information architecture and section order (mirror the Style priority order in Section 4).
- [ ] Field schema per D1–D10, including the new primitives (meter lock, pickup bar, contrast phrase, synth role + position, per-section instrument cap).
- [ ] Taxonomy seed lists: start with the Egyptian bundle from v1.1 and the trap/drill drum grammar from v1.2 as the first two fully populated entries.
- [ ] Synth-characteristic picker model.
- [ ] Drum-grammar builder (beat-position grid → prose).
- [ ] Per-section scoping UI (which instruments and synths are active per section).
- [ ] Live character-budget meters per engine field.
- [ ] Linter rules from Section 6.
- [ ] Prompt versioning with diffs (v1.0 → v1.1 → v1.2 lineage) and a take log (what drifted, what worked, which words were blamed).
- [ ] Export set: Suno three-field paste; JSON preset (per `formatting-ui-preset-exports`); word-MIDI blueprint markdown.
- [ ] Engine capability matrix update: Suno v6.
- [ ] Intent-intake pipeline spec: voice memo transcription with ASR-correction review, image-to-mood mapping.

Phase C — Build
- [ ] Repo per the Vasey starter kit v3.0 and Standard CLAUDE.md v3.0; stack Next.js 15 / TypeScript / Supabase / Vercel; mobile-first PWA per the VASEY/AI design system (void dark, teal beam, glass panels, Bebas Neue / JetBrains Mono).
- [ ] Seed the two taxonomy bundles; wire the composer to `compileSuno`; wire the linter.

Phase D — Validate
- [ ] Rebuild "Jinn on the Dune" v1.2 through the app. Diff the compiled output against the hand-built v1.2. Any gap is a missing field or rule.

---

## 8. Items to consider

- Quarter-tones do not render in Suno; slides and bends approximate them. Bayati, Saba and Rast colour will be approximate; Hijaz and Nahawand are the reliable maqamat.
- Engine specs move monthly. Every engine fact in the knowledge base needs a verification date and a confidence tag.
- Instrument-name collisions are a first-class data problem (tabla, rababa, org, "strings"). Aliases should be per engine, not global.
- Drill and trap share tempo but not frame; encode the relationship as core-plus-contrast rather than as two genres.
- Pickup bars and silence drops are structure, not FX. Model them as bar-length events with a return rule.
- Reference-by-sound must be as expressive as reference-by-name or users will type names anyway. The Lineage Pack trait bundles need enough synth and drum vocabulary to describe a Motif lead or a St. Louis stab without the names.
- Vocal pockets matter even for instrumentals; make "open pocket" a per-section field.
- Post-render workflow is part of the product: Suno Studio Manual BPM lock, stem export, DAW handoff via the word-MIDI blueprint.
- Sean's skill library is already domain logic. `generating-beat-prompts`, `auditing-audio-prompts`, `building-negative-prompt-lists`, `designing-synth-patches`, `mapping-synth-parameters`, `translating-plugin-controls`, `building-sound-design-recipes`, `formatting-ui-preset-exports`, `designing-prompt-composer-flows` map almost one-to-one onto composer modules and linter passes.
- Payload firewall holds: skills emit prose, the compiler emits JSON and engine fields.
- Copyright: no lyric reproduction anywhere in the product; no artist names in payloads; cover images and reference tracks stay client-side unless a typed reference block ships in the IR.
- Naming: whatever the app is called, it is a VASEY/AI product. The beat marketplace and music catalogue remain VASEY.AUDIO.
