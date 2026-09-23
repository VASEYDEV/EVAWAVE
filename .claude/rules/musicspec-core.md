---
description: Hard rules for the pure musicspec core. Applies to src/core/** and src/data/taxonomy/**.
paths:
  - "src/core/**"
  - "src/data/taxonomy/**"
---

# musicspec core — path-scoped rules (visible date marker: 2026-09-16)

1. `src/core/**` is pure TypeScript. No imports from react, react-dom, next, next/*, @supabase/*, @/components, @/app, @/lib/supabase. The ESLint rule enforces it; do not disable it.
2. Serializers are deterministic functions of (MusicSpec, EngineProfile). Same inputs, same bytes. No Date.now(), no randomness, no I/O.
3. Engine profiles are data. Editing a profile's limits, toggles or behaviours requires updating `verifiedOn` and `confidence` in the same commit, with the source named in `verification.method`. Community lore is labelled `community`, never `verified`.
4. Lineage invariant: artist and producer names never appear in any emitted string. `lineage/scrub.ts` runs on every serializer output, every intake patch value and every override before it is returned. A test seeds a producer name and asserts it is gone.
5. Payload firewall: only `serialize/*` produces engine text. Intake code returns `IRPatch` objects, never prose payloads. Skills emit prose; the compiler emits JSON and engine fields.
6. Never reproduce lyrics in code, fixtures, tests or docs. User lyrics pass through `VocalsDelta.lyricsPassthrough` untouched and are never generated.
7. The Jinn v1.2 oracle (`tests/oracle/jinn-v1.2/`) must pass after any serializer or lint change. The oracle asserts clause coverage, budgets and lint parity, never byte equality.
8. Taxonomy JSON is curated data: ids kebab-case and unique across banks; every cross-reference resolves; every Rhythm carries `fourFourSafe`; no artist or producer names in any field; brand terms only in `commonNames`.
9. Udio is halted (A12): `status: 'stub'`; `compile()` refuses it with a typed error. Do not add a serializer without an explicit instruction from Sean.
10. VASEY/AI (the tool) and VASEY.AUDIO (the output brand) are separate. `Song.brand` is `'VASEY.AUDIO'`; app identity is `APP_NAME=EVAWAVE`.
