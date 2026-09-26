/** BG-1: a text field over its engine character cap, or a number field outside its bounds. */
import { result, type LintRule } from "../context";

export const BG1: LintRule = {
  id: "BG-1",
  check(ctx) {
    const payload = ctx.payload;
    if (!payload) return [];
    return ctx.profile.fields.flatMap((field) => {
      const value = payload.fields[field.id];
      const path = `${ctx.profile.id}.${field.id}`;
      if (typeof value === "string" && field.hardLimit !== undefined && [...value].length > field.hardLimit) {
        return [result("BG-1", "block", path, `${[...value].length} characters, over the ${field.hardLimit} limit`, { engine: ctx.profile.id })];
      }
      if (typeof value === "number" && ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))) {
        return [result("BG-1", "block", path, `${value} is outside ${field.min ?? "−∞"}–${field.max ?? "∞"}`, { engine: ctx.profile.id })];
      }
      return [];
    });
  },
};
