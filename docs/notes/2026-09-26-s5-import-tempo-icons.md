# 2026-09-26 — S5: audio import, metronome and tap tempo, module iconography

S5 per SPEC §3. The methods are listed in SPEC §3 S5 "Delivered".

## Evidence

- **No audio on the wire** (`tests/unit/audio-import.test.ts`).
  - The global fetch and a real `@supabase/supabase-js` client's fetch are recorded.
  - Import (hash, store, decode, analyse, draft) makes no request.
  - Review accepts the draft, and the profile has tempo 140 (`analysis`) and key D Aeolian.
  - `saveImport` sends exactly `POST /rest/v1/files` and `POST /rest/v1/style_profiles`.
    Both bodies are JSON strings, together under 5% of the WAV's size. Neither carries a
    60-byte run of the sample data raw, hex, or base64 at any alignment.
  - The detector is proven on bodies that do carry audio.
  - A mutation that uploads the bytes during import fails the test.
- **Analysis** (`tests/unit/analysis.test.ts`: 24):
  - A −20 dBFS 1 kHz sine at 48 kHz reads −23.01 LUFS, and at 44.1 kHz within 0.2 LU.
  - Click tracks at 90, 120, 140 and 170 BPM read within 1.5 BPM.
  - 4/4 and 3/4 are heard from their accents, and equal beats claim no meter.
  - Triads read as D minor, C major, A minor and G major.
  - The absolute gate: a −75 dBFS sine reads −70.
  - Silence gives no tempo.
  - Analysis is deterministic.
- **Tap tempo** (`tests/unit/tempo.test.ts`): 4 taps 428 ms apart give 140 BPM; an outlier
  tap is discarded; a 2 s gap resets. On the phone viewport with Playwright's controlled
  clock, the same taps read "140 BPM · half 70 · double 280", Assign writes
  `{ bpm: 140, source: 'tap' }`, and bar math shows 1.714 s per bar. Two outliers in a
  row start a new sequence: before that rule, a tempo change from 120 to 90 BPM or one
  late tap kept every later tap discarded until the 2 s reset, because intervals are
  measured from the last kept tap.
- **Metronome** (same file): changing the subdivision mid-beat or shrinking the meter
  mid-bar keeps beats advancing. Before the fix, switching from 16ths to 8ths at step 3
  left the step counter past the subdivision, so the beat never advanced and every click
  played as a subdivision click.
- **Import storage** (`tests/unit/audio-import.test.ts`): where OPFS is missing, the blob
  stays in the tab, as the status line says. Before the fix nothing held it. When two
  files are chosen in quick succession, only the newer one's analysis lands. That race has
  no automated test, because Playwright cannot order two Web Audio decodes.
- **Iconography.** Each of the 11 module headers has its icon, and the icon's computed
  colour equals its `--mod-*` token. Removing the hue fails the test.
- **Mutation checks.** Each of these failed its test:
  - no outlier discard;
  - no 2 s reset;
  - uploading during import;
  - the PT-2 guard off;
  - no absolute loudness gate (after the −75 dBFS case was added; before it, the mutant
    survived);
  - no module hue.

## Found and fixed while building

- **Meter from the log-flux envelope** read "unknown" for 3/4. Log compression flattens
  accents. Meter now reads an amplitude-keeping accent envelope; tempo keeps the log flux,
  which is right for onsets.
- **Mobile overflow.** The review table widened the page to 542 px on a 412 px phone, so
  the browser zoomed and cells intercepted taps. Grid children now shrink (`min-width: 0`),
  the review is a list of cards, and an e2e check asserts no page scrolls sideways.
- **Base64 alignment in the no-audio detector.** A single base64 probe misses data that
  starts at another offset, so the detector checks all three alignments.

## Review findings (Codex on PR #11), verified and fixed

- **Loudness from the mono mix.** Averaging channels before BS.1770 read identical L/R
  3 dB low and phase-opposed stereo as silence. Loudness now K-weights each decoded
  channel and sums the energies with the BS.1770 weights (1.41 on 5.1 surrounds, LFE
  left out). The tests cover L = R (−20.0 LUFS for a −20 dBFS sine), one channel
  (−23.01), phase-opposed channels, and the 5.1 weights. They fail on the old code.
- **Spectra kept for the whole recording.** The frame pass now keeps running sums and
  two numbers per frame, and loudness keeps 100 ms energy sums instead of two full-length
  filtered copies. On a 3-minute 44.1 kHz stereo signal in Node, analysis raised peak RSS
  by about 21 MB, against about 220 MB before, in 2.5 s against 2.7 s. On mono input every
  feature except loudness is identical to the old code across ten signals. Loudness agrees
  to within 4e-13 LU (summation order).
- **Orphans in OPFS.** The blob was stored before decoding, so a corrupt or unsupported
  file stayed in storage. Import now decodes and analyses first. A test proves a failed
  decode stores nothing.
- **Superseded imports stored** (second review). The latest-file guard ran after the
  import had stored its blob. A newer choice now aborts the import in flight through an
  `AbortSignal`, checked after decoding and before storing. It never deletes on abort,
  because the same sha256 may belong to an earlier import.
- **A reading after two taps** (second review). SPEC §1.8 defines BPM over the last 4
  taps, but one interval already read and could be assigned. Nothing reads now until the
  fourth tap.
- **A write superseded mid-flight** (third review). This was the third orphan finding in
  the same place, so the root cause is fixed instead of the window. Import no longer
  stores anything. The screen keeps the blob when the person creates a profile from it,
  so abandoned, failed and superseded imports never reach storage. The e2e checks OPFS in
  Chromium: nothing is stored after import, and the blob is there after Create. Storing
  at import fails that check.
- **Phase cancellation in the analysis mix** (third review). Loudness already read the
  channels, but tempo, key and spectrum read the mono mix, which is silent for
  phase-opposed or side-only stereo. When the mix keeps under a quarter of the channels'
  mean energy, those features read the loudest channel. Uncorrelated stereo keeps half,
  so ordinary material still reads the mix. A test proves phase-opposed stereo reads
  140 BPM and the right key; it fails on the old code.
- **Metronome double start** (fourth review). `running` became true only after
  `resume()` settled, so a double tap made two contexts and two intervals, and the lost
  interval outlived `stop()`. A pending start is now shared, and a stop during start
  leaves nothing running. Tests with a fake AudioContext fail on the old code.
- **Fifth review.** Each fix ships with a test that fails on the old code.
  - **Weights for 5.0 and 7.1.** Only 5.1 had BS.1770 weights. 5.0 and 7.1 now use their
    standard WAV and Web Audio orders: 7.1 side surrounds are 1.41, backs 1.0, and the
    LFE is left out. Other channel counts carry no known layout and weigh 1.0.
  - **Energy windows ignored the meter.** 16 beats is four bars only in 4/4. Windows are
    now four bars of the detected meter.
  - **A new file during Create** could leave the stored blob with no profile. Creating
    now blocks new imports until it finishes. The e2e holds the OPFS write open and
    checks that the file input and Create are disabled. It fails without the lock.
  - **A double Save** inserted two profiles. The profile id is made on the device and
    saved by upsert, so a repeat writes one row. The RLS suite proves that, and that
    another owner's upsert with the same id is refused.

## Decisions

- **The profile base** is the default D1–D6, D8 and D9. Every draft op targets a path that
  exists there, so any subset of accepted fields is a valid profile.
- **Mood words carry 0.4 confidence** and start unticked (PT-1). Tempo, meter and key
  carry the analyser's own confidence; loudness character is 0.8 because it is measured.
- **PV-1** reads a StyleProfile, not a MusicSpec, so it is `lintStyleProfile`, not a
  member of `RULES`. The badge lasts until the tempo source is no longer `analysis`.
- **Icons are provisional** and their source is JSON, so the app draws them inline with
  `currentColor` (the module hue). Standalone SVGs are generated for the Vector
  Iconography project.

## Cut, and why

- **Share-sheet import.** It needs a PWA manifest with `share_target`, and the PWA tooling
  is not set up (A15). Picker and drop ship.
- **Worker analysis.** Analysis runs on the main thread after the status paints. A
  3-minute 44.1 kHz signal took 2.3 s in Node on this build container's CPU, and phones
  will be slower. Moving it to a Web Worker is the upgrade (SPEC §1.11).
