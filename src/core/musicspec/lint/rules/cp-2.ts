/** CP-2: a contrast phrase longer than a quarter of its section. */
import { result, type LintRule } from "../context";

export const CP2: LintRule = {
  id: "CP-2",
  check(ctx) {
    return ctx.spec.D7.sections.flatMap((section, i) =>
      section.contrast && section.contrast.bars > 0.25 * section.bars
        ? [result("CP-2", "warn", `/D7/sections/${i}/contrast/bars`, `contrast of ${section.contrast.bars} bars is over 25% of a ${section.bars}-bar section`)]
        : [],
    );
  },
};
