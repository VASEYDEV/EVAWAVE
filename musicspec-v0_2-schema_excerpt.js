/* ============================================================================
   VASEY.AUDIO × VASEY/AI — MusicSpec Compiler · v0.2 core
   ----------------------------------------------------------------------------
   Everything above the React component is pure logic. Lift `compileSuno`,
   `compileEleven`, `resolveLineage`, and the type-shape comments straight into
   serializers.ts when wiring the Next.js app. No UI dependencies in here.

   CANONICAL MusicSpec (v0.2) — the reconciled spine:
   {
     spec_version, title,
     intent:   { mode, targets[], duration_ms, instrumental },        // Output Intent
     genre:    [{ tag, weight }],                                     // D1 / Module A
     tone:     { valence, intensity, moods[], atmosphere[] },         // D2 / A·B
     dynamics: { range, bpm, feel, time_signature, energy_curve[] },  // D3 / C
     lineage:  { era, packs:[{ id, weight }] },                       // D4 / E
     instrumentation: { lead, harmony, bass, percussion, texture },   // D5 / D
                       // each slot: { instrument, articulation, register? }
     theory:   { key, mode, progression[], harmonic_rhythm, cadence },// D6 / F
     structure:[{ name, duration_ms, energy, delta[], lines[] }],     // D7 / H
     vocals:   { type, register, delivery, stacking[], language, adlibs }, // D8 / G
     production:[ str ],                                              // D9 / I
     negative: { global:[ str ], per_section:{ [name]: str[] } },     // D10
     meta:     { seed, notes }
   }
   Design rule (carried from Draft v0.1): every dimension is optional. The
   compiler fills nothing silently — unset dimensions are omitted, never faked.
============================================================================ */
