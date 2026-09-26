/** TQ-1: a technique with meter risk used under the meter lock. */
import { result, usedTechniqueIds, type LintRule } from "../context";

export const TQ1: LintRule = {
  id: "TQ-1",
  check(ctx) {
    if (!ctx.spec.D6.meterLock.enabled) return [];
    return usedTechniqueIds(ctx.spec).flatMap((id) =>
      ctx.catalog.techniques[id]?.meterRisk ? [result("TQ-1", "warn", `catalog:techniques/${id}`, `technique "${id}" risks the meter under the lock`)] : [],
    );
  },
};
