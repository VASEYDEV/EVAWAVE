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

**Pre-alpha: specification restart. The spec is [`docs/SPEC.md`](docs/SPEC.md) (ADR 0004).**
Nothing in the app is usable yet. What exists today:

- A Next.js 16 app shell that builds, with Supabase Auth session refresh in `src/proxy.ts`
  (the proxy passes requests through until a Supabase project is configured).
- Engine profiles as data for Suno v6, ElevenLabs Music v2 and Google Flow Music
  (`src/core/musicspec/engines/profiles/`). Udio is a halted stub (scope A12).
- A lint-enforced import boundary that keeps the `src/core/` musicspec core free of React,
  Next.js, Supabase and app-layer imports, with tests that prove it fails violations.
- The musicspec core from S1, with no UI yet. It has the IR v1 types, generated from the
  spec; bar math; a linter covering the 19 S1 rules (meter lock, pickups, contrast phrases,
  section caps, regional bundles, lineage and budgets); and a Suno v6 serializer. The
  serializer compiles the Jinn v1.2 spec to the reference Style, Exclude and Lyrics fields
  byte for byte. The linter blocks the Jinn v1.1 blueprint's meter drift.
- The composer, from S3. It shows the eleven modules of SPEC §1.5 on one mobile-first page:
  - every input is bound to an IR path;
  - budget meters, the lint panel, coverage for the active target, and an export pane
    (per-engine files, the MusicSpec JSON and a word-MIDI blueprint);
  - non-destructive undo and redo, where an edit after an undo keeps the old branch
    reachable.

  The spec persists in the browser until the S4 library.
- The library, from S4, at `/library`: style profiles saved from the composer, file
  metadata, tags, and genre and tag links. Sign-in is by Supabase Auth email link. Row
  level security keeps each user to their own rows, and a test proves it against the real
  migrations. It needs a Supabase project: see
  [`docs/runbooks/supabase.md`](docs/runbooks/supabase.md).
- Audio import, from S5, at `/import`. A reference track is analysed on this device, in a
  background worker so the page stays responsive:
  tempo, meter, key, BS.1770 loudness, energy and spectrum. EVAWAVE proposes a style
  profile field by field, you accept what you want, and the profile is saved to the
  library or downloaded. The audio never leaves the device, and a test proves no request
  carries it.
- Tap tempo (the mean of the last four taps, with outliers dropped) and a Web Audio
  metronome with half-time accents and subdivisions, in the composer's first module.
- A hue and a provisional monoline icon for every module (`assets/icons/`).
- An instrument bank of 336 records: the 24 curated Jinn records plus 312 generated
  deterministically from the seed (General MIDI programs and percussion, drum machines,
  world sets).
- Serializers for ElevenLabs Music (a `music_v2` composition plan timed by bar math, plus
  the simple prompt) and Google Flow Music (Sound, BPM, Length, and a numbered Producer
  script), from S2. `compile(spec, engine, catalog)` projects one spec onto any live target
  without changing it, and refuses the halted Udio. Every payload ships with a path-level
  coverage report.
- The product spec, [`docs/SPEC.md`](docs/SPEC.md): scope and confirmed decisions,
  MusicSpec IR v1 as a complete type definition, and the build plan. The
  [instrument bank seed](docs/evawave/instrument-bank-seed-v0.1.md) and the Jinn reference
  set stay in `docs/evawave/`. Superseded docs are in `docs/archive/`.

The build order (S1 IR, linter and Suno serializer through S5 audio import) is in
SPEC §3.

## Quick start

Requires Node 22.13+ on the 22 line, 24, or 26 and later. The locked Vitest excludes 23 and 25.

```bash
git clone https://github.com/VASEYDEV/EVAWAVE.git && cd EVAWAVE
npm ci && npx playwright install chromium   # the browser is for the e2e step
cp .env.example .env.local    # optional until Supabase is provisioned (S4)
npm run dev                   # http://localhost:3000
bash scripts/gate.sh          # full verification gate (the same one CI runs)
```

## Tech stack

- **Framework:** Next.js 16.3.6 (App Router, Turbopack) · React 19 · TypeScript 5.9 (strict)
- **Auth and data:** Supabase (`@supabase/ssr`, Supabase Auth, RLS from S4)
- **Quality:** ESLint 9 flat config (invoked directly) · Vitest (with PGlite for the RLS tests) · Playwright with axe-core (mobile viewport, WCAG 2.2 AA scan) · `npm audit`
- **Deploy:** Vercel (planned, not yet configured)

Stack decisions and held-back versions: [ADR 0002](docs/decisions/0002-session-0-intake-and-stack.md).

## Environment variables

Mirrors [`.env.example`](.env.example). Names without `NEXT_PUBLIC_` are server-only, and
the gate fails if any of them appears in the client bundle.

| Variable | Scope | Used by | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | `src/lib/supabase/*`, `src/lib/library/*`, `src/proxy.ts`, `/library`, `/login` | Both unset: proxy passes through and the library says it is not configured. Only one set: error |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | `src/lib/supabase/*`, `src/lib/library/*`, `src/proxy.ts`, `/library`, `/login` | Both unset: proxy passes through and the library says it is not configured. Only one set: error |
| `SUPABASE_SERVICE_ROLE_KEY` | server | not yet | Bypasses RLS; server only |
| `ANTHROPIC_API_KEY` | server | not yet (text intake, not scheduled in S1–S5) | |
| `INTAKE_MODEL` | server | not yet (text intake) | Pin explicitly; verify the id against the API docs when intake is built |
| `APP_NAME` | server | not yet | `EVAWAVE` |
| `BRAND_LOCKUP` | server | not yet | `EVAWAVE` |

## Architecture

MusicSpec IR is the single source of truth. Engine profiles are data. Serializers are
pure functions of (IR, profile, catalog), and the composer UI is a field library over the IR. See
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
