/** PB-2: a pickup, silence drop or contrast phrase used while the lock does not allow it. */
import { result, type LintRule } from "../context";

export const PB2: LintRule = {
  id: "PB-2",
  check(ctx) {
    const lock = ctx.spec.D6.meterLock;
    if (!lock.enabled) return [];
    const allowed = new Set(lock.allowedExtensions);
    return ctx.spec.D7.sections.flatMap((section, i) => {
      const base = `/D7/sections/${i}`;
      const out = [];
      if (section.pickupBefore && !allowed.has("pickup-bar")) out.push(result("PB-2", "warn", `${base}/pickupBefore`, "pickup bar used but not allowed by the meter lock"));
      if (section.silenceAfter && !allowed.has("silence-drop")) out.push(result("PB-2", "warn", `${base}/silenceAfter`, "silence drop used but not allowed by the meter lock"));
      if (section.contrast && !allowed.has("contrast-phrase")) out.push(result("PB-2", "warn", `${base}/contrast`, "contrast phrase used but not allowed by the meter lock"));
      return out;
    });
  },
};
