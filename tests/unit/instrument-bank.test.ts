import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import drumMachines from "@/data/taxonomy/instruments/drum-machines.json";
import gmPercussion from "@/data/taxonomy/instruments/gm-percussion.json";
import gmPrograms from "@/data/taxonomy/instruments/gm-programs.json";
import manifest from "@/data/taxonomy/instruments/manifest.json";
import world from "@/data/taxonomy/instruments/world.json";
import curated from "@/data/taxonomy/instruments.json";
import { catalog } from "@/data/taxonomy";

/**
 * The instrument bank is generated from the seed by scripts/build-instrument-bank.mjs
 * (docs/SPEC.md §3, S3). The seed is never edited, the output is deterministic, and the
 * curated records always win over a seed item that names the same instrument.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const generated = [...gmPrograms, ...gmPercussion, ...drumMachines, ...world];

describe("instrument bank", () => {
  it("is up to date with the seed (the generator's --check passes)", () => {
    const out = execFileSync(process.execPath, ["scripts/build-instrument-bank.mjs", "--check"], { cwd: root, encoding: "utf8" });
    expect(out).toContain("instrument bank matches the seed");
  });

  it("was generated from the seed as it stands", () => {
    const seed = readFileSync(`${root}docs/evawave/instrument-bank-seed-v0.1.md`);
    expect(manifest.seedSha256).toBe(createHash("sha256").update(seed).digest("hex"));
  });

  it("loads every curated and generated record into the catalog, once", () => {
    const ids = [...curated, ...generated].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(catalog.instruments)).toHaveLength(ids.length);
    expect(Object.values(manifest.counts).reduce((a, b) => a + b, 0)).toBe(generated.length);
  });

  it("keeps the curated record when the seed names the same instrument", () => {
    const curatedIds = new Set(curated.map((r) => r.id));
    expect(generated.some((r) => curatedIds.has(r.id))).toBe(false);
    expect(manifest.mergedIntoExisting).toContainEqual({ seed: "GM 117 Taiko Drum", into: "taiko", source: "curated" });
    expect(manifest.mergedIntoExisting).toContainEqual({ seed: "Egypt: Egyptian tabla (darbuka)", into: "tabla-egyptian", source: "curated" });
  });

  it("follows the seed's curation notes for General MIDI", () => {
    const programs = new Map(gmPrograms.map((r) => [r.id, r]));
    // GM 105–112 are filed in their regional sets, not as GM "Ethnic" records.
    expect(programs.has("sitar")).toBe(false);
    expect(world.some((r) => r.id === "sitar")).toBe(true);
    // GM 5/6 split into tine and reed/FM electric pianos; GM 5 is the seed's §11 example.
    expect(programs.get("electric-piano-tine")?.commonNames).toContain("Rhodes");
    expect(programs.get("electric-piano-reed-fm")?.commonNames).toEqual(["Wurlitzer", "DX EP", "Electric Piano 2 (FM/reed)"]);
    expect(programs.has("bandoneon")).toBe(true);
    expect(gmPrograms).toHaveLength(128 - 8 - 3);
  });

  it("starts every generated record unverified on every engine", () => {
    expect(generated.every((r) => r.reliability.suno === "unverified" && r.reliability.eleven === "unverified" && r.reliability.flow === "unverified")).toBe(true);
  });

  it("names the seed sections it leaves for curation", () => {
    expect(manifest.notGenerated.map((n) => n.section)).toEqual(
      expect.arrayContaining(["§4 Orchestral and symphonic", "§6 Contemporary and popular", "§7 Synthesizer archetypes"]),
    );
  });
});
