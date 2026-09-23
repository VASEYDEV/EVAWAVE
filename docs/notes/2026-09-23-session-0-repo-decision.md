# 2026-09-23 — Session 0: repo decision and package conflict scan

Inputs: `evawave-handoff.zip` on `main` (`cafe6f3`, sha256 `d1d685c7…9288`) and the
EVAWAVE Build Brief v0.1 (2026-09-16), supplied in-session. The supplied brief is
byte-identical to the package's `docs/evawave/BUILD-BRIEF.md` (MD5
`6caed07771301dfef1b25585bce2ce92` for both).

Per the brief's kickoff prompt and §7, this note reports which branch of the repo rule
fired and **stops for owner confirmation before bootstrapping**. Nothing from the package
is installed yet (runbook `package-intake.md` steps 1 and 3 only).

## 1. Repo decision rule: the "otherwise" branch fires

The rule asks whether a compiler repo has runnable TypeScript serializers
(`compileSuno`, `compileEleven`, `resolveLineage`) with a passing test suite.

| Where | Checked | Result |
| --- | --- | --- |
| `VASEYDEV/EVAWAVE` (this repo) | full tree, 22 files | No TypeScript, no `package.json`, no tests. Docs-only, plus the archive |
| The handoff package | all 13 files | No compiler sources. `ir-v0.3-delta.md` §0: "The v0.2 type file is not in this session." The brief lists `resolveLineage.ts` as "existing (import as-is)", but it is not in the package |
| `VASEYDEV/TRAKTION` @ `3aebc6e` | grep for the three symbols and `MusicSpec` | No hits. Swift app |
| `VASEYDEV/VIZION-WEB` @ `0c49c5d` | same grep, plus any `.ts`/`.tsx` | No hits, no TypeScript. SwiftUI app |
| `VASEYDEV/VASEYAUDIO` | not inspected | Attaching it to the session was refused by the session's permission policy. By name it is the most likely home of the "VASEY.AUDIO × VASEY/AI compiler" |
| `Grok-Bot`, `ROLI-Blocks-Basics`, `BLOCKS-SDK` | not inspected | Unrelated by name and history |

**Conclusion.** On everything visible, no compiler repo with runnable serializers exists,
so branch 2 applies. That branch says to create a new `evawave` repo from starter kit
v3.0. That repo already exists: it is this one, bootstrapped on Standard v3.0 by ADR 0001.
**Proposal: treat `VASEYDEV/EVAWAVE` as the `evawave` repo and don't create a second one.**
This reverses only if `VASEYAUDIO`, or a repo not visible here, turns out to hold the
compiler with a green suite.

**Either branch has the same blocker.** The brief makes "the compiler's IR v0.2" the spine,
and S1's acceptance criteria include "a v0.2 doc validates unchanged". Neither the v0.2 types
nor `resolveLineage.ts` is in the package or in any repo visible here. **S1 can't meet its
acceptance criteria until those sources are supplied.**

## 2. Canonical files: MD5 check pending the drop-in

| File | Brief expects | Found |
| --- | --- | --- |
| `CLAUDE.md` | v3.0.0, 2026-06-10, MD5 `5d460e25c85b62df8927355685a7c2c3` | Root file is "v3.0 · Aug 2026" with EVAWAVE Project Notes, MD5 `51da1dc14a4ba4793fc9932f6c79e951`. None of the 8 historical `CLAUDE.md` versions in TRAKTION, the source of the installed standard, matches the expected hash either |
| `AGENTS.md` v2.0.0 | drop-in | absent |
| `SKILLS.md` v2.0.0 | drop-in | absent |
| `.claude/settings.json` | plan mode default, auto memory on | present, but it only holds the `.env` read-deny rules |

The package intentionally excludes these files (`README-HANDOFF.md`: "drop in the canonical
v3 hard-copies"). The MD5 and date-marker check runs when they land.

## 3. Package inventory

The package ships no manifest. These hashes (sha256, first 16 hex characters) are the
reference for a byte-faithful install:

| Path | Bytes | sha256 |
| --- | --- | --- |
| `.claude/rules/musicspec-core.md` | 2047 | `9d19fd767198d197` |
| `README-HANDOFF.md` | 1933 | `9c8d8aa806b6c5ec` |
| `docs/evawave/BUILD-BRIEF.md` | 13630 | `2d152ab4c06f3bfb` |
| `docs/evawave/instrument-bank-seed-v0.1.md` | 24956 | `3517d8913fe7dbcf` |
| `docs/evawave/reference/handoff-brief-2026-09-16.md` | 18056 | `d228442343ec0b9f` |
| `docs/evawave/reference/jinn-v1.2-condensed.md` | 4259 | `9dff0106e8e258fe` |
| `docs/evawave/reference/jinn-voice-memo-transcript.txt` | 2605 | `d61cf2170a6e3e50` |
| `docs/evawave/scope-v0.2.md` | 34274 | `c3e91fec94aaaa94` |
| `docs/musicspec/ir-v0.3-delta.md` | 21062 | `460d899d17a15cf2` |
| `src/core/musicspec/engines/profiles/eleven.json` | 8697 | `de94ddd5a1b2b380` |
| `src/core/musicspec/engines/profiles/flow.json` | 7355 | `b77abdb28281413c` |
| `src/core/musicspec/engines/profiles/suno.json` | 7887 | `824541442363fad5` |
| `src/core/musicspec/engines/profiles/udio.json` | 996 | `20ce5150bfee5698` |

All four profiles parse as JSON. Every field in them carries `serializesFrom`. Udio is
`status: "stub"`.

Three reference files the brief depends on are **not in the package** (`README-HANDOFF.md`
lists them as owner drop-ins):

- `docs/evawave/reference/jinn-v1.1-egypt-blueprint.md`: S4's negative fixture
  (`jinn-v1.1-spec.json`, which must fail ML-1 and ML-2) is built from it.
- `docs/evawave/reference/jinn-v1.0-morocco.md`: source for S5's Maghreb bundle.
- `docs/evawave/reference/research-brief-2026-09-15.md`: in the brief's read order.

## 4. Conflict scan (runbook step 3)

| # | Conflict | Proposed resolution |
| --- | --- | --- |
| 1 | **Agent contracts.** The brief brings `CLAUDE.md` v3.0.0, `AGENTS.md` v2.0.0 and `SKILLS.md` v2.0.0. The repo invariant allows one policy layer | Keep `CLAUDE.md` canonical, and reference or reconcile `AGENTS.md`/`SKILLS.md` from it once they've been read. Record the outcome in ADR 0002 |
| 2 | **MD5 vs Project Notes.** The hash can only hold if the root `CLAUDE.md` is byte-identical to the hard copy, which would drop EVAWAVE's Project Notes (Apache-2.0 lock, intake rules, gate command) | Verify the MD5 on the file as delivered and record the hash in ADR 0002. Then decide with the owner: re-append Project Notes (the root hash changes by design) or move them to an imported file so the root stays byte-identical |
| 3 | **`settings.json` drop-in** would overwrite the `.env` read-deny rules | Merge them. §5 can't be overridden by a package |
| 4 | **The brief's home.** The brief targets `docs/evawave/BUILD-BRIEF.md`. The runbook default is `docs/briefs/YYYY-MM-DD-topic.md` | The brief wins. Install it at `docs/evawave/` verbatim and add a pointer in `docs/briefs/README.md` instead of keeping a second copy |
| 5 | **The gate vs the verbatim brief.** `BUILD-BRIEF.md` line 112 quotes the placeholder grep literally, so `scripts/gate.sh` fails as soon as the brief is installed. The brief's own S0 check ("= 0 outside docs/legal") fails on the brief itself | Tighten the gate to match only closed placeholder tokens (double-brace, identifier, double-brace), which keeps the check's intent. Excluding the brief's path is the fallback |
| 6 | **`README-HANDOFF.md` at the root.** "Unzip at the repo root" would put it beside `README.md` | Install it at `docs/evawave/README-HANDOFF.md` |
| 7 | **The rule file isn't path-scoped.** `.claude/rules/musicspec-core.md` has only a `description:` key. Claude Code reads only `paths:` from rule frontmatter, and loads rules without it unconditionally (code.claude.com/docs/en/memory, "Organize rules with `.claude/rules/`") | Add `paths: ["src/core/**", "src/data/taxonomy/**"]` at install. The body stays verbatim. Its content agrees with `CLAUDE.md` |
| 8 | **Stack version.** The brief pins Next.js 15. The npm registry today has `latest` 16.3.6, with 15.x on the `backport` tag (15.5.26) | Push back: start on 16 unless the compiler code requires 15. Owner decides |
| 9 | **Test data vs the S8 fixture.** The brief says "never in tests: real artist names", but S8 uses the voice-memo transcript, whose mishear key names a real composer | At S8, tests seed a synthetic producer name (as LN-1 already specifies). The real transcript is used only in a manual check. No action now |
| 10 | **Brand** | Resolved. The brief confirms VASEY/AI for the tool, which settles ADR 0001's assumption. `Song.brand = 'VASEY.AUDIO'` labels the output, as directed. It is not app branding. The logo stays deferred (lockup `EVAWAVE` vs `EVA/WAVE` is open, and icons come from the Vector Iconography project) |
| 11 | **License** | No conflict. The package carries no license text, so Apache-2.0 stays |
| 12 | **Path collisions**, including case-only ones | None across the 13 files |

## 5. Environment

Node 22.22.2, npm 10.9.7 and pnpm are on the path, the npm registry is reachable, and a
Playwright Chromium is preinstalled. So S0's stack scaffold, lint, typecheck, unit tests and
build can all run here, and the runbook's "don't scaffold where the build can't run"
condition is met. Supabase RLS integration tests (S7) need a local Supabase stack or a
test project. That gets checked at S7.

## 6. What confirmation unlocks

Once the owner confirms the branch and drops in the canonical files, the S0 intake PR on
this branch will:

1. install the package per §4, verified against the hashes above, and remove the archive;
2. verify the canonical files' MD5 and date markers and reconcile the contracts in ADR 0002;
3. scaffold the stack (the package manager defaults to npm), wire the ESLint import boundary
   on `src/core/**` with a deliberate failing import proving it, and replace
   `scripts/gate.sh` with the real §3 gate in CI;
4. update the README, architecture, CHANGELOG and Project Notes in the same PR.

S1 starts only after the IR v0.2 sources arrive.

## 7. Owner decisions and S0 outcome (appended 2026-09-23)

The owner answered the report. The decisions are recorded in
[ADR 0002](../decisions/0002-session-0-intake-and-stack.md) and scope A15:

- **Repo:** confirmed. This repo is `evawave` (the new-repo branch).
- **Compiler sources:** not an S0 dependency. They are supplied before S1. If they are
  absent at S1, stop and ask, and never reconstruct them from the docs.
- **Canonical files and starter kit v3.0:** the owner is supplying them. Verify MD5 and
  date markers. If a marker disagrees with the brief, report it and change neither file,
  because the hard copy is canonical. As of this note, they have not landed on `main`.
- **Stack:** Next.js 16, pinned at 16.3.6 or later, with the 16 conventions. Supabase
  Auth, no Clerk.
- **Node:** the requested 20.9 floor conflicted with current releases. The owner approved
  a 22.x floor, and verification against every locked `engines` range put it at 22.13.0.

Conflict-scan items resolved in this PR: #3 (the settings.json merge) is deferred to the
drop-in. #4, #5, #6 and #7 were done as proposed. #8 was decided by the owner.
#10 is resolved. #1 and #2 wait for the canonical files.

Installed tree check: all 13 package files match the section 3 hashes. The rule file
matched before its `paths:` frontmatter was added.
