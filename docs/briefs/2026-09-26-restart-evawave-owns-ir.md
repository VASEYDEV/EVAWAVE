# Brief — 2026-09-26: restart, EVAWAVE owns MusicSpec IR

Received from the owner in the session on 2026-09-26. Committed verbatim below the rule.
It supersedes the EVAWAVE Build Brief v0.1 (now `docs/archive/BUILD-BRIEF.md`).
Decisions: [ADR 0004](../decisions/0004-evawave-owns-musicspec-ir.md).

---

Restart. The BUILD-BRIEF plan is superseded. Work through everything below
without stopping for my review. Merge each PR yourself when CI is green.

1. Close issue #3 and PR #4 without merging. Any legacy compiler files on main
   (IR v0.2 types, resolveLineage.ts) move to docs/archive/legacy/ as
   reference only, excluded from tsconfig, lint and CI.

2. One PR: consolidate docs/evawave/ into docs/SPEC.md containing:
   - Product scope and confirmed decisions from scope-v0.2 (Suno, ElevenLabs
     Music, Google Flow Music live; Udio halted).
   - MusicSpec IR v1 as a complete, self-contained type definition. Fold in
     all of the IR v0.3 delta. Where it references v0.2 types not in this
     repo, define them from what the delta and scope require. Nothing imports
     from the legacy compiler. List every type you defined rather than carried
     over in a section titled "Defined, not inherited".
   - The build plan in step 3.
   Keep engine-profile-*.json, the instrument bank seed and
   docs/evawave/reference/ unchanged. Move scope-v0.2, the IR delta and
   BUILD-BRIEF.md to docs/archive/. Add an ADR superseding ADR 0002: EVAWAVE
   owns MusicSpec IR; no legacy dependency.

3. One PR per session, in order:
   S1  IR v1 types, linter, Suno serializer. Jinn v1.2 as a golden-file test,
       jinn-v1.1-egypt-blueprint as the negative fixture. No UI.
   S2  ElevenLabs and Flow serializers. Target switching as a lossless
       projection with a coverage report; round-trip tests across all three.
   S3  Composer UI over the IR, instrument bank from the seed,
       non-destructive undo/redo on inputs.
   S4  Supabase library with RLS: style profiles, files, genre tags.
   S5  Audio import to StyleProfile, metronome with tap tempo (average of
       last 4 taps), per-module color iconography.

Stop only if the Jinn v1.2 golden test can't pass without altering the Jinn
files, or a Jinn prompt file is missing. The Jinn files are ground truth;
never write or edit them.

Everything else: work only from what is in this repo. If an input is missing,
write it and flag it in the PR body, or cut it and say so. No scheduled
check-ins. Conventional Commits; every PR body states what, why, verified.
Report once, when S5 is merged.
