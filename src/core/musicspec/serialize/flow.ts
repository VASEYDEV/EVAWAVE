/**
 * Google Flow Music serializer (docs/SPEC.md §2.6). Sound is the style-equivalent field
 * with the negatives inline at its end (Flow has no exclude field). BPM and Length are
 * numbers. Structure travels in the Producer script: numbered lines, one per section plus a
 * line for each pickup, contrast phrase, transition and silence drop, timed by bar math.
 * Pure: same inputs, same bytes.
 */
import { computeBarMath, sectionTimeline, type TimeRange } from "../barmath";
import { coverageReport } from "../coverage";
import type { Catalog, CompiledPayload, EngineProfile, MusicSpec } from "../ir/types";
import { scrubNames } from "../lineage";
import { hash53, lowerFirst } from "../text";
import {
  aliasCoverage,
  contrastClause,
  DYNAMIC_WORD,
  inlineNegativeSentence,
  joinClauses,
  pickupText,
  sectionClauses,
  styleSentences,
  transitionText,
  type SerializeContext,
} from "./common";

/** "1:05": whole seconds, rounded once so adjacent ranges share their boundary. */
export function clock(sec: number): string {
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** "1:51–2:05", or "at 1:51" when both ends round to the same second. */
function span(range: TimeRange): string {
  const [start, end] = [clock(range.start), clock(range.end)];
  return start === end ? `at ${start}` : `${start}–${end}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The first-render Producer script: one instruction per line, numbered from 1. */
export function producerScript(ctx: SerializeContext): string {
  const { spec, catalog } = ctx;
  const lines: string[] = [];
  const timeline = sectionTimeline(spec.D6.tempo, spec.D6.meterLock.signature, spec.D7);
  for (const timing of timeline) {
    const { section, body } = timing;
    if (timing.silenceBefore) lines.push(`Silence before ${section.label}, ${span(timing.silenceBefore)}: drop to silence for ${plural(section.silenceAfter?.beats ?? 0, "beat")}.`);
    if (section.pickupBefore && timing.pickup) lines.push(`Pickup into ${section.label}, ${span(timing.pickup)}: ${lowerFirst(pickupText(section.pickupBefore))}.`);

    const clauses = joinClauses(sectionClauses(section, ctx, { contrast: false, transition: false, restatement: false }));
    const head = `${section.label}, ${span(body)} (${plural(section.bars, "bar")}), ${DYNAMIC_WORD[section.dynamics]}`;
    lines.push(clauses ? `${head}: ${clauses}.` : `${head}.`);

    if (section.contrast) {
      const barSec = section.bars > 0 ? (body.end - body.start) / section.bars : 0;
      const contrastSec = Math.min(section.contrast.bars, section.bars) * barSec;
      const range = section.contrast.position === "end" ? { start: body.end - contrastSec, end: body.end } : { start: body.start, end: body.start + contrastSec };
      lines.push(`${section.label} contrast, ${span(range)}: ${contrastClause(section.contrast, catalog)}.`);
    }
    const transition = section.transitionOut;
    if (transition.kind !== "none" && transition.kind !== "silence") lines.push(`End of ${section.label}, at ${clock(body.end)}: ${lowerFirst(transitionText(transition))}.`);
    if (timing.silenceAfter) lines.push(`Silence after ${section.label}, ${span(timing.silenceAfter)}: drop to silence for ${plural(section.silenceAfter?.beats ?? 0, "beat")}.`);
    else if (transition.kind === "silence") lines.push(`End of ${section.label}, at ${clock(body.end)}: drop to silence.`);
  }
  return lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
}

/** Serializes `spec` for Google Flow Music. Throws if `profile` is not the Flow profile. */
export function compileFlow(spec: MusicSpec, profile: EngineProfile, catalog: Catalog): CompiledPayload {
  if (profile.id !== "flow") throw new Error(`compileFlow needs the flow profile, got '${profile.id}'`);
  const ctx: SerializeContext = { spec, profile, catalog };
  const scrub = (text: string) => scrubNames(text, catalog.lineageNames);

  const soundSentences = [...styleSentences(ctx), inlineNegativeSentence(ctx)].filter((s): s is string => Boolean(s));
  const instrumental = spec.D8.instrumental && !spec.D8.lyricsPassthrough;
  const runtimeSec = computeBarMath(spec.D6.tempo, spec.D6.meterLock.signature, spec.D7).runtimeSec;
  const fields = {
    sound: scrub(soundSentences.join(" ")),
    lyrics: instrumental ? "" : scrub(spec.D8.lyricsPassthrough ?? ""),
    bpm: spec.D6.tempo.bpm,
    length: Math.round(runtimeSec),
    title: scrub(spec.D10.title ?? ""),
    producer_script: scrub(producerScript(ctx)),
  };
  const toggles = { instrumental };

  return {
    engine: "flow",
    profileVersion: profile.version,
    fields,
    toggles,
    coverage: coverageReport(spec, profile, aliasCoverage(ctx)),
    hash: hash53(JSON.stringify({ fields, toggles })),
  };
}
