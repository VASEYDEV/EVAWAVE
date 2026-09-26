# ADR 0006: Songs and variants: explicit, revision-checked saves and immutable snapshots

- **Status:** accepted
- **Date:** 2026-09-26
- **Relates to:** SPEC §1.6, §2.4 and §3 S6; A5 (target switching is a view), A7 (library
  entities); ADR 0004 (EVAWAVE owns IR v1).

## Context

The composer's working copy lived only in one browser. SPEC §1.6 defines Song (the
working spec), Variant (immutable versions with diffs and overrides) and Take (the render
log), and §1.10 lists their persistence as in scope but unscheduled. The archived Build
Brief's library session gave the acceptance: user B cannot read user A's rows, and forking
Jinn v1.1 into v1.2 shows the BPM 142 → 140 diff. A design review of the first plan found
the risks that shaped the decisions below: two tabs overwriting each other, a spec stored
beside the wrong song, a parent from another song, a label order where v1.10 sorts before
v1.9, and `undefined` in a diff that JSON cannot carry.

## Decision

1. **Explicit save, checked by revision.** A song has a `revision` that a trigger bumps on
   every update. A save updates only the revision it read; zero rows is an error that says
   to reload. A new song is an insert, never an upsert, so a stale tab cannot overwrite
   newer work or bring back a deleted song.
2. **Variants are immutable in the database.** Users get no UPDATE or DELETE on
   `variants`; a variant leaves only with its song. Grants are per column, so owner,
   brand, revision, sequence and timestamps are never client-writable.
3. **Freeze is one transaction.** `public.freeze_variant` (security invoker) locks the
   song at the expected revision, inserts the variant and saves the working copy with the
   variant as its base. The client computes the diff and coverage with the pure core; the
   revision check guarantees they were taken against the state the database holds.
4. **Structure, not only policy.** Composite foreign keys tie a variant to a song of the
   same owner, and a parent or base variant to the same song.
5. **Labels come from a sequence.** The database numbers variants per song and generates
   `v1.<seq − 1>`; the composer's preview (`nextVariantLabel`) agrees, and a test holds
   them together.
6. **Forks open a variant.** The working copy records the variant it descends from
   (`Song.baseVariantId`, an IR addition). Opening an earlier variant and freezing makes
   it the parent.
7. **The undo tree stays on the device.** Opening a song or a variant starts a fresh
   history; variants are the durable history.
8. **A freeze refuses LN-1.** An artist or producer name frozen into an immutable variant
   could only leave with the whole song.
9. **Kept small for now.** No song-to-style-profile or song-tag links (read as empty
   lists); no `active_target` column (A5: read from `D10`); the title is derived from
   `D10.title` on every save. `Song.brand` is stored and checked as `VASEY.AUDIO` and
   never shown: the app is a VASEY/AI tool.

## Consequences

- IR v1 changes (SPEC §2.2, §2.9): `FieldDiff.before` and `after` are optional, and
  `Song` gains `baseVariantId`.
- The browser's working copy carries its song attachment in the same `setItem`, and open
  composer tabs follow each other, so no tab writes back a stale attachment.
- The take log (S7) hangs takes off variants with the same composite-key pattern.
- The signed-in screens cannot run in CI until a Supabase project exists; the RLS suite
  and the repository tests hold the data paths, as in S4.
- Override editing (§1.4 item 3) is still unbuilt; overrides are stored but nothing
  edits them yet.
