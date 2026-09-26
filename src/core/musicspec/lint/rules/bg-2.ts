/** BG-2: a text field over its house soft limit, or over a house budget (per field or total). */
import { payloadTexts, result, type LintRule } from "../context";

export const BG2: LintRule = {
  id: "BG-2",
  check(ctx) {
    const payload = ctx.payload;
    if (!payload) return [];
    const engine = ctx.profile.id;
    const out = [];
    const texts = new Map(payloadTexts(payload).map(([id, text]) => [id, [...text].length]));
    for (const field of ctx.profile.fields) {
      const length = texts.get(field.id);
      if (length !== undefined && field.kind === "text" && field.softLimit !== undefined && length > field.softLimit) {
        out.push(result("BG-2", "warn", `${engine}.${field.id}`, `${length} characters, over the ${field.softLimit} soft limit`, { engine }));
      }
    }
    const budgets = { ...(ctx.profile.houseBudgets ?? {}), ...ctx.spec.D10.houseBudgets };
    for (const [key, cap] of Object.entries(budgets)) {
      const [owner, target] = key.split(".");
      if (owner !== engine || !target) continue;
      const pasted = ctx.profile.fields.filter((f) => f.kind === "text" && f.id !== "title").map((f) => texts.get(f.id) ?? 0);
      const length = target === "total" ? pasted.reduce((a, b) => a + b, 0) : texts.get(target);
      if (length !== undefined && length > cap) out.push(result("BG-2", "warn", key, `${length} characters, over the house budget of ${cap}`, { engine }));
    }
    return out;
  },
};
