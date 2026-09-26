# Security Policy

## Reporting a vulnerability

Email **sean@vasey.audio** with a description of the issue, steps to reproduce, and any relevant logs. Please do not open public issues for security reports. You can expect an acknowledgement within 7 days.

## Supported versions

EVAWAVE is pre-alpha and has no release yet. Until a first release, security reports are assessed against the tip of `main` only.

| Version | Supported |
| --- | --- |
| `main` (unreleased) | ✅ |

## Security model

- **Auth.** Sign-in is by Supabase Auth email links (managed auth, no passwords held by EVAWAVE). `src/proxy.ts` refreshes the session on each request. Supabase Auth rate-limits sign-in emails and token verification.
- **Data access.** Row level security is on for every library table from the first migration (`supabase/migrations/`). Users read and write only rows they own; link rows may only join rows the same user owns; the curated genres are read-only; `anon` has no table privileges. `tests/integration/library-rls.test.ts` proves user B cannot read or write user A's rows in every user-scoped table. Saved style profiles carry an id made on the device, so a repeated save upserts one row; the same test proves another owner's upsert with that id is refused.
- **Local-only audio (A6).** Reference audio and images never leave the device. The `files` table holds metadata only, and a check constraint rejects `local_only = false`.
- **Redirects.** The auth callback follows only same-site paths (`src/lib/auth/redirect.ts`).
- **Secrets.** Server-only variables never reach the client bundle; the gate fails the build if one does.

## Audit exceptions

None. Per the engineering standard (`CLAUDE.md` §6), `audit` criticals block merge; any documented exception would be recorded here.
