# 2026-09-26 — S2: ElevenLabs and Flow serializers, target switching

S2 per SPEC §3. The contracts are recorded in SPEC §2.4, §2.6 and §2.7.

## Evidence

- **Lossless projection.** `tests/unit/target-switching.test.ts` deep-freezes each Jinn
  fixture and runs Suno → Eleven → Flow → Suno, then every ordered pair of the three.
  Each spec stays deep-equal to its source, and each return trip reproduces the first
  payload hash.
- **Eleven, Jinn v1.2.**
  - The plan has 9 chunks: 8 sections plus the Hook B drill contrast.
  - `music_length_ms` is 194,143, equal both to the sum of the chunks and to the rounded
    bar-math runtime.
  - The contrast chunk is 4 bars plus Hook B's 1-beat silence (7,285 ms).
  - Both pickups fold into the chunk before, and the Bridge's timpani transition is inline.
  - The largest chunk has 14 positive styles, under the house budget of 20.
  - Coverage is 0.84.
- **Flow, Jinn v1.2.**
  - BPM is 140 and Length 194.
  - The Producer script has 13 lines: 8 sections, 2 pickups, 1 contrast, 1 transition
    and 1 silence.
  - Negative space is `approximated` (no-field), and coverage is 0.49.
- **Udio.** `compile` returns `engine-halted` and names decision A12.
- **Mutation checks.** Each of these failed its tests, and restoring the code turned
  them green again:
  - leaving silence time out of Eleven chunks;
  - no contrast chunk;
  - a Flow serializer that sorts `D2.moods` (the frozen-spec tests threw);
  - CV-1 inverted;
  - OV-1 inverted;
  - Udio not refused.

## Decisions made while building

- **`compile()` returns a result.** It returns `{ ok, payload | error }` and does not
  throw, so the target picker can render a refusal without a try/catch.
- **Coverage is path-level.** One table per engine says how each primitive renders.
  Blueprint-only content (`notes`, `harmony`) is excluded by design. Suno's dynamics are
  `approximated`, because only cue wording carries them. That puts Jinn v1.2 at 0.76 on
  Suno, and CV-1 warns while Suno is the active target. It is honest, and it is a warning
  only.
- **Eleven's first chunk.** It carries the Style sentences as qualities, which keeps the
  song-wide palette in about 8 entries. Section clauses and positioned synths move into
  their own chunks, which is Eleven's per-chunk strength.
- **Open pockets and lyrics.** An open pocket stays `{instrumental break}` with a "lead
  vocals" negative until passthrough lyrics fill it. Lyrics are never dropped silently.
  Unmatched blocks lower coverage, and a listed name in lyrics blocks LN-1.
- **Acknowledgements.** CV-2 acknowledgements live in the spec
  (`D10.acknowledgedDrops`), so they travel with Variants.

## Flagged, not settled

These are recorded in SPEC §1.11:

- Flow's Length unit and maximum. Jinn runs 194 s, over the press figure of 3 min.
- Flow's Producer command grammar.
- Whether inline "Avoid:" negatives suppress or prime.
- Whether Eleven reads long style qualities as well as short ones.
- Techniques, which no serializer renders yet.
