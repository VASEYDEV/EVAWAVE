import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getProfile } from "@/core/musicspec/engines";
import type { Catalog, EngineProfile, LintResult, LintRuleId, MusicSpec, Section } from "@/core/musicspec/ir/types";
import { lint, RULES } from "@/core/musicspec/lint";
import { compileSuno } from "@/core/musicspec/serialize/suno";
import { catalog } from "@/data/taxonomy";

/**
 * One case per S1 lint rule (docs/SPEC.md §2.7), each a small edit to the Jinn v1.2 spec,
 * which lints clean of blocks. Names seeded for LN-1 are invented, never real.
 */
const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;
const suno = getProfile("suno");
const INVENTED_PRODUCER = "Quillon Vantreese";

function edited(edit: (spec: MusicSpec) => void): MusicSpec {
  const spec = structuredClone(v12);
  edit(spec);
  return spec;
}

function section(spec: MusicSpec, id: string): Section {
  const found = spec.D7.sections.find((s) => s.id === id);
  if (!found) throw new Error(`no section ${id}`);
  return found;
}

function run(spec: MusicSpec, options: { profile?: EngineProfile; catalog?: Catalog } = {}): LintResult[] {
  const profile = options.profile ?? suno;
  const cat = options.catalog ?? catalog;
  return lint(spec, profile, cat, compileSuno(spec, profile, cat));
}

const only = (results: LintResult[], ruleId: LintRuleId) => results.filter((r) => r.ruleId === ruleId);

describe("lint", () => {
  it("registers every S1 and S2 rule once, in id order", () => {
    const ids = RULES.map((rule) => rule.id);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toEqual([
      "BG-1", "BG-2", "BT-1", "CP-1", "CP-2", "CP-3", "CV-1", "CV-2", "LN-1", "ML-1", "ML-2",
      "ML-3", "ML-4", "OV-1", "PB-1", "PB-2", "RB-1", "RB-2", "RB-3", "SC-1", "SC-2", "TQ-1",
    ]);
  });

  it("returns results sorted by rule id, then path", () => {
    const results = run(v12);
    const keys = results.map((r) => `${r.ruleId} ${r.path}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });

  it("skips every meter rule while the lock is off", () => {
    const spec = edited((s) => {
      s.D6.meterLock.enabled = false;
      s.D6.meterLock.feel = "shuffled";
      section(s, "intro").cues.push({ slot: "lead", text: "rubato nay" });
    });
    const meterRules = run(spec).filter((r) => ["ML-1", "ML-2", "ML-3", "ML-4", "PB-1", "PB-2", "CP-3", "TQ-1"].includes(r.ruleId));
    expect(meterRules).toEqual([]);
  });
});

describe("ML rules", () => {
  it("ML-1 blocks a drift word under drift suppression and warns without it", () => {
    const spec = edited((s) => section(s, "intro").cues.push({ slot: "lead", text: "swung nay phrases" }));
    expect(only(run(spec), "ML-1")).toEqual([
      expect.objectContaining({ severity: "block", path: "/D7/sections/0/cues/5/text", message: expect.stringContaining('"swung"') }),
    ]);
    spec.D6.meterLock.driftSuppression = false;
    expect(only(run(spec), "ML-1").map((r) => r.severity)).toEqual(["warn"]);
  });

  it("ML-1 ignores drift words in the negative space, where they belong", () => {
    expect(only(run(v12), "ML-1")).toEqual([]);
  });

  it("ML-2 blocks a 2/4 rhythm under a 4/4 lock", () => {
    const spec = edited((s) => section(s, "verse").scope.percussionRhythmIds.push("zar-ayyub"));
    expect(only(run(spec), "ML-2")).toEqual([expect.objectContaining({ severity: "block", path: "/D7/sections/3/scope/percussionRhythmIds/0" })]);
  });

  it("ML-3 blocks a swung or shuffled feel under the lock", () => {
    const spec = edited((s) => void (s.D6.meterLock.feel = "swung"));
    expect(only(run(spec), "ML-3")).toEqual([expect.objectContaining({ severity: "block", path: "/D6/meterLock/feel" })]);
  });

  it("ML-4 proposes the engine's drift words when the meter-drift class is missing", () => {
    const spec = edited((s) => void (s.D10.negativeSpace = s.D10.negativeSpace.filter((n) => n.class !== "meter-drift")));
    const [ml4] = only(run(spec), "ML-4");
    expect(ml4?.fix).toEqual([
      expect.objectContaining({ op: "append", path: "/D10/negativeSpace", value: { class: "meter-drift", terms: suno.driftWords, auto: true } }),
    ]);
  });
});

describe("PB and CP rules", () => {
  it("PB-1 blocks a pickup that returns to another signature", () => {
    const spec = edited((s) => {
      const pickup = section(s, "hook-b").pickupBefore;
      if (pickup) pickup.returnTo = "3/4";
    });
    expect(only(run(spec), "PB-1")).toEqual([expect.objectContaining({ severity: "block", path: "/D7/sections/4/pickupBefore/returnTo" })]);
  });

  it("PB-2 warns for each extension the lock does not allow", () => {
    const spec = edited((s) => void (s.D6.meterLock.allowedExtensions = []));
    expect(only(run(spec), "PB-2").map((r) => r.path)).toEqual([
      "/D7/sections/2/pickupBefore",
      "/D7/sections/4/contrast",
      "/D7/sections/4/pickupBefore",
      "/D7/sections/4/silenceAfter",
    ]);
  });

  it("CP-1 blocks an empty return rule", () => {
    const spec = edited((s) => {
      const contrast = section(s, "hook-b").contrast;
      if (contrast) contrast.returnRule = "  ";
    });
    expect(only(run(spec), "CP-1")).toEqual([expect.objectContaining({ severity: "block", path: "/D7/sections/4/contrast/returnRule" })]);
  });

  it("CP-2 warns when the contrast is over a quarter of its section", () => {
    expect(only(run(v12), "CP-2")).toEqual([expect.objectContaining({ severity: "warn", path: "/D7/sections/4/contrast/bars" })]);
  });

  it("CP-3 blocks a contrast style with no meter in common with the lock", () => {
    const drill = catalog.genres.drill;
    if (!drill) throw new Error("drill genre missing");
    const compound: Catalog = { ...catalog, genres: { ...catalog.genres, drill: { ...drill, criteria: { ...drill.criteria, meters: ["6/8"] } } } };
    expect(only(run(v12, { catalog: compound }), "CP-3")).toEqual([expect.objectContaining({ severity: "block", path: "/D7/sections/4/contrast/styleId" })]);
  });
});

describe("SC, RB and TQ rules", () => {
  it("SC-1 blocks a nine-instrument section", () => {
    const spec = edited((s) => {
      section(s, "verse").scope.instrumentIds = ["trap-kit", "doholla", "mazhar", "rababa", "kawala", "oud", "qanun", "nay", "riq"];
    });
    expect(only(run(spec), "SC-1")).toContainEqual(expect.objectContaining({ severity: "block", path: "/D7/sections/3/scope", message: expect.stringContaining("9 named") }));
  });

  it("SC-1 counts an instrument listed twice once", () => {
    const spec = edited((s) => void (section(s, "outro").scope.instrumentIds = ["nay", "nay", "oud", "oud", "nay", "oud"]));
    expect(only(run(spec), "SC-1").filter((r) => r.path === "/D7/sections/7/scope")).toEqual([]);
  });

  it("SC-2 warns when a positioned synth role is missing from the section scope", () => {
    const spec = edited((s) => void (section(s, "hook-a").scope.synthRoleIds = []));
    expect(only(run(spec), "SC-2")).toEqual([expect.objectContaining({ severity: "warn", path: "/D5/synthRoles/0/position/sectionIds/0" })]);
  });

  it("RB-1 warns when two bundles mix without a crossBundle flag", () => {
    const spec = edited((s) => s.D5.bundles.push({ bundleId: "second-bundle", anchorInstrumentId: "oud", rhythmIds: [] }));
    expect(only(run(spec), "RB-1")).toEqual([expect.objectContaining({ severity: "warn", path: "/D5/bundles/1" })]);
  });

  it("RB-2 warns for a section mode outside the bundle", () => {
    const spec = edited((s) => void (section(s, "bridge").modeId = "dorian"));
    expect(only(run(spec), "RB-2")).toEqual([expect.objectContaining({ severity: "warn", path: "/D7/sections/5/modeId" })]);
  });

  it("RB-3 names the nearest reliable mode as a substitute", () => {
    expect(only(run(v12), "RB-3").map((r) => r.message)).toEqual([
      'mode "Saba" is approximate on Suno; nearest reliable: Nahawand',
      'mode "Saba" is approximate on Suno; nearest reliable: Nahawand',
    ]);
  });

  it("TQ-1 warns for a meter-risk technique under the lock", () => {
    const spec = edited((s) => section(s, "intro").scope.techniqueIds.push("taqsim"));
    expect(only(run(spec), "TQ-1")).toEqual([expect.objectContaining({ severity: "warn", path: "catalog:techniques/taqsim" })]);
  });
});

describe("LN, BG and BT rules", () => {
  const withName: Catalog = { ...catalog, lineageNames: [...catalog.lineageNames, INVENTED_PRODUCER] };

  it("LN-1 blocks an invented producer name seeded in a cue, and the payload never carries it", () => {
    const spec = edited((s) => section(s, "hook-a").cues.push({ slot: "synth", text: `${INVENTED_PRODUCER} style saw lead` }));
    const results = only(run(spec, { catalog: withName }), "LN-1");
    expect(results).toEqual([expect.objectContaining({ severity: "block", path: "/D7/sections/2/cues/8/text" })]);
    const payload = compileSuno(spec, suno, withName);
    expect(Object.values(payload.fields).join("\n")).not.toMatch(/quillon|vantreese/i);
  });

  it("LN-1 blocks a name in a patch value", () => {
    const spec = edited((s) =>
      s.patches.push({
        id: "p1",
        source: "text",
        createdAt: "2026-09-26T00:00:00Z",
        status: "proposed",
        acceptedPaths: [],
        rejectedPaths: [],
        ops: [{ op: "set", path: "/D2/imagery/0", value: `a ${INVENTED_PRODUCER} night`, confidence: 0.9, rationale: "from intake" }],
      }),
    );
    expect(only(run(spec, { catalog: withName }), "LN-1")).toEqual([expect.objectContaining({ severity: "block", path: "/patches/0/ops/0/value" })]);
  });

  it("BG-1 blocks a Style over 1,000 characters", () => {
    const spec = edited((s) => s.D5.textures.push({ value: "wide cinematic ambience ".repeat(4).trim(), weight: 1 }));
    const style = compileSuno(spec, suno, catalog).fields.style as string;
    expect([...style].length).toBeGreaterThan(1000);
    expect(only(run(spec), "BG-1")).toEqual([expect.objectContaining({ severity: "block", path: "suno.style", message: expect.stringContaining("over the 1000 limit") })]);
  });

  it("BG-2 warns over a house budget", () => {
    const spec = edited((s) => void (s.D10.houseBudgets = { "suno.total": 2000 }));
    expect(only(run(spec), "BG-2")).toEqual([expect.objectContaining({ severity: "warn", path: "suno.total", message: "2779 characters, over the house budget of 2000" })]);
  });

  it("BT-1 warns for an engine banned term in the payload", () => {
    const strict: EngineProfile = { ...suno, bannedTerms: ["timpani"] };
    expect(only(run(v12, { profile: strict }), "BT-1")).toEqual([expect.objectContaining({ severity: "warn", path: "suno.lyrics", message: 'banned term "timpani"' })]);
  });
});
