/**
 * Small, deterministic DSP building blocks for on-device analysis (docs/SPEC.md §1.7):
 * a radix-2 FFT, windows, biquads and resampling. Pure functions over typed arrays.
 */

/** In-place iterative radix-2 FFT. `re` and `im` must have a power-of-two length. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) throw new RangeError("fft needs equal power-of-two lengths");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] as number, re[i] as number];
      [im[i], im[j]] = [im[j] as number, im[i] as number];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const cos = Math.cos(step * k);
        const sin = Math.sin(step * k);
        const a = start + k;
        const b = a + half;
        const tr = (re[b] as number) * cos - (im[b] as number) * sin;
        const ti = (re[b] as number) * sin + (im[b] as number) * cos;
        re[b] = (re[a] as number) - tr;
        im[b] = (im[a] as number) - ti;
        re[a] = (re[a] as number) + tr;
        im[a] = (im[a] as number) + ti;
      }
    }
  }
}

export function hann(size: number): Float64Array {
  const w = new Float64Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  return w;
}

/** Magnitudes of bins 0…size/2 for one windowed frame starting at `offset` (zero-padded past the end). */
export function magnitudes(signal: Float32Array, offset: number, window: Float64Array): Float64Array {
  const size = window.length;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i++) re[i] = (signal[offset + i] ?? 0) * (window[i] as number);
  fft(re, im);
  const out = new Float64Array(size / 2 + 1);
  for (let k = 0; k <= size / 2; k++) out[k] = Math.hypot(re[k] as number, im[k] as number);
  return out;
}

export interface Biquad {
  b: [number, number, number];
  a: [number, number, number];
}

/** Averages `factor` samples at a time: a crude low-pass decimator, enough for descriptors. */
export function decimate(signal: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return signal;
  const out = new Float32Array(Math.floor(signal.length / factor));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += signal[i * factor + j] as number;
    out[i] = sum / factor;
  }
  return out;
}

export function meanOf(values: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i] as number;
  return values.length ? sum / values.length : 0;
}

/**
 * Where the vertex of the parabola through (−1, y0), (0, y1), (1, y2) lies, from −0.5 to 0.5,
 * when y1 is a local maximum. Anything else returns 0: through a slope or a trough the vertex
 * can land any distance away, even past the origin of a lag axis.
 */
export function parabolicPeakOffset(y0: number, y1: number, y2: number): number {
  const denom = y0 - 2 * y1 + y2;
  if (!(y1 >= y0 && y1 >= y2 && denom < 0)) return 0;
  return (0.5 * (y0 - y2)) / denom;
}

/** The p-th percentile (0–100) by linear interpolation; values need not be sorted. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (rank - lo);
}
