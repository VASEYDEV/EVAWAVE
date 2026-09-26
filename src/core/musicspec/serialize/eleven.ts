/**
 * ElevenLabs Music v2 serializer (docs/SPEC.md §2.6). The primary artifact is a
 * `music_v2` composition plan: one chunk per section, a contrast phrase as its own chunk,
 * and pickups, silence drops and transitions folded into chunk text as {inline directions}.
 * The simple-mode `prompt` is the web-app paste. Pure: same inputs, same bytes.
 */
import { sectionTimeline, type SectionTiming } from "../barmath";
import { coverageReport, type Rendering } from "../coverage";
import type { Catalog, CompiledPayload, ElevenCompositionPlan, ElevenGenerationChunk, EngineProfile, MusicSpec, Section } from "../ir/types";
import { scrubNames } from "../lineage";
import { hash53, lowerFirst } from "../text";
import {
  aliasCoverage,
  contrastStyleWord,
  DYNAMIC_WORD,
  inlineNegativeSentence,
  negativeTerms,
  pickupDirection,
  pocketText,
  phraseLabel,
  scrubDeep,
  sectionHead,
  styleSentences,
  transitionText,
  type SerializeContext,
} from "./common";

/** Verified plan limit (eleven profile, verification 2026-09-16): at most 30 chunks. */
export const ELEVEN_MAX_CHUNKS = 30;

/** Chunk text and timing before rounding; durations are exact seconds. */
interface Draft {
  head: string[];
  body: string[];
  tail: string[];
  sec: number;
  positive: string[];
  negative: string[];
}

function sentenceStyles(sentences: readonly string[]): string[] {
  return sentences.map((sentence) => sentence.replace(/\.$/, ""));
}

/** The section's own style qualities: dynamics, cues in order, positioned synths, its clause. */
function sectionStyles(section: Section, ctx: SerializeContext): string[] {
  const styles = [DYNAMIC_WORD[section.dynamics]];
  for (const cue of section.cues) {
    if (cue.slot === "contrast") continue;
    if (cue.slot === "pocket") {
      const pocket = pocketText(section.openPocket);
      if (pocket) styles.push(pocket);
      continue;
    }
    if (!cue.text) continue;
    styles.push(cue.phrases?.length ? `${phraseLabel(cue.phrases)}: ${cue.text}` : cue.text);
  }
  for (const use of ctx.spec.D5.synthRoles) {
    if (!use.position.sectionIds.includes(section.id)) continue;
    const wording = use.proseOverride ?? ctx.catalog.synthRoles[use.synthRoleId]?.promptPhrase;
    if (wording && !styles.includes(wording)) styles.push(wording);
  }
  if (section.styleClause) styles.push(section.styleClause);
  const lock = ctx.spec.D6.meterLock;
  if (lock.enabled && lock.restatement === "style-and-sections") styles.push(`strict ${lock.signature}`);
  return styles;
}

function trimBlankLines(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.trim() === "") start++;
  while (end > start && lines[end - 1]?.trim() === "") end--;
  return lines.slice(start, end);
}

/**
 * Passthrough lyrics split by `[Header]` lines and matched, in order, to the section whose
 * label or bracket head equals the header. Lines are never rewritten.
 */
export function lyricsBySection(passthrough: string, sections: readonly Section[]): { bySection: Map<string, string[]>; unplaced: boolean } {
  const bySection = new Map<string, string[]>();
  const blocks: { header?: string; lines: string[] }[] = [{ lines: [] }];
  for (const line of passthrough.split("\n")) {
    const header = /^\[(.+)\]$/.exec(line.trim());
    if (header?.[1]) blocks.push({ header: header[1].trim().toLowerCase(), lines: [] });
    else blocks.at(-1)?.lines.push(line);
  }
  let unplaced = blocks[0]?.lines.some((line) => line.trim() !== "") ?? false;
  const used = new Set<string>();
  for (const block of blocks.slice(1)) {
    const section = sections.find(
      (s) => !used.has(s.id) && (s.label.toLowerCase() === block.header || sectionHead(s).toLowerCase() === block.header),
    );
    const lines = trimBlankLines(block.lines);
    if (!section) {
      if (lines.some((line) => line.trim() !== "")) unplaced = true;
      continue;
    }
    used.add(section.id);
    bySection.set(section.id, lines);
  }
  return { bySection, unplaced };
}

function sectionDrafts(timing: SectionTiming, ctx: SerializeContext, lyrics: string[] | undefined): Draft[] {
  const { section } = timing;
  const { spec, catalog } = ctx;
  const negatives = negativeTerms(ctx);
  const hasLyrics = !spec.D8.instrumental && Boolean(lyrics?.length);
  // An open pocket stays an instrumental break until the user's lyrics fill it.
  const pocketNegatives = section.openPocket.kind !== "none" && !hasLyrics ? ["lead vocals"] : [];
  const bodySec = timing.body.end - timing.body.start;
  const barSec = section.bars > 0 ? bodySec / section.bars : 0;
  const instrumentalBody = !hasLyrics;

  const main: Draft = {
    head: [`[${section.label}]`],
    body: instrumentalBody ? ["{instrumental break}"] : [...(lyrics ?? [])],
    tail: [],
    sec: bodySec,
    positive: sectionStyles(section, ctx),
    negative: [...negatives, ...pocketNegatives],
  };
  if (!section.contrast) return [main];

  const contrast = section.contrast;
  const word = contrastStyleWord(contrast, catalog);
  const contrastSec = Math.min(contrast.bars, section.bars) * barSec;
  const contrastDraft: Draft = {
    head: [`[${section.label} – ${word} contrast]`],
    body: spec.D8.instrumental ? ["{instrumental break}"] : [],
    tail: [`{${contrast.returnRule}}`],
    sec: contrastSec,
    positive: [DYNAMIC_WORD[section.dynamics], `${word} contrast`, ...contrast.changes],
    negative: [...negatives, ...pocketNegatives],
  };
  main.sec = bodySec - contrastSec;
  const ordered = contrast.position === "start" ? [contrastDraft, main] : [main, contrastDraft];
  return ordered.filter((draft) => draft.sec > 0 || draft === contrastDraft);
}

/** Durations rounded on the cumulative timeline, so they sum to the rounded runtime exactly. */
function roundedDurations(seconds: readonly number[]): number[] {
  let elapsed = 0;
  return seconds.map((sec) => {
    const start = Math.round(elapsed * 1000);
    elapsed += sec;
    return Math.round(elapsed * 1000) - start;
  });
}

/** The composition plan and the lyric-placement flag the coverage report needs. */
export function compositionPlan(ctx: SerializeContext): { plan: ElevenCompositionPlan; lyricsUnplaced: boolean } {
  const { spec } = ctx;
  const timeline = sectionTimeline(spec.D6.tempo, spec.D6.meterLock.signature, spec.D7);
  const passthrough = !spec.D8.instrumental && spec.D8.lyricsPassthrough ? lyricsBySection(spec.D8.lyricsPassthrough, spec.D7.sections) : undefined;

  const drafts: Draft[] = [];
  let pendingHead: string[] = [];
  let pendingSec = 0;
  for (const timing of timeline) {
    const { section } = timing;
    const own = sectionDrafts(timing, ctx, passthrough?.bySection.get(section.id));
    const first = own[0];
    const last = own.at(-1);
    if (!first || !last) continue;
    const previous = drafts.at(-1);

    // A start-position silence and the pickup belong to the chunk before; the song's first
    // section has none, so they open its own first chunk instead.
    const lead: string[] = [];
    let leadSec = 0;
    if (timing.silenceBefore) {
      lead.push("{silence}");
      leadSec += timing.silenceBefore.end - timing.silenceBefore.start;
    }
    if (section.pickupBefore && timing.pickup) {
      lead.push(`{${pickupDirection(section.pickupBefore)}}`);
      leadSec += timing.pickup.end - timing.pickup.start;
    }
    if (previous) {
      previous.tail.push(...lead);
      previous.sec += leadSec;
    } else {
      pendingHead = lead;
      pendingSec = leadSec;
    }

    first.head.push(...pendingHead);
    first.sec += pendingSec;
    pendingHead = [];
    pendingSec = 0;

    const transition = section.transitionOut;
    if (transition.kind !== "none" && transition.kind !== "silence") last.tail.push(`{${lowerFirst(transitionText(transition))}}`);
    if (timing.silenceAfter) {
      last.tail.push("{silence}");
      last.sec += timing.silenceAfter.end - timing.silenceAfter.start;
    } else if (transition.kind === "silence") {
      last.tail.push("{silence}");
    }
    drafts.push(...own);
  }

  const globalStyles = sentenceStyles(styleSentences(ctx, { sectionClauses: false, positionedSynths: false, negation: false }));
  const durations = roundedDurations(drafts.map((draft) => draft.sec));
  const chunks: ElevenGenerationChunk[] = drafts.map((draft, i) => ({
    text: [...draft.head, ...draft.body, ...draft.tail].join("\n"),
    duration_ms: durations[i] ?? 0,
    positive_styles: i === 0 ? [...globalStyles, ...draft.positive] : draft.positive,
    negative_styles: draft.negative,
  }));
  return { plan: { chunks }, lyricsUnplaced: passthrough?.unplaced ?? false };
}

/** Serializes `spec` for ElevenLabs Music. Throws if `profile` is not the Eleven profile. */
export function compileEleven(spec: MusicSpec, profile: EngineProfile, catalog: Catalog): CompiledPayload {
  if (profile.id !== "eleven") throw new Error(`compileEleven needs the eleven profile, got '${profile.id}'`);
  const ctx: SerializeContext = { spec, profile, catalog };
  const scrub = (text: string) => scrubNames(text, catalog.lineageNames);

  const { plan, lyricsUnplaced } = compositionPlan(ctx);
  const composition_plan = scrubDeep(plan, scrub);
  const promptSentences = [...styleSentences(ctx), inlineNegativeSentence(ctx)].filter((s): s is string => Boolean(s));
  const instrumental = spec.D8.instrumental && !spec.D8.lyricsPassthrough;
  const fields = {
    prompt: scrub(promptSentences.join(" ")),
    composition_plan,
    music_length_ms: composition_plan.chunks.reduce((sum, chunk) => sum + chunk.duration_ms, 0),
    model_id: "music_v2",
    force_instrumental: instrumental,
  };
  const toggles = { instrumental };

  const overrides: Record<string, Rendering> = aliasCoverage(ctx);
  if (lyricsUnplaced) {
    overrides["/D8/lyricsPassthrough"] = { state: "approximated", detail: "Some lyric lines had no header matching a section and were left out of the plan." };
  }

  return {
    engine: "eleven",
    profileVersion: profile.version,
    fields,
    toggles,
    coverage: coverageReport(spec, profile, overrides),
    hash: hash53(JSON.stringify({ fields, toggles })),
  };
}
