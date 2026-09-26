import { describe, expect, it } from "vitest";

import { barSec, barsToMs, barsToSec, beatsPerBar, beatsToSec, computeBarMath, sectionSpan } from "@/core/musicspec/barmath";
import { defaultSection } from "@/core/musicspec/ir/defaults";
import type { Signature } from "@/core/musicspec/ir/types";

/** Vectors from docs/SPEC.md §2.5 and the Jinn v1.1 blueprint's bar math line. */
describe("bar math", () => {
  it("gives 1.690 s per bar, 13.52 s per 8 bars and 27.04 s per 16 at 142 BPM", () => {
    expect(barSec(142)).toBeCloseTo(1.690, 3);
    expect(barsToSec(8, 142)).toBeCloseTo(13.52, 2);
    expect(barsToSec(16, 142)).toBeCloseTo(27.04, 2);
  });

  it("gives 1.714 s per bar at 140 BPM and 6,857 ms for 4 bars", () => {
    expect(barSec(140)).toBeCloseTo(1.714, 3);
    expect(barsToMs(4, 140)).toBe(6857);
  });

  it.each<[Signature, number]>([
    ["4/4", 4],
    ["3/4", 3],
    ["6/8", 6],
    ["12/8", 12],
    ["5/4", 5],
    ["7/8", 7],
  ])("counts %s as %i beats per bar", (signature, beats) => {
    expect(beatsPerBar(signature)).toBe(beats);
    expect(barSec(60, signature)).toBe(beats);
  });

  it("counts a pickup and a silence drop toward the section span", () => {
    const hookB = { ...defaultSection("hook-b", "hook", "Hook B"), pickupBefore: { beats: 2 as const, content: "roll", returnTo: "4/4" as const }, silenceAfter: { beats: 1, position: "end" as const } };
    const span = sectionSpan(hookB, 140);
    expect(span.bars).toBeCloseTo(8.75, 10);
    expect(span.pickupSec).toBeCloseTo(beatsToSec(2, 140), 10);
    expect(span.silenceSec).toBeCloseTo(beatsToSec(1, 140), 10);
    expect(span.totalSec).toBeCloseTo(8.75 * barSec(140), 10);
  });

  it("starts each section where the previous one ends, pickup first", () => {
    const sections = [
      { ...defaultSection("a", "intro", "A"), bars: 16 },
      { ...defaultSection("b", "hook", "B"), pickupBefore: { beats: 2 as const, content: "roll", returnTo: "4/4" as const } },
      { ...defaultSection("c", "outro", "C"), silenceAfter: { beats: 4, position: "end" as const } },
    ];
    const math = computeBarMath({ bpm: 142 }, "4/4", { sections });
    expect(math.sectionStarts.map((start) => start.bar)).toEqual([0, 16, 24.5]);
    expect(math.block8Sec).toBeCloseTo(8 * math.barSec, 10);
    expect(math.block16Sec).toBeCloseTo(16 * math.barSec, 10);
    expect(math.runtimeSec).toBeCloseTo(33.5 * math.barSec, 10);
    const last = math.sectionStarts[2];
    expect(last?.sec).toBeCloseTo(24.5 * math.barSec, 10);
  });

  it("rejects a non-positive tempo and negative lengths", () => {
    expect(() => barSec(0)).toThrow(RangeError);
    expect(() => barSec(Number.NaN)).toThrow(RangeError);
    expect(() => barsToSec(-1, 120)).toThrow(RangeError);
    expect(() => beatsToSec(-1, 120)).toThrow(RangeError);
  });
});
