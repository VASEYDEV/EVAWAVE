/**
 * Suno v6 serializer (docs/SPEC.md §2.6): Style, Exclude Styles, Lyrics and Title, with the
 * Instrumental toggle. Pure: the same spec, profile and catalog always give the same bytes.
 */
import { coverageReport } from "../coverage";
import type { Catalog, CompiledPayload, EngineProfile, MusicSpec } from "../ir/types";
import { scrubNames } from "../lineage";
import { hash53 } from "../text";
import {
  aliasCoverage,
  joinClauses,
  negativeSpace,
  pickupText,
  sectionClauses,
  sectionHead,
  styleSentences,
  transitionBracketText,
  type SerializeContext,
} from "./common";

/** One bracket per section, pickups and silence as their own brackets, blank-line separated. */
function lyricsField(ctx: SerializeContext): string {
  const { spec } = ctx;
  if (!spec.D8.instrumental && spec.D8.lyricsPassthrough) return spec.D8.lyricsPassthrough;
  const brackets: string[] = [];
  for (const section of spec.D7.sections) {
    if (section.silenceAfter?.position === "start") brackets.push("[Drop to silence]");
    if (section.pickupBefore) brackets.push(`[${pickupText(section.pickupBefore)}]`);
    const clauses = joinClauses(sectionClauses(section, ctx));
    brackets.push(clauses ? `[${sectionHead(section)} – ${clauses}]` : `[${sectionHead(section)}]`);
    const transition = transitionBracketText(section);
    if (transition) brackets.push(`[${transition}]`);
    const silenceAtEnd = section.silenceAfter?.position === "end" || (!section.silenceAfter && section.transitionOut.kind === "silence");
    if (silenceAtEnd) brackets.push("[Drop to silence]");
  }
  return brackets.join("\n\n");
}

/** Serializes `spec` for Suno. Throws if `profile` is not the Suno profile. */
export function compileSuno(spec: MusicSpec, profile: EngineProfile, catalog: Catalog): CompiledPayload {
  if (profile.id !== "suno") throw new Error(`compileSuno needs the suno profile, got '${profile.id}'`);
  const ctx: SerializeContext = { spec, profile, catalog };
  const scrub = (text: string) => scrubNames(text, catalog.lineageNames);

  const style = scrub(styleSentences(ctx).join(" "));
  const exclude = scrub(negativeSpace(ctx).flatMap((entry) => entry.terms).join(", "));
  const lyrics = scrub(lyricsField(ctx));
  const title = scrub(spec.D10.title ?? "");
  const fields = { style, exclude, lyrics, title };
  const toggles = { instrumental: spec.D8.instrumental && !spec.D8.lyricsPassthrough };

  return {
    engine: "suno",
    profileVersion: profile.version,
    fields,
    toggles,
    coverage: coverageReport(spec, profile, aliasCoverage(ctx)),
    hash: hash53(JSON.stringify({ fields, toggles })),
  };
}
