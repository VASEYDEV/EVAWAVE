# 2026-09-26 — Post-S5 hardening

The restart brief's plan (S1–S5) is merged. With no new brief, this pass works the repo's
own listed follow-ups, smallest and safest first: the two S4 items the S5 PR listed as "not
fixed" (CLAUDE.md §1.1), and a README Status section whose headline no longer matched its
list.

## Changes

- **Zero-row deletes.** `deleteStyleProfile` and `deleteTag` reported success when RLS let
  them remove no row. PostgREST answers a delete of another account's row with 200 and no
  rows, not an error, so after an account change in another tab the page said "done" while
  the row stayed. Both now reject with a "reload the library" `LibraryError`, as
  `deleteFile` has since the S5 review. The `/library` page already shows a thrown
  message as its status, so no UI change was needed.
- **Profile-name limit.** The `/library` profile-name input took names past the
  200-character limit the migration enforces, so a long name failed only on save. It now
  caps at `PROFILE_NAME_MAX`, as `/import`'s does.
- **README Status.** The headline said "Nothing in the app is usable yet" above a list that
  described the composer, library and import as working; the S1 bullet still said "no UI
  yet"; S2 was missing. The headline now says the S1–S5 plan has landed, what runs today,
  and what does not (no Supabase project, nothing deployed). An S2 bullet is added.

## Evidence

- `tests/unit/library-repository.test.ts`: for each of style profile, tag and file, a
  delete that removed no row rejects with a `LibraryError` naming the reload, and one that
  removed the row resolves. The PostgREST answer is mocked as RLS shapes it (200, `[]`).
- Mutation: removing the two new checks fails exactly the profile and tag cases; the file
  case still passes.
- The 200-character limit itself was already tied to the migration by the RLS suite (200
  accepted, 201 refused) and `library-schema.test.ts`.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium bash scripts/gate.sh`:
  `GATE: PASS` (618 unit and integration, 16 e2e).

## Not tested, and why

- The `maxLength` attribute on the `/library` input. The form renders only behind a live
  Supabase session, which CI and local runs do not have, and there is no component harness.
  Same gap as the S5 wiring points; the limit's value is tested where it lives.

## Next

Larger open work needs a product choice, not a default. SPEC §1.10 lists what is in scope
but unscheduled: text intake; Song, Variant and Take persistence with the take log; the
Flow Producer script for Variant diffs; the end-to-end Jinn rebuild through the UI with an
A/B Suno render. SPEC §1.11 lists the smaller technical items (share-sheet import behind
PWA tooling, the tagging model, beat-phase tracking for compound meters).
