/**
 * BG-1: a text field over its engine character cap, a number field outside its bounds, or an
 * Eleven composition plan over the engine's chunk limit.
 */
import { ELEVEN_MAX_CHUNKS } from "../../serialize/eleven";
import { compositionPlanOf, result, type LintRule } from "../context";

export const BG1: LintRule = {
  id: "BG-1",
  check(ctx) {
    const payload = ctx.payload;
    if (!payload) return [];
    const fieldHits = ctx.profile.fields.flatMap((field) => {
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
    const plan = compositionPlanOf(payload);
    const planHits =
      plan && plan.chunks.length > ELEVEN_MAX_CHUNKS
        ? [result("BG-1", "block", `${ctx.profile.id}.composition_plan`, `${plan.chunks.length} chunks, over the ${ELEVEN_MAX_CHUNKS}-chunk limit`, { engine: ctx.profile.id })]
        : [];
    return [...fieldHits, ...planHits];
  },
};
