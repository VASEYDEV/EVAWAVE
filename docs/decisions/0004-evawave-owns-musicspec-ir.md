# ADR 0004 — EVAWAVE owns MusicSpec IR; no legacy dependency

**Date:** 2026-09-26 · **Status:** accepted · **Supersedes:** [ADR 0002](0002-session-0-intake-and-stack.md)

## Context

ADR 0002 decision 2 made S1 depend on owner-supplied legacy compiler sources: the IR v0.2
type file and `resolveLineage.ts`. If they were absent, S1 was to stop and ask, and never
reconstruct them from the docs. They never arrived. Issue #3 tracked them, and PR #4 built
only the parts of the v0.3 delta that did not need them.

On 2026-09-26 the owner restarted the plan
([brief](../briefs/2026-09-26-restart-evawave-owns-ir.md)). The Build Brief is superseded.
EVAWAVE defines its own IR, and the build runs as five sessions of one PR each.

## Decisions

1. **EVAWAVE owns MusicSpec IR v1.** Its complete, self-contained type definition is
   [`docs/SPEC.md`](../SPEC.md) §2. It folds in all of the v0.3 delta. Where the delta
   referenced v0.2 containers, SPEC §2 defines them from what the delta and scope require,
   and SPEC §2.9 lists every type defined rather than carried over.
2. **No legacy dependency.** Nothing imports from the legacy compiler. Legacy files, if
   any arrive, go to `docs/archive/legacy/` as reference only. `docs/archive/**` is
   excluded from `tsconfig.json`, ESLint and the gate's placeholder scan. No legacy file
   was ever on `main`, so none moved.
3. **One spec.** `docs/SPEC.md` holds the product scope and confirmed decisions (from
   scope v0.2), IR v1, and the build plan (S1–S5). Scope v0.2, the IR v0.3 delta, the
   Build Brief and the handoff README move to `docs/archive/`. The engine profiles, the
   instrument bank seed and `docs/evawave/reference/` stay where they are, unchanged.
4. **The Jinn files are ground truth.** `docs/evawave/reference/jinn-*` are never written
   or edited. S1 tests Jinn v1.2 as a byte-for-byte golden file, replacing the Build
   Brief's clause-coverage oracle, and uses the v1.1 Egypt blueprint as the negative
   fixture. `.claude/rules/musicspec-core.md` rules 2 and 7 change to match.
5. **Closed without merging:** PR #4 (Session 1a on the v0.3 delta) and issue #3 (the
   legacy inputs).
6. **Carried forward from ADR 0002 unchanged:** decision 1 (this repo is `evawave`), 3
   (package placements), 5 (stack), 6 (Node floor 22.13.0), 7 (held-back majors), 8 (the
   import boundary checks targets, not spellings), 9 (the full gate), 10 (brand) and 11
   (`EngineField` separates character caps from numeric bounds). Decision 4 (the Build
   Brief §2 amendment) is moot now that the brief is archived. Its content lives in
   scope decision A15, carried into SPEC §1.2.

## Consequences

- S1 no longer waits on the legacy sources. It does wait on one Jinn file:
  `docs/evawave/reference/jinn-v1.1-egypt-blueprint.md`, the negative fixture, which the
  handoff package listed as a drop-in and which is not in the repo. The owner's stop
  condition applies until it is added.
- Serializers compile from `(spec, profile, catalog)`. They stay pure, and the catalog
  makes taxonomy lookups explicit.
- An IR change lands in `docs/SPEC.md` in the same PR as the code that needs it.
