/** BT-1: an engine's banned term in a compiled payload. */
import { containsTerm } from "../../text";
import { payloadTexts, result, type LintRule } from "../context";

export const BT1: LintRule = {
  id: "BT-1",
  check(ctx) {
    return payloadTexts(ctx.payload).flatMap(([field, text]) =>
      ctx.profile.bannedTerms
        .filter((term) => containsTerm(text, term))
        .map((term) => result("BT-1", "warn", `${ctx.profile.id}.${field}`, `banned term "${term}"`, { engine: ctx.profile.id })),
    );
  },
};
