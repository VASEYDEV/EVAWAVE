/** RB-3: a mode or instrument the active engine renders only approximately; suggests a substitute. */
import type { Mode } from "../../ir/types";
import { result, usedInstrumentIds, type LintRule } from "../context";

const WEAK = new Set(["approximate", "unreliable"]);

function distance(a: Mode, b: Mode): number {
  return a.intervalsCents.reduce((sum, cents, i) => sum + Math.abs(cents - (b.intervalsCents[i] ?? cents)), 0);
}

export const RB3: LintRule = {
  id: "RB-3",
  check(ctx) {
    const engine = ctx.profile.id;
    const { spec, catalog } = ctx;
    const out = [];
    const modeRefs: [string, string][] = [["/D6/key/modeId", spec.D6.key.modeId], ...spec.D7.sections.flatMap((s, i) => (s.modeId ? [[`/D7/sections/${i}/modeId`, s.modeId] as [string, string]] : []))];
    for (const [path, id] of modeRefs) {
      const mode = catalog.modes[id];
      const level = mode?.reliability[engine];
      if (!mode || !level || !WEAK.has(level)) continue;
      const substitute = Object.values(catalog.modes)
        .filter((m) => m.family === mode.family && m.reliability[engine] === "reliable")
        .sort((a, b) => distance(mode, a) - distance(mode, b) || a.id.localeCompare(b.id))[0];
      out.push(result("RB-3", "warn", path, `mode "${mode.name}" is ${level} on ${ctx.profile.displayName}${substitute ? `; nearest reliable: ${substitute.name}` : ""}`, { engine }));
    }
    for (const id of usedInstrumentIds(spec)) {
      const level = catalog.instruments[id]?.reliability[engine];
      if (level && WEAK.has(level)) out.push(result("RB-3", "warn", `catalog:instruments/${id}`, `instrument "${id}" is ${level} on ${ctx.profile.displayName}`, { engine }));
    }
    return out;
  },
};
