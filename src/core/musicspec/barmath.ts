/**
 * Bar math (docs/SPEC.md §2.5). `barSec = beatsPerBar × 60 / bpm`, where `beatsPerBar` is
 * the signature's numerator. Pickups and silence drops count toward runtime; contrast
 * phrases sit inside their section's bars. Nothing is rounded except `barsToMs`.
 */
import type { BarMath, Section, Signature, Structure, Tempo } from "./ir/types";

export const BEATS_PER_BAR: Readonly<Record<Signature, number>> = {
  "4/4": 4,
  "3/4": 3,
  "6/8": 6,
  "12/8": 12,
  "5/4": 5,
  "7/8": 7,
};

function assertBpm(bpm: number): void {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError(`bpm must be a positive number, got ${bpm}`);
}

function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a non-negative number, got ${value}`);
}

export function beatsPerBar(signature: Signature): number {
  return BEATS_PER_BAR[signature];
}

/** Seconds per bar. */
export function barSec(bpm: number, signature: Signature = "4/4"): number {
  assertBpm(bpm);
  return (beatsPerBar(signature) * 60) / bpm;
}

/** Seconds for a number of beats. */
export function beatsToSec(beats: number, bpm: number): number {
  assertBpm(bpm);
  assertNonNegative(beats, "beats");
  return (beats * 60) / bpm;
}

/** Seconds for a number of bars. */
export function barsToSec(bars: number, bpm: number, signature: Signature = "4/4"): number {
  assertNonNegative(bars, "bars");
  return bars * barSec(bpm, signature);
}

/** Whole milliseconds for a number of bars: the unit of Eleven's `duration_ms`. */
export function barsToMs(bars: number, bpm: number, signature: Signature = "4/4"): number {
  return Math.round(barsToSec(bars, bpm, signature) * 1000);
}

export interface SectionSpan {
  /** Bars including the pickup and the silence, as fractions of a bar. */
  bars: number;
  pickupSec: number;
  bodySec: number;
  silenceSec: number;
  totalSec: number;
}

/** Duration of one section: its pickup, its own bars and any silence drop. */
export function sectionSpan(section: Pick<Section, "bars" | "pickupBefore" | "silenceAfter">, bpm: number, signature: Signature = "4/4"): SectionSpan {
  assertNonNegative(section.bars, "section.bars");
  const perBar = beatsPerBar(signature);
  const pickupBeats = section.pickupBefore?.beats ?? 0;
  const silenceBeats = section.silenceAfter?.beats ?? 0;
  const pickupSec = beatsToSec(pickupBeats, bpm);
  const bodySec = barsToSec(section.bars, bpm, signature);
  const silenceSec = beatsToSec(silenceBeats, bpm);
  return {
    bars: section.bars + pickupBeats / perBar + silenceBeats / perBar,
    pickupSec,
    bodySec,
    silenceSec,
    totalSec: pickupSec + bodySec + silenceSec,
  };
}

/**
 * The derived `BarMath` for a structure. `sectionStarts[i]` is the 0-based bar and second at
 * which section i's own material begins, its pickup first.
 */
export function computeBarMath(tempo: Pick<Tempo, "bpm">, signature: Signature, structure: Pick<Structure, "sections">): BarMath {
  const perBarSec = barSec(tempo.bpm, signature);
  const sectionStarts: BarMath["sectionStarts"] = [];
  let bar = 0;
  let sec = 0;
  for (const section of structure.sections) {
    sectionStarts.push({ sectionId: section.id, bar, sec });
    const span = sectionSpan(section, tempo.bpm, signature);
    bar += span.bars;
    sec += span.totalSec;
  }
  return {
    barSec: perBarSec,
    block8Sec: 8 * perBarSec,
    block16Sec: 16 * perBarSec,
    runtimeSec: sec,
    sectionStarts,
  };
}
