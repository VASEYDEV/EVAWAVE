# 2026-09-26 — Restart: EVAWAVE owns MusicSpec IR

**Brief:** [2026-09-26 restart](../briefs/2026-09-26-restart-evawave-owns-ir.md).
**Decision record:** [ADR 0004](../decisions/0004-evawave-owns-musicspec-ir.md).

## Step 1: close the legacy track

- PR #4 (Session 1a on the IR v0.3 delta) was closed without merging, with a comment.
- Issue #3 (legacy IR v0.2 types, `resolveLineage.ts`, reference files) was closed as not
  planned, with a comment.
- Legacy compiler files on `main`: none. `git log --all --name-only` shows no IR v0.2
  type file and no `resolveLineage.ts` in any commit, so nothing moved to
  `docs/archive/legacy/`. The exclusions are in place for when one arrives.
- The pending hourly check-in trigger was deleted, since the brief rules out scheduled
  check-ins.

## Step 2: one spec

`docs/SPEC.md` replaces the Build Brief, scope v0.2 and the IR v0.3 delta, which moved to
`docs/archive/` with `git mv`. The handoff README went with them, because its content
(package install notes, missing drop-ins) is history. SPEC §3 records the drop-in that
still matters.

IR v1 design notes:

- The delta's §9 Suno compile of Hook B could not be produced from the delta's own fields.
  "harder" is not in `drumState`, and the compile appends a pocket clause that Jinn v1.2
  does not have. Section prose therefore moved to ordered, typed `cues`.
- A throwaway renderer that follows the SPEC §2.4 cue rules reproduced the Jinn v1.2 Hook B
  block (pickup, section, silence) and the Bridge bracket exactly. This shows the golden
  test is reachable without editing a Jinn file. S1 builds the real serializer.
- The Jinn v1.2 field sizes match the file's own headers: Style 998, Exclude 222,
  Lyrics 1,559, total 2,779. All are inside the Suno limits.
- Compilation is `compile(spec, profile, catalog)`. Taxonomy lookups were implicit in the
  delta.
- The Suno profile aliases `kamanja`, `rababa` and `strings-egyptian` to longer phrases
  than Jinn v1.2 uses. `InstrumentUse.phraseOverride` outranks aliases, so the profiles
  stay unchanged and the golden test can still match.

## Stop condition

S1 needs `docs/evawave/reference/jinn-v1.1-egypt-blueprint.md` as its negative fixture.
The handoff README listed it as a drop-in (from `Jinn_On_The_Dune_Suno_Prompt_v1.1_Egypt.md`)
and it never arrived. It is in no commit on any ref. The brief's stop condition ("a Jinn
prompt file is missing") applies, so the sequence stops after this PR, before S1.

## Verified

See the PR body for commands and results.
