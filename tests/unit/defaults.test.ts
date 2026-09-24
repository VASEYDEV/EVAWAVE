import { describe, expect, it } from "vitest";

import {
  DEFAULT_BLOCK_SIZE,
  DEFAULT_TRANSITION_BARS,
  DEFAULT_WEIGHT,
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

/** The IR v0.3 delta §7 attachment map, transcribed literally so a drift in defaults.ts is a diff here. */
describe("IR v0.3 defaults match the delta §7 attachment map", () => {
  it("Tempo → D6", () => {
    expect(defaultTempo()).toEqual({ bpm: 120, source: "manual" });
  });

  it("MeterLock → D6", () => {
    expect(defaultMeterLock()).toEqual({
      enabled: false,
      signature: "4/4",
      feel: "straight",
      subdivision: 16,
      driftSuppression: true,
      allowedExtensions: [],
      restatement: "style-and-sections",
    });
  });

  it("Structure → D7", () => {
    expect(defaultStructure()).toEqual({ sections: [], blockSize: 8 });
    expect(DEFAULT_BLOCK_SIZE).toBe(8);
  });

  it("InstrumentationDelta → D5", () => {
    expect(defaultInstrumentationDelta()).toEqual({ bundles: [], synthRoles: [], sectionCap: { warnAt: 6, blockAt: 8 } });
    expect(defaultSectionCap()).toEqual({ warnAt: 6, blockAt: 8 });
  });

  it("VocalsDelta → D8", () => {
    expect(defaultVocalsDelta()).toEqual({ instrumental: false });
  });

  it("OutputIntentDelta → D10", () => {
    expect(defaultOutputIntentDelta()).toEqual({ targets: ["suno"], activeTarget: "suno", houseBudgets: {}, negativeSpace: [] });
  });

  it("references and patches → MusicSpec root", () => {
    expect(defaultReferences()).toEqual([]);
    expect(defaultPatches()).toEqual([]);
  });

  it("per-field defaults from the delta's type comments", () => {
    expect(defaultOpenPocket()).toEqual({ kind: "none" });
    expect(defaultTransition()).toEqual({ kind: "none" });
    expect(DEFAULT_TRANSITION_BARS).toBe(2);
    expect(DEFAULT_WEIGHT).toBe(1);
  });
});

describe("IR v0.3 defaults are fresh objects", () => {
  it("never share mutable state between calls", () => {
    const first = defaultMeterLock();
    const second = defaultMeterLock();
    expect(first).not.toBe(second);
    first.allowedExtensions.push("pickup-bar");
    expect(second.allowedExtensions).toEqual([]);

    const delta = defaultInstrumentationDelta();
    delta.sectionCap.warnAt = 3;
    expect(defaultInstrumentationDelta().sectionCap.warnAt).toBe(6);

    const intent = defaultOutputIntentDelta();
    intent.targets.push("flow");
    expect(defaultOutputIntentDelta().targets).toEqual(["suno"]);
  });
});
