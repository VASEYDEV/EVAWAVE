import { describe, expect, it } from "vitest";

import { fft, parabolicPeakOffset } from "@/core/musicspec/analysis/dsp";
import { analyseAudio } from "@/core/musicspec/analysis/features";
import { decodeWav, encodeWav, WavError } from "@/core/musicspec/analysis/wav";

import { clickTrack, mix, noise, sine, swell, triad } from "../support/signals";

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

describe("parabolicPeakOffset", () => {
  it("places the vertex of a local maximum within half a step", () => {
    expect(parabolicPeakOffset(1, 2, 1)).toBeCloseTo(0, 12);
    expect(parabolicPeakOffset(1, 2, 1.5)).toBeCloseTo(1 / 6, 12);
    expect(parabolicPeakOffset(2, 2, 1)).toBe(-0.5);
    expect(parabolicPeakOffset(1, 2, 2)).toBe(0.5);
    let state = 7;
    const next = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 1000; i++) {
      const y1 = next();
      const offset = parabolicPeakOffset(y1 * next(), y1, y1 * next());
      expect(Math.abs(offset)).toBeLessThanOrEqual(0.5);
    }
  });

  it("does not fit a slope, a trough or a flat run", () => {
    // Three autocorrelation values from a swell: falling, and nearly straight. The unguarded
    // fit put their vertex 15 steps back.
    expect(parabolicPeakOffset(292.919, 275.449, 256.789)).toBe(0);
    expect(parabolicPeakOffset(1, 0, 1)).toBe(0);
    expect(parabolicPeakOffset(1, 1, 1)).toBe(0);
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

  it("sums channel energies: the same sine on L and R reads 3 dB above one channel", () => {
    const tone = sine(1000, -20, 10, 48000);
    const silent = new Float32Array(tone.length);
    expect(analyseAudio(tone, 48000, [tone, tone]).loudness.integratedLufs).toBeCloseTo(-20.0, 1);
    expect(analyseAudio(tone.map((v) => v / 2), 48000, [tone, silent]).loudness.integratedLufs).toBeCloseTo(-23.01, 1);
  });

  it("reads phase-opposed stereo at its real loudness, not as the silence its mono mix is", () => {
    const tone = sine(1000, -20, 10, 48000);
    const features = analyseAudio(new Float32Array(tone.length), 48000, [tone, tone.map((v) => -v)]);
    expect(features.loudness.integratedLufs).toBeCloseTo(-20.0, 1);
  });

  it("weights 5.1 surrounds by 1.41 and leaves out the LFE", () => {
    const tone = sine(1000, -20, 10, 48000);
    const only = (index: number) => Array.from({ length: 6 }, (_, c) => (c === index ? tone : new Float32Array(tone.length)));
    const mixOf = (channels: Float32Array[]) => channels[0] as Float32Array;
    expect(analyseAudio(mixOf(only(3)), 48000, only(3)).loudness.integratedLufs).toBe(-70);
    expect(analyseAudio(mixOf(only(4)), 48000, only(4)).loudness.integratedLufs).toBeCloseTo(-23.01 + 10 * Math.log10(1.41), 1);
    expect(analyseAudio(mixOf(only(2)), 48000, only(2)).loudness.integratedLufs).toBeCloseTo(-23.01, 1);
  });

  it("weights quad and 5.0 surrounds and 7.1 side surrounds by 1.41, and leaves out the 7.1 LFE", () => {
    const tone = sine(1000, -20, 10, 48000);
    const only = (count: number, index: number) => Array.from({ length: count }, (_, c) => (c === index ? tone : new Float32Array(tone.length)));
    const lufsOf = (channels: Float32Array[]) => analyseAudio(channels[0] as Float32Array, 48000, channels).loudness.integratedLufs;
    const surround = -23.01 + 10 * Math.log10(1.41);
    expect(lufsOf(only(4, 1))).toBeCloseTo(-23.01, 1);
    expect(lufsOf(only(4, 2))).toBeCloseTo(surround, 1);
    expect(lufsOf(only(5, 3))).toBeCloseTo(surround, 1);
    expect(lufsOf(only(8, 3))).toBe(-70);
    expect(lufsOf(only(8, 4))).toBeCloseTo(-23.01, 1);
    expect(lufsOf(only(8, 6))).toBeCloseTo(surround, 1);
  });

  it("rejects channels that do not match the mix", () => {
    expect(() => analyseAudio(new Float32Array(100), 48000, [new Float32Array(99)])).toThrow(RangeError);
    expect(() => analyseAudio(new Float32Array(100), 48000, [])).toThrow(RangeError);
  });

  it("measures a loudness range between a quiet and a loud half", () => {
    const quiet = sine(1000, -30, 10, 44100);
    const loud = sine(1000, -10, 10, 44100);
    const both = Float32Array.from([...quiet, ...loud]);
    expect(analyseAudio(both, 44100).loudness.loudnessRange).toBeGreaterThan(15);
  });

  it("gates the loudness range against its own short-term level, per EBU Tech 3342", () => {
    // 10 s at −23 LUFS, then 30 s at about −46 LUFS. The absolute-gated short-term windows
    // average about −29 LUFS, so Tech 3342's −20 LU gate (about −49) keeps the quiet part and
    // the range is about 23 LU. A gate at the integrated loudness − 20 (−43) would drop it.
    const loud = sine(1000, -20, 10, 48000);
    const quiet = sine(1000, -43, 30, 48000);
    const both = new Float32Array(loud.length + quiet.length);
    both.set(loud);
    both.set(quiet, loud.length);
    const { integratedLufs, loudnessRange } = analyseAudio(both, 48000).loudness;
    expect(integratedLufs).toBeCloseTo(-23, 0);
    expect(loudnessRange).toBeGreaterThan(20);
    expect(loudnessRange).toBeLessThan(24);
  });
});

describe("tempo and meter", () => {
  it("keeps the tempo in 60–200 BPM, folding a slower pulse up an octave with the true tempo as half-time", () => {
    for (const bpm of [58, 59]) {
      const { bpm: tempo } = analyseAudio(clickTrack(bpm, 20, 44100), 44100);
      expect(tempo.value).toBeGreaterThanOrEqual(60);
      expect(tempo.value).toBeLessThanOrEqual(200);
      expect(Math.abs(tempo.halfTimeCandidate - bpm)).toBeLessThan(1.5);
    }
  });

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

  it("sizes energy windows to four bars of the detected meter", () => {
    // 24 s at 120 BPM: four bars are 8 s in 4/4 and 6 s in 3/4.
    expect(analyseAudio(clickTrack(120, 24, 44100, 4), 44100).energyCurve).toHaveLength(3);
    expect(analyseAudio(clickTrack(120, 24, 44100, 3), 44100).energyCurve).toHaveLength(4);
  });

  it("claims no meter when every beat is the same", () => {
    const meter = analyseAudio(clickTrack(120, 24, 44100, 1), 44100).meter;
    expect(meter.signature).toBe("unknown");
  });

  it("claims no tempo for a swell with no beat, and ends", () => {
    // These swells once put the fitted peak at a negative lag, and folding the tempo into
    // 60–200 BPM never ended. Their winning lag sits on a slope with no raw peak near it.
    for (const seed of [1, 2, 3]) {
      const { bpm } = analyseAudio(swell(440, 12, 1, 22050, seed), 22050);
      expect(bpm).toEqual({ value: 0, confidence: 0, halfTimeCandidate: 0, doubleTimeCandidate: 0 });
    }
  });

  it("claims no tempo for a steady tone, loud or quiet, a fade or a sustained chord", () => {
    // Their flux is frame jitter, periodic in the hop: it once read 112.5 BPM at confidence 1.
    const n = 22050 * 8;
    const fade = Float32Array.from({ length: n }, (_, i) => (i / n) * Math.sin((2 * Math.PI * 440 * i) / 22050));
    for (const signal of [sine(440, -6, 10, 22050), sine(440, -40, 10, 22050), fade, triad(62, true, 12, 22050)]) {
      expect(analyseAudio(signal, 22050).bpm.value).toBe(0);
    }
  });

  it("lets a beat under noise keep its tempo, with confidence as strong as the beat shows", () => {
    const clicks = clickTrack(120, 20, 22050);
    const audible = analyseAudio(mix(clicks, noise(20, 22050, 0.1, 5)), 22050).bpm;
    expect(Math.abs(audible.value - 120)).toBeLessThan(1.5);
    expect(audible.confidence).toBeGreaterThanOrEqual(0.5);
    // Buried in noise, or noise alone: whatever lag wins, it starts unticked.
    expect(analyseAudio(mix(clicks, noise(20, 22050, 0.3, 5)), 22050).bpm.confidence).toBeLessThan(0.5);
    expect(analyseAudio(noise(10, 22050, 0.5, 5), 22050).bpm.confidence).toBeLessThan(0.5);
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

  it("reads phase-opposed stereo from a channel, not from the silent mix", () => {
    const music = mix(clickTrack(140, 12, 22050), triad(62, true, 12, 22050));
    const opposed = music.map((v) => -v);
    const features = analyseAudio(new Float32Array(music.length), 22050, [music, opposed]);
    const reference = analyseAudio(music, 22050);
    expect(Math.round(features.bpm.value)).toBe(140);
    expect(features.key).toEqual(reference.key);
    expect(features.spectral).toEqual(reference.spectral);
  });

  it("keeps reading the mix for ordinary stereo", () => {
    const left = clickTrack(120, 8, 22050);
    const right = triad(60, false, 8, 22050);
    const both = left.map((v, i) => (v + (right[i] as number)) / 2);
    // Loudness differs by design (it reads the channels); everything else reads the mix.
    const withoutLoudness = (f: ReturnType<typeof analyseAudio>) => ({ ...f, loudness: null });
    expect(withoutLoudness(analyseAudio(both, 22050, [left, right]))).toEqual(withoutLoudness(analyseAudio(both, 22050)));
  });

  it("keeps reading the mix for ordinary surround material", () => {
    // Six uncorrelated, equal-energy channels: their average keeps 1/6 of the mean energy.
    const channels = [110, 220, 330, 440, 550, 660].map((hz) => sine(hz, -12, 8, 22050));
    const mixed = new Float32Array(channels[0]?.length ?? 0).map((_, i) => channels.reduce((sum, c) => sum + (c[i] as number), 0) / channels.length);
    const withoutLoudness = (f: ReturnType<typeof analyseAudio>) => ({ ...f, loudness: null });
    expect(withoutLoudness(analyseAudio(mixed, 22050, channels))).toEqual(withoutLoudness(analyseAudio(mixed, 22050)));
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
    expect(decoded.channelData).toEqual([decoded.samples]);
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
    const float = decodeWav(make(3, 32, [[0.5, -0.5], [1, 0]]));
    expect(Array.from(float.samples)).toEqual([0, 0.5]);
    expect(float.channelData.map((c) => Array.from(c))).toEqual([
      [0.5, 1],
      [-0.5, 0],
    ]);
    const pcm24 = decodeWav(make(1, 24, [[0.5, 0.25]])).samples[0] as number;
    expect(pcm24).toBeCloseTo(0.375, 5);
  });

  it("rejects a file that is not a WAV", () => {
    expect(() => decodeWav(new TextEncoder().encode("ID3 not a wave").buffer)).toThrow(WavError);
  });
});
