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
- **Sixth review.**
  - **The metronome leaked a context when `resume()` was refused.** The context is now
    closed and released, so retries do not pile up contexts. A test with a blocked fake
    context fails on the old code.
  - **Profile names could exceed the 200-character column.** The import's name input
    and its filename fallback now cap at `PROFILE_NAME_MAX`. The RLS suite ties that
    constant to the migration's check: 200 characters are accepted and 201 refused.
  - **Listed, not fixed (CLAUDE.md §1.1):** the `/library` page's profile-name input
    (S4, `src/components/library/Library.tsx`) has the same missing limit. Using
    `PROFILE_NAME_MAX` there is a one-line follow-up.
- **Seventh review: the blob of an unsaved profile.** After Create, choosing another file
  discarded the in-memory profile but not its stored blob. Every orphan finding had one
  root: the blob was stored before anything durable referred to it. It is now stored
  only after a library save succeeds, or with a downloaded profile, which carries the
  sha256. Create is synchronous again, so the fifth review's Create lock guarded nothing
  and is gone. The e2e checks OPFS: nothing after import, nothing after Create, and the
  blob with the download. Storing at Create fails the check.
- **Eighth review.**
  - **Stage checks for aborts.** The abort signal is now checked after the read, after
    the hash and after the decode, so a superseded large import stops at its next stage
    instead of running alongside the new one. Web Audio's decode itself cannot be
    cancelled. A test aborts during the hash and asserts the decode never runs; it fails
    on the old code.
  - **Deleting a `/library` file record** left its local copy behind, a consequence of S5
    storing blobs. The delete now also calls `removeLocalAudio(sha256)`, which is
    unit-tested on a fake OPFS and on the in-tab fallback. The one-line wiring in
    `Library.tsx` has no automated test: the library needs a live Supabase session, which
    no test here has. OPFS is per origin, so another account on the same browser that
    imported the same file loses its local copy too, and can import it again.
- **Ninth review: beat phase after a subdivision change.** The first-round metronome fix
  folded the step counter but kept the next click on the old step grid. At 120 BPM, a
  change from 16ths to 8ths after 0.25 s put beat 2 at 0.375 s instead of 0.5 s. The
  cursor now carries its beat's time, and each tick re-derives the next click from that
  beat under the current settings. Tests pin the times for 16ths to 8ths and 8ths to
  16ths; they fail on the old scheduler.
- **Tenth review.**
  - **Analysis on the UI thread (P1).** The analysis now runs in a Web Worker, which an
    abort terminates, and the sample buffers are transferred, not copied. Turbopack in
    Next 16.3.6 does not bundle `new Worker(new URL("./analysis.worker.ts",
    import.meta.url))`; two builds copied the raw `.ts` file as a static asset.
    `scripts/build-analysis-worker.mjs` (rolldown, now a direct devDependency) bundles it
    into `public/workers/analysis.worker.js` instead. A `--check` test keeps that bundle
    in sync with the source. The S5 e2e records every worker the page starts: exactly
    `/workers/analysis.worker.js`, and the import still reads 140 BPM. With the worker
    removed, the e2e fails.
  - **Stale metronome clicks after a stalled tick** were scheduled in the past and
    played in a burst. `scheduleClicks` now takes `now` and skips to the first grid step
    at or after it, keeping the bar position. A test stalls from 0.3 s to 10 s and gets
    one downbeat at 10 s; it fails on the old scheduler.
- **Eleventh review: the cancellation floor for surround.** The fixed floor of a quarter of
  the channels' mean energy fits stereo only. An average of N uncorrelated channels keeps
  1/N, so ordinary 5.1 (1/6) fell under it and read one channel. The floor is now half of
  1/N: 0.25 for stereo as before, and about 0.083 for 5.1. A six-channel test reads the
  mix; it fails on the old floor.
- **Twelfth review.**
  - **A BPM change mid-beat** re-read the beat in progress at the new tempo. At 120 BPM
    with 16ths through 0.25 s, a switch to 240 BPM treated 0.25 s as the next beat. The
    cursor now carries the length of the beat in progress, so that beat finishes at its
    own tempo and the new BPM applies from the next downbeat. A test pins the times; it
    fails on the old scheduler.
  - **OPFS removal errors were swallowed.** `removeLocalAudio` now ignores only a missing
    OPFS and not-found, and rethrows anything else. `/library` removes the local copy
    before the row, so a failure keeps the record and its hash for a retry. A test with
    a locked entry expects the rejection; it fails on the old code.
- **Thirteenth review.**
  - **Leaving `/import` mid-analysis** left the worker running. An unmount cleanup now
    aborts the import in flight, which terminates the worker. The e2e serves a worker
    that never answers, navigates away and waits for exactly one `terminate()`. It fails
    without the cleanup.
  - **The save was two requests.** A failure between them left a file row with no
    profile. `public.save_import` (new migration, `security invoker`) now writes both in
    one transaction and builds the provenance from the file row it wrote. `saveImport`
    makes a single RPC call. The RLS suite checks idempotence, rollback when the profile
    fails, another owner's id refused with none of that call's rows kept, and no access
    signed out. The refusal test fails if the function becomes `security definer`.
- **Fourteenth review: audio kept for download-only profiles.** Nothing in the app could
  reach or remove a blob stored for a download, because there is no profile-JSON import
  and removal runs from a library row. Only a library save now keeps the audio, through
  `saveImportAndKeepAudio`, which stores after the save succeeds and not when it fails.
  Both orders are unit-tested, and storing first fails. The e2e checks that Download
  leaves OPFS empty. The save-then-store path has no e2e, because the library needs a
  live Supabase session.
- **Fifteenth review: OPFS root failures.** `removeLocalAudio` still treated any
  `getDirectory()` failure as "no OPFS", so a transient error could report success before
  the row was deleted. Now only a missing API or a private window's `SecurityError` counts
  as nothing to remove. `storeInOpfs` falls back to memory in both cases, so OPFS holds
  nothing. Other errors reject. A test covers both paths; it fails on the old code.
- **Sixteenth review: a recoverable delete across two stores.** Removing the local copy
  first protected the hash, but a failed row delete then left the record without its
  audio. `deleteWithLocalAudio` reads the copy into memory, removes it, deletes the row,
  and stores the copy again if the row delete fails, so each failure leaves both stores
  as they were. Tests cover a failed row delete (the copy is restored byte for byte), a
  successful delete, and a locked copy (the row delete never runs). Dropping the restore
  fails the first test.
- **Seventeenth review: one local copy per account.** OPFS is per origin, so two accounts
  on one browser that saved the same file shared `audio/<sha256>`, and deleting either
  record removed the other's only copy. Copies now live under `audio/<owner>/<sha256>`,
  and the in-tab fallback is keyed the same way. The save stores under the session's user
  id, which is the `auth.uid()` the database writes as `owner_id`; the delete uses the
  row's `owner_id`. The unit fake OPFS is now a directory tree: the old one returned the
  same directory for every name, so it could not tell one owner's directory from another's. A two-account test keeps both
  copies and removes only the deleted account's; collapsing the owner directory, or the
  in-tab key, fails it. The e2e now checks that the whole `audio` directory stays empty
  through import, Create and Download, since a check on one path would pass vacuously
  under the new layout; storing at Create fails it. This separates lifecycles, not access
  (SECURITY.md).
- **Eighteenth review: the fallback copy on a failed removal.** `removeLocalAudio` dropped
  the in-tab copy before trying OPFS. When a blob had fallen back to the tab (OPFS opened
  but could not write) and the OPFS entry was then locked, the delete failed and kept the
  record, but its only copy was gone. The in-tab copy is now dropped last, once the OPFS
  side has succeeded or had nothing to remove, so a failed removal removes nothing. A test
  with that fallback and a locked entry fails on the old code.
- **Nineteenth review.**
  - **A file delete that removed no row (fixed).** RLS hides other owners' rows, so after
    the signed-in account changes, deleting a row loaded earlier succeeds with no rows.
    `deleteFile` accepted that, so the local copy was gone while the record stayed. It now
    rejects unless exactly one row went, and `deleteWithLocalAudio` restores the copy. A
    test through a real supabase-js client answering `[]` fails on the old code.
    **Listed, not fixed (CLAUDE.md §1.1):** `deleteStyleProfile` and `deleteTag` (S4) also
    report success on zero rows; nothing local is lost there.
  - **The loudness range gate (kept, with a test).** Codex asked to gate the 3 s windows
    at the integrated loudness − 20 LU. EBU Tech 3342 anchors that gate to the power mean
    of the absolute-gated short-term values, which is what the code does, and so does
    libebur128 (`ebur128_loudness_range_multiple`: `minus_twenty_decibels * stl_power`).
    A new test uses a signal where the two anchors disagree (10 s at −23 LUFS, then 30 s at
    about −46): the range reads about 23 LU, and the suggested gate fails it.
- **Twentieth review.**
  - **A repeated delete of the same file.** Two quick activations both read the copy and
    removed it; one record delete succeeded, and the other removed no row, failed, and
    restored a copy nothing referred to. `deleteWithLocalAudio` now joins a delete already
    in flight for the same owner and hash. A test runs two at once: the record delete runs
    once and no copy comes back. It fails on the old code. Two tabs could still race; the
    twenty-first review fixed that.
  - **A stale in-tab copy after OPFS recovers.** A save that fell back to memory and was
    retried into OPFS kept the in-tab blob for the life of the tab. A successful OPFS
    write now drops it. A test stores through the fallback, then into OPFS, and checks the
    tab no longer holds it; it fails on the old code.
- **Twenty-first review: deletes across tabs.** The join is per tab, so two tabs deleting
  the same record at once could still restore an orphan. Each delete now runs holding a
  Web Lock named for the owner and hash (`evawave:local-audio:<owner>/<sha256>`), so tabs
  of the origin take turns. The second finds no copy and no row, so it fails and restores
  nothing. Where the API is missing, the delete runs as before. A test loads the module
  twice, one instance per tab, over one fake OPFS and lock manager. One delete succeeds,
  the other fails, and no copy is left; without the lock it leaves one.
- **Twenty-second review.** Each fix ships with a test that fails on the old code.
  - **Tap tempo stuck after a move to double time.** From 120 to 240 BPM, the first
    250 ms tap was discarded, but the next sat 500 ms after the last kept tap, fitted, and
    cleared the discard, so the reading stayed at 120. The state now keeps the discarded
    tap's time. A later tap that fits the old grid starts again from the discarded tap
    when two things hold: its gap from that tap misses the band, and it matches the gap
    that tap left. A test moves from 120 to 240 and reads 240. A stray tap between beats
    still keeps 120; its own test fails if the gap-match condition is dropped.
  - **A save racing a delete of the same file.** The save path did not take the file's
    lock, so a delete in another tab could land between the database save and the local
    store. That left a stored blob with no row. The lock is now
    `inTurnForLocalAudio`, and `/import` holds it across the save and the store. A test
    overlaps a slow delete with a save: the row and the copy agree at the end. Without
    the lock they do not.
  - **Quad weights.** Four channels now weigh L R Ls Rs as 1, 1, 1.41, 1.41. That is Web
    Audio's quad layout and libebur128's default map for four channels. The layout test
    covers quad.
- **Twenty-third review.** Each fix ships with a test that fails on the old code, or under
  a mutation.
  - **Filenames over 255 characters.** A scripted or virtual-filesystem `File` could carry
    a longer name, and every library save then failed the `files.filename` check.
    `recordFilename` now cuts names to `FILENAME_MAX` (255), keeping a short extension.
    It counts code points, as Postgres does, so no emoji is split. The RLS suite ties the
    constant to the migration: 255 is accepted through `save_import`, and 256 is refused.
  - **The tap reset timed from the last kept tap.** A discarded tap 1.9 s after the last
    kept one cleared the display 100 ms later. `lastTapAt` returns the latest tap, kept
    or discarded. `tapsExpired`, the reset in `tap` and the display timer in
    `TempoTools` all run from it. Timing `tapsExpired` from the kept tap fails the test.
  - **The owner of a save.** If another tab switched accounts between `getSession()` and
    the RPC, the rows went to the new account but the blob went under the old one.
    `save_import` now returns the owner the rows were written for. It is named `owner`,
    because a `returns table` column called `owner_id` would clash with the upsert's
    conflict target. `keepAudioFor(ownerId)` keeps the audio only when that owner is the
    account whose turn the save holds. Otherwise the status says the audio was not kept.
    Tests: the RLS suite checks that the returned owner is the caller, and a unit test
    checks that a mismatched owner stores nothing. Making it store anyway fails that test.
  - `profileName` sliced UTF-16 units, so an emoji straddling character 200 could end
    in a lone surrogate. Listed here, then fixed in the twenty-fourth review.
- **Twenty-fourth review.** Each fix ships with a test that fails on the old code.
  - **A restore that only reached the tab.** When a record delete failed and OPFS then
    refused to take the copy back, `storeInOpfs` fell back to tab memory. The delete
    reported only the database error, though closing the tab would now lose the audio.
    If the copy came from OPFS and can only go back to the tab, the rejection now says
    the audio is held in this tab only, with the database error as its cause. A copy
    that was only ever in the tab goes back there with the plain error. Tests cover
    both; dropping the from-OPFS condition fails the second.
  - **`profileName` counts code points**, as Postgres does, like `recordFilename`. A test
    with an emoji straddling the limit keeps it whole and the name well formed.
- **Twenty-fifth review.** Each fix ships with a test that fails under a mutation.
  - **Tapped tempos outside 20–300.** Taps under 200 ms apart read over 300 BPM, and
    Assign wrote that into the spec, past what the tempo field accepts. `assignableBpm`
    returns the rounded reading only inside `TEMPO_MIN_BPM`–`TEMPO_MAX_BPM`. That range is
    now the field's own bounds too. Assign is disabled outside it, and the readout says
    why. Dropping the range check fails the test.
  - **MIME types over 120 characters.** A constructed `File` could carry one, and every
    library save then failed the `files.mime` check. `recordMime` keeps a type that fits
    and uses `application/octet-stream` otherwise. The RLS suite ties `MIME_MAX` to the
    migration: 120 characters are accepted and 121 refused.
  - **In-memory copies in other tabs.** A delete in one tab could not reach another tab's
    fallback copy, which then held the recording with no record until the tab closed. A
    tab listens on a BroadcastChannel (`evawave:local-audio`) once it holds such a copy.
    A delete announces the key after the record delete succeeds, and listeners drop that
    key. A test with two module instances checks that a failed delete tells no one and a
    successful one clears the other tab. Not announcing, or announcing before the record
    delete, fails it.
- **Twenty-sixth review.**
  - **A nameless import (fixed).** A `File` with an empty name and no typed name gave
    `profileName("", "")`, an empty string the library's 1–200 check refuses. The name now
    falls back to "audio", as the filename does. A test fails on the old code.
  - **Tempos outside 60–200 BPM (fixed another way).** The integer lag grid rounds
    outward, so it spans about 58.7–215 BPM, and a 58 BPM click track read 57.9. Codex
    suggested rounding inward and clamping the interpolated peak. Measured, that reads
    58 BPM as 60.09 and 59 as 60.00: a pile-up at the grid's end, not the in-range
    candidate. Autocorrelation cannot find 116 for a 58 BPM click, because nothing
    happens on the half beat. The grid keeps its outward rounding, so edge tempos still
    show as true peaks. The value is then folded by octaves into 60–200: 58 reads 115.8,
    with 57.9 as its half-time candidate, and 59 reads 117.8. The probed tempos from 60 to
    215 (60, 61, 90, 120, 140, 170, 198, 200, 205, 210, 215) read as before. A test
    covers 58 and 59; it fails on the old code.
- **Twenty-seventh review.**
  - **A fallback copy in another tab after OPFS recovers (fixed).** A successful OPFS
    write dropped only its own tab's fallback copy. The write now announces the key on
    the same channel as a delete, so other tabs drop theirs too. The message is now
    `{ drop }` for both. A test with two module instances stores through one tab's
    fallback, then into OPFS from the other, and checks the first tab lets go. It fails
    without the announcement.
  - **A superseded save reporting over a newer import (fixed).** A save that failed
    after another file was chosen overwrote the new import's status with its error.
    Every status the save sets after an `await` now goes through the same
    newest-import guard as its success message. No automated test: the repo has no
    component test harness, and the e2e cannot reach a failing save without a live
    Supabase session.
- **Twenty-eighth review: half-time accents outside 4/4.** The beat-3 accent was gated to
  4/4, so the "Half-time accents (1 and 3)" control did nothing more than beat 1 in 3/4
  or 6/8, against its label and SPEC §1.8. It now accents beat 3 wherever the meter has
  one; 2/4 has none. A test covers 3/4, 6/8 and 2/4 and fails on the old code.
- **Twenty-ninth review.** Each fix ships with a test that fails under a mutation.
  - **Copies orphaned by a delete on another device.** Deleting a record on device B
    could not reach device A's copy, which then stayed unreachable. Each `/library` load
    now runs `reconcileLocalAudio`. It lists `audio/<owner>/`, and checks any copy missing
    from the loaded list against the library with `hasFileRecord`, holding that file's
    turn. It removes the copy only when no record exists. So a truncated list (PostgREST
    caps rows) or a save in another tab never costs a copy that has a record. A test
    keeps a listed copy, removes an orphan, and keeps a copy whose record was not in the
    list. It fails if the library check is dropped. The `Library.tsx` wiring has no
    automated test: no component harness, and no live Supabase session in e2e.
  - **Reading a file after the import was already superseded.** `importAudio` now checks
    the signal before reading the file, as well as after. A test aborts first and checks
    that the file is never read.
- **Thirtieth review.** Each fix ships with a test that fails under a mutation.
  - **A reconciliation check that ran as another account.** If another tab switched
    accounts mid-check, RLS answered for the new account, and the old account's copy
    looked orphaned. A new migration, `20260926000300_file_record.sql`, adds
    `public.file_record(sha256)`. It is `security invoker` and `authenticated`-only, and
    returns `present` together with `auth.uid()`. `hasFileRecord(client, ownerId, sha256)`
    counts a record as gone only when the answer came from `ownerId`. The RLS suite checks
    the answers for the owner, for another account, and signed out. A unit test covers
    the three cases, and ignoring the returned owner fails it.
  - **Fallback copies in this tab.** Reconciliation looked only at OPFS, so an in-memory
    copy stayed after its record was deleted elsewhere. This account's in-tab keys are
    now candidates too, with or without OPFS. A test without OPFS removes the orphan and
    keeps the listed copy and another account's copy. Leaving the tab's keys out fails
    it. The reconcile tests run on a fresh module, so copies left by earlier tests do
    not join them.
- **Thirty-first review: no size cap.** This was listed as a known limit. The picker and
  drop target took a file of any size, and the whole file was buffered and copied before
  decoding, which can crash a phone tab. `importAudio` now refuses a file over
  `IMPORT_MAX_BYTES` (100 MiB) before reading it, with an `ImportTooLargeError` that the
  page shows as is. 100 MiB is about 9.9 minutes of 16-bit 44.1 kHz stereo WAV, 6 minutes
  at 24-bit 48 kHz, and any compressed track of normal length. A test refuses a file
  over the limit without reading it and reads one at the limit. Dropping the check
  fails it. A streaming decoder (WebCodecs) would lift the cap.
- **Thirty-second review.** Each fix ships with a test that fails under a mutation.
  - **Defaults standing in for rejected traits.** The profile base supplied 120 BPM, 4/4
    and C Ionian when the analysis proposed none, or the person unticked them. Those
    defaults were shown and saved as the profile's traits. An IR change in SPEC §2.2 adds
    `StyleProfileSpec`: whole D1–D5, D8 and D9 modules, with D6 partial down to the
    meter-lock fields. `audioProfileSpec` keeps a module only if an accepted op wrote into
    it, and keeps D6 only down to the fields accepted ops wrote. `/import` shows "not
    set" for an absent tempo, meter or key. PV-1 flags only a profile whose tempo came
    from analysis. Tests cover tempo only, meter only, nothing, and moods; returning the
    unpruned spec fails them. The PV-1 no-tempo case fails the old rule.
  - **Subdivisions in eighth-note meters.** BPM counts the signature's denominator, so
    in 6/8 the "8ths" and "16ths" choices clicked 16ths and 32nds. `subdivisionSteps`
    maps a note value to clicks per beat for the meter. In x/8 meters, 8ths are the beat
    itself, so that choice is disabled. A test covers every signature.
  - **The byte cap did not bound decoded memory.** A 100 MiB MP3 can hold 109 minutes,
    which decodes to gigabytes. Imports now also refuse recordings over
    `IMPORT_MAX_SECONDS` (10 minutes). The duration comes from a media element reading
    the metadata, before the file is read, with a 5 s timeout. When it cannot tell, only
    the byte cap applies. A unit test covers over, at, and unknown. An e2e stubs the
    media element's duration to 11 minutes and checks the page refuses the file with no
    worker started. With the probe unwired, the e2e fails. Chromium reports a truncated
    WAV's real length rather than its header's, so the e2e stubs the duration instead.
- **Thirty-third review: compound meters read as 3/4.** Confirmed with synthetic accent
  patterns: every 6/8 and 12/8 signal read 3/4, or unknown when the tempo halved the eighth
  rate. Three detectors were tried, and none held up (CLAUDE.md §1.3):
  - Comparing 6-beat with 3-beat lags: 3/4 at 150 BPM read 6/8.
  - The same comparison on local peaks: plain 3/4 and even uniform beats read compound.
  - A guard for a compound pulse under the beat: it never caught 6/8 at eighth level, and
    it made 4/4 at 180 and 210 BPM unknown.

  The root cause is that autocorrelation at 43 frames per second is too spiky: frame
  alignment outweighs the accent hierarchy that separates 3/4 from 6/8. The analysis is
  therefore unchanged. Instead, intake no longer asserts what it cannot tell apart: a 3/4
  reading goes out at no more than `THREE_BEAT_CONFIDENCE` (0.4), so it starts unticked,
  and its rationale names 6/8. A test runs a real 6/8 eighth-note signal through analysis
  and intake. Without the cap it proposes 3/4 at 0.51, auto-ticked. A 4/4 reading keeps
  its own confidence. SPEC §1.11 lists beat-phase tracking as the upgrade.
- **Thirty-fourth review, first finding: the tempo fold could loop forever.** Confirmed. The
  prior picks the winning lag, and on a steadily falling flux (a swell with no beat) that
  lag sits on a slope of the raw autocorrelation, not at a peak. The parabolic fit then put
  the vertex at a negative lag, and folding a negative tempo into 60–200 BPM never ends.
  23 of 156 synthetic swells with a 1% noise floor hit it through `analyseAudio`, the worst
  at a lag of −239 frames. The fit is now `parabolicPeakOffset` in `dsp.ts`: it returns 0
  unless the middle value is a local maximum, which bounds the offset to ±0.5, and the lag
  is clamped to the search range. A test runs three seeded 1 s swells that each hung
  before. Restoring the old fit makes that test hang (killed by `timeout` at 60 s, exit
  124). Unit tests pin the offset's bounds.
- **Thirty-fourth review, second finding: duration alone did not bound the decode.**
  Confirmed by arithmetic. Web Audio decodes every channel at the context's rate, so a
  10-minute 7.1 file at 48 kHz is 880 MiB of samples. A live context also decodes at the
  device's rate, and stereo at 192 kHz is the same size. Two changes:
  - Decoding now uses an `OfflineAudioContext` at a fixed 48 kHz (`DECODE_SAMPLE_RATE`).
    The e2e decodes a 22.05 kHz WAV and checks that the buffer comes back at 48000.
  - Before reading the file, the import reads the channel count its container header
    declares (`analysis/channels.ts`). Duration × channels is capped at 20
    channel-minutes (`IMPORT_MAX_CHANNEL_SECONDS`), the old ten-minutes-of-stereo budget.
    When the header does not say, the import assumes 7.1 (`IMPORT_ASSUMED_CHANNELS`), so
    it takes up to 150 s. For AAC in MP4 the reader takes the count from the esds
    AudioSpecificConfig, because encoders commonly write 2 in the sample entry. Tests
    cover each container, truncation and seeded noise after each magic; mutating the esds
    path or MP3 mono detection fails them. Import tests cover 5.1 over, at, and 7.1
    assumed.
- **Thirty-fifth review: reconciliation did not tell other tabs.** Confirmed. Without OPFS,
  two tabs can each hold a fallback copy of one file. When `/library` reconciliation in one
  tab found the record gone, it removed only its own copy. The other tab kept the whole
  blob until it loaded the library or closed. A delete already announced the drop;
  reconciliation now does too, after the removal and inside the file's turn. A test with
  two module instances checks that the other tab drops the orphan and keeps a copy whose
  record still exists. Without the announcement it fails.
- **Thirty-sixth review: a stale profile after Create.** Confirmed. Create stored a snapshot,
  so unticking a field or renaming afterwards left Save and Download sending the old
  profile, including a field the review now showed as rejected. Create now fixes only the
  profile's id. The profile is derived from the current review and name
  (`profileFromReview` in `import.ts`), so there is no second copy to go stale. A unit
  test builds the profile, unticks the tempo and renames it, and checks the id stays while
  the tempo goes. The S5 e2e now does the same through the page: it unticks the tempo and
  renames after Create, sees "not set", downloads again, and reads the file. The old
  component fails that e2e, still showing "140 BPM (analysis)".
- **Thirty-seventh review.** Both confirmed. Each fix ships with a test that fails under a
  mutation.
  - **An unknown length skipped both guards.** When the media element could not give a
    finite duration, the import decoded anyway, and a metadata-less file under 100 MiB can
    hold hours. `probeDuration` is now required, and an unknown or non-finite length
    refuses the import (`ImportLengthUnknownError`) before the file is read. Checked in
    Chromium before choosing to refuse: a MediaRecorder WebM, once the known case for an
    infinite duration, now reports a finite one at `loadedmetadata` (1.44 s for a 1.5 s
    recording), so browser recordings still import. A test refuses undefined, infinite and
    NaN lengths without reading the file. Dropping the check fails it.
  - **7.1 was not an upper bound.** AAC with a program config element can carry up to 24
    channels, so assuming 8 let a 150 s file decode to about 691 MB. The import now assumes
    32, the most a Web Audio buffer holds. Chromium refuses a 33-channel `AudioBuffer`
    (checked), and 32 is the spec's minimum. So a file whose header does not say takes up
    to 37.5 s. The same Chromium check ran `channelCount` on real MediaRecorder output: a
    WebM (Opus) and a fragmented MP4 (Opus, `dOps`) both read 2, as their decoded buffers
    have.
- **Thirty-eighth review: a tempo change one beat late.** Confirmed. At 120 BPM the tick at
  0.425 s schedules the 0.5 s downbeat, and the cursor then moved to the 1 s beat, so the
  0.5 s beat's length was fixed before it started. A change to 240 BPM at 0.45 s gave
  downbeats at 0.5 and 1 s, not 0.5 and 0.75 s. The cursor now stays on the beat of its last
  scheduled click (`lastTime` replaces `nextTime` and `step`), and moves on only to schedule
  a click in the next beat. A beat keeps its length once it has started; a beat still ahead
  takes the current tempo at every tick. The next click is the first step of the current
  grid after the last scheduled click and not before `now`. That also covers subdivision
  changes and stalls. A beat past the end of a shrunk bar is followed by a new bar.
  - Tests run the 25 ms tick: a change at 0.45 s gives 0, 0.5, 0.75, 1, 1.25, and a change
    at 0.55 s, once the beat has started, gives 0, 0.5, 1, 1.25.
  - The old scheduler fails the first case, and so does dropping the started check.
  - A new test opens a new bar after beat 4 when 4/4 becomes 3/4.
  - Two existing tests now pass the tick's `now`, as the metronome always does.
- **Thirty-ninth review: the same file could not be chosen again.** Confirmed. The picker
  kept the chosen file, so choosing it again after a failed import fired no `change`. On a
  phone, with no drag and drop, the only retry was another file or a reload. The input is
  now cleared once its file is taken. The length-refusal e2e checks the picker is empty
  afterwards; the previous component fails it, still holding `C:\fakepath\long-take.wav`.

## Decisions

- **The profile base** is the default D1–D6, D8 and D9. Every draft op targets a path that
  exists there, so any subset of accepted fields is a valid profile. Since the
  thirty-second review, the result keeps only what accepted ops wrote.
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
- ~~**Worker analysis.**~~ Resolved in the tenth review: analysis runs in a Web Worker.
