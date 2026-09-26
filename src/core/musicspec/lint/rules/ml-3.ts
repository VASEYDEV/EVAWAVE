/** ML-3: meter lock on with a swung or shuffled feel. */
import { result, type LintRule } from "../context";

export const ML3: LintRule = {
  id: "ML-3",
  check(ctx) {
    const lock = ctx.spec.D6.meterLock;
    if (!lock.enabled || (lock.feel !== "swung" && lock.feel !== "shuffled")) return [];
    return [result("ML-3", "block", "/D6/meterLock/feel", `a ${lock.feel} feel contradicts the meter lock`)];
  },
};
