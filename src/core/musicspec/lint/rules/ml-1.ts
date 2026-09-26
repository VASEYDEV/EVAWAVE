/** ML-1: meter lock on → any engine drift word in the spec's prose or the catalog text it uses. */
import { containsTerm } from "../../text";
import { proseEntries, result, type LintRule } from "../context";

export const ML1: LintRule = {
  id: "ML-1",
  check(ctx) {
    const lock = ctx.spec.D6.meterLock;
    if (!lock.enabled) return [];
    const severity = lock.driftSuppression ? "block" : "warn";
    return proseEntries(ctx)
      .filter((entry) => !entry.negative)
      .flatMap((entry) =>
        ctx.profile.driftWords
          .filter((term) => containsTerm(entry.text, term))
          .map((term) =>
            result("ML-1", severity, entry.path, `drift word "${term}" under a ${lock.signature} meter lock`, { engine: ctx.profile.id }),
          ),
      );
  },
};
