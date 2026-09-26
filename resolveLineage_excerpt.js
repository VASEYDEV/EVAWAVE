/* --- Lineage Packs -------------------------------------------------------- */
/* The moat. Names map to weighted trait descriptors; names never leave the
   client. Two seed packs so trait injection is real and inspectable. */
const LINEAGE_PACKS = {
  "zimmer.hybrid_score": {
    display: "Hybrid Cinematic Score",
    traits: {
      production: ["cinematic wide mix", "long reverb tails", "hybrid orchestral textures"],
      instrumentation: ["low brass swells", "ostinato string pulse"],
      tone: ["epic", "foreboding"],
    },
  },
  "metro.dark_trap": {
    display: "Dark Modern Trap",
    traits: {
      production: ["sub-heavy low end", "tape saturation on drums"],
      instrumentation: ["808 with pitch glides", "triplet trap hats"],
      tone: ["menacing"],
    },
  },
};

function resolveLineage(spec) {
  // Returns descriptor arrays injected by packs, de-duplicated against nothing
  // here (the UI owns user-set values; this stays pure & additive).
  const out = { production: [], instrumentation: [], tone: [] };
  (spec.lineage?.packs || []).forEach(({ id }) => {
    const pack = LINEAGE_PACKS[id];
    if (!pack) return;
    Object.entries(pack.traits).forEach(([dim, arr]) => {
      arr.forEach((t) => { if (!out[dim].includes(t)) out[dim].push(t); });
    });
  });
  return out;
}
