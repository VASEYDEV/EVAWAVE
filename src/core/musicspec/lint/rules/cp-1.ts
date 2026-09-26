/** CP-1: a contrast phrase without a return rule. */
import { result, type LintRule } from "../context";

export const CP1: LintRule = {
  id: "CP-1",
  check(ctx) {
    return ctx.spec.D7.sections.flatMap((section, i) =>
      section.contrast && section.contrast.returnRule.trim() === ""
        ? [result("CP-1", "block", `/D7/sections/${i}/contrast/returnRule`, "a contrast phrase needs a bounded return rule")]
        : [],
    );
  },
};
