# Archive

Superseded documents, kept as history. Nothing here is a spec, and nothing here is built,
linted or tested. The current spec is [`docs/SPEC.md`](../SPEC.md). The decision that
archived these files is [ADR 0004](../decisions/0004-evawave-owns-musicspec-ir.md).

| File | Was | Superseded by |
| --- | --- | --- |
| `BUILD-BRIEF.md` | EVAWAVE Build Brief v0.1 (2026-09-16), with the ADR 0002 stack amendment | `docs/SPEC.md` §3 and the 2026-09-26 brief |
| `scope-v0.2.md` | Product scope v0.2 (2026-09-16), decision log A1–A15 | `docs/SPEC.md` §1 |
| `ir-v0.3-delta.md` | MusicSpec IR v0.3 delta on top of the legacy v0.2 IR | `docs/SPEC.md` §2 (IR v1) |
| `README-HANDOFF.md` | The handoff package's install note | `docs/SPEC.md` (read order and missing drop-ins) |

## Legacy compiler files

Files from the legacy VASEY.AUDIO × VASEY/AI compiler (IR v0.2 types,
`resolveLineage.ts`) go in `docs/archive/legacy/` as reference only. Nothing imports them.
`docs/archive/**` is excluded from `tsconfig.json`, ESLint and the gate's placeholder
scan, and Vitest only collects `tests/**`. As of 2026-09-26 no legacy compiler file has
ever been in this repository, so `legacy/` does not exist yet.
