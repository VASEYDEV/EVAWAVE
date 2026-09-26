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
  /** When the discarded tap came, while `discarded`. */
  rejectedAt?: number;
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

/** The latest tap, kept or discarded: the 2 s reset runs from it. */
export function lastTapAt(state: TapState): number | undefined {
  const kept = state.taps[state.taps.length - 1];
  return state.discarded && state.rejectedAt !== undefined && kept !== undefined ? Math.max(kept, state.rejectedAt) : kept;
}

/** Records a tap at `timeMs` and returns the new state. */
export function tap(state: TapState, timeMs: number): TapState {
  const last = state.taps[state.taps.length - 1];
  const latest = lastTapAt(state);
  if (last === undefined || latest === undefined || timeMs - latest > TAP_RESET_MS || timeMs <= last) return { taps: [timeMs], discarded: false };
  const current = intervals(state.taps);
  const interval = timeMs - last;
  if (current.length > 0) {
    const running = mean(current);
    const outlier = (gap: number) => Math.abs(gap - running) > TAP_OUTLIER * running;
    if (outlier(interval)) {
      // Intervals are measured from the last kept tap, so after a tempo change or a late tap
      // every later tap would miss the band until the 2 s reset. Two misses in a row mean the
      // kept taps no longer describe what the person is tapping: start again from this one.
      return state.discarded ? { taps: [timeMs], discarded: false } : { taps: state.taps, discarded: true, rejectedAt: timeMs };
    }
    // This tap fits the kept grid, but after a discard it may be a new tempo that lands on the
    // old grid every other tap (double time: 250 ms taps over a 500 ms grid). If its gap from
    // the discarded tap misses the band too, and matches the gap that tap left, the person is
    // keeping the new tempo: start again from the discarded tap. A stray tap matches neither.
    const rejectedAt = state.discarded ? state.rejectedAt : undefined;
    if (rejectedAt !== undefined) {
      const fromRejected = timeMs - rejectedAt;
      const rejectedGap = rejectedAt - last;
      if (outlier(fromRejected) && Math.abs(fromRejected - rejectedGap) <= TAP_OUTLIER * rejectedGap) return { taps: [rejectedAt, timeMs], discarded: false };
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
  const latest = lastTapAt(state);
  return latest !== undefined && nowMs - latest > TAP_RESET_MS;
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
  /** Audio time of the next click. */
  nextTime: number;
  /** Audio time of the beat the next click belongs to; subdivisions count from it. */
  beatTime: number;
  /**
   * Length of that beat at the tempo it started with, so a tempo change takes effect at the
   * next beat. 0 when no beat has started yet.
   */
  beatSec: number;
  beat: number;
  step: number;
}

/** A cursor whose first click, a downbeat, falls at `time`. */
export function startCursor(time: number): MetronomeCursor {
  return { nextTime: time, beatTime: time, beatSec: 0, beat: 0, step: 0 };
}

/** Rounding slack when mapping a time back onto the step grid. */
const GRID_EPSILON = 1e-9;

/**
 * The clicks due before `until` (audio time), starting at the cursor, and the cursor after
 * them. Called every tick with `until = now + lookahead`. Clicks that fell due before `now`
 * (a tick stalled by a background tab or a long task) are skipped, not played late in a burst;
 * the grid and the bar position carry on from where they would be.
 */
export function scheduleClicks(cursor: MetronomeCursor, until: number, settings: MetronomeSettings, now = -Infinity): { clicks: Click[]; cursor: MetronomeCursor } {
  if (!(settings.bpm > 0)) throw new RangeError(`bpm must be positive, got ${settings.bpm}`);
  const newBeatSec = 60 / settings.bpm;
  const clicks: Click[] = [];
  let { beatTime, beat } = cursor;
  // The beat in progress keeps the tempo it started with; a tempo change applies from the next
  // beat, so no time that already sounded is reinterpreted.
  let beatSec = cursor.beatSec > 0 ? cursor.beatSec : newBeatSec;
  const nextBeat = () => {
    beatTime += beatSec;
    beat += 1;
    beatSec = newBeatSec;
  };
  // Settings can change between ticks while the metronome runs. Re-derive the next click from
  // its beat: the first step of the current grid at or after the old next click (or `now`,
  // after a stall), or the next beat's downbeat past the last step, so a new subdivision keeps
  // the beat grid in phase.
  const from = Math.max(cursor.nextTime, now);
  while (beatTime + beatSec <= from + GRID_EPSILON) nextBeat();
  let step = Math.max(0, Math.ceil((from - beatTime) / (beatSec / settings.subdivision) - GRID_EPSILON));
  if (step >= settings.subdivision) {
    nextBeat();
    step = 0;
  }
  beat %= settings.beatsPerBar;
  let nextTime = beatTime + step * (beatSec / settings.subdivision);
  while (nextTime < until) {
    const accentBeat = beat === 0 || (settings.halfTimeAccent && beat === 2 && settings.beatsPerBar === 4);
    clicks.push({ time: nextTime, beat, step, accent: step !== 0 ? "sub" : accentBeat ? "bar" : "beat" });
    step += 1;
    if (step === settings.subdivision) {
      step = 0;
      nextBeat();
      beat %= settings.beatsPerBar;
    }
    nextTime = beatTime + step * (beatSec / settings.subdivision);
  }
  return { clicks, cursor: { nextTime, beatTime, beatSec, beat, step } };
}
