/**
 * On-device audio analysis into `AudioFeatures` (docs/SPEC.md §1.7 step 2). Pure and
 * deterministic: the same samples always give the same features. Nothing here identifies a
 * recording; it measures traits (tempo, meter, key, loudness, energy, spectrum).
 *
 * Methods, kept simple and documented so the numbers can be checked:
 * - tempo: spectral-flux onset envelope, autocorrelation over 60–200 BPM, weighted by a
 *   log-normal prior around 120 BPM against octave errors;
 * - meter: autocorrelation of an amplitude-keeping accent envelope at 4-beat against 3-beat
 *   bar lags;
 * - key: chroma from the magnitude spectrum, correlated with the Krumhansl–Kessler profiles;
 * - loudness: ITU-R BS.1770 K-weighting with 400 ms gated blocks; range from 3 s windows
 *   (EBU Tech 3342);
 * - spectrum: centroid, energy above 1.5 kHz, energy below 60 Hz, onsets per second.
 */
import type { AudioFeatures } from "../ir/types";
import { decimate, filter, hann, magnitudes, meanOf, percentile, type Biquad } from "./dsp";

const PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const ANALYSIS_RATE = 22050;
const FRAME = 2048;
const HOP = 512;

interface Frames {
  rate: number;
  frameRate: number;
  spectra: Float64Array[];
}

function spectralFrames(samples: Float32Array, sampleRate: number): Frames {
  const factor = Math.max(1, Math.floor(sampleRate / ANALYSIS_RATE));
  const signal = decimate(samples, factor);
  const rate = sampleRate / factor;
  const window = hann(FRAME);
  const spectra: Float64Array[] = [];
  for (let offset = 0; offset + FRAME <= signal.length || (offset === 0 && signal.length > 0); offset += HOP) {
    spectra.push(magnitudes(signal, offset, window));
    if (offset + FRAME > signal.length) break;
  }
  return { rate, frameRate: rate / HOP, spectra };
}

/** Half-wave-rectified log-magnitude flux, one value per frame. */
function onsetEnvelope(frames: Frames): Float64Array {
  const env = new Float64Array(frames.spectra.length);
  for (let t = 1; t < frames.spectra.length; t++) {
    const cur = frames.spectra[t] as Float64Array;
    const prev = frames.spectra[t - 1] as Float64Array;
    let flux = 0;
    for (let k = 1; k < cur.length; k++) {
      const d = Math.log1p(100 * (cur[k] as number)) - Math.log1p(100 * (prev[k] as number));
      if (d > 0) flux += d;
    }
    env[t] = flux;
  }
  return env;
}

/**
 * Positive frame-energy differences, one value per frame. Unlike the log flux it keeps
 * amplitude, so an accented downbeat stands out; the meter estimate reads it.
 */
function accentEnvelope(frames: Frames): Float64Array {
  const energy = frames.spectra.map((spectrum) => {
    let sum = 0;
    for (let k = 1; k < spectrum.length; k++) sum += (spectrum[k] as number) ** 2;
    return sum;
  });
  const env = new Float64Array(energy.length);
  for (let t = 1; t < energy.length; t++) env[t] = Math.max(0, (energy[t] as number) - (energy[t - 1] as number));
  return env;
}

function autocorrelation(env: Float64Array, lag: number): number {
  let sum = 0;
  for (let i = lag; i < env.length; i++) sum += (env[i] as number) * (env[i - lag] as number);
  return sum / Math.max(1, env.length - lag);
}

/** Autocorrelation at a fractional lag, by linear interpolation. */
function autocorrelationAt(env: Float64Array, lag: number): number {
  const lo = Math.floor(lag);
  return autocorrelation(env, lo) + (autocorrelation(env, lo + 1) - autocorrelation(env, lo)) * (lag - lo);
}

function estimateTempo(env: Float64Array, frameRate: number): AudioFeatures["bpm"] & { lag: number } {
  const centred = env.map((v) => v - meanOf(env));
  const minLag = Math.max(1, Math.floor((60 * frameRate) / 200));
  const maxLag = Math.min(centred.length - 1, Math.ceil((60 * frameRate) / 60));
  const zero = autocorrelation(centred, 0) || 1;
  let bestLag = 0, bestScore = -Infinity;
  const scores: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * frameRate) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1) ** 2);
    const score = (autocorrelation(centred, lag) / zero) * prior;
    scores.push(score);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!bestLag || bestScore <= 0) return { value: 0, confidence: 0, halfTimeCandidate: 0, doubleTimeCandidate: 0, lag: 0 };
  // Parabolic interpolation around the peak for a sub-frame lag.
  const y0 = autocorrelation(centred, bestLag - 1), y1 = autocorrelation(centred, bestLag), y2 = autocorrelation(centred, bestLag + 1);
  const denom = y0 - 2 * y1 + y2;
  const lag = denom < 0 ? bestLag + (0.5 * (y0 - y2)) / denom : bestLag;
  const value = (60 * frameRate) / lag;
  const median = percentile(scores, 50);
  const confidence = Math.max(0, Math.min(1, (bestScore - median) / (Math.abs(bestScore) + 1e-9)));
  return { value, confidence, halfTimeCandidate: value / 2, doubleTimeCandidate: value * 2, lag };
}

function estimateMeter(env: Float64Array, beatLag: number): AudioFeatures["meter"] {
  if (!beatLag) return { signature: "unknown", confidence: 0 };
  const centred = env.map((v) => v - meanOf(env));
  const four = autocorrelationAt(centred, beatLag * 4);
  const three = autocorrelationAt(centred, beatLag * 3);
  const top = Math.max(four, three);
  if (top <= 0) return { signature: "unknown", confidence: 0 };
  const confidence = Math.min(1, Math.abs(four - three) / top);
  if (confidence < 0.1) return { signature: "unknown", confidence };
  return { signature: four >= three ? "4/4" : "3/4", confidence };
}

function correlate(a: readonly number[], b: readonly number[]): number {
  const ma = meanOf(a), mb = meanOf(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = (a[i] as number) - ma, y = (b[i] as number) - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

function estimateKey(frames: Frames): AudioFeatures["key"] {
  const chroma = new Array<number>(12).fill(0);
  const binHz = frames.rate / FRAME;
  for (const spectrum of frames.spectra) {
    for (let k = 1; k < spectrum.length; k++) {
      const hz = k * binHz;
      if (hz < 55 || hz > 2000) continue;
      const pc = ((Math.round(12 * Math.log2(hz / 440)) + 69) % 12 + 12) % 12;
      chroma[pc] = (chroma[pc] as number) + (spectrum[k] as number) ** 2;
    }
  }
  const scores: { tonic: number; mode: "major" | "minor"; r: number }[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = chroma.map((_, i) => chroma[(i + tonic) % 12] as number);
    scores.push({ tonic, mode: "major", r: correlate(rotated, MAJOR) }, { tonic, mode: "minor", r: correlate(rotated, MINOR) });
  }
  scores.sort((x, y) => y.r - x.r);
  const [best, second] = scores;
  if (!best || best.r <= 0) return { tonic: "C", mode: "major", confidence: 0 };
  const confidence = Math.max(0, Math.min(1, best.r * (1 - (second?.r ?? 0) / best.r) * 4));
  return { tonic: PITCHES[best.tonic] as string, mode: best.mode, confidence };
}

/** BS.1770 K-weighting: exact ITU coefficients at 48 kHz, RBJ equivalents at other rates. */
function kWeighting(sampleRate: number): [Biquad, Biquad] {
  if (sampleRate === 48000) {
    return [
      { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] },
      { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] },
    ];
  }
  const shelf = (() => {
    const A = 10 ** (4 / 40), w0 = (2 * Math.PI * 1500) / sampleRate, alpha = Math.sin(w0) / (2 * Math.SQRT1_2), c = Math.cos(w0), s = 2 * Math.sqrt(A) * alpha;
    return { b: [A * (A + 1 + (A - 1) * c + s), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - s)], a: [A + 1 - (A - 1) * c + s, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - s] } as Biquad;
  })();
  const highpass = (() => {
    const w0 = (2 * Math.PI * 38) / sampleRate, alpha = Math.sin(w0) / (2 * 0.5), c = Math.cos(w0);
    return { b: [(1 + c) / 2, -(1 + c), (1 + c) / 2], a: [1 + alpha, -2 * c, 1 - alpha] } as Biquad;
  })();
  return [shelf, highpass];
}

function blockPowers(weighted: Float64Array, sampleRate: number, blockSec: number, stepSec: number): number[] {
  const size = Math.round(blockSec * sampleRate);
  const step = Math.round(stepSec * sampleRate);
  const powers: number[] = [];
  for (let start = 0; start + size <= weighted.length; start += step) {
    let sum = 0;
    for (let i = start; i < start + size; i++) sum += (weighted[i] as number) ** 2;
    powers.push(sum / size);
  }
  return powers;
}

const lufs = (power: number) => -0.691 + 10 * Math.log10(power);

function gatedLoudness(powers: readonly number[], relativeGate: number): { loudness: number; kept: number[] } {
  const absolute = powers.filter((p) => lufs(p) > -70);
  if (!absolute.length) return { loudness: -70, kept: [] };
  const threshold = lufs(meanOf(absolute)) + relativeGate;
  const kept = absolute.filter((p) => lufs(p) > threshold);
  return { loudness: kept.length ? lufs(meanOf(kept)) : -70, kept };
}

function measureLoudness(samples: Float32Array, sampleRate: number): AudioFeatures["loudness"] {
  const [stage1, stage2] = kWeighting(sampleRate);
  const weighted = filter(filter(samples, stage1), stage2);
  const integrated = gatedLoudness(blockPowers(weighted, sampleRate, 0.4, 0.1), -10).loudness;
  const shortTerm = blockPowers(weighted, sampleRate, 3, 1);
  const { kept } = gatedLoudness(shortTerm, -20);
  const levels = kept.map(lufs);
  return { integratedLufs: integrated, loudnessRange: levels.length > 1 ? percentile(levels, 95) - percentile(levels, 10) : 0 };
}

function energyCurve(samples: Float32Array, sampleRate: number, bpm: number): { curve: number[]; windowSec: number } {
  const windowSec = bpm > 0 ? (16 * 60) / bpm : 8;
  const size = Math.max(1, Math.round(windowSec * sampleRate));
  const rms: number[] = [];
  for (let start = 0; start < samples.length; start += size) {
    let sum = 0;
    const end = Math.min(samples.length, start + size);
    for (let i = start; i < end; i++) sum += (samples[i] as number) ** 2;
    rms.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const peak = Math.max(...rms, 1e-12);
  return { curve: rms.map((v) => v / peak), windowSec };
}

function sectionsFrom(curve: readonly number[], windowSec: number, durationSec: number): AudioFeatures["sections"] {
  const sections: AudioFeatures["sections"] = [];
  let start = 0;
  for (let i = 1; i <= curve.length; i++) {
    const boundary = i === curve.length || Math.abs((curve[i] as number) - (curve[i - 1] as number)) > 0.25;
    if (!boundary) continue;
    sections.push({ startSec: start * windowSec, endSec: Math.min(durationSec, i * windowSec), energy: meanOf(curve.slice(start, i)) });
    start = i;
  }
  return sections;
}

function spectralDescriptors(frames: Frames, env: Float64Array, durationSec: number): AudioFeatures["spectral"] {
  const binHz = frames.rate / FRAME;
  let weighted = 0, total = 0, bright = 0, sub = 0;
  for (const spectrum of frames.spectra) {
    for (let k = 1; k < spectrum.length; k++) {
      const hz = k * binHz;
      const m = spectrum[k] as number;
      const e = m * m;
      weighted += hz * m;
      total += m;
      if (hz >= 1500) bright += e;
      if (hz < 60) sub += e;
    }
  }
  let energy = 0;
  for (const spectrum of frames.spectra) for (let k = 1; k < spectrum.length; k++) energy += (spectrum[k] as number) ** 2;
  // Onsets: local peaks above mean + one standard deviation, at least 50 ms apart.
  const m = meanOf(env);
  const sd = Math.sqrt(meanOf(Array.from(env, (v) => (v - m) ** 2)));
  const minGap = Math.ceil(0.05 * frames.frameRate);
  let onsets = 0, lastOnset = -Infinity;
  for (let t = 1; t < env.length - 1; t++) {
    const v = env[t] as number;
    if (v > m + sd && v >= (env[t - 1] as number) && v > (env[t + 1] as number) && t - lastOnset >= minGap) {
      onsets++;
      lastOnset = t;
    }
  }
  return {
    centroidHz: total ? weighted / total : 0,
    brightness: energy ? bright / energy : 0,
    subWeight: energy ? sub / energy : 0,
    transientDensity: durationSec ? onsets / durationSec : 0,
  };
}

/** Analyses mono PCM. `tags` stays empty: the v1 tagger is the null implementation (§1.7 step 3). */
export function analyseAudio(samples: Float32Array, sampleRate: number): AudioFeatures {
  if (!(sampleRate > 0)) throw new RangeError(`sampleRate must be positive, got ${sampleRate}`);
  const durationSec = samples.length / sampleRate;
  const frames = spectralFrames(samples, sampleRate);
  const env = onsetEnvelope(frames);
  const tempo = estimateTempo(env, frames.frameRate);
  const { lag, ...bpm } = tempo;
  const { curve, windowSec } = energyCurve(samples, sampleRate, bpm.value);
  return {
    durationSec,
    bpm,
    meter: estimateMeter(accentEnvelope(frames), lag),
    key: estimateKey(frames),
    loudness: measureLoudness(samples, sampleRate),
    energyCurve: curve,
    sections: sectionsFrom(curve, windowSec, durationSec),
    spectral: spectralDescriptors(frames, env, durationSec),
    tags: [],
  };
}
