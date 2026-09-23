# 2026-09-23 — Repo bootstrap

## Done

- Located the canonical `CLAUDE.md`: Vasey Multimedia Engineering Standard v3.0 from
  TRAKTION (`a39ed81`). Its §1–§10 text is identical at `c000342`, the last commit
  before TRAKTION's kit retired it from that repo's root. VIZION-WEB's `CLAUDE.md` is
  the older "Standard v2.0, Swift edition". VASEYAUDIO uses its own `AGENTS.md` and no
  standard. A Drive search turned up no newer version.
- Installed it at the root with §1–§10 byte-identical (verified by `diff`) and Project Notes
  filled for EVAWAVE.
- Copied TRAKTION's bootstrap scaffold: `.claude/`, CI workflow, `scripts/gate.sh`,
  `.editorconfig`, `.gitignore`, `CODE_OF_CONDUCT.md`. Adapted `SECURITY.md`,
  `CHANGELOG.md`, the runbooks and the notes README.
- Added the intake path for the next session: `docs/runbooks/package-intake.md` and
  `docs/briefs/README.md`.
- Recorded bootstrap decisions in `docs/decisions/0001-repo-bootstrap.md`.

## Open items

- **Brand:** assumed VASEY/AI; owner to confirm. `SECURITY.md` and `CODE_OF_CONDUCT.md`
  use `sean@vasey.audio` as the contact, following TRAKTION. Decide whether a
  VASEY/AI-side address should replace it, given §10's metadata rule.
- **Logo:** deferred (ADR 0001 §5). It arrives with the package or from the owner.
- **Stack, product shape, target music apps:** all set by the package and brief.
- **Gate:** replace `scripts/gate.sh` with the real §3 gate in the PR that lands code.
