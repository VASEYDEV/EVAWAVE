# ADR 0004 — Session 1 split: the IR v0.3 core now, the v0.2 merge when the sources land

**Date:** 2026-09-24 · **Status:** accepted

## Context

BUILD-BRIEF §3 makes Session 1 (S1) the IR: `ir/types.ts` with v0.2 and the v0.3 delta merged
per the delta's §7 attachment map, `defaults.ts`, zod schemas, `barmath.ts` and `patch.ts`.
The IR v0.2 type file is owner-supplied and is never reconstructed from the docs (ADR 0002,
decision 2). On 2026-09-24 it was not in this repo: `origin/main` after PR #2, every branch,
the issues and the handoff package were searched (the delta's own §0 states the v0.2 file was
not in that session). `VASEYDEV/VASEYAUDIO` is the likely home; attaching it to the build
session was refused by the session's permission policy on 2026-09-23 and again on
2026-09-24. The owner asked for development to continue.

## Decisions

1. **S1 is split in two.** S1a (this ADR's PR) builds everything the v0.3 delta specifies on
   its own: the delta types (§1–§5), every v0.3 default (§7), a runtime schema per delta
   type, bar math and `applyPatch`. S1b merges the v0.2 D1–D10 containers per §7, adds the
   `MusicSpec` and `StyleProfile` schemas and the root default, and runs the brief's "a v0.2
   doc validates unchanged" check. S1b starts only when the sources arrive, and is tracked in
   [issue #3](https://github.com/VASEYDEV/EVAWAVE/issues/3) together with `resolveLineage.ts`
   (S3, S4) and the S4/S5 reference files. Until then there is no `MusicSpec` type;
   `applyPatch` is generic over the spec's shape.
2. **`types.ts` carries the delta verbatim.** Interfaces and field names are the delta's.
   String unions are `as const` arrays with the type derived from them, so the schemas' enums
   share one source. Names are added only for the delta's inline unions and objects
   (`Subdivision`, `MeterExtension`, `Restatement`, `DropPosition`, `PocketKind`, `BlockSize`,
   `SectionStart`, `CrossBundle`, `PatchOpKind`, `PatchSource`, `PatchStatus`,
   `ProvenanceKind`). Where v0.2 already carries an equivalent, the §7 merge keeps the v0.2
   name and adopts the delta's semantics (delta §0).
3. **Schemas check shape and stated ranges; the linter owns semantics.** A schema enforces
   what the type comments state as a range (integer BPM, a pickup of 1–3 beats, a silence
   drop of 1–8, weights and confidence in 0–1, a JSON-pointer patch path, a section cap whose
   `blockAt` is at least `warnAt`). Rules with a lint id (CP-1 empty `returnRule`, ML-3 swung
   feel under the lock, PT-1 low confidence) stay in the linter, so a spec that is still
   being edited can hold the problem and the lint panel can show it. Objects are strict: an
   unknown key is a typo, not an extension point. Each schema is declared with
   `satisfies z.ZodType<T>`, and `tests/unit/schema.test.ts` asserts
   `z.infer<typeof Schema>` equals `T` with `expectTypeOf`, so the two files cannot drift.
4. **Bar math follows delta §3 literally.** `barSec = beatsPerBar × 60 / bpm`, where
   `beatsPerBar` is the signature's numerator and `bpm` counts the denominator unit
   (6/8 → six eighth-note beats). Pickups count as `beats / beatsPerBar` bars, silence drops
   count in beats, contrast phrases sit inside their section's bars. `sectionStarts[i]` is
   the 0-based bar offset and second at which section i's own material begins, its pickup
   first when it has one, so `runtimeSec` is the last start plus the last span. `barsToMs`
   (the ElevenLabs `duration_ms` unit) is the only rounding. `Tempo.feltBpm` never enters the
   math. Invalid input throws `RangeError`.
5. **`applyPatch` semantics.** A `proposed` patch is a no-op. Ops apply in order; an op
   applies only when its path is an exact member of `acceptedPaths`. PT-2 refuses the
   `references` and `patches` roots even when accepted. Paths are RFC 6901 pointers;
   `__proto__`, `constructor` and `prototype` tokens are refused because values come from an
   LLM. `set` creates a missing intermediate object (a v0.2 document has no `tempo` yet, and
   the delta's own example is `/D6/tempo/bpm`) but never a missing array. `merge` is a
   shallow object merge, `append` concatenates onto an array (an array value contributes its
   elements), `remove` requires the target to exist. The input is never mutated: containers
   on the path are copied, everything else is shared. The result lists every op as applied
   or skipped with a reason, which the PatchReviewDiff (S8) consumes.
6. **`zod` 4.6.5 becomes a direct dependency.** The brief names zod for the schemas, and the
   core validates in the browser and on the server. The exact version was already resolved in
   the lockfile as a dev transitive of `eslint-plugin-react-hooks`, so no new code enters the
   tree. Zod 4 API throughout (`z.strictObject`, `z.int`, `z.literal([...])`, `z.enum` over a
   readonly tuple).

## Open items

- **Compound-meter BPM convention.** If the owner wants `bpm` to mean the felt pulse in x/8
  meters (dotted quarter, 2 per bar in 6/8), `beatsPerBar` changes in one table plus a test.
  The product's lock is 4/4, so this is not on the critical path.
- **Owner-supplied inputs** (issue #3): the v0.2 type file for S1b, `resolveLineage.ts` for
  S3/S4, the Jinn v1.1 blueprint, v1.0 Morocco prompt and research brief for S4/S5.

## Consequences

- S2 (engine profile types, loader, validation) and S5 (taxonomy seed) do not depend on v0.2
  and can proceed while S1b waits. S3 (serializers) and S4 (linter) take a `MusicSpec` and
  wait for S1b.
- S1b is a bounded merge: a delta name that collides with a v0.2 name changes in `types.ts`
  and `schema.ts`, and the parity test catches any drift between them.
