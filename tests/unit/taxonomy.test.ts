import { describe, expect, it } from "vitest";

import { buildCatalog, CatalogError, type CatalogBanks } from "@/core/musicspec/catalog";
import { ENGINE_IDS } from "@/core/musicspec/engines";
import { banks, catalog } from "@/data/taxonomy";

/**
 * The taxonomy banks are curated JSON asserted to their IR record types in
 * src/data/taxonomy/index.ts. JSON widens string unions to `string`, so these checks hold
 * every enum-valued field to the union docs/SPEC.md §2.2 defines.
 */
const RELIABILITY = ["reliable", "approximate", "unreliable", "unverified"];
const ROLES = ["lead", "stab", "sub", "bass", "pad", "arp", "texture", "rhythm", "drone", "counter", "keys", "pluck"];
const REGISTERS = ["sub", "bass", "low-mid", "mid", "high-mid", "high"];
const FEELS = ["straight", "half-time", "double-time", "swung", "shuffled"];
const KIT_PIECES = ["kick", "808", "snare", "clap", "rim", "hat-closed", "hat-open", "perc-1", "perc-2", "crash", "ride"];

function expectIn(where: string, value: unknown, allowed: readonly string[]): void {
  expect({ where, ok: typeof value === "string" && allowed.includes(value) }).toEqual({ where, ok: true });
}

function expectEngineMap(where: string, map: Record<string, unknown>, allowed?: readonly string[]): void {
  for (const [engine, value] of Object.entries(map)) {
    expectIn(`${where}.${engine} key`, engine, ENGINE_IDS);
    if (allowed) expectIn(`${where}.${engine}`, value, allowed);
  }
}

describe("taxonomy banks", () => {
  it("build into a catalog", () => {
    expect(Object.keys(catalog.instruments).length).toBe(banks.instruments.length);
    expect(catalog.lineageNames.length).toBeGreaterThan(0);
  });

  it("hold every instrument enum to the IR unions", () => {
    for (const instrument of banks.instruments) {
      const where = `instruments/${instrument.id}`;
      expectIn(`${where}.family`, instrument.family, ["string", "wind", "brass", "percussion", "keyboard", "voice", "electronic", "other"]);
      instrument.register.forEach((r) => expectIn(`${where}.register`, r, REGISTERS));
      instrument.idiomaticRoles.forEach((r) => expectIn(`${where}.idiomaticRoles`, r, ROLES));
      expectEngineMap(`${where}.aliases`, instrument.aliases);
      expectEngineMap(`${where}.reliability`, instrument.reliability, RELIABILITY);
      expect(instrument.promptPhrase.length).toBeGreaterThan(0);
    }
  });

  it("hold every technique, mode and rhythm enum to the IR unions", () => {
    for (const technique of banks.techniques) {
      const where = `techniques/${technique.id}`;
      expectIn(`${where}.class`, technique.class, ["articulation", "dynamics", "ornament", "harmony", "rhythm", "form", "texture", "production"]);
      technique.applicableTo.forEach((a) => expectIn(`${where}.applicableTo`, a, ["instrument", "section", "song"]));
      expect(typeof technique.meterRisk).toBe("boolean");
      expectEngineMap(`${where}.engineReliability`, technique.engineReliability, RELIABILITY);
    }
    for (const mode of banks.modes) {
      expectIn(`modes/${mode.id}.family`, mode.family, ["western", "maqam", "raga", "pentatonic", "synthetic"]);
      expectEngineMap(`modes/${mode.id}.reliability`, mode.reliability, RELIABILITY);
      expect(mode.intervalsCents[0]).toBe(0);
    }
    for (const rhythm of banks.rhythms) {
      expect(typeof rhythm.fourFourSafe).toBe("boolean");
      expect(rhythm.meter).toMatch(/^\d+\/\d+$/);
    }
  });

  it("hold every genre, drum pattern and synth role enum to the IR unions", () => {
    for (const genre of banks.genres) {
      genre.criteria.feel.forEach((f) => expectIn(`genres/${genre.id}.feel`, f, FEELS));
      expectIn(`genres/${genre.id}.harmonyStyle`, genre.criteria.theoryDefaults.harmonyStyle, ["drone", "chordal", "modal", "mixed"]);
      expectEngineMap(`genres/${genre.id}.engineNotes`, genre.engineNotes);
    }
    for (const pattern of banks.drumPatterns) {
      const where = `drumPatterns/${pattern.id}`;
      expectIn(`${where}.feel`, pattern.feel, ["straight", "half-time", "double-time", "swung"]);
      for (const [piece, slots] of Object.entries(pattern.grid)) {
        expectIn(`${where}.grid`, piece, KIT_PIECES);
        expect(slots.every((slot) => Number.isInteger(slot) && slot >= 0 && slot <= 15)).toBe(true);
      }
      pattern.rolls.forEach((roll) => expectIn(`${where}.rolls.piece`, roll.piece, KIT_PIECES));
    }
    for (const role of banks.synthRoles) {
      const where = `synthRoles/${role.id}`;
      const c = role.characteristics;
      expectIn(`${where}.role`, role.role, ROLES);
      c.osc.forEach((o) => expectIn(`${where}.osc`, o, ["saw", "square", "sine", "triangle", "noise", "wavetable", "fm"]));
      expectIn(`${where}.distortion`, c.distortion, ["none", "overdrive", "amp-sim", "hard-clip", "bitcrush", "saturation"]);
      expectIn(`${where}.filter`, c.filter, ["none", "lowpass", "highpass", "bandpass"]);
      expectIn(`${where}.envelope`, c.envelope, ["pluck", "stab", "sustain", "swell"]);
      expectIn(`${where}.voicing`, c.voicing, ["mono", "legato", "poly"]);
    }
  });
});

describe("buildCatalog", () => {
  const clone = (): CatalogBanks => structuredClone(banks);

  function problemsOf(mutate: (b: CatalogBanks) => void): string[] {
    const b = clone();
    mutate(b);
    try {
      buildCatalog(b);
      return [];
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogError);
      return (error as CatalogError).problems;
    }
  }

  it("rejects an id that is not kebab-case", () => {
    expect(problemsOf((b) => void (b.modes[0]!.id = "Bad_Id"))).toContainEqual(expect.stringContaining("not kebab-case"));
  });

  it("rejects an id used in two banks", () => {
    expect(problemsOf((b) => void (b.modes[0]!.id = b.instruments[0]!.id))).toContainEqual(expect.stringContaining("already used"));
  });

  it("rejects a reference that does not resolve", () => {
    expect(problemsOf((b) => void b.bundles[0]!.rhythmIds.push("no-such-rhythm"))).toContainEqual(
      expect.stringContaining("rhythms id 'no-such-rhythm' does not resolve"),
    );
  });

  it("rejects a rhythm without fourFourSafe", () => {
    expect(problemsOf((b) => void delete (b.rhythms[0] as Partial<(typeof b.rhythms)[0]>).fourFourSafe)).toContainEqual(
      expect.stringContaining("fourFourSafe must be a boolean"),
    );
  });

  it("rejects a record that names a listed artist or producer", () => {
    const invented = "Quillon Vantreese";
    const problems = problemsOf((b) => {
      b.lineageNames.push(invented);
      b.instruments[0]!.description += ` as played by ${invented}`;
    });
    expect(problems).toContainEqual(expect.stringContaining("names an artist or producer"));
  });
});
