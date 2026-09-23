# Architecture

> **Status: Session 0 (bootstrap).** This document describes what exists today and points
> to the spec for what the build adds. The package's product statement replaces the
> concept-stage description in ADR 0001. Update this file in the same PR as any change
> that alters it (CLAUDE.md §3).

## Product

EVAWAVE is a VASEY/AI mobile-first PWA. It composes, lints and versions structured
musical intent (MusicSpec IR) and compiles it into the exact input fields of Suno v6,
ElevenLabs Music v2 and Google Flow Music, exported as plain files. It does not generate
audio and does not call the engines. Output serves VASEY.AUDIO, and the two brands
never conflate. Full scope: [`evawave/scope-v0.2.md`](evawave/scope-v0.2.md).

## Layers

| Layer | Path | Rule | State |
| --- | --- | --- | --- |
| musicspec core | `src/core/musicspec/` | Pure TypeScript. No React, Next.js, Supabase or app-layer imports. ESLint enforces this, and `tests/unit/import-boundary.test.ts` proves it | Engine profiles (JSON) only. The IR (S1), profile loader (S2), serializers (S3) and linter (S4) follow |
| Taxonomy data | `src/data/taxonomy/` | Curated JSON; ids unique across banks | S5 |
| App | `src/app/` | Next.js 16 App Router | Shell only. Composer (S6) and library (S7) follow |
| Proxy | `src/proxy.ts` | Next.js 16 proxy (the successor to `middleware.ts`) | Supabase Auth session refresh. Passes through while Supabase is unconfigured |
| Supabase clients | `src/lib/supabase/` | Browser client, server client, proxy session update | Present. Migrations and RLS arrive in S7 |

Hard rules for the core live in
[`.claude/rules/musicspec-core.md`](../.claude/rules/musicspec-core.md): deterministic
serializers, the lineage invariant, the payload firewall, no lyrics, and the Jinn v1.2
oracle.

## Data flow (target, per the Build Brief §2)

1. The composer UI and the intake routes produce a `MusicSpec`. Intake returns
   `IRPatch` JSON only, and a patch applies only through the review diff.
2. `compile(spec, engineId)` runs `serialize/*`, the only producer of engine text, and
   emits the payload plus a `CoverageReport`.
3. `lint(spec, profile)` runs the rule ids from IR v0.3 delta §8 on the IR and on each
   payload.
4. The library persists Songs, Variants and Takes in Supabase under RLS. Reference audio
   stays on the device (OPFS). Only features leave it.

## Specs

- [Build Brief](evawave/BUILD-BRIEF.md): session plan, file targets, acceptance criteria.
- [Scope v0.2](evawave/scope-v0.2.md): decision log (A1–A15), engine model, library
  schema, intake, linter, seed plan.
- [IR v0.3 delta](musicspec/ir-v0.3-delta.md): new primitives, attachment map, lint rule
  ids, serializer contracts.
- [Instrument bank seed v0.1](evawave/instrument-bank-seed-v0.1.md).
- Decisions: [ADR 0001](decisions/0001-repo-bootstrap.md),
  [ADR 0002](decisions/0002-session-0-intake-and-stack.md),
  [ADR 0003](decisions/0003-agent-contract-files.md).

## Open items

- IR v0.2 types and `resolveLineage.ts`: the owner supplies them before S1 (ADR 0002,
  decision 2).
- Flow verification results and the ElevenLabs web-app form surface (Build Brief §7).
- Tagging model for S9 (Build Brief §7).
- PWA and service-worker tooling: to be checked against Turbopack, with options reported,
  when it comes up (scope A15).
