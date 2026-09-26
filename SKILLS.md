# SKILLS.md — EVAWAVE

Index of the skills and rules that apply to this repo. The authoritative operating
contract is `CLAUDE.md`; on any conflict it wins. Runtime notes are in `AGENTS.md`.

## The firewall

Skills emit prose. The compiler emits JSON and engine fields. Engine payload text comes
only from `src/core/musicspec/serialize/*`, and intake code returns `IRPatch` objects,
never prose payloads (`.claude/rules/musicspec-core.md`, rule 5). A skill can shape the
spec, the taxonomy data or the UI copy. It never writes text that ships to an engine.

## Repo-local

| Path | What | Scope |
| --- | --- | --- |
| `.claude/rules/musicspec-core.md` | Hard rules for the pure core: purity, determinism, lineage, the payload firewall, no lyrics, the oracle, taxonomy, Udio halted, brand separation | `src/core/**`, `src/data/taxonomy/**` |
| `.claude/skills/` | Repo skills | none yet |
| `.claude/commands/` | Repo slash commands | none yet |

## Owner skills by build session

The handoff brief (`docs/evawave/reference/handoff-brief-2026-09-16.md`, §2 and §8)
names these skills as domain logic that maps onto composer modules and linter passes.
The session column shows where each one applies in the build plan (`docs/SPEC.md` §3).

| Skill | Applies to | Session |
| --- | --- | --- |
| `generating-beat-prompts` | Drum Grammar and Regional Bundle modules; drum-pattern and bundle seed drafting | S1, S3 |
| `building-negative-prompt-lists` | Negative Space + Output module; exclude classes (vocals, meter drift, genre bleed, instrument ambiguity) | S1, S3 |
| `auditing-audio-prompts` | Linter passes over the IR and compiled payloads | S1, S2 |
| `designing-synth-patches` | Synth-role records and the synth-characteristic picker | S1, S3 |
| `mapping-synth-parameters` | `SynthCharacteristics` vocabulary (oscillator, unison, distortion, filter, envelope, glide) | S1, S3 |
| `translating-plugin-controls` | Describing hardware or plugin sounds by trait, never by patch or producer name (lineage invariant) | S1, S3 |
| `building-sound-design-recipes` | Texture and transition vocabulary | S3 |
| `designing-prompt-composer-flows` | Composer information architecture and module order | S3 |
| `formatting-ui-preset-exports` | JSON preset export in the export pane | S3 |
| `drafting-agent-system-instructions` | The system prompt for a text-intake route | not scheduled in S1–S5 |

Every skill's output passes the lineage scrub before it reaches the spec. Artist and
producer names never appear in any emitted string.
