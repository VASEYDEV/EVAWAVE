import type { BarMath, Section, SectionStart, Signature, Structure, Tempo } from "./ir/types";

/**
 * Bar math (IR v0.3 delta §3): `barSec = beatsPerBar × 60 / bpm`; a pickup counts as
 * `beats / beatsPerBar` bars, a silence drop counts in beats, and a contrast phrase sits
 * inside its section's bars. Every function is a pure function of its arguments: no
 * rounding except `barsToMs`, no Date, no randomness (.claude/rules/musicspec-core.md, rule 2).
 *
 * `bpm` counts the signature's denominator unit, so `beatsPerBar` is the numerator
 * (6/8 → six eighth-note beats). `Tempo.feltBpm` is display only and never enters the math.
 */

const BEATS_PER_BAR: Record<Signature, number> = {
  "4/4": 4,
  "3/4": 3,
  "6/8": 6,
  "12/8": 12,
  "5/4": 5,
  "7/8": 7,
};

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, got ${String(value)}`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number, got ${String(value)}`);
  }
}

/** Beats per bar for a signature: its numerator. */
export function beatsPerBar(signature: Signature): number {
  return BEATS_PER_BAR[signature];
}

/** Seconds per bar. At 142 BPM in 4/4 a bar is 1.69 s; at 140 BPM, 1.714 s. */
export function barSec(bpm: number, signature: Signature = "4/4"): number {
  assertPositiveFinite(bpm, "bpm");
  return (beatsPerBar(signature) * 60) / bpm;
}

/** Seconds for a number of beats at a tempo. */
export function beatsToSec(beats: number, bpm: number): number {
  assertNonNegativeFinite(beats, "beats");
  assertPositiveFinite(bpm, "bpm");
  return (beats * 60) / bpm;
}

/** Seconds for a number of bars. Eight bars at 142 BPM are 13.5 s; sixteen are 27 s. */
export function barsToSec(bars: number, bpm: number, signature: Signature = "4/4"): number {
  assertNonNegativeFinite(bars, "bars");
  return bars * barSec(bpm, signature);
}

/** Whole milliseconds for a number of bars: the ElevenLabs `duration_ms` unit (4 bars at 140 BPM → 6857). */
export function barsToMs(bars: number, bpm: number, signature: Signature = "4/4"): number {
  return Math.round(barsToSec(bars, bpm, signature) * 1000);
}

/** One section's footprint on the timeline, pickup and silence included. */
export interface SectionSpan {
  /** Bars occupied, fractional when a pickup or silence drop is present. */
  bars: number;
  pickupSec: number;
  bodySec: number;
  silenceSec: number;
  /** `pickupSec + bodySec + silenceSec`, summed in that order so runtime totals stay exact. */
  totalSec: number;
}

/** Duration of a section including its `pickupBefore` and `silenceAfter`. */
export function sectionSpan(section: Section, bpm: number, signature: Signature): SectionSpan {
  assertNonNegativeFinite(section.bars, `section ${section.id} bars`);
  const perBar = barSec(bpm, signature);
  const perBeat = perBar / beatsPerBar(signature);
  const pickupBeats = section.pickupBefore?.beats ?? 0;
  const silenceBeats = section.silenceAfter?.beats ?? 0;
  assertNonNegativeFinite(silenceBeats, `section ${section.id} silenceAfter.beats`);
  const pickupSec = pickupBeats * perBeat;
  const bodySec = section.bars * perBar;
  const silenceSec = silenceBeats * perBeat;
  return {
    bars: section.bars + (pickupBeats + silenceBeats) / beatsPerBar(signature),
    pickupSec,
    bodySec,
    silenceSec,
    totalSec: pickupSec + bodySec + silenceSec,
  };
}

/**
 * The derived `BarMath` for a structure. `sectionStarts[i]` is the 0-based bar offset and
 * the second at which section i's own material begins, its pickup first when it has one, so
 * `runtimeSec` is the last start plus the last span. Pass `MeterLock.signature`: the lock's
 * signature applies whether or not the lock is enabled (it defaults to 4/4).
 */
export function computeBarMath(
  tempo: Pick<Tempo, "bpm">,
  signature: Signature,
  structure: Pick<Structure, "sections">,
): BarMath {
  const perBar = barSec(tempo.bpm, signature);
  const sectionStarts: SectionStart[] = [];
  let bar = 0;
  let sec = 0;
  for (const section of structure.sections) {
    sectionStarts.push({ sectionId: section.id, bar, sec });
    const span = sectionSpan(section, tempo.bpm, signature);
    bar += span.bars;
    sec += span.totalSec;
  }
  return {
    barSec: perBar,
    block8Sec: 8 * perBar,
    block16Sec: 16 * perBar,
    runtimeSec: sec,
    sectionStarts,
  };
}
