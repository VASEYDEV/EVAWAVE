# EVAWAVE — Instrument Bank Seed v0.1

VASEY/AI · 2026-09-16 · status: PROPOSED list, confirmed floor (A13)
Repo target: `docs/evawave/instrument-bank-seed-v0.1.md`

This is the launch floor for the `Instrument`, `DrumPattern` and `SynthRole` banks. "Every instrument in the world" stays the growth goal and runs through the curation pipeline (Claude-drafted batches, Sean-approved). Everything below is enumerable and finite, which is what makes it a seed rather than an aspiration.

---

## 0. Conventions

- **Record shape:** `Instrument` per scope v0.2 §4.2, plus `promptPhrase` (the text the serializer emits) and `commonNames` (what users type). Ids are kebab-case slugs; GM records also carry `gmProgram` (1–128) or `gmNote` (27–87) in `description` until the schema gets a `sources` block.
- **Name vs. prompt phrase:** `name` is generic. Brand-derived terms ("808", "Rhodes", "Hammond", "Mellotron", "Moog", "303") live in `commonNames` and may appear in `promptPhrase` only where engines demonstrably read them (808 and 909 do; verify the rest per engine). Artist and producer names never appear anywhere in a record.
- **Family defaults:** each GM family sets default `family`, `register`, `idiomaticRoles` and articulation set; individual records override.
- **Engine columns** (`aliases`, `reliability`) are filled per engine at curation time, not here. Suno v6 aliases from Jinn v1.1/1.2 (tabla → Egyptian tabla darbuka; rababa; org; strings) carry over.
- **Sections vs. instruments:** "String Ensemble", "Brass Section", "Choir" are Instrument records with `family` of the section and `commonNames` for the section terms, so per-section scoping can place a section as one item against the 5–8 cap.
- **Counts:** GM1 128 + GM percussion 61 (GM1 47 + GM2 14) + orchestral additions ~45 + band ~18 + contemporary ~40 + synth archetypes ~28 + acoustic kits 8 + drum machines/sample kits 14 + genre kits 20 + world ~95 ≈ **~455 records at seed**. Exact count settled at curation.

---

## 1. General MIDI Level 1 — 128 programs (baseline)

Program numbers 1–128. Defaults per family in the right-hand column.

| Family | Programs | Defaults |
|--------|----------|----------|
| Piano | 1 Acoustic Grand Piano · 2 Bright Acoustic Piano · 3 Electric Grand Piano · 4 Honky-tonk Piano · 5 Electric Piano 1 (tine) · 6 Electric Piano 2 (FM/reed) · 7 Harpsichord · 8 Clavinet | keyboard · low-mid–high · roles: keys, pad, counter, lead |
| Chromatic percussion | 9 Celesta · 10 Glockenspiel · 11 Music Box · 12 Vibraphone · 13 Marimba · 14 Xylophone · 15 Tubular Bells · 16 Dulcimer (hammered) | percussion (pitched) · mid–high · roles: texture, counter, lead |
| Organ | 17 Drawbar Organ · 18 Percussive Organ · 19 Rock Organ · 20 Church Organ · 21 Reed Organ · 22 Accordion · 23 Harmonica · 24 Tango Accordion (bandoneon) | keyboard/wind · low-mid–high · roles: pad, keys, lead |
| Guitar | 25 Acoustic Guitar (nylon) · 26 Acoustic Guitar (steel) · 27 Electric Guitar (jazz) · 28 Electric Guitar (clean) · 29 Electric Guitar (muted) · 30 Overdriven Guitar · 31 Distortion Guitar · 32 Guitar Harmonics | string (plucked) · low-mid–high-mid · roles: rhythm, lead, texture |
| Bass | 33 Acoustic Bass (upright) · 34 Electric Bass (finger) · 35 Electric Bass (pick) · 36 Fretless Bass · 37 Slap Bass 1 · 38 Slap Bass 2 · 39 Synth Bass 1 · 40 Synth Bass 2 | string/electronic · sub–low-mid · roles: bass |
| Strings (solo/section) | 41 Violin · 42 Viola · 43 Cello · 44 Contrabass · 45 Tremolo Strings · 46 Pizzicato Strings · 47 Orchestral Harp · 48 Timpani | string (bowed) / percussion · full range · roles: lead, counter, pad, texture; timpani: rhythm |
| Ensemble | 49 String Ensemble 1 · 50 String Ensemble 2 (slow) · 51 Synth Strings 1 · 52 Synth Strings 2 · 53 Choir Aahs · 54 Voice Oohs · 55 Synth Voice · 56 Orchestra Hit | section/voice · low-mid–high · roles: pad, texture, stab (orchestra hit) |
| Brass | 57 Trumpet · 58 Trombone · 59 Tuba · 60 Muted Trumpet · 61 French Horn · 62 Brass Section · 63 Synth Brass 1 · 64 Synth Brass 2 | brass · bass–high-mid · roles: lead, stab, pad |
| Reed | 65 Soprano Sax · 66 Alto Sax · 67 Tenor Sax · 68 Baritone Sax · 69 Oboe · 70 English Horn (cor anglais) · 71 Bassoon · 72 Clarinet | wind (reed) · low-mid–high · roles: lead, counter, pad |
| Pipe | 73 Piccolo · 74 Flute · 75 Recorder · 76 Pan Flute · 77 Blown Bottle · 78 Shakuhachi · 79 Whistle · 80 Ocarina | wind (air) · mid–high · roles: lead, texture |
| Synth lead | 81 Lead 1 (square) · 82 Lead 2 (sawtooth) · 83 Lead 3 (calliope) · 84 Lead 4 (chiff) · 85 Lead 5 (charang) · 86 Lead 6 (voice) · 87 Lead 7 (fifths) · 88 Lead 8 (bass + lead) | electronic · low-mid–high · roles: lead, stab |
| Synth pad | 89 Pad 1 (new age) · 90 Pad 2 (warm) · 91 Pad 3 (polysynth) · 92 Pad 4 (choir) · 93 Pad 5 (bowed) · 94 Pad 6 (metallic) · 95 Pad 7 (halo) · 96 Pad 8 (sweep) | electronic · low-mid–high · roles: pad, drone, texture |
| Synth effects | 97 FX 1 (rain) · 98 FX 2 (soundtrack) · 99 FX 3 (crystal) · 100 FX 4 (atmosphere) · 101 FX 5 (brightness) · 102 FX 6 (goblins) · 103 FX 7 (echoes) · 104 FX 8 (sci-fi) | electronic · full range · roles: texture, drone |
| Ethnic (GM label; bank uses region) | 105 Sitar · 106 Banjo · 107 Shamisen · 108 Koto · 109 Kalimba · 110 Bag pipe · 111 Fiddle · 112 Shanai (shehnai) | region set per record · roles: lead, texture, rhythm |
| Percussive | 113 Tinkle Bell · 114 Agogo · 115 Steel Drums · 116 Woodblock · 117 Taiko Drum · 118 Melodic Tom · 119 Synth Drum · 120 Reverse Cymbal | percussion · roles: rhythm, texture, transition (reverse cymbal) |
| Sound effects | 121 Guitar Fret Noise · 122 Breath Noise · 123 Seashore · 124 Bird Tweet · 125 Telephone Ring · 126 Helicopter · 127 Applause · 128 Gunshot | fx · roles: texture; most are `reliability: unreliable` for music engines and exist for completeness |

Curation notes: GM's "Ethnic" label is not used in the bank; those eight records go to their regional sets (§9) with `commonNames` retaining the GM name. GM 5/6 are split into tine EP and reed/FM EP records with `commonNames` ["Rhodes"], ["Wurlitzer", "DX EP"]. GM 24 is filed as bandoneon.

---

## 2. General MIDI percussion key map (channel 10)

### 2.1 GM1 notes 35–81

35 Acoustic Bass Drum · 36 Bass Drum 1 · 37 Side Stick · 38 Acoustic Snare · 39 Hand Clap · 40 Electric Snare · 41 Low Floor Tom · 42 Closed Hi-Hat · 43 High Floor Tom · 44 Pedal Hi-Hat · 45 Low Tom · 46 Open Hi-Hat · 47 Low-Mid Tom · 48 Hi-Mid Tom · 49 Crash Cymbal 1 · 50 High Tom · 51 Ride Cymbal 1 · 52 Chinese Cymbal · 53 Ride Bell · 54 Tambourine · 55 Splash Cymbal · 56 Cowbell · 57 Crash Cymbal 2 · 58 Vibraslap · 59 Ride Cymbal 2 · 60 Hi Bongo · 61 Low Bongo · 62 Mute Hi Conga · 63 Open Hi Conga · 64 Low Conga · 65 High Timbale · 66 Low Timbale · 67 High Agogo · 68 Low Agogo · 69 Cabasa · 70 Maracas · 71 Short Whistle · 72 Long Whistle · 73 Short Guiro · 74 Long Guiro · 75 Claves · 76 Hi Wood Block · 77 Low Wood Block · 78 Mute Cuica · 79 Open Cuica · 80 Mute Triangle · 81 Open Triangle

### 2.2 GM2 additions

Notes 27–34: High Q · Slap · Scratch Push · Scratch Pull · Sticks · Square Click · Metronome Click · Metronome Bell.
Notes 82–87: Shaker · Jingle Bell · Bell Tree · Castanets · Mute Surdo · Open Surdo.
GM2 drum kits (bank/program): Standard · Room · Power · Electronic · Analog · Jazz · Brush · Orchestra · SFX.

Mapping rule: each GM percussion note becomes an Instrument record with `family: 'percussion'`, `idiomaticRoles: ['rhythm']`, and a `KitPiece` mapping where one exists (36 → kick, 38 → snare, 39 → clap, 37 → rim, 42 → hat-closed, 46 → hat-open, 49/57 → crash, 51 → ride, toms → perc-1/perc-2). Each GM2 kit becomes a `DrumPattern`-compatible kit preset (acoustic kits §8.1, Electronic/Analog kits §8.2).

---

## 3. GS and XG variation banks

Roland GS and Yamaha XG extend GM with hundreds of program variations and additional drum kits (GS: TR-808, TR-909, Dance, Jazz, Brush, Orchestra and others; XG: many more). Rule: **batch-import from the published spec tables** as a curation job, deduplicated against §1 and §6–§8 by `promptPhrase`. Not hand-enumerated here. Variations that only differ by chorus/velocity switching collapse into one record with a `playStyles` entry.

---

## 4. Orchestral and symphonic (beyond GM)

Strings: violin I, violin II, viola, cello, double bass (sections and solo records); harp; techniques bank entries for arco, pizzicato, tremolo, sul ponticello, sul tasto, col legno, harmonics, spiccato, staccato, legato, marcato, glissando, divisi, con sordino, Bartók pizz.
Woodwinds: alto flute, bass flute, oboe d'amore, E♭ clarinet, A clarinet, bass clarinet, contrabass clarinet, contrabassoon, heckelphone (rare; `reliability` low everywhere).
Brass: C trumpet, piccolo trumpet, flugelhorn, cornet, Wagner tuba, tenor trombone, bass trombone, contrabass trombone, cimbasso, euphonium, contrabass tuba; mutes as `playStyles` (straight, cup, harmon, bucket, plunger).
Percussion: bass drum (gran cassa), orchestral snare, tenor drum, field drum, crash pair, suspended cymbal, tam-tam, gong, triangle, tambourine, castanets, temple blocks, ratchet, whip/slapstick, anvil, thunder sheet, mark tree, wind chimes, crotales, bell plates, sleigh bells, rainstick; timpani (GM 48) gains `playStyles`: roll, glissando, muffled.
Keyboards in the pit: celesta (GM 9), pipe organ (GM 20), orchestral piano, harpsichord continuo.
Choir: SATB choir, wordless choir (aahs/oohs), boys' choir, chant (monophonic, Latin-style) — `family: 'voice'`, `idiomaticRoles: ['pad','texture']`; wordless variants flagged `instrumental-safe: true` in `description`.
Film-score hybrids: trombone braam, French horn stab, string ostinato, taiko ensemble (also §9), sub-boom hit, riser (also FX) — modelled as Technique/SynthRole entries pointing at these instruments.

---

## 5. Concert band, brass band, marching band, jazz big band

Concert band: clarinet choir (E♭, B♭, alto, bass, contra), saxophone section (SATB), cornets, flugelhorns, E♭ tenor horn, baritone horn, euphonium, sousaphone, string bass (band), concert snare/bass/cymbals, glockenspiel (bell lyra).
Brass band (British): soprano cornet, solo/rep/2nd/3rd cornets, flugelhorn, tenor horns, baritones, euphoniums, tenor/bass trombones, E♭/B♭ basses.
Marching / drumline: marching snare (high-tension), tenor drums (quads/quints), marching bass drum line (tuned set), marching cymbals, front ensemble (marimba, vibes, xylophone, glock, bells, aux).
Jazz big band: trumpet section (4), trombone section (3 + bass), sax section (2 alto, 2 tenor, bari), rhythm section (piano, archtop guitar, upright bass, kit with brushes/sticks), vibes; `playStyles` for shakes, falls, doits, scoops, plunger growl.

---

## 6. Contemporary and popular

Guitars: steel-string acoustic, nylon (classical), 12-string, electric single-coil, electric humbucker, semi-hollow/archtop, baritone electric, lap steel, pedal steel, resonator (dobro), ukulele, mandolin, 5-string banjo, tenor banjo; amp/FX `playStyles`: clean, crunch, overdrive, distortion, fuzz, chorus, tremolo, wah, spring reverb, palm mute, slide, fingerpicked, strummed, tapped, harmonics, feedback.
Basses: fingerstyle electric, pick electric, slap, fretless, upright (also GM 33), 5-string, P-style vs J-style as `playStyles`, synth bass (§7), sub bass, 808 bass (§8.2).
Keys: acoustic grand, upright piano, tack/saloon piano, felt piano, tine electric piano (commonNames: Rhodes), reed electric piano (commonNames: Wurlitzer), FM electric piano (commonNames: DX EP), clavinet (GM 8), tonewheel organ with rotary speaker (commonNames: Hammond, B3, Leslie), transistor combo organ (commonNames: Vox, Farfisa), tape-replay keyboard (commonNames: Mellotron), electric grand (GM 3, commonNames: CP-70), pianet, toy piano, harpsichord (GM 7), accordion (GM 22), melodica, harmonium (also §9), string machine (commonNames: Solina), electric harpsichord.
Voice as instrument: lead vocal, backing vocals, vocoder, talkbox, vocal chops, vocal pad, beatbox — `family: 'voice'`; only vocoder/vocal chops/vocal pad are `instrumental-safe`.

---

## 7. Synthesizer archetypes (SynthRole seeds)

Seeded as `SynthRole` records with `SynthCharacteristics` filled and `promptPhrase` written by trait. Common hardware names go in a `commonNames` note inside `prose` for lookup only; they are not emitted.

| Role | Archetype (promptPhrase) | Characteristics | Lookup names |
|------|--------------------------|-----------------|--------------|
| lead | dirty detuned amp-sim-distorted analog saw lead with glide and pitch-bend swoops | saw, unison 3–7, ±15c, amp-sim, mono legato, glide, bend ±2/±12 | 2000s Southern rap lead, "Dirty Hook"-style |
| lead | fat three-oscillator analog mono lead | saw+saw+square, unison 3, ±8c, overdrive, mono legato, glide | Minimoog-style |
| lead | bright PWM rave lead ("hoover") | pulse+saw, PWM, unison 5, ±20c, saturation, poly | hoover |
| lead | screaming resonant sync lead | saw, osc sync, high-res LPF, overdrive, mono | sync lead |
| lead | glassy FM bell lead | fm, no unison, none, poly, pluck env | DX-style bell |
| stab | angry ripping crackling distorted hypersaw unison stab | saw, unison 7–9, ±25c, hard-clip + bitcrush, stab env, poly | hypersaw stab |
| stab | 12-bit gritty sampled chord stab | wavetable/sample, bitcrush, stab env, poly | SP-1200-style stab |
| stab | orchestral synth hit | saw+noise, saturation, stab env | orchestra hit |
| sub | saturated sine/808 sub tuned to key, long decay | sine, none, saturation, sustain env, mono, glide (drill) | 808 sub |
| sub | distorted saw sub for gritty warm low-mids | saw, unison 2, ±5c, overdrive, mono | saw sub layer |
| bass | detuned dual-saw bass ("reese") | saw, unison 2, ±12c, overdrive, mono, sustain | reese |
| bass | squelchy resonant acid bass | saw/square, high-res LPF, accent/slide, mono, glide | 303-style |
| bass | FM slap/growl bass | fm, saturation, mono, pluck | DX bass |
| bass | wobble bass with LFO filter modulation | saw, unison 3, LPF LFO, overdrive, mono | dubstep wobble |
| bass | chorused analog poly bass | saw, unison 2, chorus, poly, pluck | Juno-style bass |
| pad | warm chorused analog poly pad | saw, unison 2, ±7c, LPF, poly, sustain/swell | Juno/Jupiter-style pad |
| pad | dark evolving wavetable pad | wavetable, LPF sweep, poly, swell | dark pad |
| pad | wordless vocal formant pad | wavetable/formant, poly, swell | vox pad |
| pad | string machine pad | saw, ensemble chorus, poly, sustain | Solina-style |
| arp | low-passed 16th arpeggio in the mode | saw/square, LPF, pluck, poly | arp |
| arp | trance supersaw arp | saw, unison 7, ±20c, poly, pluck | supersaw arp |
| pluck | short plucked square/saw with fast decay | square/saw, pluck, poly | pluck |
| keys | FM electric piano | fm, poly, sustain | DX EP |
| drone | sub drone on the tonic | sine+saw, LPF, mono, sustain | drone |
| texture | granular cloud | granular, poly, swell | granular |
| texture | noise riser with filter opening | noise, HPF→LPF sweep, swell | riser |
| texture | reverse reverb swell | any, reverse env | reverse swell |
| counter | arpeggiated detuned saw counter-melody with pitch bends | saw, unison 3, ±12c, overdrive, mono, glide, bend ±2 | Jinn bridge phrase 2/4 |

Synthesis-type vocabulary for the picker: subtractive analog, virtual analog, FM, wavetable, additive, granular, physical modelling, sample-based, vector, PWM, ring-mod, formant.

---

## 8. Drums and percussion

### 8.1 Acoustic drum kits (kit presets → `DrumPattern.regional` empty, `grid` per genre)

Rock kit (close-miked, big room) · pop kit (tight, sampled-augmented) · funk kit (dry, tight snare) · jazz kit (ride-led, brushes/sticks) · brush kit · metal kit (double kick, triggered snare) · gospel/R&B kit (ghost-note heavy) · orchestral kit (concert snare, gran cassa, suspended cymbal). Kit pieces per §2 mapping; `playStyles`: brushes, rods, mallets, rimshot, side-stick, cross-stick, ghost notes, flams, ruffs, buzz roll.

### 8.2 Drum machines and digitized-sample kits

Each is an Instrument record (`family: 'electronic'`, `idiomaticRoles: ['rhythm']`, kit-piece children) described by trait; brand/model in `commonNames`.

| Record (promptPhrase) | Trait description | commonNames |
|-----------------------|-------------------|-------------|
| 808 analog drum kit | boomy tuned sub kick with long decay, snappy short snare, dry clap, ticking hats, cowbell, congas, maracas | 808, TR-808 |
| 909 analog/sample hybrid kit | punchy clicky kick, cracking snare, sizzling open hat, crash | 909, TR-909 |
| 707 digital kit | thin crisp digital kick/snare, Latin toms | 707, 727 |
| 606 analog kit | small tight analog kit, clicky hats | 606 |
| CR-78 kit | soft vintage analog rhythm-box kit | CR-78 |
| 8-bit digitized drum kit, gated | early digital sampled drums, gated reverb, crunchy | LinnDrum, LM-1, DMX |
| 12-bit gritty sampled kit | 26 kHz 12-bit sampled drums, dusty, filtered, punchy | SP-1200 |
| 12-bit MPC-style sampled kit with swing | warm sampled drums, swung 16ths, soft transients | MPC60 |
| 16-bit MPC-style kit | cleaner sampled drums, tight | MPC3000, MPC2000 |
| hexagonal electronic tom kit | 80s synthesized toms with pitch drop | Simmons |
| 12-bit sampler drums (rack) | crunchy aliasing sampler character | S950, Emulator |
| layered trap kit | 808 sub tuned to key + short transient kick, clap-snare stack, rimshot, 16th/32nd hats | trap kit |
| dusty chopped-break kit | sampled breakbeat slices, vinyl crackle, swung | boom-bap kit |
| processed modern hybrid kit | acoustic + electronic layers, saturated, sidechained | hybrid kit |

Sampling and processing `playStyles` shared by these: bitcrush, sample-rate reduce, tape saturation, vinyl crackle, gated reverb, sidechain pump, transient shaping, pitch-down, layering, chopping, filtering.

### 8.3 Genre kits (DrumPattern seeds; grid filled at curation)

Atlanta trap · drill (contrast) · boom-bap · lo-fi hip hop · crunk/snap · phonk · Memphis · jersey club · house (four-on-floor, open hat on the and) · techno · trance · drum and bass (chopped break + sub) · jungle · dubstep (half-time) · UK garage / 2-step · footwork/juke · reggaeton/dembow · afrobeats · amapiano (log-drum bass) · dancehall · synthwave (gated 80s kit) · industrial · pop-rock · funk · disco · R&B/neo-soul · gospel · latin (salsa/bossa) · Egyptian iqa'at set (maqsum, baladi, Sa'idi, wahda, malfuf, ayyub — `fourFourSafe: true`; samai thaqil, karsilama, yuruk semai — `false`).

---

## 9. World sets (regional bundles)

Everything used in Jinn v1.0–v1.2 is included and anchored.

**Egypt (Jinn v1.1/1.2; anchor doholla + low oud):** oud, qanun, nay, kawala, mizmar, rababa, kamanja (Egyptian violin), unison Egyptian string section, tanbura lyre, kisir lyre, arghul, quarter-tone org keyboard; percussion: Egyptian tabla (darbuka), doholla, riq, mazhar, sagat, duff/daf, tabla baladi, tura.
**Morocco / Maghreb (Jinn v1.0; anchor guembri):** guembri (gimbri/sintir), ribab, lotar, oud (Maghrebi), krakebs (qraqeb), bendir, tbel, tarija, taarija, darbuka (Maghrebi), handclaps (Gnawa/Ahwach).
**Levant / Turkey / Persia / Caucasus:** buzuq, saz/bağlama, cümbüş, kanun (Turkish), ney (Turkish), zurna, duduk, kemençe, santur, tar, setar, kamancheh, tombak (zarb), daf, davul, bendir, tar (frame drum).
**South Asia:** sitar (GM 105), sarod, tanpura, veena, santoor, bansuri, shehnai (GM 112), harmonium, sarangi, esraj, dilruba; percussion: tabla pair, pakhawaj, mridangam, dhol, dholak, ghatam, kanjira, khol, ghungroo bells.
**East / Southeast Asia:** koto (GM 108), shamisen (GM 107), shakuhachi (GM 78), biwa, taiko (GM 117) with shime-daiko and ō-daiko, erhu, guzheng, pipa, dizi, sheng, yangqin, guqin, suona, gayageum, haegeum, dan bau, gamelan metallophones (saron, gender, bonang), gong ageng, kendang, angklung.
**Sub-Saharan Africa:** kora, ngoni, balafon, mbira/kalimba (GM 109), krar, masenqo, oud (Sudanese); percussion: djembe, dunun set, talking drum, udu, shekere, log drum, sabar, bougarabou, kpanlogo, seperewa.
**Latin America / Caribbean / Brazil:** congas, bongos, timbales, cajón, güiro (GM 73/74), claves (GM 75), maracas (GM 70), cabasa (GM 69), shekere, cowbell (GM 56), agogô (GM 67/68), surdo, repinique, tamborim, caixa, cuíca (GM 78/79), pandeiro, berimbau, steelpan (GM 115), tres, cuatro, charango, quena, siku, bombo legüero, requinto, vihuela and guitarrón (mariachi), harp (Paraguayan), bandoneón (GM 24), accordion (norteño).
**Celtic / European folk:** uilleann pipes, Highland bagpipes (GM 110), tin whistle, low whistle, bodhrán, fiddle (GM 111), Irish bouzouki, Greek bouzouki, hurdy-gurdy, nyckelharpa, hardanger fiddle, cimbalom, tamburica, Cretan lyra, launeddas, cajón (also §9 Latin), accordion (Cajun/zydeco with rubboard).
**Oceania / other:** didgeridoo, clapsticks, ukulele (also §6), log drums (pate), conch.

Each set becomes a `RegionalBundle` with `instrumentIds`, `rhythmIds` (with meter flags), `modeIds` (maqam / dastgah / raga / pentatonic sets), `techniqueIds` (taqsim, Sa'idi trill, meend, gamak, tahrir, etc.) and one `anchorInstrumentId` that bridges into the trap/electronic low end.

---

## 10. Curation order

1. GM1 + GM percussion + GM2 kits (finite, canonical; import first, machine-checkable).
2. Jinn bundles: Egypt, Morocco (already specified in v1.1/v1.0; validates the record shape against real prompts).
3. Trap/drill/boom-bap genre kits and the drum-machine records (Jinn v1.2 grammar).
4. Orchestral and choir set (Jinn finale).
5. Synth archetypes.
6. Contemporary popular.
7. Band sets.
8. Remaining world sets, one region per batch.
9. GS/XG batch import, deduplicated.

Every batch: Claude drafts records against the schema → Sean approves in the curator view → `verifiedOn` stamped → published. Engine `reliability` is filled from take logs over time, starting `unverified`.

---

## 11. Example records

```json
{
  "id": "oud",
  "name": "Oud",
  "family": "string",
  "region": "Egypt / Arab world",
  "register": ["low-mid", "mid"],
  "timbre": ["plucked", "warm", "woody", "fretless", "short sustain"],
  "articulationIds": ["tremolo", "slide", "taqsim", "ostinato", "double-stop"],
  "playStyles": ["dry plucked", "risha tremolo", "low-register ostinato doubling the 808"],
  "idiomaticRoles": ["lead", "counter", "drone", "rhythm"],
  "aliases": { "suno": "oud" },
  "reliability": { "suno": "reliable", "flow": "unverified", "eleven": "unverified" },
  "bundleIds": ["egypt-takht-saidi-nubian", "maghreb-gnawa"],
  "description": "Fretless short-necked lute; the melodic core of the takht. In Jinn it plays the Hijaz hook dry and plucked and doubles the 808 on D2.",
  "promptPhrase": "oud",
  "commonNames": ["oud", "ud", "'ud"]
}
```

```json
{
  "id": "kick-808-sub",
  "name": "808 sub kick",
  "family": "electronic",
  "region": null,
  "register": ["sub", "bass"],
  "timbre": ["boomy", "tuned", "long decay", "saturated", "felt in the chest"],
  "articulationIds": ["glide", "pitch-drop", "long-release"],
  "playStyles": ["tuned to the song key", "distorted and reverberant", "sliding between root and minor third (drill)"],
  "idiomaticRoles": ["sub", "bass", "rhythm"],
  "aliases": { "suno": "808" },
  "reliability": { "suno": "reliable", "flow": "unverified", "eleven": "unverified" },
  "bundleIds": ["atlanta-trap-kit", "drill-contrast-kit"],
  "description": "Analog-derived tuned bass drum used as the bass instrument in trap; GM 36 lineage but functionally a bass. Jinn: tuned to D1, long decay, distorted, reverberant.",
  "promptPhrase": "booming distorted reverberant 808 tuned to the key, long decay",
  "commonNames": ["808", "TR-808 kick", "808 bass"]
}
```

```json
{
  "id": "electric-piano-tine",
  "name": "Tine electric piano",
  "family": "keyboard",
  "region": null,
  "register": ["low-mid", "mid", "high-mid"],
  "timbre": ["bell-like", "warm", "mellow", "barky when driven"],
  "articulationIds": ["legato", "staccato", "tremolo-panned", "sustain-pedal"],
  "playStyles": ["clean", "phaser", "tremolo", "overdriven", "chorused"],
  "idiomaticRoles": ["keys", "pad", "counter"],
  "aliases": {},
  "reliability": { "suno": "unverified", "flow": "unverified", "eleven": "unverified" },
  "bundleIds": ["contemporary-keys"],
  "description": "GM 5 lineage. Hammer-struck tines with electromagnetic pickups; the neo-soul, jazz-funk and lo-fi keys sound.",
  "promptPhrase": "warm tine electric piano",
  "commonNames": ["Rhodes", "Fender Rhodes", "Rhodes piano", "EP"]
}
```
