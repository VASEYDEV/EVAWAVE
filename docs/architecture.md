# Architecture

> **Status: specification restart (ADR 0004).** This document describes what exists today
> and points to the spec for what the build adds. The spec is [`SPEC.md`](SPEC.md). Update
> this file in the same PR as any change that alters it (CLAUDE.md §3).

## Product

EVAWAVE is a VASEY/AI mobile-first PWA. It composes, lints and versions structured
musical intent (MusicSpec IR) and compiles it into the exact input fields of Suno v6,
ElevenLabs Music v2 and Google Flow Music, exported as plain files. Udio is halted. It
does not generate audio and does not call the engines. Output serves VASEY.AUDIO, and the
two brands never conflate. Full scope: [`SPEC.md`](SPEC.md) §1.

## Layers

| Layer | Path | Rule | State |
| --- | --- | --- | --- |
| musicspec core | `src/core/musicspec/` | Pure TypeScript. No React, Next.js, Supabase or app-layer imports. ESLint enforces this, and `tests/unit/import-boundary.test.ts` proves it | Engine profiles (JSON) only. IR v1, linter and Suno serializer (S1), then the Eleven and Flow serializers with target switching (S2) follow |
| Taxonomy data | `src/data/taxonomy/` | Curated JSON; ids unique across banks | Jinn catalog records (S1), instrument bank from the seed (S3) |
| App | `src/app/` | Next.js 16 App Router | Shell only. Composer (S3), library (S4), audio import, metronome and tap tempo (S5) follow |
| Proxy | `src/proxy.ts` | Next.js 16 proxy (the successor to `middleware.ts`) | Supabase Auth session refresh. Passes through while Supabase is unconfigured |
| Supabase clients | `src/lib/supabase/` | Browser client, server client, proxy session update | Present. Migrations and RLS arrive in S4 |

Hard rules for the core live in
[`.claude/rules/musicspec-core.md`](../.claude/rules/musicspec-core.md): deterministic
serializers, the lineage invariant, the payload firewall, no lyrics, and the Jinn v1.2
golden file.

## Data flow (target, per SPEC §1 and §2)

1. The composer UI and audio import produce a `MusicSpec`. Intake returns `IRPatch` JSON
   only, and a patch applies only through the review diff.
2. `compile(spec, profile, catalog)` runs `serialize/*`, the only producer of engine
   text, and emits the payload plus a `CoverageReport`. Switching target re-runs it and
   never mutates the spec.
3. `lint(spec, profile, catalog)` runs the rule ids in SPEC §2.7 on the IR and on each
   payload.
4. The library persists style profiles, file metadata and genre tags in Supabase under
   RLS. Reference audio stays on the device (OPFS), and only features leave it.

## Specs

- [SPEC](SPEC.md): product scope and decisions (A1–A16), MusicSpec IR v1 with the
  "Defined, not inherited" list, lint rules, and the build plan S1–S5.
- [Instrument bank seed v0.1](evawave/instrument-bank-seed-v0.1.md).
- Reference set, ground truth: [`evawave/reference/`](evawave/reference/).
- History: [`archive/`](archive/) (Build Brief v0.1, scope v0.2, IR v0.3 delta).
- Decisions: [ADR 0001](decisions/0001-repo-bootstrap.md),
  [ADR 0002](decisions/0002-session-0-intake-and-stack.md) (superseded),
  [ADR 0003](decisions/0003-agent-contract-files.md),
  [ADR 0004](decisions/0004-evawave-owns-musicspec-ir.md).

## Open items

- `docs/evawave/reference/jinn-v1.1-egypt-blueprint.md`, S1's negative fixture, is not in
  the repo. S1 cannot start until it is added (SPEC §3).
- Flow verification results and the ElevenLabs web-app form surface (SPEC §1.11).
- Tagging model for audio import (SPEC §1.11).
- PWA and service-worker tooling: to be checked against Turbopack, with options reported,
  when it comes up (scope A15).
