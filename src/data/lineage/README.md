# Lineage names

`names.json` lists artist and producer names that must never appear in an emitted string
(`.claude/rules/musicspec-core.md`, rule 4; lint rule LN-1). The lineage pass matches them
case-insensitively as whole words and removes them from every payload.

The seed list holds names that already appear in this repo's reference documents, so it
covers the Jinn material. It is not exhaustive. The curator extends it, and the list only
ever holds names that are unambiguous as whole words. A name that is also a common word
would strip ordinary prose, so it stays out.

Tests never use these names. They seed an invented name instead.

The database holds a copy for LN-1 on a freeze (`public.lineage_names`, migration
`20260926000350_lineage_names.sql`). A name added here also needs a migration that adds it
there; `tests/integration/songs-rls.test.ts` fails until the two agree.
