/** PB-1: a pickup bar that returns to a different signature than the lock. */
import { result, type LintRule } from "../context";

export const PB1: LintRule = {
  id: "PB-1",
  check(ctx) {
    const lock = ctx.spec.D6.meterLock;
    if (!lock.enabled) return [];
    return ctx.spec.D7.sections.flatMap((section, i) =>
      section.pickupBefore && section.pickupBefore.returnTo !== lock.signature
        ? [result("PB-1", "block", `/D7/sections/${i}/pickupBefore/returnTo`, `pickup returns to ${section.pickupBefore.returnTo}, not ${lock.signature}`)]
        : [],
    );
  },
};
