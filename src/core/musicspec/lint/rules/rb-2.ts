/** RB-2: a section mode outside every used bundle's modes, with no cross flag. */
import { result, type LintRule } from "../context";

export const RB2: LintRule = {
  id: "RB-2",
  check(ctx) {
    const bundles = ctx.spec.D5.bundles;
    if (!bundles.length || bundles.some((b) => b.crossBundle)) return [];
    const modes = new Set(bundles.flatMap((b) => ctx.catalog.bundles[b.bundleId]?.modeIds ?? []));
    return ctx.spec.D7.sections.flatMap((section, i) =>
      section.modeId && !modes.has(section.modeId)
        ? [result("RB-2", "warn", `/D7/sections/${i}/modeId`, `mode "${section.modeId}" is outside the regional bundle`)]
        : [],
    );
  },
};
