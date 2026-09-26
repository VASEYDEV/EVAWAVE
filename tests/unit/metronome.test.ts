import { afterEach, describe, expect, it, vi } from "vitest";

import { Metronome } from "@/lib/audio/metronome";

/** A click the stand-in scheduled: its start time, and whether it was cut off the graph. */
interface FakeClick {
  start: number;
  silenced: boolean;
}

/** A Web Audio stand-in: counts contexts and records the clicks the metronome schedules. */
function fakeAudio({ blocked = false } = {}) {
  const contexts: FakeContext[] = [];
  class FakeContext {
    currentTime = 0;
    destination = {};
    closed = false;
    constructor() {
      contexts.push(this);
    }
    resume = async () => {
      if (blocked) throw new DOMException("audio output is blocked", "NotAllowedError");
    };
    close = async () => {
      this.closed = true;
    };
    clicks: FakeClick[] = [];
    createOscillator = () => {
      let gain: { click?: FakeClick } = {};
      return {
        frequency: { value: 0 },
        connect: (node: { click?: FakeClick }) => (gain = node),
        start: (time: number) => this.clicks.push((gain.click = { start: Math.round(time * 1e6) / 1e6, silenced: false })),
        stop: () => {},
      };
    };
    createGain = () => {
      const node: { click?: FakeClick; [key: string]: unknown } = {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: (next: unknown) => next,
        disconnect: () => {
          if (node.click) node.click.silenced = true;
        },
      };
      return node;
    };
  }
  vi.stubGlobal("AudioContext", FakeContext);
  return contexts;
}

const settings = { bpm: 120, beatsPerBar: 4, halfTimeAccent: false, subdivision: 1 as const };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("metronome start and stop", () => {
  it("joins a second start made while the first is resuming: one context, one scheduler", async () => {
    const contexts = fakeAudio();
    const intervals = vi.spyOn(globalThis, "setInterval");
    const metronome = new Metronome(settings);
    await Promise.all([metronome.start(), metronome.start()]);
    expect(contexts).toHaveLength(1);
    expect(intervals).toHaveBeenCalledTimes(1);
    expect(metronome.running).toBe(true);
    await metronome.stop();
    expect(metronome.running).toBe(false);
    expect(contexts[0]?.closed).toBe(true);
  });

  it("leaves nothing running when stopped while starting", async () => {
    fakeAudio();
    const intervals = vi.spyOn(globalThis, "setInterval");
    const metronome = new Metronome(settings);
    const starting = metronome.start();
    await metronome.stop();
    await starting;
    expect(intervals).not.toHaveBeenCalled();
    expect(metronome.running).toBe(false);
  });

  it("closes the context when resume() is refused, so retries do not pile up contexts", async () => {
    const contexts = fakeAudio({ blocked: true });
    const metronome = new Metronome(settings);
    await expect(metronome.start()).rejects.toThrow("blocked");
    await expect(metronome.start()).rejects.toThrow("blocked");
    expect(contexts).toHaveLength(2);
    expect(contexts.every((c) => c.closed)).toBe(true);
    expect(metronome.running).toBe(false);
  });

  it("starts again after a stop", async () => {
    const contexts = fakeAudio();
    const metronome = new Metronome(settings);
    await metronome.start();
    await metronome.stop();
    await metronome.start();
    expect(contexts).toHaveLength(2);
    expect(metronome.running).toBe(true);
    await metronome.stop();
  });
});

describe("metronome settings while running", () => {
  it("drops clicks queued on the old tempo and schedules again from the last click that sounded", async () => {
    vi.useFakeTimers();
    const contexts = fakeAudio();
    // 16ths at 300 BPM: 0.2 s beats in 0.05 s steps, from the first downbeat at 0.05 s.
    const metronome = new Metronome({ ...settings, bpm: 300, subdivision: 4 });
    await metronome.start();
    const context = contexts[0] as unknown as { currentTime: number; clicks: FakeClick[] };
    const tickAt = (time: number) => {
      context.currentTime = time;
      vi.advanceTimersByTime(25);
    };
    for (let i = 1; i <= 9; i++) tickAt(i * 0.025);
    // The tick at 0.225 s queued the 0.25 s downbeat and the 0.3 s 16th of a beat not yet begun.
    expect(context.clicks.filter((c) => c.start >= 0.25).map((c) => c.start)).toEqual([0.25, 0.3]);
    context.currentTime = 0.23;
    metronome.update({ ...settings, bpm: 150, subdivision: 4 }, 0.5);
    for (let i = 10; i <= 16; i++) tickAt(i * 0.025);
    await metronome.stop();
    // At 150 BPM the beat from 0.25 s is 0.4 s long, in 0.1 s steps: 0.3 s is off the grid.
    const heard = context.clicks.filter((c) => !c.silenced).map((c) => c.start);
    expect(heard).toEqual([0.05, 0.1, 0.15, 0.2, 0.25, 0.35, 0.45]);
    expect(context.clicks.filter((c) => c.silenced).map((c) => c.start)).toEqual([0.25, 0.3]);
  });

  it("leaves the queue alone when nothing changed", async () => {
    vi.useFakeTimers();
    const contexts = fakeAudio();
    const metronome = new Metronome(settings);
    await metronome.start();
    const context = contexts[0] as unknown as { currentTime: number; clicks: FakeClick[] };
    // TempoTools passes the settings on every render; the same values re-time nothing.
    metronome.update({ ...settings }, 0.5);
    await metronome.stop();
    expect(context.clicks.map((c) => c.silenced)).toEqual([false]);
  });
});
