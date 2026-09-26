# 2026-09-26 — Filing the owner's upload

The owner uploaded 11 files to the repo root on `main` (`6fe42ea`, `dafc559`). That broke
the gate on `main`: `musicspec-compiler.tsx` sits inside `tsconfig.json`'s `**/*.tsx`
include and ESLint's reach. Reproduced on `dafc559`: `npm run typecheck` fails with
TS7006/TS7053, and `npm run lint` fails with `prefer-const`.

| Uploaded as | Filed as | Check |
| --- | --- | --- |
| `Jinn_On_The_Dune_Suno_Prompt_v1.1_Egypt.md` | `docs/evawave/reference/jinn-v1.1-egypt-blueprint.md` | sha256 `df8a29e6…` unchanged |
| `Jinn_On_The_Dune_Suno_Prompt.md` | `docs/evawave/reference/jinn-v1.0-morocco.md` | sha256 `a8d79136…` unchanged |
| `Research_Brief_Egyptian_Atlanta_Trap_Suno_v6.md` | `docs/evawave/reference/research-brief-2026-09-15.md` | sha256 `98cf9c2a…` unchanged |
| `musicspec-compiler.tsx` | `docs/archive/legacy/` | sha256 `f2ed60a8…` unchanged |
| `musicspec-v0_2-schema_excerpt.js` | `docs/archive/legacy/` | sha256 `540a636f…` unchanged |
| `resolveLineage_excerpt.js` | `docs/archive/legacy/` | sha256 `632a5a57…` unchanged |
| `Claude_Instructions_Song_Prompt_Generator.md` | `docs/archive/handoff-chat/claude-instructions-song-prompt-generator.md` | sha256 `b0d0fe4b…` unchanged |
| `New_Chat_Opening_Message.txt` | `docs/archive/handoff-chat/new-chat-opening-message.txt` | sha256 `d5a28e30…` unchanged |
| `Jinn_On_The_Dune_Suno_v1.2_condensed.md` | removed: byte-identical to `docs/evawave/reference/jinn-v1.2-condensed.md` | `cmp` equal |
| `AI_Song_Prompt_Generator_Handoff_Brief.md` | removed: byte-identical to `docs/evawave/reference/handoff-brief-2026-09-16.md` | `cmp` equal |
| `Jinn_On_The_Dune_voice_memo_transcript.txt` | removed: same text as `docs/evawave/reference/jinn-voice-memo-transcript.txt`, which ends with a newline this copy lacks | `diff`: final newline only |

The target names are the ones `docs/archive/README-HANDOFF.md` gave for the drop-ins. The
Jinn files keep their bytes. Only their paths change, and the copies already in
`reference/` stay the ground truth.

The v1.1 blueprint's own rhythm key lists zar/ayyub and malfuf as 2/4. That settles the
SPEC §1.11 ML-2 item in S1.
