# AGENTS.md — EVAWAVE

The authoritative operating contract lives in `CLAUDE.md` (the Vasey Multimedia
Engineering Standard v3.0 plus EVAWAVE Project Notes). Read it first, then
`docs/evawave/BUILD-BRIEF.md`. This file adds only environment and runtime notes; on any
conflict, `CLAUDE.md` wins. The skill index is `SKILLS.md`.

## Shape of the thing

One Next.js 16 app (App Router, Turbopack) with a pure TypeScript core at
`src/core/musicspec/`. The core is where the IR, engine profiles, serializers and linter
live, and it is compiled into engine input fields. The app layer (`src/app/`,
`src/lib/`, `src/proxy.ts`) wraps it with Supabase Auth and, later, the composer and
library UI. EVAWAVE never generates audio and never calls the engines.

## Commands

- `npm ci`: install from the lockfile. Node ≥ 22.13.0; `.npmrc` sets `engine-strict`.
- `npm run dev`: dev server on http://localhost:3000.
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- `bash scripts/gate.sh`: the full gate CI runs (standards, lint, typecheck, unit, build,
  client-bundle check, audit).

## Non-obvious gotchas

- **`src/core/**` is import-restricted.** ESLint rejects React, Next.js, Supabase and
  app-layer imports there by the module they target, not by spelling.
  `eslint-rules/core-boundary.mjs` normalizes aliases, relative paths, dot segments and
  doubled slashes across static imports, re-exports, `import()`, `import("…")` type
  queries and import-equals, and `no-restricted-imports` backs it up. A dynamic `import()`
  must use a string literal so the rule can check it.
  `tests/unit/import-boundary.test.ts` proves the rule. Never disable either. The
  path-scoped hard rules are in `.claude/rules/musicspec-core.md`.
- **`next lint` does not exist in Next 16.** `npm run lint` calls ESLint directly.
- **ESLint stays on 9.** `eslint-config-next@16.3.6` crashes under ESLint 10.
- **Session refresh is `src/proxy.ts`, not `middleware.ts`.** It passes requests through
  while `NEXT_PUBLIC_SUPABASE_*` are unset.
- **`next-env.d.ts` and route types are generated and gitignored.** `npm run typecheck`
  runs `next typegen` first.
- **Server-only env names must never reach client code.** The gate greps `.next/static` for
  every non-`NEXT_PUBLIC_` name in `.env.example`.
- **Closed double-brace tokens in non-code text fail the gate.** They are read as unfilled
  template placeholders.
- **Keep the managed block below in this file.** `next dev` maintains it whenever it
  detects an AI coding agent. If this file were missing, `next dev` would write the block
  into `CLAUDE.md` and alter the standard.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
