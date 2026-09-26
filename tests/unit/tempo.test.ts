import { describe, expect, it } from "vitest";

import { emptyTaps, reading, scheduleClicks, tap, tapsExpired, TAP_RESET_MS, type TapState } from "@/core/musicspec/tempo";

const tapAll = (times: number[], start: TapState = emptyTaps()) => times.reduce(tap, start);

describe("tap tempo (§1.8)", () => {
  it("gives 140 BPM from 4 taps 428 ms apart", () => {
    const state = tapAll([0, 428, 856, 1284]);
    expect(Math.round(reading(state).bpm ?? 0)).toBe(140);
    expect(reading(state).halfTime).toBeCloseTo((reading(state).bpm ?? 0) / 2, 10);
    expect(reading(state).doubleTime).toBeCloseTo((reading(state).bpm ?? 0) * 2, 10);
  });

  it("uses the mean of the last three intervals only", () => {
    // An early slower pair falls out of the 4-tap window.
    const state = tapAll([0, 500, 900, 1300, 1700, 2100]);
    expect(state.taps).toEqual([900, 1300, 1700, 2100]);
    expect(reading(state).bpm).toBeCloseTo(150, 10);
  });

  it("discards an outlier tap more than 25% off the running mean", () => {
    const before = tapAll([0, 428, 856]);
    const outlier = tap(before, 1000);
    expect(outlier.discarded).toBe(true);
    expect(outlier.taps).toEqual(before.taps);
    const after = tap(outlier, 1284);
    expect(after.discarded).toBe(false);
    expect(Math.round(reading(after).bpm ?? 0)).toBe(140);
  });

  it("starts a new sequence after two outliers in a row, so a tempo change recovers", () => {
    // 120 BPM, then the person moves to 90 BPM (667 ms).
    const first = tap(tapAll([0, 500, 1000, 1500]), 2167);
    expect(first.discarded).toBe(true);
    const second = tap(first, 2834);
    expect(second).toEqual({ taps: [2834], discarded: false });
    expect(Math.round(reading(tapAll([3501, 4168, 4835], second)).bpm ?? 0)).toBe(90);
  });

  it("recovers from a late tap without waiting for the 2 s reset", () => {
    const state = tapAll([0, 428, 856, 1400, 1712, 2140, 2568, 2996]);
    expect(state.taps).toEqual([1712, 2140, 2568, 2996]);
    expect(Math.round(reading(state).bpm ?? 0)).toBe(140);
  });

  it("accepts a tap just inside the 25% band", () => {
    const state = tap(tapAll([0, 400]), 400 + 499);
    expect(state.discarded).toBe(false);
  });

  it("resets after a 2 s gap", () => {
    const state = tapAll([0, 428, 856]);
    const late = tap(state, 856 + TAP_RESET_MS + 1);
    expect(late.taps).toEqual([856 + TAP_RESET_MS + 1]);
    expect(reading(late).bpm).toBeNull();
    expect(tapsExpired(state, 856 + TAP_RESET_MS + 1)).toBe(true);
    expect(tapsExpired(state, 856 + TAP_RESET_MS)).toBe(false);
  });

  it("reads nothing until four taps are in, so one interval cannot be assigned", () => {
    expect(reading(tap(emptyTaps(), 0)).bpm).toBeNull();
    expect(reading(tapAll([0, 428])).bpm).toBeNull();
    expect(reading(tapAll([0, 428, 856])).bpm).toBeNull();
    expect(reading(tapAll([0, 428, 856, 1284])).bpm).not.toBeNull();
  });
});

describe("metronome scheduling", () => {
  const settings = { bpm: 120, beatsPerBar: 4, halfTimeAccent: false, subdivision: 1 as const };

  it("schedules the clicks due inside the lookahead window, accenting beat 1", () => {
    const { clicks, cursor } = scheduleClicks({ nextTime: 0, beat: 0, step: 0 }, 2.1, settings);
    expect(clicks.map((c) => [c.time, c.beat, c.accent])).toEqual([
      [0, 0, "bar"],
      [0.5, 1, "beat"],
      [1, 2, "beat"],
      [1.5, 3, "beat"],
      [2, 0, "bar"],
    ]);
    expect(cursor).toEqual({ nextTime: 2.5, beat: 1, step: 0 });
  });

  it("accents 1 and 3 in half-time mode", () => {
    const { clicks } = scheduleClicks({ nextTime: 0, beat: 0, step: 0 }, 2, { ...settings, halfTimeAccent: true });
    expect(clicks.map((c) => c.accent)).toEqual(["bar", "beat", "bar", "beat"]);
  });

  it("adds subdivision clicks between beats", () => {
    const { clicks } = scheduleClicks({ nextTime: 0, beat: 0, step: 0 }, 0.5, { ...settings, subdivision: 4 });
    expect(clicks.map((c) => [c.time, c.step, c.accent])).toEqual([
      [0, 0, "bar"],
      [0.125, 1, "sub"],
      [0.25, 2, "sub"],
      [0.375, 3, "sub"],
    ]);
  });

  it("continues seamlessly across ticks", () => {
    const a = scheduleClicks({ nextTime: 0, beat: 0, step: 0 }, 1, settings);
    const b = scheduleClicks(a.cursor, 2.1, settings);
    expect([...a.clicks, ...b.clicks].map((c) => c.time)).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it("keeps beats advancing when the subdivision changes mid-beat", () => {
    const sixteenths = scheduleClicks({ nextTime: 0, beat: 0, step: 0 }, 0.3, { ...settings, subdivision: 4 });
    expect(sixteenths.cursor.step).toBe(3);
    const { clicks } = scheduleClicks(sixteenths.cursor, 1.6, { ...settings, subdivision: 2 });
    expect(clicks.map((c) => [c.beat, c.step, c.accent])).toEqual([
      [1, 0, "beat"],
      [1, 1, "sub"],
      [2, 0, "beat"],
      [2, 1, "sub"],
      [3, 0, "beat"],
    ]);
  });

  it("wraps the beat when the meter shrinks mid-bar", () => {
    const { clicks } = scheduleClicks({ nextTime: 0, beat: 3, step: 0 }, 0.6, { ...settings, beatsPerBar: 3 });
    expect(clicks.map((c) => [c.beat, c.accent])).toEqual([
      [0, "bar"],
      [1, "beat"],
    ]);
  });
});
