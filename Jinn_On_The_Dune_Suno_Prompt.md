# JINN ON THE DUNE — Suno Prompt Package

VASEY.AUDIO · جِنّ (Jinn) · instrumental · v1.0 · 2026-09-14

---

## 0. Decisions made

- **Mode:** D Hijaz (D–E♭–F♯–G–A–B♭–C) for all hook material. D Nahawand (natural minor) for the breakdown counter-melody and the finale harmony. Your note said Dorian; its raised 6th reads Western/modal-jazz, not Maghrebi. Hijaz is the sound you were describing.
- **Tempo:** 142 BPM, half-time drums (feels like 71). Drill lives at 140–145; 142 leaves room for clean 32nd rolls.
- **Sub tuning:** 808 tuned to D1 (36.7 Hz). Guembri doubles one octave up. The Gnawa bass lute is the authenticity anchor and the acoustic bridge into the 808.
- **Palette scoped per section**, not all at once. Twenty instruments in one prompt gives Suno mush; five per section gives it a target.
- **Indian layer** (sitar, tabla, ghungroo) is confined to Verse 2 and the Bridge so it reads as a guest colour, not a second homeland.
- **Choir is wordless.** Track stays instrumental. Wordless choir is the one vocal-adjacent element that survives the "instrumental" constraint.
- **Runtime target:** ~3:10. Eight sections on 8/16-bar blocks.
- **Bar math at 142 BPM:** 1 bar = 1.69 s · 8 bars = 13.5 s · 16 bars = 27 s.

---

## 1. SUNO — Style field

Paste as-is. Under 1000 characters.

```
Instrumental cinematic Moroccan trap-drill hybrid, 142 BPM half-time, D Hijaz Phrygian dominant, dark minor. Ancient Amazigh Gnawa and Arabic instruments: guembri bass lute, oud, qanun, ney flute, Arabic violin with pitch-bent slides, bendir, darbuka, krakebs, riq; sitar, tabla, ghungroo bells as accents. Massive tuned 808 sub bass with drill glides, hard punchy snare layered with claps, rapid trap hi-hats with triplet and 32nd-note rolls, double-time fills. Wordless epic Gregorian Carmina Burana style choir, arpeggiated synths, dark synth pads, sparse piano. Risers, sweeps and filter transitions every 8 and 16 bars. Breakdown bridge: drums drop, slower harmonized counter-melody, auto-panned shakers, phaser and flanger on hi-hats. Grand finale: epic blockbuster film-score orchestra, massive trombone braam hits, French horn stabs, violin glissandi, staccato string arpeggios, taiko, full drill drums. Desert dusk, lonely wanderer, mystical, ominous. No vocals, no rap, no lyrics.
```

---

## 2. SUNO — Exclude Styles field

```
vocals, rap, singing, lyrics, pop, EDM drop, dubstep, house, reggaeton, bright major key, acoustic guitar, ukulele, lo-fi, jazz
```

---

## 3. SUNO — Lyrics field (structure only)

Leave the **Instrumental** toggle **OFF** so the section tags are honoured. Paste exactly this; there are no lyrics.

```
[Intro – desert wind, ney flute rubato, guembri drone on D, oud taqsim in D Hijaz, sparse bendir, no drums]

[Build – half-time trap drums enter, 808 sub on D, kick on 1, snare on 3, hi-hats in 8ths, oud hook phrase, krakebs shuffled 16ths, darbuka]

[Riser – white noise sweep, reverse cymbal]

[Hook – full drill drums, sliding 808s, layered snare and claps, 32nd hi-hat rolls, triplet fills, oud and Arabic violin double the Hijaz hook, epic wordless choir, arpeggiated synth]

[Verse – sparser 808, tabla and darbuka interplay, sitar lead with bends answers the oud, ghungroo bells, ney, dark and alone]

[Filter sweep closing]

[Hook – full drill drums return harder, qanun tremolo runs, auto-panned shakers, double-time hi-hat fills, choir]

[Drop to silence]

[Bridge – drums out, slower harmonized counter-melody in D minor, piano and warm synth pad, sitar counter-line, auto-panned shakers, phaser and flanger on hi-hats, soft 808 pulse, low-pass filter opening slowly]

[Big riser – timpani roll, choir swell, sub drop]

[Finale – epic film-score orchestra, massive trombone braams on D, French horn stabs, violin glissandi, staccato string arpeggios, taiko drums, full drill drums with 808 glides, fortissimo wordless choir, oud melody on top]

[Outro – drums cut, solo ney with long reverb, desert wind, single guembri note on D, slow fade]

[End]
```

---

## 4. Arrangement blueprint (word-MIDI)

Global: 4/4 · 142 BPM · half-time drums · D Hijaz / D minor · 808 root D1 · swing: straight 16ths on hats, light shuffle on krakebs and darbuka.

### Hook motif (D Hijaz)
Two-bar call, two-bar answer. Scale degrees, 1 = D.

- Call: `1 – ♭2 – 3 – 4 – 3 – ♭2 – 1` with a bent approach into the 3 (F♯), half-note pace, last note held.
- Answer: `5 – 4 – 3 – ♭2 – 1` descending, quarter notes, ending on a long 1.
- Oud plays it dry and plucked; Arabic violin doubles with slides into every ♭2 and 3.

### Harmony
- Hook / Build / Verse / Finale-open: D pedal drone. Implied movement `D5 · E♭ · D5 · B♭–C` (i · ♭II · i · ♭VI–♭VII), one chord per bar.
- Bridge: `Dm · B♭ · Gm · A` (i · ♭VI · iv · V), two bars each.
- Finale cadence: `Dm · B♭ · E♭ · A → D`. The E♭ (Neapolitan) is the hinge between the minor harmony and the Hijaz melody.

### Drum grammar (half-time, one bar = 4 beats)
- **Kick / 808:** 1, and-of-2. In hooks, 808 glides D1→F1 on the and-of-3, back to D1 on 4.
- **Snare + clap:** beat 3. Drill accent: extra snare on and-of-4 every second bar.
- **Hi-hats:** Build = 8ths. Hook = 16ths, 32nd roll on beat 4 of every 4th bar, 16th-triplet fill alternating beats 2 and 4, open hat on and-of-4.
- **Darbuka:** maqsum pattern folded into half-time: doum on 1, tek on and-of-2, tek on 4, ka ghost notes on the 16ths between.
- **Krakebs:** shuffled 16ths, ta-ka-ta, sitting slightly behind the hats.
- **Bendir:** low frame-drum thud on 1 and 3, snare buzz on 3.

---

### Section 1 · Intro · bars 1–16 · 0:00–0:27
- **Tempo/feel:** rubato over an implied 142 grid; nothing locks yet.
- **Dynamics:** pp → p.
- **Drums:** none until bar 9. Bar 9: bendir on 1 and 3, very dry.
- **Bass:** guembri drone, single D2 plucked every 2 bars, natural decay. Bar 9: sub-sine on D1 fades in under it.
- **Lead:** ney rubato phrases in D Hijaz, breathy, long slides. Bar 5: oud taqsim, free ornaments around the ♭2 and 3.
- **FX:** desert wind bed, wide stereo, very slow auto-pan. Bars 15–16: white-noise riser, reverse cymbal, LPF opening on the sub.
- **Transition out:** riser peaks on the downbeat of bar 17.

### Section 2 · Build · bars 17–32 · 0:27–0:54
- **Tempo/feel:** grid locks. Half-time.
- **Dynamics:** mp → mf.
- **Drums:** kick 1 and and-of-2, snare on 3, hats 8ths. Darbuka maqsum from bar 17. Krakebs from bar 25.
- **Bass:** 808 on D1, no glides yet, 1 and and-of-2. Guembri doubles the octave.
- **Lead:** oud plays the hook call only (bars 17–24), then call + answer (25–32). Qanun tremolo pad sneaks in at bar 25.
- **FX:** bars 23–24: short filter sweep. Bars 29–32: full riser + reverse cymbal + snare roll doubling speed.
- **Transition out:** one beat of silence before bar 33.

### Section 3 · Hook A · bars 33–48 · 0:54–1:21
- **Dynamics:** f.
- **Drums:** full drill. Hats 16ths with 32nd rolls, triplet fills, open hat on and-of-4. Layered snare + clap. Drill and-of-4 snare accent every second bar.
- **Bass:** 808 with glides D1→F1→D1 as written above. Long release.
- **Lead:** oud + Arabic violin double the full hook motif. Sitar answers in the gaps a fifth up (bars 41–48 only).
- **Pads/choir:** wordless choir sustains the D pedal, opens to E♭ on bar 2 of each 4. Arpeggiated synth, 16ths, D Hijaz, mid-low register, low-passed.
- **FX:** bars 39–40: filter sweep. Bars 47–48: riser + reverse cymbal.

### Section 4 · Verse 2 · bars 49–64 · 1:21–1:48
- **Dynamics:** mf, then thinning to mp.
- **Drums:** kick and snare stay, hats drop to 8ths. Tabla enters trading with darbuka (tabla answers, 2-bar phrases). Ghungroo bells on the and-of-4.
- **Bass:** 808 root only, no glides, longer gaps.
- **Lead:** sitar lead with bends, answering the oud. Ney holds long notes behind it.
- **Pads/choir:** choir out. Pad thinned to a dark drone.
- **FX:** bars 61–64: LPF closes over the whole mix, ending almost fully closed. Reverse cymbal into bar 65.

### Section 5 · Hook B · bars 65–72 · 1:48–2:02
- **Dynamics:** f, harder than Hook A.
- **Drums:** everything from Hook A plus double-time hat fills, shakers auto-panned L↔R at 1/8-note rate.
- **Bass:** 808 glides return.
- **Lead:** qanun tremolo runs on top of the oud/violin hook.
- **FX:** filter snaps fully open on bar 65. Bar 72: everything cuts on beat 4; one full beat of silence.

### Section 6 · Bridge · bars 73–88 · 2:02–2:29
- **Tempo/feel:** grid holds at 142 but drums are gone; perceived tempo halves. Counter-melody written at half-note pace.
- **Dynamics:** p → mp.
- **Drums:** none. Hi-hats only as a textural loop: 8ths, phaser slow, flanger, HPF at 2 kHz, auto-pan. Shakers auto-panned.
- **Bass:** soft 808 pulse, root only, on beat 1 every 2 bars.
- **Harmony:** Dm · B♭ · Gm · A, two bars each. Piano voices the chords, warm synth pad underneath.
- **Lead:** counter-melody in D minor, harmonized in thirds: piano plays the line, sitar plays the harmony line a third above, half-note pace, wide reverb.
- **FX:** LPF on the pad opening across bars 81–88. Bars 85–88: timpani roll crescendo, choir swell fading in, riser, sub drop on the last beat of bar 88.

### Section 7 · Finale · bars 89–104 · 2:29–2:56
- **Dynamics:** ff.
- **Drums:** full drill drums return plus taiko on 1 and 3. Hats 16ths with 32nd rolls.
- **Bass:** 808 glides, plus low brass doubling the root.
- **Harmony:** Dm · B♭ · E♭ · A → D, two bars each, then held D for the last 4 bars.
- **Orchestra:** trombone braam on the downbeat of bars 89, 93, 97, 101. French horn stabs on the chord changes. Staccato string ostinato in 16ths (D Hijaz). Violin glissandi sweeping up into each braam.
- **Lead:** oud plays the hook motif on top of the orchestra, doubled by ney an octave up.
- **Choir:** fortissimo, wordless, holding the chord tones.
- **FX:** side-chain pump on pads and choir against the kick. Bar 104: final hit on the downbeat, everything stops on beat 2, long reverb tail.

### Section 8 · Outro · bars 105–112 · 2:56–3:10
- **Dynamics:** pp.
- **Drums:** none.
- **Bass:** one guembri note on D2, natural decay.
- **Lead:** solo ney, one last phrase of the hook answer (`5 – 4 – 3 – ♭2 – 1`), very slow, long reverb.
- **FX:** desert wind returns, slow auto-pan, fade to silence.

---

## 5. Cover-to-sound mapping

- Horizon line: long sustained drones and pads under everything.
- Footprints: the guembri/808 pulse; the journey is the low end.
- Wind in the cloth: ney breath, risers, auto-pan.
- Sun at the horizon: the Hijaz hook, the only bright thing in the mix.
- Indigo shadow: sub-bass depth, low-passed arps, dark pad.
- Amber/rust: brass and choir in the finale.

---

## 6. Generation notes

- Suno custom mode. Style field ≤1000 chars, Exclude Styles filled, Lyrics field = structure tags only, Instrumental toggle OFF. Assumes v4.5+/v5 field limits and bracket-tag behaviour; verify against whatever version is live.
- If a take starts singing the bracket text, strip the brackets to bare tags (`[Intro]`, `[Build]`, `[Hook]`...) and rerun. If vocals persist, flip Instrumental ON and rely on the style field alone; you lose section control but keep the palette.
- Generate 4–6 takes. Keep the one where Hook and Bridge are audibly different sections. Kill any take that lands in a major key or skips the drums-out bridge.
- If a take stops before the finale, use Extend from the Bridge with the same style text.
- Variant A (more Berber, less Indian): replace sitar/tabla/ghungroo with ribab, tbel and handclaps. Variant B (harder drill): 150 BPM, drop the arpeggiated synth, add the drill and-of-4 snare every bar.
