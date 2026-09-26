# Directive briefs

A directive brief is the owner's instruction for a body of work. Briefs are committed
here **verbatim**, named `YYYY-MM-DD-topic.md`, and never edited afterwards. A change of
direction is a new brief that names the one it supersedes.

Precedence: **brief > package > `CLAUDE.md` defaults**. §1, §5, and §10 of `CLAUDE.md`
change only by explicit owner instruction recorded in an ADR.

## Briefs on record

| Date | Brief | Location |
| --- | --- | --- |
| 2026-09-16 | EVAWAVE Build Brief v0.1 | **Superseded** by the 2026-09-26 brief. Archived at [`docs/archive/BUILD-BRIEF.md`](../archive/BUILD-BRIEF.md). Owner amendments to it are listed in [ADR 0002](../decisions/0002-session-0-intake-and-stack.md) |
| 2026-09-26 | Restart: EVAWAVE owns MusicSpec IR | [`2026-09-26-restart-evawave-owns-ir.md`](2026-09-26-restart-evawave-owns-ir.md). Decisions in [ADR 0004](../decisions/0004-evawave-owns-musicspec-ir.md); spec in [`docs/SPEC.md`](../SPEC.md) |

## What a brief should settle

A brief doesn't need every item, but anything it leaves open becomes a flagged assumption
or the session's single clarifying question.

1. **Objective:** what exists when this brief is done, in one or two sentences.
2. **Scope and non-goals:** what is in scope, and what is explicitly out of scope for this round.
3. **Deliverables and acceptance criteria:** checkable outcomes, preferably ones a
   command or test can prove.
4. **Priority order:** which parts matter most if time or budget runs short.
5. **Stack and platform:** chosen by the brief, inherited from the package, or left to the
   agent (with a stated preference, e.g. Next.js PWA on Vercel).
6. **Product decisions for EvaWavE:**
   - target AI music apps and each one's tag and prompt dialect (syntax, length limits,
     structure tags vs style tags);
   - the source of truth for the tag vocabulary;
   - what "prompt alignment" means operationally: validation, rewriting, scoring, or
     round-tripping between apps;
   - whether any model or provider call is in scope, and the spend cap per operation (§9).
7. **Brand:** confirm VASEY/AI (assumed in ADR 0001), and whether the package carries the
   mark and palette.
8. **License:** confirm Apache-2.0 or direct a change.
9. **Authority:** whether the agent may merge its own PRs and run multi-PR sequences
   without check-ins, or should stop for review after each PR.
10. **Package pointer:** which archive or folder the brief goes with, and whether
    the package or the brief wins where they disagree, if that should differ from the default.
