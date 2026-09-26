/** Synthetic test signals with known answers for the analysis tests. */

export function sine(freq: number, dbfs: number, seconds: number, sampleRate: number): Float32Array {
  const amp = 10 ** (dbfs / 20);
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / sampleRate));
}

/** Decaying 1.5 kHz clicks on every beat; beat 1 of each bar is louder. */
export function clickTrack(bpm: number, seconds: number, sampleRate: number, beatsPerBar = 4): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  const beatSamples = (60 / bpm) * sampleRate;
  const clickLength = Math.round(0.03 * sampleRate);
  for (let beat = 0; beat * beatSamples < out.length; beat++) {
    const start = Math.round(beat * beatSamples);
    const amp = beat % beatsPerBar === 0 ? 0.9 : 0.35;
    for (let i = 0; i < clickLength && start + i < out.length; i++) {
      out[start + i] = (out[start + i] as number) + amp * Math.exp(-i / (0.004 * sampleRate)) * Math.sin((2 * Math.PI * 1500 * i) / sampleRate);
    }
  }
  return out;
}

/** Clicks on every beat, with each beat's level taken in turn from `levels` (one bar's pattern). */
export function accentedClicks(bpm: number, seconds: number, sampleRate: number, levels: readonly number[]): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  const beatSamples = (60 / bpm) * sampleRate;
  const clickLength = Math.round(0.03 * sampleRate);
  for (let beat = 0; beat * beatSamples < out.length; beat++) {
    const start = Math.round(beat * beatSamples);
    const amp = levels[beat % levels.length] as number;
    for (let i = 0; i < clickLength && start + i < out.length; i++) {
      out[start + i] = (out[start + i] as number) + amp * Math.exp(-i / (0.004 * sampleRate)) * Math.sin((2 * Math.PI * 1500 * i) / sampleRate);
    }
  }
  return out;
}

/**
 * A tone that swells with no beat: its level rises `nepers` over `seconds`, fast at first and
 * levelling off, over a quiet seeded noise floor. Its onset flux falls steadily throughout.
 */
export function swell(freq: number, nepers: number, seconds: number, sampleRate: number, seed: number): Float32Array {
  let state = seed >>> 0;
  const jitter = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
  const k = (2 * nepers) / seconds ** 2;
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => {
    const t = i / sampleRate;
    return 0.9 * Math.exp(k * (seconds * t - (t * t) / 2) - nepers) * (Math.sin((2 * Math.PI * freq * i) / sampleRate) + 0.01 * jitter());
  });
}

/** Seeded white noise at `amplitude` peak. */
export function noise(seconds: number, sampleRate: number, amplitude: number, seed: number): Float32Array {
  let state = seed >>> 0;
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, () => amplitude * (((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1));
}

const midiHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** A sustained triad (with its root an octave down), e.g. D minor = 62, minor. */
export function triad(rootMidi: number, minor: boolean, seconds: number, sampleRate: number): Float32Array {
  const notes = [rootMidi - 12, rootMidi, rootMidi + (minor ? 3 : 4), rootMidi + 7];
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) =>
    notes.reduce((sum, n) => sum + 0.15 * Math.sin((2 * Math.PI * midiHz(n) * i) / sampleRate), 0),
  );
}

export function mix(...signals: Float32Array[]): Float32Array {
  const length = Math.max(...signals.map((s) => s.length));
  return Float32Array.from({ length }, (_, i) => signals.reduce((sum, s) => sum + (s[i] ?? 0), 0));
}
