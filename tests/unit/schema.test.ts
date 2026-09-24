import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  defaultInstrumentationDelta,
  defaultMeterLock,
  defaultOpenPocket,
  defaultOutputIntentDelta,
  defaultPatches,
  defaultReferences,
  defaultSectionCap,
  defaultStructure,
  defaultTempo,
  defaultTransition,
  defaultVocalsDelta,
} from "@/core/musicspec/ir/defaults";
import {
  BarMathSchema,
  BundleUseSchema,
  ContrastPhraseSchema,
  InstrumentationDeltaSchema,
  IRPatchSchema,
  JSON_POINTER,
  MeterLockSchema,
  NegativeSpaceSchema,
  OpenPocketSchema,
  OutputIntentDeltaSchema,
  PatchOpSchema,
  PickupBarSchema,
  ProvenanceSchema,
  ReferenceSchema,
  SectionCapSchema,
  SectionSchema,
  SectionScopeSchema,
  SilenceDropSchema,
  StructureSchema,
  SynthRolePositionSchema,
  SynthRoleUseSchema,
  TempoSchema,
  TransitionSchema,
  VocalsDeltaSchema,
  weightedSchema,
} from "@/core/musicspec/ir/schema";
import type {
  BarMath,
  BundleUse,
  ContrastPhrase,
  InstrumentationDelta,
  IRPatch,
  MeterLock,
  NegativeSpace,
  OpenPocket,
  OutputIntentDelta,
  PatchOp,
  PickupBar,
  Provenance,
  Reference,
  Section,
  SectionCap,
  SectionScope,
  SilenceDrop,
  Structure,
  SynthRolePosition,
  SynthRoleUse,
  Tempo,
  Transition,
  VocalsDelta,
  Weighted,
} from "@/core/musicspec/ir/types";

import hookB from "../fixtures/ir-v0.3/hook-b-section.json";

/** IR v0.3 delta §5's own intake-patch shape, with the §2 example path. */
const examplePatch: IRPatch = {
  id: "patch-1",
  source: "text",
  createdAt: "2026-09-24T12:00:00Z",
  model: "intake-model",
  ops: [{ op: "set", path: "/D6/tempo/bpm", value: 140, confidence: 0.8, rationale: "The brief says 140 BPM." }],
  status: "proposed",
  acceptedPaths: [],
  rejectedPaths: [],
};

describe("IR v0.3 schemas: accept the spec's own examples", () => {
  it("parses the delta §9 Hook B section unchanged", () => {
    expect(SectionSchema.parse(hookB)).toEqual(hookB);
  });

  it("parses every default under its schema", () => {
    expect(TempoSchema.parse(defaultTempo())).toEqual(defaultTempo());
    expect(MeterLockSchema.parse(defaultMeterLock())).toEqual(defaultMeterLock());
    expect(StructureSchema.parse(defaultStructure())).toEqual(defaultStructure());
    expect(SectionCapSchema.parse(defaultSectionCap())).toEqual(defaultSectionCap());
    expect(InstrumentationDeltaSchema.parse(defaultInstrumentationDelta())).toEqual(defaultInstrumentationDelta());
    expect(VocalsDeltaSchema.parse(defaultVocalsDelta())).toEqual(defaultVocalsDelta());
    expect(OutputIntentDeltaSchema.parse(defaultOutputIntentDelta())).toEqual(defaultOutputIntentDelta());
    expect(z.array(ReferenceSchema).parse(defaultReferences())).toEqual([]);
    expect(z.array(IRPatchSchema).parse(defaultPatches())).toEqual([]);
    expect(OpenPocketSchema.parse(defaultOpenPocket())).toEqual(defaultOpenPocket());
    expect(TransitionSchema.parse(defaultTransition())).toEqual(defaultTransition());
  });

  it("parses an intake patch", () => {
    expect(IRPatchSchema.parse(examplePatch)).toEqual(examplePatch);
  });

  it("parses a structure with derived bar math", () => {
    const structure: Structure = {
      sections: [SectionSchema.parse(hookB)],
      blockSize: 8,
      runtimeTargetSec: 180,
      derived: { barSec: 1.714, block8Sec: 13.714, block16Sec: 27.429, runtimeSec: 16.286, sectionStarts: [{ sectionId: "hook-b", bar: 0, sec: 0 }] },
    };
    expect(StructureSchema.parse(structure)).toEqual(structure);
  });

  it("wraps any value type as Weighted<T>", () => {
    const schema = weightedSchema(z.string());
    expect(schema.parse({ value: "oud", weight: 0.5 })).toEqual({ value: "oud", weight: 0.5 });
    expect(schema.safeParse({ value: "oud", weight: 1.5 }).success).toBe(false);
    expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<Weighted<string>>();
  });
});

describe("IR v0.3 schemas: reject out-of-range values and unknown keys", () => {
  const cases: [string, z.ZodType, unknown][] = [
    ["Tempo bpm 0", TempoSchema, { ...defaultTempo(), bpm: 0 }],
    ["Tempo bpm fractional", TempoSchema, { ...defaultTempo(), bpm: 120.5 }],
    ["Tempo bpm negative", TempoSchema, { ...defaultTempo(), bpm: -3 }],
    ["Tempo unknown key", TempoSchema, { ...defaultTempo(), swing: true }],
    ["Tempo bad source", TempoSchema, { ...defaultTempo(), source: "guess" }],
    ["MeterLock bad signature", MeterLockSchema, { ...defaultMeterLock(), signature: "9/8" }],
    ["MeterLock subdivision 12", MeterLockSchema, { ...defaultMeterLock(), subdivision: 12 }],
    ["MeterLock unknown extension", MeterLockSchema, { ...defaultMeterLock(), allowedExtensions: ["tempo-change"] }],
    ["PickupBar 4 beats", PickupBarSchema, { beats: 4, content: "roll", returnTo: "4/4" }],
    ["PickupBar 0 beats", PickupBarSchema, { beats: 0, content: "roll", returnTo: "4/4" }],
    ["SilenceDrop 9 beats", SilenceDropSchema, { beats: 9, position: "end" }],
    ["SilenceDrop 0 beats", SilenceDropSchema, { beats: 0, position: "end" }],
    ["ContrastPhrase 0 bars", ContrastPhraseSchema, { styleId: "drill-contrast", bars: 0, position: "end", changes: [], returnRule: "back" }],
    ["Transition bad kind", TransitionSchema, { kind: "explosion" }],
    ["Section 0 bars", SectionSchema, { ...hookB, bars: 0 }],
    ["Section bad dynamics", SectionSchema, { ...hookB, dynamics: "fff" }],
    ["Section unknown key", SectionSchema, { ...hookB, lyrics: "never" }],
    ["Structure blockSize 4", StructureSchema, { sections: [], blockSize: 4 }],
    ["SectionCap blockAt below warnAt", SectionCapSchema, { warnAt: 8, blockAt: 6 }],
    ["SynthRolePosition 0-based beat", SynthRolePositionSchema, { sectionIds: [], phrases: [], beats: [0] }],
    ["Reference weight 1.5", ReferenceSchema, { id: "r", kind: "audio", roles: ["style"], weight: 1.5, provenance: { kind: "hand-built" } }],
    ["Reference bad role", ReferenceSchema, { id: "r", kind: "audio", roles: ["lyrics"], weight: 1, provenance: { kind: "hand-built" } }],
    ["OutputIntent bad target", OutputIntentDeltaSchema, { ...defaultOutputIntentDelta(), targets: ["spotify"] }],
    ["OutputIntent negative budget", OutputIntentDeltaSchema, { ...defaultOutputIntentDelta(), houseBudgets: { "suno.style": -1 } }],
    ["PatchOp confidence -1", PatchOpSchema, { op: "set", path: "/D6/tempo/bpm", value: 1, confidence: -1, rationale: "" }],
    ["PatchOp bad op", PatchOpSchema, { op: "replace", path: "/D6/tempo/bpm", value: 1, confidence: 1, rationale: "" }],
    ["PatchOp path without slash", PatchOpSchema, { op: "set", path: "D6", value: 1, confidence: 1, rationale: "" }],
    ["PatchOp whole-document path", PatchOpSchema, { op: "set", path: "", value: 1, confidence: 1, rationale: "" }],
    ["PatchOp bad escape", PatchOpSchema, { op: "set", path: "/a~2", value: 1, confidence: 1, rationale: "" }],
    ["IRPatch bad status", IRPatchSchema, { ...examplePatch, status: "maybe" }],
    ["IRPatch bad source", IRPatchSchema, { ...examplePatch, source: "midi" }],
  ];

  it.each(cases)("%s", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("keeps semantic rules for the linter: an empty returnRule (CP-1) still parses", () => {
    expect(ContrastPhraseSchema.safeParse({ styleId: "drill-contrast", bars: 4, position: "end", changes: [], returnRule: "" }).success).toBe(true);
  });
});

describe("JSON_POINTER", () => {
  it.each(["/D6/tempo/bpm", "/a~1b", "/a~0b", "/0", "/", "/D7/sections/-"])("accepts %j", (path) => {
    expect(JSON_POINTER.test(path)).toBe(true);
  });

  it.each(["", "D6", "/a~2", "/a~", "a/b"])("rejects %j", (path) => {
    expect(JSON_POINTER.test(path)).toBe(false);
  });
});

describe("IR v0.3 schemas: inferred types equal the declared types", () => {
  it("holds for every schema (checked by tsc)", () => {
    expectTypeOf<z.infer<typeof TempoSchema>>().toEqualTypeOf<Tempo>();
    expectTypeOf<z.infer<typeof MeterLockSchema>>().toEqualTypeOf<MeterLock>();
    expectTypeOf<z.infer<typeof PickupBarSchema>>().toEqualTypeOf<PickupBar>();
    expectTypeOf<z.infer<typeof SilenceDropSchema>>().toEqualTypeOf<SilenceDrop>();
    expectTypeOf<z.infer<typeof ContrastPhraseSchema>>().toEqualTypeOf<ContrastPhrase>();
    expectTypeOf<z.infer<typeof TransitionSchema>>().toEqualTypeOf<Transition>();
    expectTypeOf<z.infer<typeof SectionScopeSchema>>().toEqualTypeOf<SectionScope>();
    expectTypeOf<z.infer<typeof OpenPocketSchema>>().toEqualTypeOf<OpenPocket>();
    expectTypeOf<z.infer<typeof SectionSchema>>().toEqualTypeOf<Section>();
    expectTypeOf<z.infer<typeof BarMathSchema>>().toEqualTypeOf<BarMath>();
    expectTypeOf<z.infer<typeof StructureSchema>>().toEqualTypeOf<Structure>();
    expectTypeOf<z.infer<typeof BundleUseSchema>>().toEqualTypeOf<BundleUse>();
    expectTypeOf<z.infer<typeof SynthRolePositionSchema>>().toEqualTypeOf<SynthRolePosition>();
    expectTypeOf<z.infer<typeof SynthRoleUseSchema>>().toEqualTypeOf<SynthRoleUse>();
    expectTypeOf<z.infer<typeof SectionCapSchema>>().toEqualTypeOf<SectionCap>();
    expectTypeOf<z.infer<typeof InstrumentationDeltaSchema>>().toEqualTypeOf<InstrumentationDelta>();
    expectTypeOf<z.infer<typeof VocalsDeltaSchema>>().toEqualTypeOf<VocalsDelta>();
    expectTypeOf<z.infer<typeof NegativeSpaceSchema>>().toEqualTypeOf<NegativeSpace>();
    expectTypeOf<z.infer<typeof OutputIntentDeltaSchema>>().toEqualTypeOf<OutputIntentDelta>();
    expectTypeOf<z.infer<typeof ProvenanceSchema>>().toEqualTypeOf<Provenance>();
    expectTypeOf<z.infer<typeof ReferenceSchema>>().toEqualTypeOf<Reference>();
    expectTypeOf<z.infer<typeof PatchOpSchema>>().toEqualTypeOf<PatchOp>();
    expectTypeOf<z.infer<typeof IRPatchSchema>>().toEqualTypeOf<IRPatch>();
  });
});
