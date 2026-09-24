import { describe, expect, it } from "vitest";

import { barSec, barsToMs, barsToSec, beatsPerBar, beatsToSec, computeBarMath, sectionSpan } from "@/core/musicspec/barmath";
import { SectionSchema } from "@/core/musicspec/ir/schema";
import { SIGNATURES, type Section, type Signature, type Tempo } from "@/core/musicspec/ir/types";

import hookBFixture from "../fixtures/ir-v0.3/hook-b-section.json";

/** IR v0.3 delta §9: Hook B, 8 bars with a two-beat pickup and a four-beat silence drop. */
const hookB = SectionSchema.parse(hookBFixture);

function section(id: string, bars: number, extras: Partial<Section> = {}): Section {
  return {
    id,
    kind: "custom",
    label: id,
    bars,
    dynamics: "mf",
    scope: { instrumentIds: [], synthRoleIds: [], techniqueIds: [], percussionRhythmIds: [] },
    drumState: "none",
    bassState: "none",
    openPocket: { kind: "none" },
    transitionOut: { kind: "none" },
    ...extras,
  };
}

/** Deterministic generator for the property test (no randomness in src; the seed pins the run). */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) {
    throw new Error("empty choice list");
  }
  return value;
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

describe("bar math: blueprint vectors (BUILD-BRIEF §3, S1 acceptance)", () => {
  it("142 BPM: one bar is 1.69 s, eight bars 13.5 s, sixteen bars 27 s", () => {
    expect(barSec(142)).toBeCloseTo(1.69, 2);
    expect(barsToSec(8, 142)).toBeCloseTo(13.5, 1);
    expect(barsToSec(16, 142)).toBeCloseTo(27, 1);
  });

  it("140 BPM: one bar is 1.714 s", () => {
    expect(barSec(140)).toBeCloseTo(1.714, 3);
  });

  it("four bars at 140 BPM are 6857 ms, the Eleven chunk duration in delta §9", () => {
    expect(barsToMs(4, 140)).toBe(6857);
  });

  it("a beat at 140 BPM is 428.6 ms, the tap-tempo interval in BUILD-BRIEF §3 S8", () => {
    expect(beatsToSec(1, 140) * 1000).toBeCloseTo(428.6, 1);
  });
});

describe("bar math: signatures", () => {
  it.each(SIGNATURES)("%s has the numerator as beats per bar", (signature) => {
    expect(beatsPerBar(signature)).toBe(Number(signature.split("/")[0]));
  });

  it("scales barSec by beats per bar", () => {
    expect(barSec(120, "3/4")).toBeCloseTo(1.5, 10);
    expect(barSec(120, "6/8")).toBeCloseTo(3, 10);
    expect(barSec(120, "7/8")).toBeCloseTo(3.5, 10);
  });
});

describe("bar math: section spans", () => {
  it("counts a pickup and a silence drop in beats (delta §3)", () => {
    const span = sectionSpan(hookB, 140, "4/4");
    // 8 bars + 2 pickup beats + 4 silence beats = 9.5 bars at 1.714 s.
    expect(span.bars).toBeCloseTo(9.5, 10);
    expect(span.pickupSec).toBeCloseTo(0.857, 3);
    expect(span.bodySec).toBeCloseTo(13.714, 3);
    expect(span.silenceSec).toBeCloseTo(1.714, 3);
    expect(span.totalSec).toBeCloseTo(16.286, 3);
  });

  it("leaves a contrast phrase inside its section's bars", () => {
    const withContrast = section("a", 8, {
      contrast: { styleId: "drill-contrast", bars: 4, position: "end", changes: [], returnRule: "then back" },
    });
    expect(sectionSpan(withContrast, 140, "4/4").totalSec).toBeCloseTo(sectionSpan(section("b", 8), 140, "4/4").totalSec, 10);
  });

  it("ignores feltBpm and tempo source: the grid is bpm", () => {
    const sections = [section("a", 8)];
    const tapped: Tempo = { bpm: 140, source: "tap", feltBpm: 70 };
    const plain = computeBarMath({ bpm: 140 }, "4/4", { sections });
    const halfTime = computeBarMath(tapped, "4/4", { sections });
    expect(halfTime).toEqual(plain);
  });
});

describe("bar math: computeBarMath", () => {
  it("derives blocks, runtime and section starts, pickups and silence included", () => {
    const result = computeBarMath({ bpm: 140 }, "4/4", { sections: [section("hook-a", 8), hookB] });
    expect(result.barSec).toBeCloseTo(1.714, 3);
    expect(result.block8Sec).toBeCloseTo(13.714, 3);
    expect(result.block16Sec).toBeCloseTo(27.429, 3);
    // 8 bars + 9.5 bars = 17.5 bars = 30 s exactly at 140 BPM.
    expect(result.runtimeSec).toBeCloseTo(30, 10);
    expect(result.sectionStarts).toHaveLength(2);
    expect(result.sectionStarts[0]).toEqual({ sectionId: "hook-a", bar: 0, sec: 0 });
    expect(result.sectionStarts[1]?.sectionId).toBe("hook-b");
    expect(result.sectionStarts[1]?.bar).toBeCloseTo(8, 10);
    expect(result.sectionStarts[1]?.sec).toBeCloseTo(13.714, 3);
  });

  it("starts the next section after the previous one's pickup and silence", () => {
    const result = computeBarMath({ bpm: 120 }, "4/4", { sections: [hookB, section("bridge", 8)] });
    // Hook B spans 9.5 bars, so the bridge starts at bar 9.5 = 19 s at 120 BPM.
    expect(result.sectionStarts[1]?.bar).toBeCloseTo(9.5, 10);
    expect(result.sectionStarts[1]?.sec).toBeCloseTo(19, 10);
  });

  it("handles an empty structure", () => {
    expect(computeBarMath({ bpm: 120 }, "4/4", { sections: [] })).toEqual({
      barSec: 2,
      block8Sec: 16,
      block16Sec: 32,
      runtimeSec: 0,
      sectionStarts: [],
    });
  });

  it("property: runtime is the sum of section spans and starts are consistent (BUILD-BRIEF §4)", () => {
    const random = lcg(20260924);
    for (let run = 0; run < 250; run += 1) {
      const bpm = randomInt(random, 60, 200);
      const signature: Signature = pick(random, SIGNATURES);
      const count = randomInt(random, 1, 12);
      const sections: Section[] = [];
      for (let i = 0; i < count; i += 1) {
        const extras: Partial<Section> = {};
        if (random() < 0.3) {
          extras.pickupBefore = { beats: pick(random, [1, 2, 3] as const), content: "riser", returnTo: signature };
        }
        if (random() < 0.3) {
          extras.silenceAfter = { beats: randomInt(random, 1, 8), position: "end" };
        }
        sections.push(section(`s${i}`, randomInt(random, 1, 32), extras));
      }

      const result = computeBarMath({ bpm }, signature, { sections });
      const spans = sections.map((s) => sectionSpan(s, bpm, signature));
      const total = spans.reduce((sum, span) => sum + span.totalSec, 0);

      expect(result.runtimeSec).toBeCloseTo(total, 9);
      expect(result.block8Sec).toBeCloseTo(8 * result.barSec, 12);
      expect(result.block16Sec).toBeCloseTo(16 * result.barSec, 12);
      expect(result.sectionStarts.map((start) => start.sectionId)).toEqual(sections.map((s) => s.id));
      expect(result.sectionStarts[0]).toEqual({ sectionId: "s0", bar: 0, sec: 0 });

      let previous = -1;
      for (const [index, start] of result.sectionStarts.entries()) {
        expect(start.sec).toBeGreaterThan(previous);
        expect(start.sec).toBeCloseTo(start.bar * result.barSec, 9);
        previous = start.sec;
        if (index > 0) {
          const before = result.sectionStarts[index - 1];
          const beforeSpan = spans[index - 1];
          expect(before).toBeDefined();
          expect(beforeSpan).toBeDefined();
          expect(start.sec).toBeCloseTo((before?.sec ?? 0) + (beforeSpan?.totalSec ?? 0), 9);
        }
      }
      const last = result.sectionStarts.at(-1);
      const lastSpan = spans.at(-1);
      expect(result.runtimeSec).toBeCloseTo((last?.sec ?? 0) + (lastSpan?.totalSec ?? 0), 9);
    }
  });
});

describe("bar math: invalid input", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects bpm %s", (bpm) => {
    expect(() => barSec(bpm)).toThrow(RangeError);
    expect(() => barsToSec(4, bpm)).toThrow(RangeError);
    expect(() => beatsToSec(1, bpm)).toThrow(RangeError);
    expect(() => computeBarMath({ bpm }, "4/4", { sections: [] })).toThrow(RangeError);
  });

  it("rejects negative or non-finite bar and beat counts", () => {
    expect(() => barsToSec(-1, 120)).toThrow(RangeError);
    expect(() => barsToSec(Number.NaN, 120)).toThrow(RangeError);
    expect(() => beatsToSec(-2, 120)).toThrow(RangeError);
    expect(() => sectionSpan(section("bad", -8), 120, "4/4")).toThrow(RangeError);
  });
});
