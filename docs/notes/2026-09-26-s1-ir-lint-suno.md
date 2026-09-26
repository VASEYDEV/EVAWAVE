# 2026-09-26 — S1: IR v1 types, linter, Suno serializer

S1 per SPEC §3. There is no UI. Everything lives in `src/core/musicspec/` and
`src/data/`, plus the tests.

## What was built

| Piece | Path | Notes |
| --- | --- | --- |
| IR v1 types | `src/core/musicspec/ir/types.ts` | Generated from the SPEC §2.2 block by `scripts/sync-ir-types.mjs`. `--check` fails on drift, and `tests/unit/ir-types-sync.test.ts` runs it |
| Defaults | `ir/defaults.ts` | Factories return fresh objects |
| Bar math | `barmath.ts` | §2.5. Pickups and silence count toward runtime |
| Profile loader | `engines/` | `validateProfile` checks all four profiles at import |
| Catalog | `catalog.ts`, `src/data/taxonomy/` | `buildCatalog` rejects non-kebab or duplicate ids, unresolved references, a missing `fourFourSafe`, and listed names |
| Lineage | `lineage.ts`, `src/data/lineage/` | Case-insensitive whole-word find and scrub over a curated list |
| Linter | `lint/` | 19 rules, one module per id, sorted output |
| Suno serializer | `serialize/suno.ts`, `serialize/common.ts` | Style, Exclude Styles, Lyrics, Title, and the Instrumental toggle. Every field is scrubbed |

## Evidence

- **Golden (v1.2).** `tests/unit/jinn-golden.test.ts` reads the three fenced blocks of
  `jinn-v1.2-condensed.md` at run time. The compile matches byte for byte: Style 998,
  Exclude 222, Lyrics 1,559, total 2,779. Lint returns warnings only: CP-2 on Hook B's
  4-in-8 contrast, RB-3 twice for Saba, and SC-1 on Hook A (6) and the Finale (7).
- **Negative (v1.1).** `tests/fixtures/jinn-v1.1.spec.json` encodes the blueprint with
  the 4/4 lock it declares. ML-1 blocks "rubato" (intro cue and note), "shuffled" (sagat
  cue and note), "trance" and "trance rhythm" (verse cue), "two cycles per bar" (verse
  note) and "shuffle" (the `light-shuffle` technique phrase). ML-2 blocks zar/ayyub in
  the bundle and the verse, and malfuf in the finale. SC-1 blocks the nine-record finale.
  TQ-1 warns for light-shuffle and taqsim, and ML-4 warns for the missing meter-drift
  class. The fixture's brackets compile to the blueprint's Lyrics field, less its closing
  `[End]` tag. That shows the fixture encodes the blueprint, not a paraphrase of it.
- **Mutation checks.** Each of these mutations failed its tests, and restoring the code
  turned them green again:
  - joining every clause with `, ` (golden);
  - disabling the ML-2 meter check (negative);
  - skipping `notes` in ML-1 (negative);
  - making the lineage scrub a no-op (lineage, serializer and LN-1 tests);
  - hard-coding four beats per bar (bar math).
- The Jinn files are unchanged against `main`. `git diff origin/main --
  docs/evawave/reference` is empty, and the blueprint's sha256 is still `df8a29e6…`.

## Decisions made while building

- **`Section.notes`.** The blueprint's word-MIDI lines ("two cycles per bar") carry drift
  vocabulary that no cue repeats. Notes are linted like cues and never sent to an engine.
  They are added to SPEC §2.2 and §2.9.
- **`Catalog.lineageNames`.** The lineage list is curated data beside the taxonomy, so
  compile and lint stay pure functions of their inputs. The seed list holds the names
  already in this repo's reference docs. Tests use invented names only.
- **SC-1 counting.** The count is instruments ∪ synth roles. The earlier SPEC text also
  counted "the instruments of `percussionRhythmIds`", but `Rhythm` has no instruments, and
  whoever plays a rhythm is already in the scope. SPEC §2.4 now says so.
- **ML-4.** `LintSeverity` has no auto-fix level, so ML-4 is a warn that carries a `fix`
  patch. Compile applies the same class, so a locked song never ships without meter-drift
  excludes.
- **The v1.1 Style field's named choral work** is left out of the fixture, which records
  meter content. Lineage has its own tests. Whether a work title belongs in the lineage
  list is a curation call for the owner. It is not in the list today.

## Found and fixed

The lineage scrub left `[Hook – full drums ]` when a name ended a bracket. The tidy
step now handles bracket edges and a name right after the section dash. There are
regression cases in `tests/unit/lineage.test.ts`.
