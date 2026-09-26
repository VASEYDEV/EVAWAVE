/** RB-1: two or more regional bundles without a cross-bundle flag. */
import { result, type LintRule } from "../context";

export const RB1: LintRule = {
  id: "RB-1",
  check(ctx) {
    const bundles = ctx.spec.D5.bundles;
    if (bundles.length < 2) return [];
    return bundles.flatMap((bundle, i) =>
      i > 0 && !bundle.crossBundle ? [result("RB-1", "warn", `/D5/bundles/${i}`, `bundle "${bundle.bundleId}" mixes with another bundle without a crossBundle flag`)] : [],
    );
  },
};
