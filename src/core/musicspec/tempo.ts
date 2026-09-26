/**
 * Tap tempo and metronome scheduling (docs/SPEC.md §1.8). Pure: callers pass the clock,
 * so the rules are testable to the millisecond and the same code drives the browser.
 */
import type { Signature } from "./ir/types";

/** Taps that count toward the tempo: the last four give three intervals. */
export const TAP_WINDOW = 4;
/**
 * A tap whose interval is more than this share away from the running mean is discarded. A
 * second outlier in a row starts a new sequence from that tap.
 */
export const TAP_OUTLIER = 0.25;
/** A gap longer than this starts a new tap sequence. */
export const TAP_RESET_MS = 2000;
/** The tempo range the Composer accepts, typed or tapped. */
export const TEMPO_MIN_BPM = 20;
export const TEMPO_MAX_BPM = 300;

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

/**
 * Clicks per beat for a note-value subdivision in a meter. BPM counts the signature's
 * denominator (an eighth in 6/8), so 16ths are 4 per beat in 4/4 but 2 in 6/8. Null when
 * the note is not finer than the beat: 8ths in 6/8 are the beat itself.
 */
export function subdivisionSteps(note: 8 | 16, signature: Signature): 2 | 4 | null {
  const perBeat = note / Number(signature.split("/")[1]);
  return perBeat === 2 || perBeat === 4 ? perBeat : null;
}

/** The reading rounded for `D6.tempo.bpm`, or null when there is none or it is outside the Composer's range. */
export function assignableBpm(state: TapState): number | null {
  const { bpm } = reading(state);
  if (bpm === null) return null;
  const rounded = Math.round(bpm);
  return rounded >= TEMPO_MIN_BPM && rounded <= TEMPO_MAX_BPM ? rounded : null;
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
  /** Audio time and length of the beat the click belongs to, as scheduled (see cursorAfter). */
  beatTime: number;
  beatSec: number;
}

export interface MetronomeCursor {
  /** Audio time of the beat the last scheduled click belongs to (the first beat, before any). */
  beatTime: number;
  /**
   * That beat's length. It holds once the beat has started; a beat still ahead, even with its
   * downbeat scheduled, takes the tempo current at the next tick. 0 before any click.
   */
  beatSec: number;
  /** That beat's 0-based position in the bar. */
  beat: number;
  /** Audio time of the last scheduled click; −Infinity before any. */
  lastTime: number;
}

/** A cursor whose first click, a downbeat, falls at `time`. */
export function startCursor(time: number): MetronomeCursor {
  return { beatTime: time, beatSec: 0, beat: 0, lastTime: Number.NEGATIVE_INFINITY };
}

/**
 * The cursor as it stood right after `click` was scheduled. The metronome restarts from the
 * last click that has sounded when it drops clicks queued on settings that have changed.
 */
export function cursorAfter(click: Click): MetronomeCursor {
  return { beatTime: click.beatTime, beatSec: click.beatSec, beat: click.beat, lastTime: click.time };
}

/** Rounding slack when mapping a time back onto the step grid. */
const GRID_EPSILON = 1e-9;

/**
 * The clicks due before `until` (audio time) after the cursor's last click, and the cursor
 * after them. Called every tick with `until = now + lookahead`. Clicks that fell due before
 * `now` (a tick stalled by a background tab or a long task) are skipped, not played late in a
 * burst; the grid and the bar position carry on from where they would be.
 */
export function scheduleClicks(cursor: MetronomeCursor, until: number, settings: MetronomeSettings, now = -Infinity): { clicks: Click[]; cursor: MetronomeCursor } {
  if (!(settings.bpm > 0)) throw new RangeError(`bpm must be positive, got ${settings.bpm}`);
  const newBeatSec = 60 / settings.bpm;
  const clicks: Click[] = [];
  let { beatTime, lastTime, beat } = cursor;
  // A beat with nothing scheduled yet takes its place in the current meter now; one that has
  // sounded past a shrunk bar's end is followed by a new bar (nextBeat).
  if (lastTime < beatTime - GRID_EPSILON && beat >= settings.beatsPerBar) beat = 0;
  // A beat that has started keeps the tempo it started with, so no time that already sounded
  // is reinterpreted. A beat still ahead takes the current tempo, even when its downbeat is
  // already scheduled, so a change applies from the next beat to sound.
  let beatSec = cursor.beatSec > 0 && beatTime <= now ? cursor.beatSec : newBeatSec;
  const nextBeat = () => {
    beatTime += beatSec;
    // Past the bar's end (the meter may have shrunk mid-bar), the next beat opens a new bar.
    beat = beat + 1 >= settings.beatsPerBar ? 0 : beat + 1;
    beatSec = newBeatSec;
  };
  // Settings can change between ticks while the metronome runs. The next click is the first
  // step of the current grid after the last scheduled click and not before `now`, so a new
  // subdivision or tempo keeps the beat grid in phase.
  const firstStep = () => {
    const stepSec = beatSec / settings.subdivision;
    return Math.max(0, Math.ceil((now - beatTime) / stepSec - GRID_EPSILON), Math.floor((lastTime - beatTime) / stepSec + GRID_EPSILON) + 1);
  };
  let step = firstStep();
  for (;;) {
    if (step >= settings.subdivision) {
      // Move to the next beat only to schedule a click in it, so a beat that has not started
      // stays the cursor's beat and the next tick can still re-time it. After a stall, this
      // walks past the beats that fell due before `now`.
      if (beatTime + beatSec >= until) break;
      nextBeat();
      step = firstStep();
      continue;
    }
    const time = beatTime + step * (beatSec / settings.subdivision);
    if (time >= until) break;
    // A beat past a shrunk bar's end counts as a downbeat. Beat 3 exists whenever beat is 2, in
    // any meter of three or more.
    const inBar = beat >= settings.beatsPerBar ? 0 : beat;
    const accentBeat = inBar === 0 || (settings.halfTimeAccent && inBar === 2);
    clicks.push({ time, beat: inBar, step, accent: step !== 0 ? "sub" : accentBeat ? "bar" : "beat", beatTime, beatSec });
    lastTime = time;
    step += 1;
  }
  return { clicks, cursor: { beatTime, beatSec, beat, lastTime } };
}
