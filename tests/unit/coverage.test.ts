import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { coverageReport, coverageTargets } from "@/core/musicspec/coverage";
import { getProfile } from "@/core/musicspec/engines";
import type { EngineProfile, MusicSpec } from "@/core/musicspec/ir/types";

/** Path-level coverage (docs/SPEC.md A5, §2.6). */
const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;

describe("coverage", () => {
  it("never lists blueprint-only content (notes, harmony) or references", () => {
    const spec = structuredClone(v12);
    spec.D7.sections[0]!.notes = ["a word-MIDI note"];
    const paths = coverageTargets(spec).map((t) => t.path);
    expect(paths.some((p) => /notes|harmony|references/.test(p))).toBe(false);
  });

  it("scores expressed items over all items", () => {
    const report = coverageReport(v12, getProfile("suno"));
    const expressed = report.items.filter((i) => i.state === "expressed").length;
    expect(report.score).toBeCloseTo(expressed / report.items.length, 12);
  });

  it("renders each primitive per engine: the contrast is expressed on Suno and Eleven and approximated on Flow", () => {
    const state = (engine: "suno" | "eleven" | "flow") =>
      coverageReport(v12, getProfile(engine)).items.find((i) => i.path === "/D7/sections/4/contrast")?.state;
    expect([state("suno"), state("eleven"), state("flow")]).toEqual(["expressed", "expressed", "approximated"]);
  });

  it("drops every item of a dimension the profile does not support", () => {
    const noStructure: EngineProfile = { ...getProfile("suno"), supports: { ...getProfile("suno").supports, D7: "none" } };
    const d7 = coverageReport(v12, noStructure).items.filter((i) => i.dimension === "D7");
    expect(d7.length).toBeGreaterThan(0);
    expect(d7.every((i) => i.state === "dropped" && i.reason === "unsupported-dimension")).toBe(true);
  });

  it("reports techniques as dropped until a serializer renders them", () => {
    const spec = structuredClone(v12);
    spec.D3.techniques.push({ techniqueId: "slide", target: { kind: "song" } });
    const item = coverageReport(spec, getProfile("suno")).items.find((i) => i.path === "/D3/techniques/0");
    expect(item).toEqual(expect.objectContaining({ state: "dropped", reason: "no-field" }));
  });

  it("applies path overrides", () => {
    const report = coverageReport(v12, getProfile("suno"), { "/D1": { state: "dropped", reason: "engine-filter" } });
    expect(report.items.find((i) => i.path === "/D1")).toEqual({ path: "/D1", dimension: "D1", state: "dropped", reason: "engine-filter" });
  });
});
