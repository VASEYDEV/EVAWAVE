/** SC-1: too many named instruments in a section (instruments ∪ synth roles; ensembles count once). */
import { result, type LintRule } from "../context";

export const SC1: LintRule = {
  id: "SC-1",
  check(ctx) {
    const cap = ctx.spec.D5.sectionCap;
    return ctx.spec.D7.sections.flatMap((section, i) => {
      const count = new Set([...section.scope.instrumentIds, ...section.scope.synthRoleIds]).size;
      const path = `/D7/sections/${i}/scope`;
      if (count >= cap.blockAt) return [result("SC-1", "block", path, `${count} named instruments in "${section.label}" (block at ${cap.blockAt})`)];
      if (count >= cap.warnAt) return [result("SC-1", "warn", path, `${count} named instruments in "${section.label}" (warn at ${cap.warnAt})`)];
      return [];
    });
  },
};
