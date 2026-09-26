# JINN ON THE DUNE — Suno Prompt Package

VASEY.AUDIO · جِنّ (Jinn) · instrumental · v1.1 (Egypt) · 2026-09-14

---

## 0. Decisions made

- **Region:** Egypt. Classical Cairo takht (oud, qanun, nay, kamanja, riq), the firqa-era massed unison string section, Sa'idi (Upper Egypt) folk (mizmar, rababa, kawala, tabla baladi), Nubian tanbura lyre, and Egypt's own urban electronic lineage (shaabi / mahraganat org-keyboard and tabla loops). Maghrebi instruments (guembri, krakebs, bendir) and the Indian layer (sitar, Indian tabla, ghungroo) are removed.
- **Thematic anchor:** the Egyptian zar. It is a ritual to appease possessing spirits, played on tabla, doholla, mazhar and tanbura over a hypnotic 2/4 trance rhythm. A track called Jinn on the Dune has no better rhythmic source. Zar drives Verse 2.
- **Mode:** D Hijaz (D–E♭–F♯–G–A–B♭–C) for hook material. Nay intro in maqam Saba for the darkest Egyptian colour. D Nahawand (natural minor) for the breakdown. Finale melody flips to D Hijaz Kar (raised 7th, C♯) so the lead line matches the A-major dominant in the cadence. This is the Cairo film-score mode.
- **Rhythms:** Egyptian iqa'at run at the full 142 grid on the tabla while the trap kit sits in half-time. Maqsum (build), baladi (Hook A), zar/ayyub (verse), Sa'idi (Hook B), wahda (bridge), malfuf on the sagat (finale).
- **Tempo:** 142 BPM, half-time drums. Egyptian trap and drill sit here; mahraganat tabla loops at 142 read as double-time against the kit.
- **Sub tuning:** 808 tuned to D1 (36.7 Hz). Doholla (bass darbuka) tuned near D2 doubles the kick; low oud ostinato on D2 doubles the 808. That pair replaces the guembri as the acoustic bridge into the sub.
- **Drill lead:** mizmar. The Sa'idi shawm is the loudest, most aggressive lead in the region and already sits in the frequency band of a trap lead synth. It takes Hook B.
- **Choir is wordless.** Track stays instrumental.
- **Runtime target:** ~3:10. Eight sections on 8/16-bar blocks.
- **Bar math at 142 BPM:** 1 bar = 1.69 s · 8 bars = 13.5 s · 16 bars = 27 s.

---

## 1. SUNO — Style field

Paste as-is. Under 1000 characters.

```
Instrumental cinematic Egyptian trap-drill hybrid, 142 BPM half-time, D Hijaz maqam, dark minor, Cairo film-score meets Egyptian drill and mahraganat. Takht and Sa'idi instruments: oud, qanun, nay, kawala, kamanja violin with slides, unison Egyptian strings, mizmar, rababa, tanbura lyre; Egyptian tabla darbuka, doholla, riq, mazhar, sagat, quarter-tone org keyboard. Maqsum, baladi, Sa'idi and zar rhythms under trap half-time. Massive tuned 808 sub with drill glides, hard snare with claps, rapid trap hi-hats with triplet and 32nd rolls, double-time fills. Wordless epic Carmina Burana style choir, arpeggiated synths, dark pads, piano. Risers, sweeps, filter transitions every 8 and 16 bars. Bridge: drums drop, slower harmonized counter-melody, auto-panned shakers, phaser, flanger. Finale: epic blockbuster orchestra, trombone braams, French horn stabs, violin glissandi, staccato string arpeggios, taiko, full drill drums. Desert dusk, lonely wanderer, ominous. No vocals, no rap, no lyrics.```

---

## 2. SUNO — Exclude Styles field

```
vocals, rap, singing, lyrics, autotune, pop, EDM drop, dubstep, house, reggaeton, bright major key, acoustic guitar, ukulele, lo-fi, jazz, sitar, Bollywood, flamenco, Moroccan Gnawa
```

---

## 3. SUNO — Lyrics field (structure only)

Leave the **Instrumental** toggle **OFF** so the section tags are honoured. Paste exactly this; there are no lyrics.

```
[Intro – desert wind, nay flute rubato in maqam Saba, low oud drone on D, tanbura lyre ostinato, sparse mazhar frame drum, no drums]

[Build – half-time trap drums enter, 808 sub on D, kick on 1, snare on 3, hi-hats in 8ths, oud hook phrase in D Hijaz, Egyptian tabla maqsum rhythm, riq, sagat finger cymbals shuffled 16ths]

[Riser – white noise sweep, reverse cymbal]

[Hook – full drill drums, sliding 808s, layered snare and claps, 32nd hi-hat rolls, triplet fills, tabla baladi rhythm, oud and Egyptian kamanja violin with slides double the Hijaz hook, epic wordless choir, quarter-tone org arpeggio]

[Verse – sparser 808, zar trance rhythm on doholla and mazhar, rababa lead with bends answers the oud, kawala flute, tanbura lyre, dark and alone]

[Filter sweep closing]

[Hook – full drill drums return harder, Sa'idi rhythm on tabla, mizmar lead stabs over the oud hook, qanun tremolo runs, auto-panned shakers, double-time hi-hat fills, choir]

[Drop to silence]

[Bridge – drums out, slower harmonized counter-melody in D minor, piano and warm synth pad, qanun counter-line, auto-panned shakers, phaser and flanger on hi-hats, soft 808 pulse, low-pass filter opening slowly]

[Big riser – timpani roll, choir swell, sub drop]

[Finale – epic film-score orchestra, unison Egyptian string section gliding in Hijaz, massive trombone braams on D, French horn stabs, violin glissandi, staccato string arpeggios, taiko drums, sagat malfuf rhythm, full drill drums with 808 glides, fortissimo wordless choir, oud and mizmar melody on top]

[Outro – drums cut, solo nay with long reverb, desert wind, single low oud note on D, slow fade]

[End]
```

---

## 4. Arrangement blueprint (word-MIDI)

Global: 4/4 · 142 BPM · half-time trap kit, full-tempo tabla · D Hijaz / D minor / D Hijaz Kar · 808 root D1 · swing: straight 16ths on hats, light shuffle on sagat and tabla ka-strokes.

### Egyptian rhythm key (D = doum, T = tek, k = ka ghost, · = rest)
- **Maqsum** 4/4: `D T · T D · T ·` — the Egyptian default.
- **Baladi** 4/4: `D D · T D · T ·` — heavier, folk.
- **Sa'idi** 4/4: `D T · D D · T ·` — Upper Egypt, tahtib.
- **Zar / Ayyub** 2/4: `D · · k D · T ·` — trance, hypnotic, played twice per bar.
- **Wahda** 4/4: `D · · · · T · ·` — slow, one doum per bar.
- **Malfuf** 2/4: `D · T · T ·` — fast and driving, played on sagat or hats.

Tabla plays one full cycle per bar at 142. The trap kick/snare frame underneath is half-time.

### Hook motif (D Hijaz)
Two-bar call, two-bar answer. Scale degrees, 1 = D.

- Call: `1 – ♭2 – 3 – 4 – 3 – ♭2 – 1` with a bent approach into the 3 (F♯), half-note pace, last note held.
- Answer: `5 – 4 – 3 – ♭2 – 1` descending, quarter notes, ending on a long 1.
- Oud plays it dry and plucked; kamanja doubles with slides into every ♭2 and 3.
- Hook B: mizmar takes the call an octave up with the Sa'idi trill on the 3; oud keeps the answer.
- Finale: raise the 7th to C♯ (Hijaz Kar) so the answer ends `♭2 – 1` with a C♯ pickup underneath the A-major chord.

### Harmony
Egyptian classical music is drone-based, not chordal; chords are implied, not strummed.
- Hook / Build / Verse / Finale-open: D pedal drone. Implied movement `D5 · E♭ · D5 · B♭–C` (i · ♭II · i · ♭VI–♭VII), one chord per bar.
- Bridge: `Dm · B♭ · Gm · A` (i · ♭VI · iv · V), two bars each.
- Finale cadence: `Dm · B♭ · E♭ · A → D`. The E♭ (Neapolitan) is the hinge between the minor harmony and the Hijaz melody; the A-major dominant carries the Hijaz Kar leading tone.

### Drum grammar (half-time kit, one bar = 4 beats)
- **Kick / 808:** 1, and-of-2. In hooks, 808 glides D1→F1 on the and-of-3, back to D1 on 4. Doholla doubles every kick.
- **Snare + clap:** beat 3. Drill accent: extra snare on and-of-4 every second bar.
- **Hi-hats:** Build = 8ths. Hook = 16ths, 32nd roll on beat 4 of every 4th bar, 16th-triplet fill alternating beats 2 and 4, open hat on and-of-4.
- **Tabla:** the iqa' of the section at full tempo (see key).
- **Riq:** jingles on the 16ths, doum on 1, sits behind the hats.
- **Sagat:** shuffled 16ths, slightly behind the hats; malfuf in the finale.
- **Mazhar:** low frame-drum thud on 1 and 3, jingles ring on 3.

---

### Section 1 · Intro · bars 1–16 · 0:00–0:27
- **Tempo/feel:** rubato over an implied 142 grid; nothing locks yet.
- **Dynamics:** pp → p.
- **Drums:** none until bar 9. Bar 9: mazhar on 1 and 3, very dry.
- **Bass:** low oud drone, single D2 plucked every 2 bars, natural decay. Tanbura lyre plays a 4-note ostinato on D–A–C–D from bar 5. Bar 9: sub-sine on D1 fades in under it.
- **Lead:** nay rubato phrases in maqam Saba (the flattened 4th gives the mournful colour), breathy, long slides. Bar 5: oud taqsim shifting toward Hijaz, free ornaments around the ♭2 and 3.
- **FX:** desert wind bed, wide stereo, very slow auto-pan. Bars 15–16: white-noise riser, reverse cymbal, LPF opening on the sub.
- **Transition out:** riser peaks on the downbeat of bar 17.

### Section 2 · Build · bars 17–32 · 0:27–0:54
- **Tempo/feel:** grid locks. Half-time kit, tabla at full tempo.
- **Dynamics:** mp → mf.
- **Drums:** kick 1 and and-of-2, snare on 3, hats 8ths. Tabla maqsum from bar 17. Riq from bar 21. Sagat from bar 25.
- **Bass:** 808 on D1, no glides yet, 1 and and-of-2. Low oud doubles the octave. Doholla doubles the kick.
- **Lead:** oud plays the hook call only (bars 17–24), then call + answer (25–32). Qanun tremolo pad sneaks in at bar 25.
- **FX:** bars 23–24: short filter sweep. Bars 29–32: full riser + reverse cymbal + snare roll doubling speed.
- **Transition out:** one beat of silence before bar 33.

### Section 3 · Hook A · bars 33–48 · 0:54–1:21
- **Dynamics:** f.
- **Drums:** full drill. Hats 16ths with 32nd rolls, triplet fills, open hat on and-of-4. Layered snare + clap. Drill and-of-4 snare accent every second bar. Tabla switches to baladi.
- **Bass:** 808 with glides D1→F1→D1 as written above. Long release. Doholla on every kick.
- **Lead:** oud + kamanja double the full hook motif. Qanun answers in the gaps (bars 41–48 only).
- **Pads/choir:** wordless choir sustains the D pedal, opens to E♭ on bar 2 of each 4. Quarter-tone org keyboard plays the arpeggio, 16ths, D Hijaz, mid-low register, low-passed.
- **FX:** bars 39–40: filter sweep. Bars 47–48: riser + reverse cymbal.

### Section 4 · Verse 2 · bars 49–64 · 1:21–1:48
- **Dynamics:** mf, then thinning to mp.
- **Drums:** kick and snare stay, hats drop to 8ths. Tabla out; doholla and mazhar carry the zar/ayyub rhythm, two cycles per bar, hypnotic and unchanging. Sagat on the and-of-4.
- **Bass:** 808 root only, no glides, longer gaps.
- **Lead:** rababa lead with wide bends, answering the oud. Kawala holds long notes behind it.
- **Pads/choir:** choir out. Tanbura ostinato returns under a thin dark pad.
- **FX:** bars 61–64: LPF closes over the whole mix, ending almost fully closed. Reverse cymbal into bar 65.

### Section 5 · Hook B · bars 65–72 · 1:48–2:02
- **Dynamics:** f, harder than Hook A.
- **Drums:** everything from Hook A plus double-time hat fills, shakers auto-panned L↔R at 1/8-note rate. Tabla on Sa'idi.
- **Bass:** 808 glides return.
- **Lead:** mizmar takes the hook call an octave up with the Sa'idi trill; oud keeps the answer; qanun tremolo runs on top.
- **FX:** filter snaps fully open on bar 65. Bar 72: everything cuts on beat 4; one full beat of silence.

### Section 6 · Bridge · bars 73–88 · 2:02–2:29
- **Tempo/feel:** grid holds at 142 but drums are gone; perceived tempo halves. Counter-melody written at half-note pace. Tabla, if audible at all, plays wahda: one doum per bar.
- **Dynamics:** p → mp.
- **Drums:** none. Hi-hats only as a textural loop: 8ths, phaser slow, flanger, HPF at 2 kHz, auto-pan. Shakers auto-panned.
- **Bass:** soft 808 pulse, root only, on beat 1 every 2 bars.
- **Harmony:** Dm · B♭ · Gm · A, two bars each. Piano voices the chords, warm synth pad underneath.
- **Lead:** counter-melody in D minor, harmonized in thirds: piano plays the line, qanun plays the harmony line a third above, half-note pace, wide reverb.
- **FX:** LPF on the pad opening across bars 81–88. Bars 85–88: timpani roll crescendo, choir swell fading in, riser, sub drop on the last beat of bar 88.

### Section 7 · Finale · bars 89–104 · 2:29–2:56
- **Dynamics:** ff.
- **Drums:** full drill drums return plus taiko on 1 and 3. Hats 16ths with 32nd rolls. Sagat on malfuf.
- **Bass:** 808 glides, plus low brass doubling the root.
- **Harmony:** Dm · B♭ · E♭ · A → D, two bars each, then held D for the last 4 bars.
- **Orchestra:** trombone braam on the downbeat of bars 89, 93, 97, 101. French horn stabs on the chord changes. Staccato string ostinato in 16ths (D Hijaz). Unison Egyptian string section glides the hook motif in octaves, firqa style, over the ostinato. Violin glissandi sweeping up into each braam.
- **Lead:** oud plays the hook motif in Hijaz Kar on top of the orchestra, mizmar doubles an octave up.
- **Choir:** fortissimo, wordless, holding the chord tones.
- **FX:** side-chain pump on pads and choir against the kick. Bar 104: final hit on the downbeat, everything stops on beat 2, long reverb tail.

### Section 8 · Outro · bars 105–112 · 2:56–3:10
- **Dynamics:** pp.
- **Drums:** none.
- **Bass:** one low oud note on D2, natural decay.
- **Lead:** solo nay, one last phrase of the hook answer (`5 – 4 – 3 – ♭2 – 1`), very slow, long reverb, back in Saba colour.
- **FX:** desert wind returns, slow auto-pan, fade to silence.

---

## 5. Cover-to-sound mapping

Read the dune as the Great Sand Sea in Egypt's Western Desert.

- Horizon line: long sustained drones (low oud, tanbura, pad) under everything.
- Footprints: the doholla/808 pulse; the journey is the low end.
- Wind in the cloth: nay and kawala breath, risers, auto-pan.
- Sun at the horizon: the Hijaz hook and the mizmar, the only bright things in the mix.
- Indigo shadow: sub-bass depth, low-passed org arpeggio, dark pad.
- Amber/rust: brass, unison strings and choir in the finale.
- The figure alone: the zar rhythm, a ritual for someone with a spirit on them.

---

## 6. Generation notes

- Suno custom mode. Style field ≤1000 chars, Exclude Styles filled, Lyrics field = structure tags only, Instrumental toggle OFF. Assumes v4.5+/v5 field limits and bracket-tag behaviour; verify against whatever version is live.
- Instrument-name risk: Suno may read "tabla" as the Indian pair. The prompt says "Egyptian tabla darbuka" and excludes sitar/Bollywood to hold the line. If a take drifts Indian, replace "tabla" with "darbuka" everywhere and rerun.
- If a take starts singing the bracket text, strip the brackets to bare tags (`[Intro]`, `[Build]`, `[Hook]`...) and rerun. If vocals persist, flip Instrumental ON and rely on the style field alone; you lose section control but keep the palette.
- Generate 4–6 takes. Keep the one where Hook and Bridge are audibly different sections and where the mizmar is present in Hook B. Kill any take that lands in a major key or skips the drums-out bridge.
- If a take stops before the finale, use Extend from the Bridge with the same style text.
- Variant A (Nubian lean): replace rababa/mizmar with tanbura and kisir lyres, Nubian pentatonic melody, Nubian rhythm on duff. Variant B (mahraganat lean): 150 BPM, quarter-tone org takes the hook lead, sampled tabla loop under the drill kit, drop the arpeggiated synth.
