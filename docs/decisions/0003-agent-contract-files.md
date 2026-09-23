# ADR 0003 — Agent contract files: CLAUDE.md, AGENTS.md, SKILLS.md, settings

**Date:** 2026-09-23 · **Status:** accepted

## Context

Build Brief §1 expects canonical `CLAUDE.md`, `AGENTS.md`, `SKILLS.md` and
`.claude/settings.json` files, plus starter kit v3.0. The owner directed that
`CLAUDE.md` be the standard, and that his most recently made standard versions of these
files be installed without further back-and-forth. The owner's repos and Drive were
searched on 2026-09-23. `VASEYAUDIO` was not reachable from this session.

## Findings

- **`CLAUDE.md`:** the most recent standard edition is the Vasey Multimedia Engineering
  Standard v3.0 (Aug 2026), which ADR 0001 installed here. §1–§10 are byte-identical to
  the template at TRAKTION `a39ed81` (108 lines, MD5 `f2593384a4ebe4a92c04bf5422ddccf7`).
  VIZION-WEB carries the older v2.0 Swift edition. TRAKTION has since moved to an
  `AGENTS.md`-canonical shim under its own foundation kit. Nothing newer was found.
- **`.claude/settings.json`:** byte-identical to the v3.0 standard scaffold in TRAKTION
  (the `.env` read-deny rules).
- **`AGENTS.md` / `SKILLS.md`:** no standard edition exists in the reachable repos or in
  Drive. The Drive `AGENTS`/`SKILLS` folders hold ChatGPT agent and skill definitions,
  not repo contracts. The owner's latest repo convention is VIZION-WEB (2026-09-03):
  `CLAUDE.md` is authoritative, and `AGENTS.md` is a pointer plus environment and
  runtime notes.
- **Starter kit v3.0:** the v3.0 scaffold is already in place from ADR 0001:
  `.claude/` (settings, hooks, skills, commands), CI workflows, `docs/` (architecture,
  decisions, runbooks), and every required file. The only gap is `assets/`, deferred with
  the logo (ADR 0001, decision 5).
- **Brief §1's version markers** (CLAUDE.md v3.0.0 dated 2026-06-10 with MD5
  `5d460e25…`, and AGENTS.md/SKILLS.md v2.0.0) match no file found. The standard is
  canonical, so the installed files stand and the brief's line stays unedited.

## Decisions

1. **`CLAUDE.md` remains the canonical contract.** The standard's §1–§10 stay
   byte-identical, and EVAWAVE facts live only in Project Notes.
2. **`AGENTS.md` follows the VIZION-WEB pattern.** It points to `CLAUDE.md` and adds
   runtime notes only, and `CLAUDE.md` wins any conflict. It also hosts the Next.js
   agent-rules block. Next.js 16.3.6's `next dev` writes that block whenever it detects
   an AI coding agent and finds the block missing. When no `AGENTS.md` exists, it appends
   the block to `CLAUDE.md`, which would alter the standard. With the block in
   `AGENTS.md`, `next dev` leaves both files untouched. Verified with Next's own
   `hasCurrentAgentRules` (true) and `writeAgentFiles` (`AGENTS.md` unchanged,
   `CLAUDE.md` skipped).
3. **`SKILLS.md` is an index, not a policy layer.** It restates the payload firewall
   (skills emit prose; only `serialize/*` emits engine text), lists the repo-local
   rules, and maps the owner skills named in the handoff brief (§2, §8) to build
   sessions.
4. **`.claude/settings.json` stays the standard file.** The brief describes it with plan
   mode as the default and auto memory on, but the standard file carries neither.
   Plan-mode-by-default would also stall autonomous cloud sessions at the approval
   prompt.

## Consequences

- One policy layer: `CLAUDE.md` governs, and `AGENTS.md` and `SKILLS.md` defer to it.
- Deleting `AGENTS.md` would let `next dev` edit `CLAUDE.md`. `CLAUDE.md` Project Notes
  record this.
