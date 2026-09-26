/**
 * The linter (docs/SPEC.md §2.7): `lint(spec, profile, catalog, payload?)` runs every rule
 * on the IR and, when a payload is given, on the compiled fields. Results are ordered by
 * rule id, then path, so output is stable across runs.
 */
import type { Catalog, CompiledPayload, EngineProfile, LintResult, MusicSpec } from "../ir/types";
import type { LintRule } from "./context";
import { BG1 } from "./rules/bg-1";
import { BG2 } from "./rules/bg-2";
import { BT1 } from "./rules/bt-1";
import { CP1 } from "./rules/cp-1";
import { CP2 } from "./rules/cp-2";
import { CP3 } from "./rules/cp-3";
import { LN1 } from "./rules/ln-1";
import { ML1 } from "./rules/ml-1";
import { ML2 } from "./rules/ml-2";
import { ML3 } from "./rules/ml-3";
import { ML4 } from "./rules/ml-4";
import { PB1 } from "./rules/pb-1";
import { PB2 } from "./rules/pb-2";
import { RB1 } from "./rules/rb-1";
import { RB2 } from "./rules/rb-2";
import { RB3 } from "./rules/rb-3";
import { SC1 } from "./rules/sc-1";
import { SC2 } from "./rules/sc-2";
import { TQ1 } from "./rules/tq-1";

export type { LintContext, LintRule } from "./context";

/** Every rule scheduled for S1, in rule-id order. */
export const RULES: readonly LintRule[] = [BG1, BG2, BT1, CP1, CP2, CP3, LN1, ML1, ML2, ML3, ML4, PB1, PB2, RB1, RB2, RB3, SC1, SC2, TQ1];

export function lint(spec: MusicSpec, profile: EngineProfile, catalog: Catalog, payload?: CompiledPayload, rules: readonly LintRule[] = RULES): LintResult[] {
  const ctx = { spec, profile, catalog, ...(payload ? { payload } : {}) };
  return rules
    .flatMap((rule) => rule.check(ctx))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.path.localeCompare(b.path) || a.message.localeCompare(b.message));
}
