# Research Brief: Egyptian-Influenced Atlanta-Trap Beat (Suno Prompt Rewrite)

Compiled Sept 15, 2026 for the "Jinn on the Dune" v1.2 rewrite. Every factual claim is tagged VERIFIED / UNVERIFIED / PARTIALLY VERIFIED. No song lyrics reproduced. Re-verify engine facts before relying on them; they move monthly.

---

## 1. Yamaha Motif "Dirty Hook" patch and the pitch-bending lead sound

- VERIFIED — "Dirty Hook" is a real factory voice. Yamaha's Motif XF / MOXF / MOTIF-RACK XS Data List places it at PRE1 bank, location C11, voice #43, main category SynLd (Synth Lead), sub-category Analg (Analog), a 4-element voice. (Motifator MOTIF XF Data List PDF; Yamaha MOTIF-RACK XS Data List PDF.)
- CORRECTION: it is #43 / C11, not #46. #46 / C14 is "Lucky." Neighbours in the analog-lead cluster: "Nu Mini" (C12), "ProgressiveRock Lead" (C13), "Lucky" (C14), "Rap Lead 1" (C16).
- VERIFIED — built-in distortion. The stock voice carries an Amp Simulator insertion effect, which is the source of its overdriven character. (Yamaha MODX synth forum thread describing removal of "Amp Simulator1" from the "Dirty Hook" preset.)
- VERIFIED — the voice carries forward: MONTAGE/MODX include all MOTIF XF voices. (Yamaha MONTAGE compatibility page.)
- UNVERIFIED — Mannie Fresh / Motif / "Dirty Hook" link. No credible primary source connects Mannie Fresh to a Yamaha Motif or to this patch. Documented gear: E-Mu SP-1200 and Ensoniq EPS (Equipboard, citing a 2016 Medium interview), plus MPCs and fan-attributed Triton/JV/E-mu modules. The closest datapoint is a hesitant FutureProducers forum guess, about strings rather than the lead, not tied to these songs. Treat the attribution as community folklore.
- VERIFIED — production credits:
  - T.I. "Front Back" (feat. UGK), from King (2006), produced by Mannie Fresh; interpolates UGK's "Front, Back & Side to Side" and Eazy-E's "Boyz-n-the-Hood." Promo single Nov 4, 2005; album Mar 28, 2006. (Wikipedia; WhoSampled; Discogs.)
  - Frankie J "That Girl" (feat. Mannie Fresh & Chamillionaire), from Priceless (2006), produced by Mannie Fresh. A 2006 release, not 2005. (Wikipedia; Discogs; SongwriterUniverse.)
- VERIFIED technique (generic, not song-specific) for recreating the whining pitch-bending distorted lead: sawtooth oscillator(s); unison/detune around ±10–25 cents; overdrive or amp-sim distortion; portamento/glide; mono plus legato voicing; expressive pitch-bend wheel and/or a fast note-on pitch envelope. (KVR detuned-saw threads; Computer Music detuned-bass walkthroughs; YamahaSynth "Synth Basics.") No source documents a pitch-bend range for these tracks; set by ear (±2 semitones for scoops, ±12 for octave dives are the common choices).

## 2. The Trackboyz (Mark "Trackboy" Williams and Joe "Capo" Kent, St. Louis)

- VERIFIED — credits:
  - J-Kwon "Tipsy" (2004) and "Hood Hop" (2004), produced by Trackboyz. "Tipsy" (So So Def/Arista, Jan 12, 2004) reached #2 on the Billboard Hot 100 in April 2004. Writers: Jerrell Jones, Joe Kent, Mark Williams (plus Brian May, uncredited, for the "We Will Rock You" element). (Wikipedia; WhoSampled.)
  - YoungBloodZ "Lean Low" (feat. Backbone), produced by The Trackboyz (Discogs credits on the "Lean Low / Damn! Remix" release; Wikipedia). Originally a 2003 single from Drankin' Patnaz; recirculated on Ev'rybody Know Me (2005). The 2005 date is a re-release.
  - Ebony Eyez "In Ya Face," from 7 Day Cycle (2005), produced by The Trackboyz. (Discogs; AllMusic.)
- UNVERIFIED — "Stand Up." No Ebony Eyez track by that title found. Documented 7 Day Cycle tracks include "In Ya Face," "Good Vibrations," "Act Like a Bitch," "Dear Father," "Lame Ass," "Take Me Back" (feat. 112), "Hot Chick" (feat. Trey Songz), "Heart of a Soldier." Likely a mix-up with "In Ya Face."
- UNVERIFIED / THIN — gear and sound design. No interview names specific Trackboyz hardware or software. Documented characterisations: Vice described the sound as "drums, breathy adlibs and not much more," a wilder counterpoint to St. Louis's shinier productions; a Jake Halpern feature describes a loud, thumping rhythm mixed with subtler Funkadelic-like synthesizer sounds; AllMusic calls 7 Day Cycle expansive and bottom-heavy, full of pulsing synth samples and fat mid-tempo beats. The distorted, crackling stabs and the sub/saw low-mid construction are not documented anywhere; recreate empirically (detuned saw stab into hard clipping/bitcrush for the crackle; saturated sine/808 for the sub; saw layer for low-mid).

## 3. Access Virus (TI/TI2/C) — aggressive unison-detuned distorted leads

- VERIFIED — HyperSaw. Sound On Sound's Virus TI review describes HyperSaw as a sawtooth oscillator that can generate up to nine sawtooth waves in parallel, with voices added or removed in real time without glitching. It has Density (up to 9.0) and Spread (detune, ~0–127) controls. (Sound On Sound; Access Virus TI manual.)
- VERIFIED — Unison. Combined with Unison mode, the review notes a theoretical maximum of 72 oscillators per note, or 144 using both main oscillators.
- VERIFIED — Distortion/saturation. A dedicated distortion effect with multiple types (expanded via firmware, including the Rate Reducer); Analog Boost for low-mid saturation (on at roughly a third by default from Init); filter saturation/drive, analog and digital, in the filter section. (Sound On Sound; Virus TI manual; Kulshan Studios.)
- Practical aggressive-lead recipe: two HyperSaws at high Density and Spread, Unison on, drive from the distortion effect plus filter saturation, then EQ/high-pass. HyperSaw is not high-passed at the oscillator, so it is bass-heavy and needs low-end cleanup.

## 4. Suno AI — current state (Sept 15, 2026)

- VERIFIED — model version. Suno v6 launched Sept 9, 2026, as three models: v6 and v6-wild (Pro/Premier) and v6-mini (all users). Older models (v5, v4.5) were removed from the picker. Launched in partnership with Warner Music, BMG and Believe. US Pro/Premier plans at $8 and $24 monthly. (Digital Music News, Sept 9, 2026; Quartz, Sept 9, 2026.)
- VERIFIED — field limits (v4.5 through v6): Style ~1,000 chars; Lyrics 5,000 chars; Title 100 (app) / 80 (API). v4 and older: 200 / 3,000 / 80. Practical lyrics sweet spot is ~3,000 chars before Suno rushes. (HookGenius; AI Music API.)
- VERIFIED — Exclude Styles field still exists, under Custom Mode → Advanced Options; on v6 the input carries maxlength="1000". It is the reliable channel for negatives, more consistent than typing "no X" in the Style box, though v4.5+ improved inline negation. Pro/Premier tiers get the fullest use. (HookGenius; Blake Crosley; SongSmith; usesuno.com.)
- VERIFIED — Instrumental plus structure tags. With the Instrumental toggle on, the Lyrics box can be left empty or hold only structural tags such as [Intro], [Build], [Drop], [Break], [Outro]; bracketed tags are read as directions, not sung. Adding "instrumental" / "no vocals" reinforces it. [Verse] / [Hook] style tags can shape an instrumental's arrangement. (HookGenius; sunometatagcreator.)
- VERIFIED — BPM is approximate. A BPM in the prompt is treated as guidance, not a metronome lock (Blake Crosley). Renders show deliberate tempo drift; Suno's help article on fixing tempo drift and Suno Studio's Manual BPM setting exist to conform stems to a fixed grid on export.
- PARTIALLY VERIFIED / CAUTION — time signature. Third-party guides show meta-tags like [time-signature-4/4] or [4/4], but these are community and API conventions, not officially documented Suno tags (Suno publishes no official tag list). Best practice: write "4/4, straight time, no swing, no triplet feel" in the Style box and reinforce with a locked, driving trap groove description.
- INFERRED best practice — avoiding meter drift. Words that push Suno toward compound, triplet or odd feels: shuffle, swing, triplet, waltz, rubato, and folk/dance rhythm names (karsilama, any 6/8 or 9/8 form). Keep them out. To lock a straight trap grid: name "straight 4/4," "half-time trap," "808 on the grid," "16th-note hi-hats"; if drift appears, drop "triplet hats." Post-render, use Manual BPM in Suno Studio.

## 5. Egyptian rhythms (iqa'at) — meter check

Notation: D = doum, T = tek, "-" = rest, eight eighth-note slots per 4/4 bar. Sources: Maqam World, Wikipedia, darbuka pedagogy sites. Notations are simplified and vary slightly by teacher.

- VERIFIED — simple duple/quadruple, safe for strict 4/4:
  - Maqsum, 4/4: D T - T D - T - (Doum Tek – Tek Doum – Tek). Maqam World describes it as the most widely used iqa' in Arabic music, one that modulates freely to other 4/4 iqa'at such as Baladi and Wahda.
  - Baladi / Masmoudi Saghir, 4/4: D D - T D - T - (Doum Doum – Tek Doum – Tek). Called Masmoudi Saghir to distinguish it from Masmoudi Kabir, which spans two 4/4 bars.
  - Sa'idi, 4/4: Maqsum family with two doums in the middle of the cycle.
  - Wahda, 4/4: one strong doum per bar; sparse; suits slow trap.
  - Malfuf, 2/4: Doum – Tek – Tek; loops cleanly inside 4/4.
  - Ayyub / Zar, 2/4: Doum – Tek Doum – Tek; duple, fits 4/4.
- VERIFIED — compound or odd meter, avoid for a strict-4/4 track:
  - Samai Thaqil, 10/8 (10/4 in some notations).
  - Karsilama, 9/8 (2-2-2-3).
  - Yuruk Semai, 6/8; other 6/8 forms are compound duple.
  - Masmoudi Kabir, 8/4 (spans two 4/4 bars; usable but count carefully).
- Practical takeaway: build the Egyptian flavour from Maqsum, Baladi or Sa'idi (all 4/4) and get the Egyptian colour from maqam melodic scales (e.g., Hijaz) while the rhythm stays strictly 4/4. Keep 9/8, 10/8 and 6/8 patterns out of the prompt entirely.

## 6. Atlanta trap drum characteristics, with drill contrast

- VERIFIED — trap (eMastered; Orphiq; Padwolf; Audeobox):
  - 808/kick: the 808 is pitched to the song key and played as bass with extended decay; commonly distorted/saturated and often reverberant. The transient kick is short and sharp to leave room for the 808.
  - Snare/clap: snare, frequently layered with a clap and/or rimshot/side-stick, in a half-time feel on beat 3; syncopated off-beat snare placements for variation.
  - Hi-hats: 16th-note base with 32nd-note and triplet rolls, velocity and pitch variation, crescendo rolls before snares and phrase ends.
  - Tempo: Padwolf's trap drum tutorial gives 130–145 BPM played in half-time so it feels like 65–72 BPM.
- VERIFIED — drill differs (Amped Studio; Songen; note.com; Audeobox): sliding 808s (portamento between notes, often distorted); displaced snare, on beat 3 but frequently shifted (e.g., to the "and of 3," or alternating 3rd-beat/4th-beat across two-bar pairs); 3-3-2 dotted / tresillo hi-hat feel; ~140–145 BPM (UK/NY), felt half-time. Chicago drill is written ~60–75 BPM (double-time in the DAW).
- Application: keep the main groove as straight Atlanta trap (808 pitched to key, snare/clap on 3, 16th hats). Deploy drill only as a short contrast phrase (one sliding-808 bar with a displaced snare and 3-3-2 hats), then return to the trap grid so the meter and feel stay locked.

---

## Recommendations (staged)

1. Fix the factual scaffolding in the notes: cite the lead as a detuned, amp-sim-distorted analog saw lead with glide and pitch-bend ("Motif Dirty Hook style"); do not assert Mannie Fresh used a Motif; correct "Dirty Hook" to #43/C11; date "That Girl" to 2006; drop the Ebony Eyez "Stand Up" reference.
2. Write the Suno Style box (v6) around a straight grid, front-loading the five to eight most important tags: instrumental Egyptian trap; maqam Hijaz melody; detuned distorted saw lead with glide and pitch bends; Atlanta 808 tuned to key, saturated, long decay; clap/snare on beat 3, 16th-note hi-hats with 32nd rolls; straight 4/4, no swing, no triplet feel, half-time trap, ~140 BPM. Keep it under ~1,000 chars.
3. Use the Exclude Styles field (Advanced Options) for: 6/8, triplet feel, shuffle, swing, waltz, drill, vocals. More reliable than inline "no X."
4. Instrumental workflow: toggle Instrumental ON; in Lyrics use only structural tags as arrangement scaffolding.
5. Lock the grid post-render: export stems via Suno Studio → Manual BPM to conform to a fixed 4/4 grid before DAW work.
6. Recreate the two thinly documented sounds by ear. Lead: mono saw, unison detune ±10–25 cents, overdrive/amp-sim, portamento, expressive pitch-bend (an Access Virus HyperSaw plus built-in distortion is an ideal modern stand-in). Trackboyz-style stabs: detuned saw stab plus hard clip/bitcrush, over a saturated 808 sub.

Benchmarks that would change the advice: a primary interview naming Mannie Fresh's Motif/"Dirty Hook" would upgrade that claim to VERIFIED; an official Suno meta-tag list including a time-signature tag would replace Style-box phrasing with the official tag; a Suno model that honours exact BPM would remove the Manual-BPM export step.

## Caveats

- Thinnest sourcing: the Mannie Fresh–Motif link and Trackboyz gear, both UNVERIFIED/anecdotal.
- Suno specifics (v6, field limits, Exclude field, Instrumental behaviour) come from reputable independent guides and press; Suno publishes no official character-limit table or tag list, so app-side numbers can shift between UI releases. Verify in the live composer.
- Time-signature and BPM control in Suno is not a hard lock; plan on the Manual-BPM export step.
- Rhythm meters are corroborated across multiple sources; doum/tek notations are simplified to eighth-note grids.

## Source list

- Motifator: MOTIF XF Data List (PDF)
- Yamaha: MOTIF-RACK XS Data List (PDF); MONTAGE compatibility page; MODX synth forum
- Future Producers forum: "How to recreate this Mannie Fresh synth?"
- Equipboard: Mannie Fresh gear
- Wikipedia: "Front Back," "That Girl," "Tipsy," "Lean Low," Maqsoum
- Discogs, WhoSampled, AllMusic (Ebony Eyez, 7 Day Cycle), SongwriterUniverse
- Vice; Jake Halpern, "Selling the Beat"
- Sound On Sound: Access Virus TI review; Access Virus TI manual; Kulshan Studios (HyperSaw)
- Digital Music News and Quartz (Suno v6, Sept 9, 2026)
- HookGenius (Suno character limits); Blake Crosley (Suno guide, v5.5); SongSmith; usesuno.com; SunoHK; sunometatagcreator
- Maqam World (iqa'at); Alsiadi (Samai Thaqil); Handpan Dojo rhythm library
- eMastered, Orphiq, Padwolf, Audeobox (trap drums); Amped Studio, Songen, note.com (drill)
