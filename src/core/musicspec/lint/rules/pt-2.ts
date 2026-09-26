/** PT-2: a patch op that targets `references` or `patches` is blocked. */
import { PROTECTED_ROOTS } from "../../intake";
import type { IRPatch, LintResult } from "../../ir/types";
import { parsePointer, PatchError } from "../../patch";
import { result, type LintRule } from "../context";

function root(path: string): string {
  try {
    return parsePointer(path)[0] ?? "";
  } catch (error) {
    if (error instanceof PatchError) return "";
    throw error;
  }
}

/** PT-2 for one patch; `base` is its pointer, for example '/patches/0'. */
export function protectedOps(patch: IRPatch, base: string): LintResult[] {
  return patch.ops.flatMap((op, j) =>
    PROTECTED_ROOTS.has(root(op.path)) ? [result("PT-2", "block", `${base}/ops/${j}`, `patches may not edit ${op.path}`)] : [],
  );
}

export const PT2: LintRule = {
  id: "PT-2",
  check(ctx) {
    return ctx.spec.patches.flatMap((patch, i) => protectedOps(patch, `/patches/${i}`));
  },
};
