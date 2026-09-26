# Runbook — verification gate

## Run it locally

```bash
npm ci
bash scripts/gate.sh     # or: npm run gate
```

Exit code 0 and a final `GATE: PASS` line mean every check passed. Node must match
`package.json` `engines`: `^22.13.0 || ^24.0.0 || >=26.0.0`. The locked Vitest excludes 23
and 25. `.npmrc` sets `engine-strict`, so an unsupported Node fails at install instead of
partway through the gate.

## What CI runs

`.github/workflows/ci.yml` runs `npm ci` and then the same script on every pull request
and every push to `main`. It runs on two Node versions: 22.13.0 (the floor) and 24 (the
current LTS line). Local and CI verification never diverge.

## What the gate checks (CLAUDE.md §3, §5, §6)

1. **Standards.**
   - Required files exist: the governance set, `AGENTS.md` and `SKILLS.md` (without
     `AGENTS.md`, `next dev` writes into `CLAUDE.md`; ADR 0003), `.env.example`,
     `package.json` and `package-lock.json`.
   - No unfilled template placeholders: a closed double-brace token in non-code text
     files outside `docs/legal/` and `docs/archive/`. Code, the lockfile and GitHub Actions expressions are
     excluded. Bare double braces in prose are not placeholders.
   - `CLAUDE.md` stays under 200 lines.
   - No env files are committed (except `.env.example`), and the repo's own files contain
     no private-key material.
2. **Lint:** `eslint` is invoked directly with `--max-warnings=0`. Next.js 16 removed
   `next lint`. This step enforces the `src/core/**` import boundary (SPEC §1.2, A1). `docs/archive/**`
   is ignored (ADR 0004).
3. **Typecheck:** `next typegen && tsc --noEmit`. `next-env.d.ts` and route types are
   generated, not committed.
4. **Unit:** `vitest run` over `tests/**/*.test.ts`.
   `tests/unit/import-boundary.test.ts` proves the boundary rule rejects deliberate
   violations under the real ESLint config. `tests/unit/spec.test.ts` type-checks the IR v1
   block in `docs/SPEC.md` standalone and ties its worked example to the Jinn v1.2 file.
5. **Build:** `next build` (Turbopack).
6. **Client bundle:** `scripts/check-client-bundle.sh` fails if any server-only variable
   name from `.env.example` appears in `.next/static`.
7. **Audit:** `npm audit --audit-level=critical`. Criticals block merge (§6); exceptions
   go in `SECURITY.md`.

Integration tests join the gate when the first ones land (S4, Supabase RLS with two test
users).

## Known toolchain constraints (2026-09-23)

- **ESLint stays on 9.x.** `eslint-config-next@16.3.6` crashes under ESLint 10
  (`eslint-plugin-react` calls the removed `context.getFilename`). Revisit when
  `eslint-config-next` supports ESLint 10.
- **TypeScript stays on 5.9.** TypeScript 7 is outside typescript-eslint's peer range
  (`<6.1.0`).
