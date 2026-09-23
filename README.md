# EVAWAVE

**A VASEY/AI tool for composing, linting, versioning and compiling musical intent into the exact input fields of AI music engines. It does not generate audio.**

<p>
  <a href="https://github.com/VASEYDEV/EVAWAVE/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/VASEYDEV/EVAWAVE/ci.yml?branch=main&label=gate" alt="CI gate status"></a>
  <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version 0.1.0">
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License: Apache-2.0">
  <img src="https://img.shields.io/badge/status-pre--alpha-orange" alt="Status: pre-alpha">
</p>

> The logo is deferred until the brand pass settles the lockup (ADR 0001 and 0002).

## Status

**Pre-alpha: Session 0 (bootstrap) of the [Build Brief](docs/evawave/BUILD-BRIEF.md).**
Nothing in the app is usable yet. What exists today:

- A Next.js 16 app shell that builds, with Supabase Auth session refresh in `src/proxy.ts`
  (the proxy passes requests through until a Supabase project is configured).
- Engine profiles as data for Suno v6, ElevenLabs Music v2 and Google Flow Music
  (`src/core/musicspec/engines/profiles/`). Udio is a halted stub (scope A12).
- A lint-enforced import boundary that keeps the `src/core/` musicspec core free of React,
  Next.js, Supabase and app-layer imports, with tests that prove it fails violations.
- The product spec: [scope](docs/evawave/scope-v0.2.md), the
  [IR v0.3 delta](docs/musicspec/ir-v0.3-delta.md) and the
  [instrument bank seed](docs/evawave/instrument-bank-seed-v0.1.md).

The build order (S1 IR through S10 Phase D) is in the Build Brief §3.

## Quick start

Requires Node ≥ 22.13.0.

```bash
git clone https://github.com/VASEYDEV/EVAWAVE.git && cd EVAWAVE
npm ci
cp .env.example .env.local    # optional until Supabase is provisioned (S7)
npm run dev                   # http://localhost:3000
bash scripts/gate.sh          # full verification gate (the same one CI runs)
```

## Tech stack

- **Framework:** Next.js 16.3.6 (App Router, Turbopack) · React 19 · TypeScript 5.9 (strict)
- **Auth and data:** Supabase (`@supabase/ssr`, Supabase Auth, RLS from S7)
- **Quality:** ESLint 9 flat config (invoked directly) · Vitest · `npm audit`
- **Deploy:** Vercel (planned, not yet configured)

Stack decisions and held-back versions: [ADR 0002](docs/decisions/0002-session-0-intake-and-stack.md).

## Environment variables

Mirrors [`.env.example`](.env.example). Names without `NEXT_PUBLIC_` are server-only, and
the gate fails if any of them appears in the client bundle.

| Variable | Scope | Used by | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | `src/lib/supabase/*`, `src/proxy.ts` | Unset: proxy passes through |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | `src/lib/supabase/*`, `src/proxy.ts` | Unset: proxy passes through |
| `SUPABASE_SERVICE_ROLE_KEY` | server | not yet | Bypasses RLS; server only |
| `ANTHROPIC_API_KEY` | server | not yet (S8 text intake) | |
| `INTAKE_MODEL` | server | not yet (S8) | Pin explicitly; verify the id against the API docs at S8 |
| `APP_NAME` | server | not yet | `EVAWAVE` |
| `BRAND_LOCKUP` | server | not yet | `EVAWAVE` |

## Architecture

MusicSpec IR is the single source of truth. Engine profiles are data. Serializers are
pure functions of (IR, profile), and the composer UI is a field library over the IR. See
[`docs/architecture.md`](docs/architecture.md).

## Notes and updates

- [`CHANGELOG.md`](CHANGELOG.md): every meaningful change (Keep a Changelog + SemVer).
- [`docs/notes/`](docs/notes/): dated working notes.
- [`docs/decisions/`](docs/decisions/): decision records.
- [`docs/briefs/`](docs/briefs/): owner directive briefs.

## Contributing

All changes follow the engineering standard in [`CLAUDE.md`](CLAUDE.md) (with runtime notes in
[`AGENTS.md`](AGENTS.md) and the skill index in [`SKILLS.md`](SKILLS.md)) and pass
`bash scripts/gate.sh` ([verification runbook](docs/runbooks/verification.md)). Conduct is
governed by the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through the
[security policy](SECURITY.md), not public issues.

## License

[Apache License 2.0](LICENSE).

---

<p align="center"><sub><strong>VASEY/AI</strong> · AI tooling by Sean Vasey · a Vasey Studios project</sub></p>
