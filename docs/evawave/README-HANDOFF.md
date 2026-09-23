# EVAWAVE handoff → Claude Code (2026-09-16)

Unzip at the repo root (existing compiler repo on branch `feat/evawave`, or a new `evawave` repo — the Session 0 rule in `docs/evawave/BUILD-BRIEF.md` decides which). Paths are repo-relative.

Included
- `docs/evawave/BUILD-BRIEF.md` — read first; contains the kickoff prompt for session 0.
- `docs/evawave/scope-v0.2.md` — product scope, decision log A1–A14, engine model, library schema, intake, linter, seed plan.
- `docs/evawave/instrument-bank-seed-v0.1.md` — GM1/GM2 baseline plus orchestral, band, contemporary, synth, kits, drum machines, genre kits, world sets.
- `docs/musicspec/ir-v0.3-delta.md` — additive IR primitives, attachment map, lint rule ids, per-engine serializer contracts, Hook B worked example.
- `src/core/musicspec/engines/profiles/{suno,eleven,flow,udio}.json` — engine profiles (Udio halted stub).
- `.claude/rules/musicspec-core.md` — path-scoped hard rules for the pure core.
- `docs/evawave/reference/handoff-brief-2026-09-16.md`, `jinn-v1.2-condensed.md`, `jinn-voice-memo-transcript.txt` — Phase D oracle and S8 intake fixture.

Drop in from your own files (they were attached to the chat, not on disk here) — target names the brief expects:
- `docs/evawave/reference/jinn-v1.1-egypt-blueprint.md`  ← Jinn_On_The_Dune_Suno_Prompt_v1.1_Egypt.md (bar map, harmony, drum grammar; the S4 negative fixture is built from it)
- `docs/evawave/reference/jinn-v1.0-morocco.md`          ← Jinn_On_The_Dune_Suno_Prompt.md (Maghreb bundle source)
- `docs/evawave/reference/research-brief-2026-09-15.md`  ← Research_Brief_Egyptian_Atlanta_Trap_Suno_v6.md

Not included, by design: CLAUDE.md, AGENTS.md, SKILLS.md, `.claude/settings.json` — drop in the canonical v3 hard-copies and let the agent verify MD5 and date markers. The Flow Music screenshots stay with you; the Flow profile's `verification` block records what they established.
