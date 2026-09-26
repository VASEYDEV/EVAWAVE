/** CP-3: a contrast style whose known meters exclude the locked signature. */
import { result, type LintRule } from "../context";

export const CP3: LintRule = {
  id: "CP-3",
  check(ctx) {
    const lock = ctx.spec.D6.meterLock;
    if (!lock.enabled) return [];
    const { catalog } = ctx;
    return ctx.spec.D7.sections.flatMap((section, i) => {
      if (!section.contrast) return [];
      const styleId = section.contrast.styleId;
      const genre = catalog.genres[styleId] ?? catalog.genres[catalog.drumPatterns[styleId]?.genreId ?? ""];
      const meters = genre?.criteria.meters ?? [];
      return meters.length && !meters.includes(lock.signature)
        ? [result("CP-3", "block", `/D7/sections/${i}/contrast/styleId`, `contrast style "${styleId}" has no ${lock.signature} meter`)]
        : [];
    });
  },
};
