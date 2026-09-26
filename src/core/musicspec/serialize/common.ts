/**
 * Serializer building blocks shared by every engine (docs/SPEC.md §2.4, §2.6). Everything
 * here is a pure function of (spec, profile, catalog): no clock, no randomness, no I/O.
 */
import type {
  BlockTransitionRule,
  Catalog,
  ContrastPhrase,
  DynamicMark,
  EngineProfile,
  InstrumentUse,
  MeterLock,
  MusicSpec,
  NegativeClass,
  NegativeSpace,
  OpenPocket,
  PickupBar,
  Section,
  SectionKind,
  Signature,
  Tempo,
  Transition,
  TransitionKind,
} from "../ir/types";
import { ALIAS_SUBSTITUTED, type Rendering } from "../coverage";
import { byWeight, capitalize, joinAnd, lowerFirst } from "../text";

export interface SerializeContext {
  spec: MusicSpec;
  profile: EngineProfile;
  catalog: Catalog;
}

const SUBDIVISION_WORD: Record<MeterLock["subdivision"], string> = { 8: "8ths", 16: "16ths", 32: "32nds" };
const BEATS_WORD: Record<number, string> = { 1: "One", 2: "Two", 3: "Three" };

const SECTION_HEAD: Record<Exclude<SectionKind, "custom">, string> = {
  intro: "Intro",
  build: "Build",
  hook: "Hook",
  verse: "Verse",
  pre: "Pre-Hook",
  bridge: "Bridge",
  break: "Break",
  drop: "Drop",
  finale: "Finale",
  outro: "Outro",
};

const TRANSITION_PHRASE: Record<Exclude<TransitionKind, "none">, string> = {
  riser: "riser",
  "filter-sweep-open": "filter sweep opening",
  "filter-sweep-close": "filter sweep closing",
  "reverse-cymbal": "reverse cymbal",
  "snare-roll": "snare roll",
  "timpani-roll": "timpani roll",
  "choir-swell": "choir swell",
  "sub-drop": "sub drop",
  "hard-stop": "hard stop",
  silence: "drop to silence",
  crossfade: "crossfade",
};

const TRANSITION_PLURAL: Record<Exclude<TransitionKind, "none">, string> = {
  riser: "risers",
  "filter-sweep-open": "filter sweeps",
  "filter-sweep-close": "filter sweeps",
  "reverse-cymbal": "reverse cymbals",
  "snare-roll": "snare rolls",
  "timpani-roll": "timpani rolls",
  "choir-swell": "choir swells",
  "sub-drop": "sub drops",
  "hard-stop": "hard stops",
  silence: "silences",
  crossfade: "crossfades",
};

/** Negative-space classes in serialization order (docs/SPEC.md §2.2, `OutputIntent`). */
export const NEGATIVE_CLASS_ORDER: readonly NegativeClass[] = ["vocals", "meter-drift", "genre-bleed", "instrument-ambiguity", "custom"];

/** Section bracket head: 'hook' → "Hook"; a custom section uses its label. */
export function sectionHead(section: Pick<Section, "kind" | "label">): string {
  return section.kind === "custom" ? section.label : SECTION_HEAD[section.kind];
}

/** "strict 4/4 common time" or "strict 3/4 time". */
export function strictSignature(signature: Signature): string {
  return signature === "4/4" ? "strict 4/4 common time" : `strict ${signature} time`;
}

/** "140 BPM half-time"; a straight feel adds nothing. */
export function tempoText(tempo: Tempo, feel: MeterLock["feel"]): string {
  return feel === "straight" ? `${tempo.bpm} BPM` : `${tempo.bpm} BPM ${feel}`;
}

/** The meter-lock clause: "strict 4/4 common time, 140 BPM half-time, straight 16ths, no swing". */
export function meterLockText(tempo: Tempo, lock: MeterLock): string {
  return [strictSignature(lock.signature), tempoText(tempo, lock.feel), `straight ${SUBDIVISION_WORD[lock.subdivision]}`, "no swing"].join(", ");
}

export interface InstrumentWording {
  text: string;
  /** True when an engine alias replaced the record's own phrase. */
  aliased: boolean;
}

/**
 * Wording precedence (docs/SPEC.md §2.4): the song's `phraseOverride`, then the engine
 * profile's alias, then the record's own alias for this engine, then `promptPhrase`.
 * `<id>:drift-fallback` alias keys apply only on a drift rerun, so they are never read here.
 */
export function instrumentWording(use: InstrumentUse, ctx: SerializeContext): InstrumentWording {
  if (use.phraseOverride) return { text: use.phraseOverride, aliased: false };
  const profileAlias = ctx.profile.aliases[use.instrumentId];
  if (profileAlias) return { text: profileAlias, aliased: true };
  const record = ctx.catalog.instruments[use.instrumentId];
  const recordAlias = record?.aliases[ctx.profile.id];
  if (recordAlias) return { text: recordAlias, aliased: true };
  return { text: record?.promptPhrase ?? use.instrumentId, aliased: false };
}

export function isPercussion(instrumentId: string, catalog: Catalog): boolean {
  return catalog.instruments[instrumentId]?.family === "percussion";
}

/** The style word of a contrast phrase: its label, else the referenced genre's name. */
export function contrastStyleWord(contrast: ContrastPhrase, catalog: Catalog): string {
  if (contrast.label) return contrast.label;
  const genre = catalog.genres[contrast.styleId];
  if (genre) return genre.name.toLowerCase();
  const pattern = catalog.drumPatterns[contrast.styleId];
  const patternGenre = pattern?.genreId ? catalog.genres[pattern.genreId] : undefined;
  return (patternGenre?.name ?? pattern?.name ?? contrast.styleId).toLowerCase();
}

/** "last 4 bars drill contrast: sliding 808s, displaced snare, then back to trap grid". */
export function contrastClause(contrast: ContrastPhrase, catalog: Catalog): string {
  const where = contrast.position === "end" ? "last" : "first";
  const head = `${where} ${contrast.bars} bars ${contrastStyleWord(contrast, catalog)} contrast`;
  return contrast.changes.length ? `${head}: ${contrast.changes.join(", ")}, ${contrast.returnRule}` : `${head}, ${contrast.returnRule}`;
}

export function pocketText(pocket: OpenPocket): string | undefined {
  if (pocket.kind === "none") return undefined;
  return pocket.note ?? (pocket.kind === "rap" ? "open pocket for rap" : "open pocket for vocals");
}

/** "phrase 3" or "phrases 2 and 4". */
export function phraseLabel(phrases: readonly number[]): string {
  return phrases.length === 1 ? `phrase ${phrases[0]}` : `phrases ${joinAnd(phrases.map(String))}`;
}

export interface Clause {
  text: string;
  /** Generated labelled clauses (phrase-limited cues, contrast) are set off with "; ". */
  setOff: boolean;
}

/** Which generated clauses `sectionClauses` adds after the cues. All default to true (Suno). */
export interface ClauseOptions {
  contrast?: boolean;
  transition?: boolean;
  restatement?: boolean;
}

/** A transition's wording: its note, else the kind's phrase ("filter sweep closing"). */
export function transitionText(transition: Transition): string {
  return transition.kind === "none" ? "" : (transition.note ?? TRANSITION_PHRASE[transition.kind]);
}

/** Section dynamics as English style words (Eleven styles must be English). */
export const DYNAMIC_WORD: Readonly<Record<DynamicMark, string>> = {
  pp: "very soft",
  p: "soft",
  mp: "moderately soft",
  mf: "moderately loud",
  f: "loud",
  ff: "very loud",
};

/**
 * The section's clause list in cue order (docs/SPEC.md §2.4). The pocket renders only where
 * its cue sits. A contrast phrase with no cue is appended, so its return rule is never lost.
 */
export function sectionClauses(section: Section, ctx: SerializeContext, options: ClauseOptions = {}): Clause[] {
  const { contrast: withContrast = true, transition: withTransition = true, restatement: withRestatement = true } = options;
  const clauses: Clause[] = [];
  let contrastRendered = false;
  for (const cue of section.cues) {
    if (cue.slot === "contrast") {
      if (withContrast && section.contrast && !contrastRendered) {
        clauses.push({ text: contrastClause(section.contrast, ctx.catalog), setOff: true });
        contrastRendered = true;
      }
    } else if (cue.slot === "pocket") {
      const text = pocketText(section.openPocket);
      if (text) clauses.push({ text, setOff: false });
    } else if (cue.text) {
      const limited = cue.phrases !== undefined && cue.phrases.length > 0;
      clauses.push({ text: limited ? `${phraseLabel(cue.phrases ?? [])}: ${cue.text}` : cue.text, setOff: limited });
    }
  }
  if (withContrast && section.contrast && !contrastRendered) clauses.push({ text: contrastClause(section.contrast, ctx.catalog), setOff: true });
  const transition = section.transitionOut;
  if (withTransition && transition.kind !== "none" && transition.kind !== "silence" && !transition.bracket) {
    clauses.push({ text: transitionText(transition), setOff: false });
  }
  const lock = ctx.spec.D6.meterLock;
  if (withRestatement && lock.enabled && lock.restatement === "style-and-sections") {
    clauses.push({ text: `strict ${lock.signature}`, setOff: false });
  }
  return clauses;
}

export function joinClauses(clauses: readonly Clause[]): string {
  let out = "";
  clauses.forEach((clause, i) => {
    if (i === 0) out = clause.text;
    else out += (clause.setOff || clauses[i - 1]?.setOff ? "; " : ", ") + clause.text;
  });
  return out;
}

/** "[Two-beat pickup bar – snare roll, riser, back to 4/4]", or the content alone. */
export function pickupText(pickup: PickupBar): string {
  if (pickup.announce === false) return capitalize(pickup.content);
  return `${BEATS_WORD[pickup.beats]}-beat pickup bar – ${pickup.content}, back to ${pickup.returnTo}`;
}

/**
 * An inline pickup direction for engines without pickup brackets: "two-beat pickup: snare
 * roll, riser", or the content alone when the pickup is not announced.
 */
export function pickupDirection(pickup: PickupBar): string {
  if (pickup.announce === false) return lowerFirst(pickup.content);
  return `${BEATS_WORD[pickup.beats]?.toLowerCase() ?? pickup.beats}-beat pickup: ${pickup.content}`;
}

export function transitionBracketText(section: Section): string | undefined {
  const transition = section.transitionOut;
  if (!transition.bracket || transition.kind === "none" || transition.kind === "silence") return undefined;
  return capitalize(transitionText(transition));
}

/** "Risers and filter sweeps at 8 and 16 bars". */
export function blockRuleText(rule: BlockTransitionRule): string {
  if (rule.phraseOverride) return rule.phraseOverride;
  const nouns = [...new Set(rule.kinds.filter((k): k is Exclude<TransitionKind, "none"> => k !== "none").map((k) => TRANSITION_PLURAL[k]))];
  return `${capitalize(joinAnd(nouns))} at ${joinAnd(rule.everyBars.map(String))} bars`;
}

/** Key and mode: the override, else "D Hijaz maqam" / "A Aeolian". */
export function keyText(ctx: SerializeContext): string {
  const key = ctx.spec.D6.key;
  if (key.phraseOverride) return key.phraseOverride;
  const mode = ctx.catalog.modes[key.modeId];
  if (!mode) return `${key.tonic} ${key.modeId}`;
  const family = mode.family === "maqam" ? " maqam" : mode.family === "raga" ? " raga" : "";
  return `${key.tonic} ${mode.name}${family}`;
}

/**
 * The style-equivalent field as ordered sentences (docs/SPEC.md §2.6): form, meter and
 * tempo; key; drums; regional instruments; other instruments; synths; textures and mix;
 * block transitions; section clauses; lineage traits; mood; inline negation.
 */
export function styleSentences(ctx: SerializeContext, options: StyleOptions = {}): string[] {
  const { sectionClauses: withSectionClauses = true, positionedSynths = true, negation = true } = options;
  const { spec, catalog } = ctx;
  const sentences: string[] = [];
  const lock = spec.D6.meterLock;

  const lead = [spec.D8.instrumental ? "Instrumental" : "", spec.D1.formPhrase].filter(Boolean).join(" ");
  const timing = lock.enabled ? meterLockText(spec.D6.tempo, lock) : tempoText(spec.D6.tempo, lock.feel);
  sentences.push(`${capitalize([lead, timing].filter(Boolean).join(", "))}.`);

  sentences.push(`${capitalize(keyText(ctx))}.`);

  const drums = spec.D5.drums;
  const corePattern = drums.patternIds[0] ? catalog.drumPatterns[drums.patternIds[0]] : undefined;
  const drumProse = drums.proseOverride ?? corePattern?.prose;
  if (drumProse) sentences.push(drums.label ? `${drums.label}: ${drumProse}.` : `${capitalize(drumProse)}.`);

  const instruments = byWeight(spec.D5.instruments);
  for (const bundle of spec.D5.bundles) {
    const uses = instruments.filter((entry) => entry.value.bundleId === bundle.bundleId);
    const melodic = uses.filter((entry) => !isPercussion(entry.value.instrumentId, catalog)).map((entry) => instrumentWording(entry.value, ctx).text);
    const percussion = uses.filter((entry) => isPercussion(entry.value.instrumentId, catalog)).map((entry) => instrumentWording(entry.value, ctx).text);
    let body = melodic.join(", ");
    if (percussion.length) body += `${body ? "; " : ""}${percussion.join(", ")}`;
    const rhythms = bundle.rhythmIds.map((id) => catalog.rhythms[id]?.name ?? id);
    if (rhythms.length) body += ` on ${joinAnd(rhythms)} rhythms${lock.enabled ? ` in ${lock.signature}` : ""}`;
    if (body) sentences.push(`${bundle.label ?? catalog.bundles[bundle.bundleId]?.name ?? bundle.bundleId}: ${body}.`);
  }
  const loose = instruments.filter((entry) => !entry.value.bundleId).map((entry) => instrumentWording(entry.value, ctx).text);
  if (loose.length) sentences.push(`${capitalize(loose.join(", "))}.`);

  const seenRoles = new Set<string>();
  const synths: string[] = [];
  for (const use of spec.D5.synthRoles) {
    if (!positionedSynths && use.position.sectionIds.length > 0) continue;
    if (seenRoles.has(use.synthRoleId)) continue;
    seenRoles.add(use.synthRoleId);
    synths.push(use.proseOverride ?? catalog.synthRoles[use.synthRoleId]?.promptPhrase ?? use.synthRoleId);
  }
  if (synths.length) sentences.push(`Synths: ${synths.join("; ")}.`);

  const textures = byWeight(spec.D5.textures).map((entry) => entry.value);
  if (textures.length) sentences.push(`${capitalize(textures.join(", "))}.`);
  if (spec.D9.character.length) sentences.push(`${capitalize(spec.D9.character.join(", "))}.`);

  if (spec.D7.blockRule) sentences.push(`${blockRuleText(spec.D7.blockRule)}.`);

  if (withSectionClauses) {
    for (const section of spec.D7.sections) {
      if (section.styleClause) sentences.push(`${sectionHead(section)}: ${section.styleClause}.`);
    }
  }

  const traits = byWeight(spec.D4.traits).map((entry) => entry.value.trait);
  if (traits.length) sentences.push(`${capitalize(traits.join(", "))}.`);

  const moods = byWeight(spec.D2.moods).map((entry) => entry.value);
  if (moods.length) sentences.push(`${capitalize(moods.join(", "))}.`);

  if (negation && spec.D8.instrumental) sentences.push("No vocals, no lyrics.");
  return sentences;
}

/** Which parts `styleSentences` includes. All default to true (Suno Style). */
export interface StyleOptions {
  /** `Section.styleClause` sentences. Eleven moves them into their own chunks. */
  sectionClauses?: boolean;
  /** Synth roles positioned in sections. Eleven words them in those chunks only. */
  positionedSynths?: boolean;
  /** The closing "No vocals, no lyrics." */
  negation?: boolean;
}

/** Negative-space terms in class order, for engines without an exclude field. */
export function negativeTerms(ctx: SerializeContext): string[] {
  return negativeSpace(ctx).flatMap((entry) => entry.terms);
}

/** The inline negative sentence that ends Flow's Sound and Eleven's prompt: "Avoid: a, b." */
export function inlineNegativeSentence(ctx: SerializeContext): string | undefined {
  const terms = negativeTerms(ctx);
  return terms.length ? `Avoid: ${terms.join(", ")}.` : undefined;
}

/**
 * Negative space in class order. With the meter lock on and no `meter-drift` class, the
 * engine's drift words fill it (ML-4's auto-fix, applied at compile time).
 */
export function negativeSpace(ctx: SerializeContext): NegativeSpace[] {
  const entries = [...ctx.spec.D10.negativeSpace];
  if (ctx.spec.D6.meterLock.enabled && !entries.some((entry) => entry.class === "meter-drift")) {
    entries.push({ class: "meter-drift", terms: [...ctx.profile.driftWords], auto: true });
  }
  return NEGATIVE_CLASS_ORDER.flatMap((cls) => entries.filter((entry) => entry.class === cls));
}

/** Coverage overrides for every palette instrument whose wording came from an engine alias. */
export function aliasCoverage(ctx: SerializeContext): Record<string, Rendering> {
  return Object.fromEntries(
    ctx.spec.D5.instruments.flatMap((entry, i) => (instrumentWording(entry.value, ctx).aliased ? [[`/D5/instruments/${i}`, ALIAS_SUBSTITUTED]] : [])),
  );
}

export { scrubDeep } from "../lineage";
