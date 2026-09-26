/** CV-1: the active target's coverage score is under 0.8. */
import { result, type LintRule } from "../context";

/** Coverage below this share of expressed items warns (docs/SPEC.md §2.7). */
export const COVERAGE_WARN_BELOW = 0.8;

export const CV1: LintRule = {
  id: "CV-1",
  check(ctx) {
    const coverage = ctx.payload?.coverage;
    if (!coverage || ctx.profile.id !== ctx.spec.D10.activeTarget || coverage.score >= COVERAGE_WARN_BELOW) return [];
    const percent = Math.round(coverage.score * 100);
    return [result("CV-1", "warn", `${ctx.profile.id}.coverage`, `coverage ${percent}% on the active target, under ${COVERAGE_WARN_BELOW * 100}%`, { engine: ctx.profile.id })];
  },
};
