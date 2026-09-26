import { describe, expect, it } from "vitest";

import { assignableBpm, emptyTaps, lastTapAt, reading, scheduleClicks, startCursor, tap, tapsExpired, TAP_RESET_MS, TEMPO_MAX_BPM, TEMPO_MIN_BPM, type TapState } from "@/core/musicspec/tempo";

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

  it("follows a move to double time, whose every other tap lands on the old grid", () => {
    // 120 BPM, then 240 BPM (250 ms): 2000 and 2500 fit the old 500 ms grid from the kept taps.
    const state = tapAll([0, 500, 1000, 1500, 1750, 2000, 2250, 2500]);
    expect(state.taps).toEqual([1750, 2000, 2250, 2500]);
    expect(reading(state).bpm).toBeCloseTo(240, 10);
  });

  it("keeps the tempo through one stray tap between beats", () => {
    const state = tapAll([0, 500, 1000, 1500, 1650, 2000]);
    expect(state.taps).toEqual([500, 1000, 1500, 2000]);
    expect(reading(state).bpm).toBeCloseTo(120, 10);
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

  it("times the 2 s reset from the latest tap, even a discarded one", () => {
    // A discarded tap 1.9 s after the last kept one: the person is still tapping.
    const state = tap(tapAll([0, 500, 1000, 1500]), 3400);
    expect(state.discarded).toBe(true);
    expect(lastTapAt(state)).toBe(3400);
    expect(tapsExpired(state, 3600)).toBe(false);
    expect(tapsExpired(state, 3400 + TAP_RESET_MS + 1)).toBe(true);
    // The next tap is a second outlier, not a timeout: it starts a new sequence either way.
    expect(tap(state, 3900)).toEqual({ taps: [3900], discarded: false });
  });

  it("assigns only a tempo the tempo field accepts", () => {
    expect(assignableBpm(tapAll([0, 428, 856, 1284]))).toBe(140);
    expect(assignableBpm(tapAll([0, 428, 856]))).toBeNull();
    // 150 ms taps read 400 BPM, past the field's 300.
    const fast = tapAll([0, 150, 300, 450]);
    expect(reading(fast).bpm).toBeCloseTo(400, 10);
    expect(assignableBpm(fast)).toBeNull();
    expect(assignableBpm(tapAll([0, 200, 400, 600]))).toBe(TEMPO_MAX_BPM);
    expect([TEMPO_MIN_BPM, TEMPO_MAX_BPM]).toEqual([20, 300]);
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
    const { clicks, cursor } = scheduleClicks(startCursor(0), 2.1, settings);
    expect(clicks.map((c) => [c.time, c.beat, c.accent])).toEqual([
      [0, 0, "bar"],
      [0.5, 1, "beat"],
      [1, 2, "beat"],
      [1.5, 3, "beat"],
      [2, 0, "bar"],
    ]);
    expect(cursor).toEqual({ nextTime: 2.5, beatTime: 2.5, beatSec: 0.5, beat: 1, step: 0 });
  });

  it("accents 1 and 3 in half-time mode", () => {
    const { clicks } = scheduleClicks(startCursor(0), 2, { ...settings, halfTimeAccent: true });
    expect(clicks.map((c) => c.accent)).toEqual(["bar", "beat", "bar", "beat"]);
  });

  it("adds subdivision clicks between beats", () => {
    const { clicks } = scheduleClicks(startCursor(0), 0.5, { ...settings, subdivision: 4 });
    expect(clicks.map((c) => [c.time, c.step, c.accent])).toEqual([
      [0, 0, "bar"],
      [0.125, 1, "sub"],
      [0.25, 2, "sub"],
      [0.375, 3, "sub"],
    ]);
  });

  it("continues seamlessly across ticks", () => {
    const a = scheduleClicks(startCursor(0), 1, settings);
    const b = scheduleClicks(a.cursor, 2.1, settings);
    expect([...a.clicks, ...b.clicks].map((c) => c.time)).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it("keeps beats advancing when the subdivision changes mid-beat", () => {
    const sixteenths = scheduleClicks(startCursor(0), 0.3, { ...settings, subdivision: 4 });
    expect(sixteenths.cursor.step).toBe(3);
    // 16ths at 120 BPM were scheduled through 0.25 s; the next beat is still at 0.5 s.
    const { clicks } = scheduleClicks(sixteenths.cursor, 1.6, { ...settings, subdivision: 2 });
    expect(clicks.map((c) => [c.time, c.beat, c.step, c.accent])).toEqual([
      [0.5, 1, 0, "beat"],
      [0.75, 1, 1, "sub"],
      [1, 2, 0, "beat"],
      [1.25, 2, 1, "sub"],
      [1.5, 3, 0, "beat"],
    ]);
  });

  it("finishes the beat in progress at its own tempo and applies a new BPM from the next beat", () => {
    // 16ths at 120 BPM sounded through 0.25 s; the tempo then doubles to 240 BPM.
    const before = scheduleClicks(startCursor(0), 0.3, { ...settings, subdivision: 4 });
    const { clicks } = scheduleClicks(before.cursor, 0.7, { ...settings, bpm: 240, subdivision: 4 });
    expect(clicks.map((c) => [c.time, c.beat, c.step])).toEqual([
      [0.375, 0, 3],
      [0.5, 1, 0],
      [0.5625, 1, 1],
      [0.625, 1, 2],
      [0.6875, 1, 3],
    ]);
  });

  it("skips clicks that fell due during a stalled tick instead of playing them in a burst", () => {
    // Scheduled through 0.3 s, then the tab was throttled until 10 s (20 beats later at 120 BPM).
    const early = scheduleClicks(startCursor(0), 0.3, settings);
    const { clicks } = scheduleClicks(early.cursor, 10.1, settings, 10);
    expect(clicks.map((c) => [c.time, c.beat, c.accent])).toEqual([[10, 0, "bar"]]);
  });

  it("lands on the finer grid of the same beat when the subdivision increases mid-beat", () => {
    // 8ths at 60 BPM, scheduled through 0.3 s: the next 8th was due at 0.5 s.
    const eighths = scheduleClicks(startCursor(0), 0.3, { ...settings, bpm: 60, subdivision: 2 });
    const { clicks } = scheduleClicks(eighths.cursor, 1.1, { ...settings, bpm: 60, subdivision: 4 });
    expect(clicks.map((c) => [c.time, c.beat, c.step])).toEqual([
      [0.5, 0, 2],
      [0.75, 0, 3],
      [1, 1, 0],
    ]);
  });

  it("wraps the beat when the meter shrinks mid-bar", () => {
    const { clicks } = scheduleClicks({ ...startCursor(0), beat: 3 }, 0.6, { ...settings, beatsPerBar: 3 });
    expect(clicks.map((c) => [c.beat, c.accent])).toEqual([
      [0, "bar"],
      [1, "beat"],
    ]);
  });
});
