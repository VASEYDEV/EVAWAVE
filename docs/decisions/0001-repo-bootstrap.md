# ADR 0001 — Bootstrap on the Vasey repo standard v3.0

**Date:** 2026-09-23 · **Status:** accepted

## Context

EVAWAVE was a two-file repository (README stub + Apache-2.0 LICENSE). The owner asked
for the canonical `CLAUDE.md` to be installed and for the repo to be ready for a
session that starts from a **package upload and a directive brief**. The canonical source
is the Vasey Multimedia Engineering Standard v3.0 as installed in TRAKTION
(`a39ed81`, unchanged through `c000342`). VIZION-WEB carries the older v2.0 Swift
edition. No newer version was found.

## Decisions

1. **Standard installed verbatim.** §1–§10 of `CLAUDE.md` are byte-identical to the source
   template. Repo-specific facts live only in its "Project Notes" section.
2. **License stays Apache-2.0.** The standard defaults to MIT, but this repo was created
   under Apache-2.0, which counts as "the project specifies otherwise" (§7). Swapping licenses
   requires explicit owner approval.
3. **Shell gate until a stack exists.** `scripts/gate.sh` (required files, no template
   placeholders, `CLAUDE.md` under 200 lines, no committed env files or key material)
   runs locally and in CI. It is replaced by the real §3 gate in the PR that introduces
   code.
4. **Brand assumed VASEY/AI**, under the Vasey Studios umbrella (as in TRAKTION's ADR
   0003). EvaWavE is AI tooling, and its music subject matter does not make it a VASEY.AUDIO
   product (§10). This is flagged for owner confirmation.
5. **Logo deferred. This deviates from §8 item 1.** §8 says to generate a mark when none
   exists. It is not generated here: the Vasey Brand System v2.0 is binding for produced
   assets, and the incoming package may carry the mark. An invented placeholder would
   likely be thrown away or, worse, conflict. The README therefore ships without an
   icon until the package, brief, or owner supplies one.
6. **Intake path defined before the package arrives.** `docs/runbooks/package-intake.md`
   sets the procedure, and `docs/briefs/` is the brief's system of record. Precedence is
   brief > package > `CLAUDE.md` defaults. The package cannot override §1, §5, or §10.
   `CLAUDE.md` stays canonical unless the brief directs otherwise. This is an explicit
   default, because TRAKTION's kit silently reframed its contract (`AGENTS.md` canonical,
   `CLAUDE.md` reduced to a shim).
7. **No `.env.example`, no `docs/legal/`, no `assets/` yet.** There are no environment
   variables and no brand assets, and no user-facing service ships from this repo.
8. **Notes convention.** Working notes are dated files in `docs/notes/`. Every meaningful
   change also gets a `CHANGELOG.md` entry. Decisions graduate to ADRs in this folder.

## Consequences

- CI is green on a docs-only repository without faking a build.
- The next session has a fixed procedure for the package and brief, and a stated
  precedence rule, so conflicts surface as decisions instead of silent overwrites.
- Until the brand is confirmed and a mark lands, the README is knowingly out of spec on §8
  item 1.
