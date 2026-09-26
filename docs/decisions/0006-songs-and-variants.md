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
2. **Variants are immutable in the database.** Users get no INSERT, UPDATE or DELETE on
   `variants`; a variant leaves only with its song. Grants are per column, so owner,
   brand, revision, sequence and timestamps are never client-writable.
3. **Freeze is one transaction, and the only way in.** `public.freeze_variant` locks the
   song at the expected revision, inserts the variant and saves the working copy with the
   variant as its base. Because users may not insert variants directly (a direct insert
   would skip the revision check and the lock, and could never be undone), the function is
   security definer and checks ownership itself, with an empty `search_path`. It takes
   only what a save takes (the title and the spec) and the parent.
4. **Nothing derived is stored.** A variant keeps its snapshot (without the working
   copy's `patches`, which the IR keeps out of a snapshot), its parent and the overrides
   copied from its song. Its diff and coverage follow from the snapshots, so
   the app derives them when it reads, with the pure core. A stored copy of either could
   only be what the client sent, and a variant keeps whatever it is frozen with (review
   of #14).
5. **Structure, not only policy.** Composite foreign keys tie a variant to a song of the
   same owner, and a parent or base variant to the same song.
6. **Labels come from a sequence.** The database numbers variants per song and generates
   `v1.<seq − 1>`; the composer's preview (`nextVariantLabel`) agrees, and a test holds
   them together.
7. **Forks open a variant.** The working copy records the variant it descends from
   (`Song.baseVariantId`, an IR addition). Opening an earlier variant and freezing makes
   it the parent. The base is part of the saved state: the same spec from another
   variant is unsaved.
8. **The undo tree stays on the device.** Opening a song or a variant starts a fresh
   history; variants are the durable history.
9. **A freeze refuses LN-1, in the app and in the database.** An artist or producer name
   frozen into an immutable variant could only leave with the whole song. The app lints
   first. Because a caller can skip the app, `freeze_variant` checks as well, against
   `public.lineage_names`, a copy of `src/data/lineage/names.json` that a test holds equal
   (a name added to the file needs a migration). It reads every string in the spec except
   the references, which are never sent to an engine, so on the spec it is at least as
   strict as LN-1's prose fields. The catalog data and the Jinn fixtures hold no lineage
   name, so it refuses nothing the app would allow from them.
10. **Kept small for now.** No song-to-style-profile or song-tag links (read as empty
    lists); no `active_target` column (A5: read from `D10`); the title is derived from
    `D10.title` on every save. `Song.brand` is stored and checked as `VASEY.AUDIO` and
    never shown: the app is a VASEY/AI tool.

## Consequences

- IR v1 changes (SPEC §2.2, §2.9): `FieldDiff.before` and `after` are optional, and
  `Song` gains `baseVariantId`.
- The browser's working copy carries its song attachment in the same `setItem`, and open
  composer tabs follow each other, so no tab writes back a stale attachment.
- The take log (S7) hangs takes off variants with the same composite-key pattern. Takes
  are never edited either: a mistaken one is deleted and logged again.
- The signed-in screens cannot run in CI until a Supabase project exists; the RLS suite
  and the repository tests hold the data paths, as in S4.
- Override editing (§1.4 item 3) is still unbuilt. Overrides are not client-writable:
  a freeze copies them into a variant that never changes, so they wait for a write path
  that lints them (LN-1). Until then every song's overrides are empty.
- Reading a song compiles each variant's snapshot for its coverage, a few milliseconds a
  variant; `loadSong` yields between them so a long history does not block the page.
