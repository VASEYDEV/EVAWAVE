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
 * - loudness: ITU-R BS.1770 K-weighting per channel, summed with the channel weights, with
 *   400 ms gated blocks; range from 3 s windows (EBU Tech 3342);
 * - spectrum: centroid, energy above 1.5 kHz, energy below 60 Hz, onsets per second.
 *
 * Memory is bounded for long recordings: the frame pass keeps running sums and two numbers
 * per frame, never the spectra, and loudness keeps one number per 100 ms.
 */
import type { AudioFeatures } from "../ir/types";
import { decimate, hann, magnitudes, meanOf, percentile, type Biquad } from "./dsp";

const PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const ANALYSIS_RATE = 22050;
const FRAME = 2048;
const HOP = 512;

/** What one pass over the spectral frames keeps. */
interface FramePass {
  rate: number;
  frameRate: number;
  /** Half-wave-rectified log-magnitude flux per frame: the onset envelope. */
  flux: Float64Array;
  /** Spectral energy per frame, which the accent envelope differences. */
  energy: Float64Array;
  /** Energy per pitch class between 55 Hz and 2 kHz. */
  chroma: number[];
  /** Σ hz·magnitude and Σ magnitude, for the centroid. */
  centroidSum: number;
  magnitudeSum: number;
  /** Energy above 1.5 kHz, below 60 Hz, and in total. */
  brightEnergy: number;
  subEnergy: number;
  totalEnergy: number;
}

function framePass(samples: Float32Array, sampleRate: number): FramePass {
  const factor = Math.max(1, Math.floor(sampleRate / ANALYSIS_RATE));
  const signal = decimate(samples, factor);
  const rate = sampleRate / factor;
  const window = hann(FRAME);
  const binHz = rate / FRAME;
  // A short signal still gives one zero-padded frame.
  const count = signal.length === 0 ? 0 : signal.length < FRAME ? 1 : Math.floor((signal.length - FRAME) / HOP) + 1;
  const pass: FramePass = {
    rate,
    frameRate: rate / HOP,
    flux: new Float64Array(count),
    energy: new Float64Array(count),
    chroma: new Array<number>(12).fill(0),
    centroidSum: 0,
    magnitudeSum: 0,
    brightEnergy: 0,
    subEnergy: 0,
    totalEnergy: 0,
  };
  let prev: Float64Array | null = null;
  for (let t = 0; t < count; t++) {
    const spectrum = magnitudes(signal, t * HOP, window);
    if (prev) {
      let flux = 0;
      for (let k = 1; k < spectrum.length; k++) {
        const d = Math.log1p(100 * (spectrum[k] as number)) - Math.log1p(100 * (prev[k] as number));
        if (d > 0) flux += d;
      }
      pass.flux[t] = flux;
    }
    let frameEnergy = 0;
    for (let k = 1; k < spectrum.length; k++) {
      const hz = k * binHz;
      const m = spectrum[k] as number;
      const e = m ** 2;
      frameEnergy += e;
      pass.totalEnergy += e;
      pass.centroidSum += hz * m;
      pass.magnitudeSum += m;
      if (hz >= 1500) pass.brightEnergy += e;
      if (hz < 60) pass.subEnergy += e;
      if (hz >= 55 && hz <= 2000) {
        const pc = ((Math.round(12 * Math.log2(hz / 440)) + 69) % 12 + 12) % 12;
        pass.chroma[pc] = (pass.chroma[pc] as number) + e;
      }
    }
    pass.energy[t] = frameEnergy;
    prev = spectrum;
  }
  return pass;
}

/**
 * Positive frame-energy differences, one value per frame. Unlike the log flux it keeps
 * amplitude, so an accented downbeat stands out; the meter estimate reads it.
 */
function accentEnvelope(energy: Float64Array): Float64Array {
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

function estimateKey(chroma: readonly number[]): AudioFeatures["key"] {
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

interface Normalised {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function normalised({ b, a }: Biquad): Normalised {
  return { b0: b[0] / a[0], b1: b[1] / a[0], b2: b[2] / a[0], a1: a[1] / a[0], a2: a[2] / a[0] };
}

/**
 * BS.1770 channel weights by channel count, for the standard WAV (WAVE_FORMAT_EXTENSIBLE) and
 * Web Audio orders: 1.41 for surrounds between 60° and 120° azimuth, 0 for the LFE, 1.0
 * otherwise. 5.0 is L R C Ls Rs; 5.1 is L R C LFE Ls Rs; 7.1 is L R C LFE Lb Rb Ls Rs, whose
 * backs sit behind 120°. Other counts carry no known layout and weigh every channel 1.0.
 */
const LAYOUT_WEIGHTS: Readonly<Record<number, readonly number[]>> = {
  5: [1, 1, 1, 1.41, 1.41],
  6: [1, 1, 1, 0, 1.41, 1.41],
  8: [1, 1, 1, 0, 1, 1, 1.41, 1.41],
};

function channelWeight(index: number, count: number): number {
  return LAYOUT_WEIGHTS[count]?.[index] ?? 1;
}

/**
 * K-weighted energy per 100 ms sub-block, summed across channels with their BS.1770 weights.
 * The 400 ms gating blocks and the 3 s short-term windows are built from these sums, so the
 * cost is ten numbers per second whatever the length or channel count.
 */
function weightedEnergy(channels: readonly Float32Array[], sampleRate: number): { sums: Float64Array; size: number } {
  const size = Math.max(1, Math.round(0.1 * sampleRate));
  const sums = new Float64Array(Math.floor((channels[0]?.length ?? 0) / size));
  const [shelf, highpass] = kWeighting(sampleRate).map(normalised) as [Normalised, Normalised];
  channels.forEach((channel, c) => {
    const weight = channelWeight(c, channels.length);
    if (!weight) return;
    // The two biquads run inline, direct form I: this loop touches every sample of every channel.
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;
    for (let j = 0; j < sums.length; j++) {
      let sum = 0;
      for (let i = j * size; i < (j + 1) * size; i++) {
        const x = channel[i] as number;
        const y = shelf.b0 * x + shelf.b1 * x1 + shelf.b2 * x2 - shelf.a1 * y1 - shelf.a2 * y2;
        const z = highpass.b0 * y + highpass.b1 * y1 + highpass.b2 * y2 - highpass.a1 * z1 - highpass.a2 * z2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        z2 = z1;
        z1 = z;
        sum += z * z;
      }
      sums[j] = (sums[j] as number) + weight * sum;
    }
  });
  return { sums, size };
}

/** Mean-square power of each block of `length` sub-blocks, stepping `step` sub-blocks. */
function blockPowers(sums: Float64Array, size: number, length: number, step: number): number[] {
  const powers: number[] = [];
  for (let start = 0; start + length <= sums.length; start += step) {
    let sum = 0;
    for (let j = start; j < start + length; j++) sum += sums[j] as number;
    powers.push(sum / (length * size));
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

function measureLoudness(channels: readonly Float32Array[], sampleRate: number): AudioFeatures["loudness"] {
  const { sums, size } = weightedEnergy(channels, sampleRate);
  const integrated = gatedLoudness(blockPowers(sums, size, 4, 1), -10).loudness;
  const { kept } = gatedLoudness(blockPowers(sums, size, 30, 10), -20);
  const levels = kept.map(lufs);
  return { integratedLufs: integrated, loudnessRange: levels.length > 1 ? percentile(levels, 95) - percentile(levels, 10) : 0 };
}

/** One value per four bars of the detected meter (an unknown meter counts as 4/4). */
function energyCurve(samples: Float32Array, sampleRate: number, bpm: number, meter: AudioFeatures["meter"]): { curve: number[]; windowSec: number } {
  const beatsPerBar = meter.signature === "3/4" ? 3 : 4;
  const windowSec = bpm > 0 ? (4 * beatsPerBar * 60) / bpm : 8;
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

function spectralDescriptors(pass: FramePass, durationSec: number): AudioFeatures["spectral"] {
  const env = pass.flux;
  // Onsets: local peaks above mean + one standard deviation, at least 50 ms apart.
  const m = meanOf(env);
  const sd = Math.sqrt(meanOf(Array.from(env, (v) => (v - m) ** 2)));
  const minGap = Math.ceil(0.05 * pass.frameRate);
  let onsets = 0, lastOnset = -Infinity;
  for (let t = 1; t < env.length - 1; t++) {
    const v = env[t] as number;
    if (v > m + sd && v >= (env[t - 1] as number) && v > (env[t + 1] as number) && t - lastOnset >= minGap) {
      onsets++;
      lastOnset = t;
    }
  }
  return {
    centroidHz: pass.magnitudeSum ? pass.centroidSum / pass.magnitudeSum : 0,
    brightness: pass.totalEnergy ? pass.brightEnergy / pass.totalEnergy : 0,
    subWeight: pass.totalEnergy ? pass.subEnergy / pass.totalEnergy : 0,
    transientDensity: durationSec ? onsets / durationSec : 0,
  };
}

/**
 * An N-channel average of uncorrelated channels keeps 1/N of their mean energy. Below half of
 * that, the mix has lost the music to phase cancellation (0.25 for stereo, about 0.083 for 5.1).
 */
const MIX_ENERGY_FLOOR = 0.5;

function energyOf(signal: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < signal.length; i++) sum += (signal[i] as number) ** 2;
  return sum;
}

/**
 * The signal tempo, meter, key, energy and spectrum read: the mono mix, unless phase
 * cancellation took most of its energy (side-only or phase-opposed channels), in which case
 * the loudest channel, which still carries the music. The floor scales with the channel count,
 * so ordinary stereo and surround material always reads the mix.
 */
function analysisSignal(mix: Float32Array, channels: readonly Float32Array[]): Float32Array {
  if (channels.length < 2) return mix;
  const energies = channels.map(energyOf);
  const mean = meanOf(energies);
  if (mean === 0 || energyOf(mix) >= (MIX_ENERGY_FLOOR / channels.length) * mean) return mix;
  return channels[energies.indexOf(Math.max(...energies))] as Float32Array;
}

/**
 * Analyses a recording. `samples` is the mono mix, which tempo, meter, key, energy and
 * spectrum read unless phase cancellation emptied it (see `analysisSignal`). `channels` are
 * the decoded channels, whose K-weighted energies loudness sums per BS.1770; a mono source
 * passes the mix as its one channel (the default). `tags` stays empty: the v1 tagger is the
 * null implementation (§1.7 step 3).
 */
export function analyseAudio(samples: Float32Array, sampleRate: number, channels: readonly Float32Array[] = [samples]): AudioFeatures {
  if (!(sampleRate > 0)) throw new RangeError(`sampleRate must be positive, got ${sampleRate}`);
  if (!channels.length || channels.some((c) => c.length !== samples.length)) throw new RangeError("every channel must have the mix's length");
  const durationSec = samples.length / sampleRate;
  const signal = analysisSignal(samples, channels);
  const pass = framePass(signal, sampleRate);
  const tempo = estimateTempo(pass.flux, pass.frameRate);
  const { lag, ...bpm } = tempo;
  const meter = estimateMeter(accentEnvelope(pass.energy), lag);
  const { curve, windowSec } = energyCurve(signal, sampleRate, bpm.value, meter);
  return {
    durationSec,
    bpm,
    meter,
    key: estimateKey(pass.chroma),
    loudness: measureLoudness(channels, sampleRate),
    energyCurve: curve,
    sections: sectionsFrom(curve, windowSec, durationSec),
    spectral: spectralDescriptors(pass, durationSec),
    tags: [],
  };
}
