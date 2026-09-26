/**
 * Shared inputs for the lint rules (docs/SPEC.md §2.7). Each rule is a pure function of a
 * `LintContext`; nothing here reads the clock or the network.
 */
import type { Catalog, CompiledPayload, EngineProfile, LintResult, LintRuleId, MusicSpec, Rhythm } from "../ir/types";

export interface LintContext {
  spec: MusicSpec;
  profile: EngineProfile;
  catalog: Catalog;
  /** The compiled payload for `profile`, when payload-level rules (BG, BT, LN) should run. */
  payload?: CompiledPayload;
}

export interface LintRule {
  id: LintRuleId;
  check(ctx: LintContext): LintResult[];
}

export interface ProseEntry {
  /** JSON pointer into the spec, or a `catalog:` path for catalog text the song uses. */
  path: string;
  text: string;
  /** Negative-space terms are where drift words belong, so ML-1 skips them. */
  negative: boolean;
}

function push(out: ProseEntry[], path: string, text: string | undefined, negative = false): void {
  if (text) out.push({ path, text, negative });
}

/**
 * Every prose string in the spec plus the catalog text the song pulls in (technique phrases
 * and instrument play styles). User lyrics are excluded: EVAWAVE never writes or edits them.
 */
export function proseEntries(ctx: Pick<LintContext, "spec" | "catalog">): ProseEntry[] {
  const { spec, catalog } = ctx;
  const out: ProseEntry[] = [];
  push(out, "/D1/formPhrase", spec.D1.formPhrase);
  spec.D2.moods.forEach((m, i) => push(out, `/D2/moods/${i}/value`, m.value));
  spec.D2.imagery.forEach((t, i) => push(out, `/D2/imagery/${i}`, t));
  spec.D4.traits.forEach((t, i) => {
    push(out, `/D4/traits/${i}/value/trait`, t.value.trait);
    push(out, `/D4/traits/${i}/value/era`, t.value.era);
    push(out, `/D4/traits/${i}/value/scene`, t.value.scene);
  });
  spec.D5.instruments.forEach((u, i) => push(out, `/D5/instruments/${i}/value/phraseOverride`, u.value.phraseOverride));
  spec.D5.bundles.forEach((b, i) => push(out, `/D5/bundles/${i}/label`, b.label));
  push(out, "/D5/drums/label", spec.D5.drums.label);
  push(out, "/D5/drums/proseOverride", spec.D5.drums.proseOverride);
  spec.D5.synthRoles.forEach((u, i) => push(out, `/D5/synthRoles/${i}/proseOverride`, u.proseOverride));
  spec.D5.textures.forEach((t, i) => push(out, `/D5/textures/${i}/value`, t.value));
  push(out, "/D6/key/phraseOverride", spec.D6.key.phraseOverride);
  spec.D6.harmony.forEach((h, i) => push(out, `/D6/harmony/${i}`, h));
  push(out, "/D7/blockRule/phraseOverride", spec.D7.blockRule?.phraseOverride);
  spec.D7.sections.forEach((s, i) => {
    const base = `/D7/sections/${i}`;
    push(out, `${base}/label`, s.label);
    s.cues.forEach((c, j) => push(out, `${base}/cues/${j}/text`, c.text));
    push(out, `${base}/styleClause`, s.styleClause);
    push(out, `${base}/harmony`, s.harmony);
    s.notes?.forEach((n, j) => push(out, `${base}/notes/${j}`, n));
    push(out, `${base}/openPocket/note`, s.openPocket.note);
    push(out, `${base}/pickupBefore/content`, s.pickupBefore?.content);
    s.contrast?.changes.forEach((c, j) => push(out, `${base}/contrast/changes/${j}`, c));
    push(out, `${base}/contrast/returnRule`, s.contrast?.returnRule);
    push(out, `${base}/contrast/label`, s.contrast?.label);
    push(out, `${base}/transitionOut/note`, s.transitionOut.note);
  });
  spec.D8.voice.forEach((v, i) => push(out, `/D8/voice/${i}`, v));
  spec.D9.character.forEach((c, i) => push(out, `/D9/character/${i}`, c));
  push(out, "/D10/title", spec.D10.title);
  spec.D10.negativeSpace.forEach((n, i) => n.terms.forEach((t, j) => push(out, `/D10/negativeSpace/${i}/terms/${j}`, t, true)));

  for (const id of usedTechniqueIds(spec)) push(out, `catalog:techniques/${id}/promptPhrase`, catalog.techniques[id]?.promptPhrase);
  for (const id of usedInstrumentIds(spec)) {
    catalog.instruments[id]?.playStyles.forEach((p, j) => push(out, `catalog:instruments/${id}/playStyles/${j}`, p));
  }
  return out;
}

/** Technique ids the song uses: song- and instrument-level (D3), section scopes, production (D9). */
export function usedTechniqueIds(spec: MusicSpec): string[] {
  const ids = [
    ...spec.D3.techniques.map((t) => t.techniqueId),
    ...spec.D7.sections.flatMap((s) => s.scope.techniqueIds),
    ...spec.D9.techniqueIds,
  ];
  return [...new Set(ids)];
}

/** Instrument ids the song uses: the palette and every section scope. */
export function usedInstrumentIds(spec: MusicSpec): string[] {
  const ids = [...spec.D5.instruments.map((u) => u.value.instrumentId), ...spec.D7.sections.flatMap((s) => s.scope.instrumentIds)];
  return [...new Set(ids)];
}

/** Every rhythm reference with its path: section scopes and bundle uses. */
export function rhythmRefs(ctx: Pick<LintContext, "spec" | "catalog">): { path: string; id: string; rhythm?: Rhythm }[] {
  const refs: { path: string; id: string; rhythm?: Rhythm }[] = [];
  ctx.spec.D7.sections.forEach((s, i) =>
    s.scope.percussionRhythmIds.forEach((id, j) =>
      refs.push({ path: `/D7/sections/${i}/scope/percussionRhythmIds/${j}`, id, rhythm: ctx.catalog.rhythms[id] }),
    ),
  );
  ctx.spec.D5.bundles.forEach((b, i) =>
    b.rhythmIds.forEach((id, j) => refs.push({ path: `/D5/bundles/${i}/rhythmIds/${j}`, id, rhythm: ctx.catalog.rhythms[id] })),
  );
  return refs;
}

/** Text fields of the compiled payload, keyed by field id. */
export function payloadTexts(payload: CompiledPayload | undefined): [string, string][] {
  if (!payload) return [];
  return Object.entries(payload.fields).flatMap(([id, value]) => {
    if (typeof value === "string") return [[id, value] as [string, string]];
    if (typeof value === "object") return [[id, JSON.stringify(value)] as [string, string]];
    return [];
  });
}

export function result(ruleId: LintRuleId, severity: LintResult["severity"], path: string, message: string, extra: Partial<LintResult> = {}): LintResult {
  return { ruleId, severity, path, message, ...extra };
}
