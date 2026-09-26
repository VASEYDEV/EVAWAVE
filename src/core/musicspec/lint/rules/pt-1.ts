/** PT-1: a patch op with confidence under 0.5 is flagged low-confidence in the review diff. */
import type { IRPatch, LintResult } from "../../ir/types";
import { result, type LintRule } from "../context";

export const LOW_CONFIDENCE = 0.5;

/** PT-1 for one patch; `base` is its pointer, for example '/patches/0'. */
export function lowConfidenceOps(patch: IRPatch, base: string): LintResult[] {
  return patch.ops.flatMap((op, j) =>
    op.confidence < LOW_CONFIDENCE ? [result("PT-1", "info", `${base}/ops/${j}`, `low confidence (${Math.round(op.confidence * 100)}%) for ${op.path}`)] : [],
  );
}

export const PT1: LintRule = {
  id: "PT-1",
  check(ctx) {
    return ctx.spec.patches.flatMap((patch, i) => lowConfidenceOps(patch, `/patches/${i}`));
  },
};
