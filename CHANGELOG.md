# Changelog

All notable changes to EVAWAVE are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Session 0 report for the EVAWAVE Build Brief v0.1 (`docs/notes/2026-09-23-session-0-repo-decision.md`): the repo decision rule's outcome, the handoff package inventory with sha256 hashes, the conflict scan, and the owner decisions.
- EVAWAVE handoff package installed (2026-09-16): the Build Brief, scope v0.2, the instrument bank seed, the IR v0.3 delta, reference docs, engine profiles for Suno, ElevenLabs, Flow and a halted Udio stub, and the path-scoped `musicspec-core` rule. The archive is removed from the tree.
- Next.js 16.3.6 app scaffold (App Router, Turbopack, TypeScript strict) with Supabase Auth session refresh in `src/proxy.ts` and Supabase browser and server clients.
- The `src/core/**` import boundary (ESLint `no-restricted-imports`, including relative-path escapes), with a Vitest suite that proves it rejects violations.
- `.env.example` documenting every variable from Build Brief §6.
- `scripts/check-client-bundle.sh`: fails the build if a server-only variable name reaches the client bundle.
- ADR 0002: Session 0 intake and stack decisions.
- `AGENTS.md` (points to `CLAUDE.md`, adds runtime notes, and hosts the `next dev`-managed Next.js block so `next dev` never writes into `CLAUDE.md`) and `SKILLS.md` (skill index and payload firewall). ADR 0003 records the agent contract files; `CLAUDE.md` stays the canonical Standard v3.0.

### Changed

- The verification gate now runs the full §3 gate: standards, lint, typecheck, unit, build, the client-bundle check and `npm audit` (criticals block). CI runs it after `npm ci` on Node 22.13.0 and 24.
- Build Brief §2 stack line amended to Next.js 16 by owner decision. Scope decision log gains A15 (stack and Node ≥ 22.13).
- README and `docs/architecture.md` rewritten to the package's product statement (current claims only).
- The gate requires `AGENTS.md` and `SKILLS.md`.

### Fixed

- `scripts/gate.sh` failed on `main` after the handoff archive was uploaded (`cafe6f3`): the placeholder check matched the double-brace sequence inside the archive's compressed bytes. The check now skips binary files (`grep -I`) and still catches placeholders in text files.
- The placeholder check failed on the verbatim Build Brief, which quotes the check itself. It now matches only closed double-brace tokens in non-code text files, excluding GitHub Actions expressions. The placeholder and private-key scans no longer read `node_modules/` or `.next/`.

## [0.1.0] - 2026-09-23

### Added

- Vasey Multimedia Engineering Standard v3.0 installed at repo root (`CLAUDE.md`), §1–§10 byte-identical to the source template, with Project Notes filled for EVAWAVE.
- Repository scaffold: `.claude/` (settings, hooks, skills, commands), `.github/workflows/`, `docs/` (architecture, decisions, runbooks, notes, briefs), `scripts/`.
- Governance documents: `SECURITY.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `.editorconfig`, `.gitignore`.
- Verification gate for the docs-only stage: `scripts/gate.sh`, run locally and in CI (`.github/workflows/ci.yml`) on every PR and push to `main`.
- Intake path for the next session: `docs/runbooks/package-intake.md` (foundation package) and `docs/briefs/` (directive brief format and system of record).
- First decision record: `docs/decisions/0001-repo-bootstrap.md`.
- Working-notes convention under `docs/notes/` with the bootstrap session note.

### Changed

- README expanded from a two-line stub: status, badges, notes and contributing links, license, and brand footer. The logo and hero are deferred (ADR 0001).

## [0.0.1] - 2026-09-23

### Added

- Initial repository: README stub and the Apache License 2.0.
