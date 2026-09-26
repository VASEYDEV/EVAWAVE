/** OV-1: a target override written against a compile that no longer matches. */
import { result, type LintRule } from "../context";

export const OV1: LintRule = {
  id: "OV-1",
  check(ctx) {
    const payload = ctx.payload;
    if (!payload || !ctx.overrides) return [];
    return ctx.overrides.flatMap((override, i) =>
      override.engine === ctx.profile.id && override.basedOnCompiledHash !== payload.hash
        ? [result("OV-1", "warn", `overrides/${i}`, `override of ${override.engine}.${override.fieldId} was written against an older compile`, { engine: override.engine })]
        : [],
    );
  },
};
