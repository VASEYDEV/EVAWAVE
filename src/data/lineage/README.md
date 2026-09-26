# Lineage names

`names.json` lists artist and producer names that must never appear in an emitted string
(`.claude/rules/musicspec-core.md`, rule 4; lint rule LN-1). The lineage pass matches them
case-insensitively as whole words and removes them from every payload.

The seed list holds names that already appear in this repo's reference documents, so it
covers the Jinn material. It is not exhaustive. The curator extends it, and the list only
ever holds names that are unambiguous as whole words. A name that is also a common word
would strip ordinary prose, so it stays out.

Tests never use these names. They seed an invented name instead.
