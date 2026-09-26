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
  Mutations: linting without overrides fails 2 tests; saving `[]` fails 1.

## Evidence

- Core: `tests/unit/variants.test.ts` (16), including the Jinn v1.1 → v1.2 diff with
  `/D6/tempo/bpm` 142 → 140 and an exact replay over 60 seeded random edits. Mutations:
  plain text sort and ascending removals each fail.
- Database: `tests/integration/songs-rls.test.ts` (22). Mutations: dropping the revision
  predicate, granting variant updates, dropping the same-song parent key and dropping
  the revision bump each fail their tests.
- App: `songs-repository.test.ts` (14; dropping the revision filter fails),
  `composer-storage.test.ts` (8).
- E2e without Supabase: `songs.spec.ts` (3) and the song page in the layout and BEAM
  checks.
- Signed in, against a fake Supabase in scratch space (not committed): `/library`, the
  song page and the composer render at Pixel 7 and 1280 with no axe violations and no
  sideways scroll, and never show VASEY.AUDIO. Opening a song attaches it; an edit shows
  unsaved and reaches a second tab; a freeze sends only the changed field against its
  parent; opening v1.0 makes it the next parent; the unsaved guard and the two-step delete
  ask first.
- Gate: see the PR body.

## Not done, and why

- The take log: S7, the next PR.
- Song links to style profiles and tags: nothing sets them yet.
- Override editing with the three-way stale diff (§1.4 item 3): a separate slice.
- The signed-in screens in CI: they need a Supabase project.
