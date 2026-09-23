# ADR 0002 — Session 0: package intake and stack

**Date:** 2026-09-23 · **Status:** accepted

## Context

The owner supplied the EVAWAVE handoff package (`evawave-handoff.zip`, 2026-09-16) and
the EVAWAVE Build Brief v0.1. The brief opens with a Session 0 (S0) that runs the repo
decision rule, installs the canonical agent files and starter kit v3.0, imports the docs,
and makes the import-boundary lint rule live with CI green. The Session 0 report
(`docs/notes/2026-09-23-session-0-repo-decision.md`) found no compiler repo with
runnable serializers and listed 12 conflicts. On 2026-09-23 the owner answered the
report's questions. This ADR records those answers and the S0 decisions that follow
from them.

## Decisions

1. **This repo is `evawave`.** The owner confirmed the brief's new-repo branch. No
   second repository is created.
2. **Compiler sources are not an S0 dependency.** The owner supplies the IR v0.2 types
   and `resolveLineage.ts`, or read access to the repo that holds them, before S1. If
   they are absent when S1 starts, the session stops and asks. It never reconstructs them
   from the docs.
3. **Package installed byte-faithfully, with three placements.**
   - `README-HANDOFF.md` goes to `docs/evawave/`, not the repo root.
   - The brief stays at its own repo target (`docs/evawave/BUILD-BRIEF.md`).
     `docs/briefs/README.md` points to it instead of holding a copy.
   - `.claude/rules/musicspec-core.md` gets `paths:` frontmatter so it is actually
     path-scoped. Claude Code reads only `paths:` and loads a rule without it
     unconditionally. The rule's body is unchanged.
4. **Brief amendment, directed by the owner.** BUILD-BRIEF §2's stack line now reads
   Next.js 16, as recorded in scope decision A15. This is the only edit to the verbatim
   brief. `docs/briefs/README.md` says briefs are never edited, and the owner's explicit
   instruction overrides that here. The brief's §1 canonical-file line (CLAUDE.md
   v3.0.0, 2026-06-10, MD5 `5d460e25…`) is deliberately not edited. The owner holds
   that the hard copy is canonical and that neither the file nor the brief changes when
   they disagree. The disagreement gets reported instead.
5. **Stack (scope A15).**
   - Next.js 16.3.6, pinned exactly, with the 16 conventions. `src/proxy.ts` (not
     `middleware.ts`) runs the Supabase session refresh. ESLint is invoked directly.
     Turbopack is the default bundler.
   - Supabase Auth via `@supabase/ssr`. Clerk does not come over, because only the pure
     core migrates.
   - npm as the package manager, with the lockfile committed.
   - Vitest for unit tests.
6. **Node floor is 22.13.0, not 20.9.** The owner asked for 20.9 (Next 16's own floor).
   Current releases need more: `@supabase/supabase-js` 2.117 needs ≥ 22 (2.100–2.109
   were its last Node 20 line), vitest 5 needs ^22.12, and `eslint-visitor-keys`, a
   non-optional typescript-eslint dependency, needs ^22.13. Node 20 has also been EOL
   since 2026-04-30. The owner approved a 22.x floor. Checking every locked package's
   `engines` set it at 22.13.0; at 22.12.0 `npm ci` fails under `engine-strict`. CI runs
   22.13.0 and 24.
7. **Held-back majors, each with a reproduced reason.**
   - ESLint stays on 9: `eslint-config-next@16.3.6` crashes under ESLint 10.
   - TypeScript stays on 5.9: TypeScript 7 is outside typescript-eslint's `<6.1.0` peer
     range.
   - `@types/node` stays on 22, to track the floor.
8. **The import boundary covers relative paths too.** `no-restricted-imports` on
   `src/core/**` blocks the brief's list and the `**/app`, `**/components` and
   `**/lib/supabase` forms, so a `../../` path cannot route around the aliases. A
   Vitest suite lints deliberate violations through the real config.
9. **The gate replaces the docs-only stage** (ADR 0001, decision 3), with standards,
   lint, typecheck, unit, build, the client-bundle check and audit. The placeholder
   check now matches only closed double-brace tokens in non-code text. The brief's
   literal S0 check ("`grep "{{"` = 0 outside docs/legal") cannot pass, because the
   verbatim brief quotes that grep itself. The gate enforces the check's intent instead.
10. **Brand confirmed.** The brief states that EVAWAVE is a VASEY/AI tool whose output
    serves VASEY.AUDIO, which settles ADR 0001 decision 4. `Song.brand = 'VASEY.AUDIO'`
    labels output data and is not app branding. The logo stays deferred (ADR 0001
    decision 5): the lockup (`EVAWAVE` vs `EVA/WAVE`) is open, and the icons come from
    the Vector Iconography project.

## Pending

- **Canonical files.** `CLAUDE.md`, `AGENTS.md`, `SKILLS.md`, `.claude/settings.json`
  and starter kit v3.0 are being supplied by the owner. When they land, the session
  verifies MD5 and date markers against the brief and reports any disagreement without
  editing either side. It also reconciles the agent contracts (one policy layer) in
  ADR 0003.
- **Reference files** for S4/S5 (the Jinn v1.1 blueprint, the v1.0 Morocco prompt and
  the research brief) arrive before S4.

## Consequences

- S0 is green with no compiler code. S1 is gated on the owner's sources.
- Every future dependency bump is checked against the 22.13.0 floor, which
  `engine-strict` enforces at install.
- When `eslint-config-next` supports ESLint 10, the held-back major gets its own commit
  (CLAUDE.md §6).
