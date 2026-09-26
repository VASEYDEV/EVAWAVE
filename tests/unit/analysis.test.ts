import { describe, expect, it } from "vitest";

import { fft } from "@/core/musicspec/analysis/dsp";
import { analyseAudio } from "@/core/musicspec/analysis/features";
import { decodeWav, encodeWav, WavError } from "@/core/musicspec/analysis/wav";

import { clickTrack, mix, sine, triad } from "../support/signals";

describe("fft", () => {
  it("puts a pure tone in its bin", () => {
    const n = 64;
    const re = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 5 * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    const mags = Array.from(re, (r, k) => Math.hypot(r, im[k] as number));
    expect(mags.indexOf(Math.max(...mags.slice(0, n / 2)))).toBe(5);
    expect(mags[5]).toBeCloseTo(n / 2, 6);
  });

  it("rejects a non-power-of-two length", () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow(RangeError);
  });
});

describe("loudness (ITU-R BS.1770)", () => {
  it("reads a −20 dBFS 1 kHz sine at 48 kHz as −23.01 LUFS", () => {
    expect(analyseAudio(sine(1000, -20, 10, 48000), 48000).loudness.integratedLufs).toBeCloseTo(-23.01, 1);
  });

  it("agrees within 0.2 LU at 44.1 kHz", () => {
    expect(Math.abs(analyseAudio(sine(1000, -20, 10, 44100), 44100).loudness.integratedLufs + 23.01)).toBeLessThan(0.2);
  });

  it("gates silence to −70 LUFS", () => {
    expect(analyseAudio(new Float32Array(44100 * 4), 44100).loudness.integratedLufs).toBe(-70);
  });

  it("applies the −70 LUFS absolute gate to material that is quieter than it", () => {
    // A −75 dBFS sine would read about −78 LUFS; every block falls below the absolute gate.
    expect(analyseAudio(sine(1000, -75, 6, 48000), 48000).loudness.integratedLufs).toBe(-70);
  });

  it("measures a loudness range between a quiet and a loud half", () => {
    const quiet = sine(1000, -30, 10, 44100);
    const loud = sine(1000, -10, 10, 44100);
    const both = Float32Array.from([...quiet, ...loud]);
    expect(analyseAudio(both, 44100).loudness.loudnessRange).toBeGreaterThan(15);
  });
});

describe("tempo and meter", () => {
  it.each([90, 120, 140, 170])("finds %i BPM in a click track", (bpm) => {
    const features = analyseAudio(clickTrack(bpm, 20, 44100), 44100);
    expect(Math.abs(features.bpm.value - bpm)).toBeLessThan(1.5);
    expect(features.bpm.halfTimeCandidate).toBeCloseTo(features.bpm.value / 2, 6);
    expect(features.bpm.doubleTimeCandidate).toBeCloseTo(features.bpm.value * 2, 6);
    expect(features.bpm.confidence).toBeGreaterThan(0.5);
  });

  it("hears 4/4 from accents every four beats and 3/4 from accents every three", () => {
    expect(analyseAudio(clickTrack(120, 24, 44100, 4), 44100).meter.signature).toBe("4/4");
    expect(analyseAudio(clickTrack(120, 24, 44100, 3), 44100).meter.signature).toBe("3/4");
  });

  it("claims no meter when every beat is the same", () => {
    const meter = analyseAudio(clickTrack(120, 24, 44100, 1), 44100).meter;
    expect(meter.signature).toBe("unknown");
  });

  it("reports no tempo in silence", () => {
    const features = analyseAudio(new Float32Array(44100 * 4), 44100);
    expect(features.bpm.value).toBe(0);
    expect(features.bpm.confidence).toBe(0);
  });
});

describe("key", () => {
  it.each([
    [62, true, "D", "minor"],
    [60, false, "C", "major"],
    [69, true, "A", "minor"],
    [67, false, "G", "major"],
  ] as const)("finds a sustained triad on MIDI %i (minor: %s) as %s %s", (root, minor, tonic, mode) => {
    const key = analyseAudio(triad(root, minor, 6, 44100), 44100).key;
    expect({ tonic: key.tonic, mode: key.mode }).toEqual({ tonic, mode });
    expect(key.confidence).toBeGreaterThan(0);
  });
});

describe("energy, sections and spectrum", () => {
  it("normalises the energy curve and splits a quiet-then-loud track into sections", () => {
    const quiet = mix(clickTrack(120, 16, 22050), sine(200, -40, 16, 22050));
    const loud = mix(clickTrack(120, 16, 22050), sine(200, -6, 16, 22050));
    const features = analyseAudio(Float32Array.from([...quiet, ...loud]), 22050);
    expect(Math.max(...features.energyCurve)).toBeCloseTo(1, 10);
    expect(features.sections.length).toBeGreaterThanOrEqual(2);
    expect(features.sections.at(-1)?.endSec).toBeCloseTo(features.durationSec, 6);
  });

  it("weighs sub, brightness and transients", () => {
    const sub = analyseAudio(sine(45, -6, 4, 44100), 44100).spectral;
    const bright = analyseAudio(sine(4000, -6, 4, 44100), 44100).spectral;
    expect(sub.subWeight).toBeGreaterThan(0.8);
    expect(bright.brightness).toBeGreaterThan(0.9);
    expect(bright.centroidHz).toBeGreaterThan(sub.centroidHz);
    const clicks = analyseAudio(clickTrack(120, 10, 44100), 44100).spectral;
    expect(clicks.transientDensity).toBeGreaterThan(1.5);
    expect(clicks.transientDensity).toBeLessThan(2.5);
  });

  it("is deterministic and never tags (null tagger)", () => {
    const signal = mix(clickTrack(140, 8, 44100), triad(62, true, 8, 44100));
    const a = analyseAudio(signal, 44100);
    expect(analyseAudio(signal, 44100)).toEqual(a);
    expect(a.tags).toEqual([]);
  });
});

describe("WAV", () => {
  it("round-trips 16-bit mono PCM", () => {
    const samples = sine(440, -6, 0.1, 8000);
    const decoded = decodeWav(encodeWav(samples, 8000));
    expect(decoded.sampleRate).toBe(8000);
    expect(decoded.channels).toBe(1);
    decoded.samples.forEach((s, i) => expect(Math.abs(s - (samples[i] as number))).toBeLessThan(1 / 16384));
  });

  it("mixes stereo 24-bit and float WAVs to mono", () => {
    const make = (format: 1 | 3, bits: 24 | 32, frames: [number, number][]) => {
      const bytes = bits / 8;
      const buffer = new ArrayBuffer(44 + frames.length * 2 * bytes);
      const view = new DataView(buffer);
      const write = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
      write(0, "RIFF");
      view.setUint32(4, buffer.byteLength - 8, true);
      write(8, "WAVE");
      write(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, format, true);
      view.setUint16(22, 2, true);
      view.setUint32(24, 48000, true);
      view.setUint32(28, 48000 * 2 * bytes, true);
      view.setUint16(32, 2 * bytes, true);
      view.setUint16(34, bits, true);
      write(36, "data");
      view.setUint32(40, frames.length * 2 * bytes, true);
      frames.flat().forEach((v, i) => {
        const at = 44 + i * bytes;
        if (format === 3) view.setFloat32(at, v, true);
        else {
          const int = Math.round(v * 8388607);
          view.setUint8(at, int & 0xff);
          view.setUint8(at + 1, (int >> 8) & 0xff);
          view.setInt8(at + 2, int >> 16);
        }
      });
      return buffer;
    };
    expect(Array.from(decodeWav(make(3, 32, [[0.5, -0.5], [1, 0]])).samples)).toEqual([0, 0.5]);
    const pcm24 = decodeWav(make(1, 24, [[0.5, 0.25]])).samples[0] as number;
    expect(pcm24).toBeCloseTo(0.375, 5);
  });

  it("rejects a file that is not a WAV", () => {
    expect(() => decodeWav(new TextEncoder().encode("ID3 not a wave").buffer)).toThrow(WavError);
  });
});
