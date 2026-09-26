/** CV-2: a dropped D6 or D7 item the user has not acknowledged blocks export. */
import { result, type LintRule } from "../context";

export const CV2: LintRule = {
  id: "CV-2",
  check(ctx) {
    const coverage = ctx.payload?.coverage;
    if (!coverage) return [];
    const acknowledged = new Set(ctx.spec.D10.acknowledgedDrops ?? []);
    const engine = ctx.profile.id;
    return coverage.items
      .filter((item) => item.state === "dropped" && (item.dimension === "D6" || item.dimension === "D7") && !acknowledged.has(`${engine}:${item.path}`))
      .map((item) =>
        result("CV-2", "block", item.path, `${ctx.profile.displayName} drops this${item.detail ? ` (${item.detail})` : ""}; acknowledge it to export`, { engine }),
      );
  },
};
