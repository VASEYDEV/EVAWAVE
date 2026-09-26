import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getProfile } from "@/core/musicspec/engines";
import type { Catalog, CompiledPayload, ElevenCompositionPlan, EngineProfile, LintResult, LintRuleId, MusicSpec, TargetOverride } from "@/core/musicspec/ir/types";
import { lint } from "@/core/musicspec/lint";
import { compile, compileSuno } from "@/core/musicspec/serialize";
import { catalog } from "@/data/taxonomy";

/** The S2 lint rules (CV-1, CV-2, OV-1) and the S2 extensions of BG-1, BG-2 and LN-1. */
const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;
const INVENTED = "Quillon Vantreese";

function payloadFor(spec: MusicSpec, engine: string, cat: Catalog = catalog): CompiledPayload {
  const result = compile(spec, engine, cat);
  if (!result.ok) throw new Error(result.error.message);
  return result.payload;
}

const only = (results: LintResult[], id: LintRuleId) => results.filter((r) => r.ruleId === id);

function override(engine: TargetOverride["engine"], basedOnCompiledHash: string, text = "hand-edited field"): TargetOverride {
  return { engine, fieldId: "style", text, basedOnCompiledHash, createdAt: "2026-09-26T00:00:00Z" };
}

describe("CV-1", () => {
  it("warns when the active target's coverage is under 80%", () => {
    const spec = structuredClone(v12);
    spec.D10.activeTarget = "flow";
    const payload = payloadFor(spec, "flow");
    expect(payload.coverage.score).toBeLessThan(0.8);
    expect(only(lint(spec, getProfile("flow"), catalog, payload), "CV-1")).toEqual([
      expect.objectContaining({ severity: "warn", path: "flow.coverage", message: expect.stringContaining("under 80%") }),
    ]);
  });

  it("stays quiet for a target that is not active", () => {
    expect(only(lint(v12, getProfile("flow"), catalog, payloadFor(v12, "flow")), "CV-1")).toEqual([]);
  });

  it("stays quiet at or above 80%", () => {
    const spec = structuredClone(v12);
    spec.D10.activeTarget = "eleven";
    const payload = payloadFor(spec, "eleven");
    expect(payload.coverage.score).toBeGreaterThanOrEqual(0.8);
    expect(only(lint(spec, getProfile("eleven"), catalog, payload), "CV-1")).toEqual([]);
  });
});

describe("CV-2", () => {
  const noStructure: EngineProfile = { ...getProfile("suno"), supports: { ...getProfile("suno").supports, D7: "none" } };

  it("blocks each dropped D7 item until it is acknowledged", () => {
    const payload = compileSuno(v12, noStructure, catalog);
    const blocked = only(lint(v12, noStructure, catalog, payload), "CV-2");
    expect(blocked.map((r) => r.path)).toContain("/D7/sections/4/contrast");
    expect(blocked.every((r) => r.severity === "block")).toBe(true);
    const acknowledged = structuredClone(v12);
    acknowledged.D10.acknowledgedDrops = ["suno:/D7/sections/4/contrast"];
    const after = only(lint(acknowledged, noStructure, catalog, payload), "CV-2").map((r) => r.path);
    expect(after).not.toContain("/D7/sections/4/contrast");
    expect(after).toHaveLength(blocked.length - 1);
  });

  it("ignores dropped items outside D6 and D7", () => {
    expect(only(lint(v12, getProfile("eleven"), catalog, payloadFor(v12, "eleven")), "CV-2")).toEqual([]);
  });
});

describe("OV-1", () => {
  it("warns for an override written against an older compile of the same engine", () => {
    const payload = payloadFor(v12, "suno");
    const overrides = [override("suno", payload.hash), override("suno", "00000000000000"), override("flow", "00000000000000")];
    expect(only(lint(v12, getProfile("suno"), catalog, payload, { overrides }), "OV-1")).toEqual([
      expect.objectContaining({ severity: "warn", path: "overrides/1" }),
    ]);
  });
});

describe("S2 extensions", () => {
  const withName: Catalog = { ...catalog, lineageNames: [...catalog.lineageNames, INVENTED] };

  it("LN-1 blocks a listed name in passthrough lyrics, which the compile removes", () => {
    const spec = structuredClone(v12);
    spec.D8.instrumental = false;
    spec.D8.lyricsPassthrough = `[Verse]\nA LINE FOR ${INVENTED}`;
    const payload = payloadFor(spec, "flow", withName);
    expect(String(payload.fields.lyrics)).toBe("[Verse]\nA LINE FOR");
    expect(only(lint(spec, getProfile("flow"), withName, payload), "LN-1")).toEqual([expect.objectContaining({ severity: "block", path: "/D8/lyricsPassthrough" })]);
  });

  it("LN-1 blocks a listed name in a target override", () => {
    const payload = payloadFor(v12, "suno", withName);
    const overrides = [override("suno", payload.hash, `bounce like ${INVENTED}`)];
    expect(only(lint(v12, getProfile("suno"), withName, payload, { overrides }), "LN-1")).toEqual([expect.objectContaining({ path: "overrides/0" })]);
  });

  it("BG-1 blocks an Eleven plan over 30 chunks", () => {
    const spec = structuredClone(v12);
    const base = spec.D7.sections[0]!;
    spec.D7.sections = Array.from({ length: 31 }, (_, i) => ({ ...structuredClone(base), id: `s${i}`, bars: 2 }));
    const payload = payloadFor(spec, "eleven");
    expect((payload.fields.composition_plan as ElevenCompositionPlan).chunks).toHaveLength(31);
    expect(only(lint(spec, getProfile("eleven"), catalog, payload), "BG-1")).toContainEqual(
      expect.objectContaining({ severity: "block", path: "eleven.composition_plan", message: "31 chunks, over the 30-chunk limit" }),
    );
  });

  it("BG-2 warns for a chunk over the styles-per-chunk house budget", () => {
    const spec = structuredClone(v12);
    spec.D10.houseBudgets = { "eleven.styles_per_chunk": 10 };
    const results = only(lint(spec, getProfile("eleven"), catalog, payloadFor(spec, "eleven")), "BG-2");
    expect(results.map((r) => r.path)).toEqual(["eleven.styles_per_chunk/0", "eleven.styles_per_chunk/7"]);
  });
});
