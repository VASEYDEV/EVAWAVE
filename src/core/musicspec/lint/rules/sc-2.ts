/** SC-2: a synth role positioned in a section whose scope omits it. */
import { result, type LintRule } from "../context";

export const SC2: LintRule = {
  id: "SC-2",
  check(ctx) {
    const sections = ctx.spec.D7.sections;
    return ctx.spec.D5.synthRoles.flatMap((use, i) =>
      use.position.sectionIds.flatMap((sectionId, j) => {
        const section = sections.find((s) => s.id === sectionId);
        return section && !section.scope.synthRoleIds.includes(use.synthRoleId)
          ? [result("SC-2", "warn", `/D5/synthRoles/${i}/position/sectionIds/${j}`, `"${use.synthRoleId}" is positioned in "${section.label}" but not in its scope`)]
          : [];
      }),
    );
  },
};
