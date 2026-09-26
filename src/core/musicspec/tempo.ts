/**
 * Tap tempo and metronome scheduling (docs/SPEC.md §1.8). Pure: callers pass the clock,
 * so the rules are testable to the millisecond and the same code drives the browser.
 */

/** Taps that count toward the tempo: the last four give three intervals. */
export const TAP_WINDOW = 4;
/**
 * A tap whose interval is more than this share away from the running mean is discarded. A
 * second outlier in a row starts a new sequence from that tap.
 */
export const TAP_OUTLIER = 0.25;
/** A gap longer than this starts a new tap sequence. */
export const TAP_RESET_MS = 2000;

export interface TapState {
  /** Accepted tap times in milliseconds, oldest first, at most TAP_WINDOW. */
  taps: number[];
  /** True when the last tap was discarded as an outlier. */
  discarded: boolean;
}

export interface TapReading {
  /** Unrounded BPM, or null until TAP_WINDOW taps are in. */
  bpm: number | null;
  halfTime: number | null;
  doubleTime: number | null;
}

export function emptyTaps(): TapState {
  return { taps: [], discarded: false };
}

function intervals(taps: readonly number[]): number[] {
  return taps.slice(1).map((t, i) => t - (taps[i] as number));
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Records a tap at `timeMs` and returns the new state. */
export function tap(state: TapState, timeMs: number): TapState {
  const last = state.taps[state.taps.length - 1];
  if (last === undefined || timeMs - last > TAP_RESET_MS || timeMs <= last) return { taps: [timeMs], discarded: false };
  const current = intervals(state.taps);
  const interval = timeMs - last;
  if (current.length > 0) {
    const running = mean(current);
    if (Math.abs(interval - running) > TAP_OUTLIER * running) {
      // Intervals are measured from the last kept tap, so after a tempo change or a late tap
      // every later tap would miss the band until the 2 s reset. Two misses in a row mean the
      // kept taps no longer describe what the person is tapping: start again from this one.
      return state.discarded ? { taps: [timeMs], discarded: false } : { taps: state.taps, discarded: true };
    }
  }
  return { taps: [...state.taps, timeMs].slice(-TAP_WINDOW), discarded: false };
}

/**
 * BPM from the mean interval across the last four taps, with its half- and double-time
 * candidates. Fewer taps read nothing, so one noisy interval can never be assigned.
 */
export function reading(state: TapState): TapReading {
  if (state.taps.length < TAP_WINDOW) return { bpm: null, halfTime: null, doubleTime: null };
  const gaps = intervals(state.taps);
  const bpm = 60000 / mean(gaps);
  return { bpm, halfTime: bpm / 2, doubleTime: bpm * 2 };
}

/** True when the sequence has timed out at `nowMs` (the display should clear). */
export function tapsExpired(state: TapState, nowMs: number): boolean {
  const last = state.taps[state.taps.length - 1];
  return last !== undefined && nowMs - last > TAP_RESET_MS;
}

// ─── Metronome scheduling ─────────────────────────────────────────────────────────────

/** Web Audio lookahead scheduler timings (§1.8): a 25 ms tick scheduling 100 ms ahead. */
export const METRONOME_TICK_MS = 25;
export const METRONOME_LOOKAHEAD_SEC = 0.1;

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  /** Accents beats 1 and 3, so a 140 half-time grid auditions as 70 (§1.8). */
  halfTimeAccent: boolean;
  /** Clicks between beats: none, 8ths or 16ths. */
  subdivision: 1 | 2 | 4;
}

export interface Click {
  /** Seconds on the audio clock. */
  time: number;
  /** 0-based beat in the bar. */
  beat: number;
  /** 0 on the beat; 1…subdivision−1 between beats. */
  step: number;
  accent: "bar" | "beat" | "sub";
}

export interface MetronomeCursor {
  nextTime: number;
  beat: number;
  step: number;
}

/**
 * The clicks due before `until` (audio time), starting at the cursor, and the cursor after
 * them. Called every tick with `until = now + lookahead`.
 */
export function scheduleClicks(cursor: MetronomeCursor, until: number, settings: MetronomeSettings): { clicks: Click[]; cursor: MetronomeCursor } {
  if (!(settings.bpm > 0)) throw new RangeError(`bpm must be positive, got ${settings.bpm}`);
  const stepSec = 60 / settings.bpm / settings.subdivision;
  const clicks: Click[] = [];
  let { nextTime, beat, step } = cursor;
  // Settings can change between ticks while the metronome runs. A cursor left past the new
  // subdivision or meter moves to the next beat, or the step counter would never wrap.
  if (step >= settings.subdivision) {
    step = 0;
    beat += 1;
  }
  beat %= settings.beatsPerBar;
  while (nextTime < until) {
    const accentBeat = beat === 0 || (settings.halfTimeAccent && beat === 2 && settings.beatsPerBar === 4);
    clicks.push({ time: nextTime, beat, step, accent: step !== 0 ? "sub" : accentBeat ? "bar" : "beat" });
    nextTime += stepSec;
    step += 1;
    if (step === settings.subdivision) {
      step = 0;
      beat = (beat + 1) % settings.beatsPerBar;
    }
  }
  return { clicks, cursor: { nextTime, beat, step } };
}
