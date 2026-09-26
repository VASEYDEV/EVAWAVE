/** ML-4: meter lock on and no meter-drift negative class; proposes the engine's drift words. */
import { result, type LintRule } from "../context";

export const ML4: LintRule = {
  id: "ML-4",
  check(ctx) {
    const { spec, profile } = ctx;
    if (!spec.D6.meterLock.enabled || spec.D10.negativeSpace.some((entry) => entry.class === "meter-drift")) return [];
    return [
      result("ML-4", "warn", "/D10/negativeSpace", "meter lock on without a meter-drift exclude class", {
        engine: profile.id,
        fix: [
          {
            op: "append",
            path: "/D10/negativeSpace",
            value: { class: "meter-drift", terms: [...profile.driftWords], auto: true },
            confidence: 1,
            rationale: `Populate the meter-drift class from the ${profile.displayName} drift words.`,
          },
        ],
      }),
    ];
  },
};
