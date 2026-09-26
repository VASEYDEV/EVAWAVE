# 2026-09-26 · S6: songs and variants

Owner request: "Continue developing", with no new brief. SPEC §1.10 lists four in-scope
items not yet scheduled. Three need what a session cannot supply: text intake needs an
Anthropic key and API spend, the Jinn rebuild needs a real Suno render judged by Sean,
and the Flow Producer script consumes Variant diffs that did not exist. Song, Variant and
Take persistence was the unblocked foundation, with its types already in §2.2 and its
acceptance in the archived Build Brief. It was planned in plan mode, reviewed by a Plan
agent, and split in two: S6 songs and variants here, S7 the take log next.

## What changed

- `src/core/musicspec/variants.ts`: the field diff, its replay, the spec hash, labels,
  coverage per engine and the LN-1 freeze check. IR: optional `FieldDiff` sides and
  `Song.baseVariantId`.
- `supabase/migrations/20260926000400_songs.sql`: `songs`, immutable `variants`,
  per-column grants, composite keys, the revision and sequence triggers, and
  `public.freeze_variant`.
- `src/lib/library/songs.ts`; `src/lib/composer/storage.ts` (one key, one parser, the
  song attachment in the same `setItem`); the composer's Song panel; the `/library` Songs
  section; `/songs/[id]`.
- ADR 0006, SPEC §1.1, A7, A10, §1.6, §1.10, §2.4, §2.9 and §3 S6 (with S7 planned),
  CHANGELOG, README, architecture, the Supabase runbook.

## Found on the way

- **The design review** changed the first plan: upsert-by-id saves became
  revision-checked updates; the attachment moved into the same `setItem` as the spec;
  labels came from a database sequence (text order puts v1.10 before v1.9); parents and
  bases got composite keys; `FieldDiff` sides became optional, since JSON cannot carry
  `undefined`.
- **A blank copy on mount.** The composer wrote its default state to storage before it
  read the saved one. Harmless while each tab was alone. With tabs now following each
  other it would broadcast a blank working copy, so nothing is written until the saved
  copy has been read. The flag lives in the reducer: a ref would have let React's double
  effect run in development store the blank copy over the saved one.
- **A typecheck masked by a pipe.** One commit went in with a type error because
  `npm run typecheck | tail` hid the exit status. It was amended before any push, and
  every later check reads the exit code.
- Leftovers from the restyle, fixed here: SPEC §1.1 still called the lockup open, A10
  still named a hue per module, the README and architecture doc still mentioned module
  hues, the icon script's comment said "module hue", and two Supabase comments pointed at
  the archived "S7".

## Review of #14 (Codex, on 6b7fbee)

- **P2: direct variant inserts.** `authenticated` could insert variants directly, skipping
  the revision check and the song lock, and a variant can never be removed. Fixed: no
  INSERT grant or policy on `variants`; `freeze_variant` is security definer and checks
  that the song is the caller's at the expected revision. Tests: the owner's direct insert
  is refused; mutations (grant the insert back; drop the definer's owner filter) fail.
- **P1: the shared registry.** AGENTS.md says a new user-scoped table joins
  `USER_SCOPED_TABLES`, and `library-rls.test.ts` covers it. `songs`, `variants` and
  `takes` now do, with per-table expectations where a grant is absent rather than a
  policy refusing; the parallel `SONG_TABLES` is gone.
- **P2: root diffs.** `diffToOps` refuses a diff at the empty pointer instead of emitting
  an op `applyOps` rejects; two specs never produce one.

Second round (Codex, on 498c5ad):

- **P1: LN-1 skipped the overrides.** `freezeBlockers` linted without the working copy's
  overrides, so a name in one could be frozen. It now takes them and passes them to every
  lint call; `freezeVariant` sends `copy.overrides`.
- **P2: overrides dropped on save.** The composer sent `overrides: []` on every save and
  freeze, so opening a song that had overrides and saving it erased them. They now travel
  in the song attachment (the song's for its working copy, the variant's for a variant),
  and save, freeze and "save as new song" send them. Checked against the scratch fake
  Supabase: an opened song's override reaches the stored attachment and the save body.
  Mutations: linting without overrides fails 2 tests; saving `[]` fails 1. Superseded in
  the fourth round: overrides are no longer client-writable at all.

Third round (Codex, on d1eaea8), three races, each reproduced against the scratch fake
Supabase on d1eaea8 and gone on the fix:

- **Open over edits made mid-load.** The unsaved-work check ran before the song loaded, so
  edits another tab made during the load were replaced without asking. `OpenInComposer`
  now checks again just before writing. Unfixed: it navigated away; fixed: it asks.
- **A song page after the account changes.** The page kept the previous owner's history
  and its Open buttons (which copy the cached spec without a request). It now follows the
  session (sign-in changes, and a session check on return to the tab) and shows data only
  for the account it was loaded for. Unfixed: user B and a signed-out viewer still saw A's
  song and three Open buttons; fixed: nothing, and a sign-in prompt when signed out.
- **A late save onto another copy.** A save or freeze that finished after another tab had
  opened a different variant re-attached its old attachment to that copy. `attach` now
  applies only if the copy is still attached to the same song, base variant and revision
  (`stillCurrent`). Unfixed: the v1.0 copy was re-labelled "from v1.1"; fixed: it stays
  "from v1.0".

Fourth round (Codex, on 87fae30), each reproduced against the scratch fake Supabase on
87fae30 and gone on the fix:

- **P2: the freeze stored what the client computed.** `freeze_variant` inserted the diff,
  coverage and overrides it was sent, so a direct RPC call could freeze a forged history,
  or an override LN-1 never saw, for good. The root cause was storing client-derived
  data, so nothing derived is stored now. `variants` loses `diff` and `coverage`, and
  `loadSong` derives them from the snapshots: the diff from the parent's, the coverage by
  compiling. `songs.overrides` has no insert or update grant, and the function copies the
  song's own into the variant. It takes the title, the spec and the parent, as a save
  does. On 87fae30 the freeze body carried `p_overrides`, `p_diff` and `p_coverage`; on
  the fix it carries five keys, and the song page shows the same diff and coverage,
  derived. Tests: the old eight-argument call no longer exists; the owner cannot write
  overrides; a freeze copies the song's; the diff is taken against the parent, not the
  variant before it. Mutations: granting overrides back, freezing `[]` instead of the
  song's, and diffing against the previous variant each fail their test. LN-1 on the
  spec stays an app check (ADR 0006, decision 9).
- **P1: `/library` after an account change.** The page kept the previous account's
  songs, and its profiles, files and tags, after a sign-out or switch in another tab. The
  session tracking the song page got in round 3 is now a shared hook, `useViewer`.
  `/library` shows only what was loaded for the account signed in now, and a sign-in
  prompt when signed out. Unfixed: user B and a signed-out viewer still saw A's song and
  its Open button. Fixed: "No songs yet." for B, and the prompt when signed out, with no
  axe violations and no sideways scroll at Pixel 7 and 1280.
- **P2: unsaved ignored the base variant.** Say a variant's snapshot equals the song's
  spec, and the song's base is another variant. Opened, that variant showed as saved:
  Save was disabled, and opening the song over it did not ask. The saved fingerprint is
  now `workingHash(spec, baseVariantId)`. The attachment no longer carries overrides,
  since no save sends them. Unfixed: "Saved · from v1.2", Save disabled, and the library
  opened over it without asking. Fixed: "Unsaved changes", Save enabled, and it asks.
  Mutation: a hash without the base fails 3 tests.
- **What deriving costs.** Coverage is three compiles, about 6 ms a variant in Node; the
  diff is about 1.6 ms. On the song page at 4x CPU throttling, 23 variants made a 591 ms
  long task and 63 made a 1,678 ms one. `loadSong` now yields every 16 ms. The longest
  task left is hydration, about 400 ms at 4x, the same as with 3 variants. At 1x, 63
  variants show after about 1.1 s rather than 0.85 s, and 23 show as before.

Fifth round (Codex, on db09c94):

- **P2: a history longer than the row limit.** PostgREST cuts every response at its
  `max-rows` (1,000 on Supabase by default) without an error. `loadSong` read variants
  and takes in one request each, so past the limit it saw only the oldest page. The
  song's base variant could then be missing, and the next save would clear it. The same
  cut applied to `listSongs`, both the songs and the variant counts. All of them now go
  through `allRows`: pages ordered by a unique, stable key (sequence, or id with the sort
  done after), read until the exact count or an empty page. It moves on by the rows the
  server returned, so a limit below the page size still reads everything. Takes are
  asked for 100 variant ids at a time, keeping the URL near 4 KB. Reproduced against the
  scratch fake Supabase with a row limit of 1. On db09c94 the song page showed 1 of 3
  variants and "not frozen yet", the composer "no variant yet", and the save sent
  `base_variant_id: null`. On the fix it shows all 3 variants and both takes, "Saved ·
  from v1.1", and the save keeps v1.1. Mutations: one page only, stopping at a short
  page, and one takes request each fail their tests.
- Not fixed here, listed: the S4 library reads (`loadLibrary`: profiles, files, tags and
  their links) are single requests too, and would be cut the same way past the limit.

Sixth round (Codex, on c925349), each reproduced against the scratch fake Supabase on
c925349 and gone on the fix:

- **P1: a late freeze onto another opening of the same song.** `stillCurrent` compared
  the song, base variant and revision. Another tab could open another copy with all three
  equal: the song's working copy, then its base variant. A pending freeze then attached
  its new variant to that copy and changed the next freeze's parent. Each opening now
  gets a `copyId` (`openedCopy` stamps a new one, never one passed in; "save as new
  song" keeps the copy's). The check includes it. Edits in the same tab keep the id, so
  a save still attaches after them, as round 3 intended; a spec fingerprint would have
  dropped those. Unfixed: the v1.1 copy another tab opened (tempo 140) became "from v1.3"
  at revision 4. Fixed: it stays "Saved · from v1.1" at revision 3.
- **P2: the song and its variants read at the same time.** A freeze landing between the
  two reads could name a base that the variant list did not hold, and the copy then
  opened with no base. `loadSong` now reads the song first. Variants only ever arrive,
  so the base it names is among those read after. A base still missing (the song was
  deleted in between) is an error, never a copy with no base. Unfixed, with the song read
  delayed and a freeze sent meanwhile: "working copy not frozen yet". Fixed: all 5
  variants, "from v1.4".
- **P2: opening when storage refuses.** `writeComposer` swallowed the error, and
  `OpenInComposer` navigated anyway, to the old copy. It now returns whether the browser
  kept the write. Opening stays on the page with a message when it did not. Unfixed,
  with `setItem` throwing: it went to the composer with no message. Fixed: it stays on
  `/library` and says why.
- Mutations: the identity without the copy id, an opening that keeps a passed id, no
  base check, and a write that always reports success each fail their test.

## Evidence

Counts as of the sixth round.

- Core: `tests/unit/variants.test.ts` (18), including the Jinn v1.1 → v1.2 diff with
  `/D6/tempo/bpm` 142 → 140 and an exact replay over 60 seeded random edits. Mutations:
  plain text sort and ascending removals each fail.
- Database: `tests/integration/songs-rls.test.ts` (27). Mutations: dropping the revision
  predicate, granting variant updates, dropping the same-song parent key and dropping
  the revision bump each fail their tests.
- App: `songs-repository.test.ts` (28 with the S7 take cases; dropping the revision
  filter fails), `composer-storage.test.ts` (13).
- E2e without Supabase: `songs.spec.ts` (3) and the song page in the layout and BEAM
  checks.
- Signed in, against a fake Supabase in scratch space (not committed): `/library`, the
  song page and the composer render at Pixel 7 and 1280 with no axe violations and no
  sideways scroll, and never show VASEY.AUDIO. Opening a song attaches it; an edit shows
  unsaved and reaches a second tab; a frozen variant shows only the changed field against
  its parent; opening v1.0 makes it the next parent; the unsaved guard and the two-step delete
  ask first.
- Gate: see the PR body.

## Not done, and why

- The take log: S7, the next PR.
- Song links to style profiles and tags: nothing sets them yet.
- Override editing with the three-way stale diff (§1.4 item 3): a separate slice.
- The signed-in screens in CI: they need a Supabase project.
