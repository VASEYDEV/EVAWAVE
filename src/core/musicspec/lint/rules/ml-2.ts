/** ML-2: meter lock on → a rhythm whose meter differs from the lock, or one not 4/4-safe under 4/4. */
import { result, rhythmRefs, type LintRule } from "../context";

export const ML2: LintRule = {
  id: "ML-2",
  check(ctx) {
    const lock = ctx.spec.D6.meterLock;
    if (!lock.enabled) return [];
    return rhythmRefs(ctx).flatMap(({ path, id, rhythm }) => {
      if (!rhythm) return [];
      if (rhythm.meter !== lock.signature) {
        return [result("ML-2", "block", path, `rhythm "${rhythm.name}" is in ${rhythm.meter}, not the locked ${lock.signature}`)];
      }
      if (lock.signature === "4/4" && !rhythm.fourFourSafe) {
        return [result("ML-2", "block", path, `rhythm "${rhythm.name}" (${id}) is not 4/4-safe`)];
      }
      return [];
    });
  },
};
