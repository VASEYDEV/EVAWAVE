# Changelog

All notable changes to EVAWAVE are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Session 0 report for the EVAWAVE Build Brief v0.1 (`docs/notes/2026-09-23-session-0-repo-decision.md`): the repo decision rule's outcome, the handoff package inventory with sha256 hashes, the conflict scan, and the owner inputs needed before bootstrapping. The package itself is not installed yet.

### Fixed

- `scripts/gate.sh` failed on `main` after the handoff archive was uploaded (`cafe6f3`): the placeholder check matched the double-brace sequence inside the archive's compressed bytes. The check now skips binary files (`grep -I`) and still catches placeholders in text files.

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
