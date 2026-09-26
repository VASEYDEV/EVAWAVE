/**
 * The linter (docs/SPEC.md §2.7): `lint(spec, profile, catalog, payload?, options?)` runs every rule
 * on the IR and, when a payload is given, on the compiled fields. Results are ordered by
 * rule id, then path, so output is stable across runs.
 */
import type { Catalog, CompiledPayload, EngineProfile, LintResult, MusicSpec, TargetOverride } from "../ir/types";
import type { LintRule } from "./context";
import { BG1 } from "./rules/bg-1";
import { BG2 } from "./rules/bg-2";
import { BT1 } from "./rules/bt-1";
import { CP1 } from "./rules/cp-1";
import { CP2 } from "./rules/cp-2";
import { CP3 } from "./rules/cp-3";
import { CV1 } from "./rules/cv-1";
import { CV2 } from "./rules/cv-2";
import { LN1 } from "./rules/ln-1";
import { ML1 } from "./rules/ml-1";
import { ML2 } from "./rules/ml-2";
import { ML3 } from "./rules/ml-3";
import { ML4 } from "./rules/ml-4";
import { OV1 } from "./rules/ov-1";
import { PB1 } from "./rules/pb-1";
import { PB2 } from "./rules/pb-2";
import { PT1 } from "./rules/pt-1";
import { PT2 } from "./rules/pt-2";
import { RB1 } from "./rules/rb-1";
import { RB2 } from "./rules/rb-2";
import { RB3 } from "./rules/rb-3";
import { SC1 } from "./rules/sc-1";
import { SC2 } from "./rules/sc-2";
import { TQ1 } from "./rules/tq-1";

export type { LintContext, LintRule } from "./context";

/** Every spec-level rule, in rule-id order. PV-1 reads a StyleProfile: see `lintStyleProfile`. */
export const RULES: readonly LintRule[] = [BG1, BG2, BT1, CP1, CP2, CP3, CV1, CV2, LN1, ML1, ML2, ML3, ML4, OV1, PB1, PB2, PT1, PT2, RB1, RB2, RB3, SC1, SC2, TQ1];

export { lowConfidenceOps } from "./rules/pt-1";
export { protectedOps } from "./rules/pt-2";
export { lintStyleProfile } from "./rules/pv-1";

export interface LintOptions {
  /** The song's target overrides, for LN-1 and OV-1. */
  overrides?: readonly TargetOverride[];
  /** A subset of rules; defaults to every rule. */
  rules?: readonly LintRule[];
}

export function lint(spec: MusicSpec, profile: EngineProfile, catalog: Catalog, payload?: CompiledPayload, options: LintOptions = {}): LintResult[] {
  const { rules = RULES, overrides } = options;
  const ctx = { spec, profile, catalog, ...(payload ? { payload } : {}), ...(overrides ? { overrides } : {}) };
  return rules
    .flatMap((rule) => rule.check(ctx))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.path.localeCompare(b.path) || a.message.localeCompare(b.message));
}
