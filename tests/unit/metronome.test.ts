import { afterEach, describe, expect, it, vi } from "vitest";

import { Metronome } from "@/lib/audio/metronome";

/** A Web Audio stand-in: counts contexts and accepts the nodes the metronome schedules. */
function fakeAudio() {
  const contexts: FakeContext[] = [];
  class FakeContext {
    currentTime = 0;
    destination = {};
    closed = false;
    constructor() {
      contexts.push(this);
    }
    resume = async () => {};
    close = async () => {
      this.closed = true;
    };
    createOscillator = () => ({ frequency: { value: 0 }, connect: (node: unknown) => node, start: () => {}, stop: () => {} });
    createGain = () => ({ gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: (node: unknown) => node });
  }
  vi.stubGlobal("AudioContext", FakeContext);
  return contexts;
}

const settings = { bpm: 120, beatsPerBar: 4, halfTimeAccent: false, subdivision: 1 as const };

afterEach(() => {
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
