import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import source from "../../assets/icons/modules.json";

/** Module iconography (docs/SPEC.md §1.9): one provisional monoline icon per module. */
const MODULES = ["form", "key", "drums", "bundle", "instruments", "technique", "textures", "transitions", "sections", "mood", "output", "library", "intake"];

describe("module icons", () => {
  it("cover every module in the §1.9 table and are marked provisional", () => {
    expect(Object.keys(source.icons).sort()).toEqual([...MODULES].sort());
    expect(source.status).toBe("provisional");
    expect(source.viewBox).toBe("0 0 400 400");
  });

  it("are monoline: one stroke weight and no fill attributes", () => {
    for (const shapes of Object.values(source.icons)) {
      for (const [, attrs] of shapes as [string, Record<string, string>][]) {
        expect(Object.keys(attrs).some((k) => /fill|stroke/.test(k))).toBe(false);
      }
    }
  });

  it("have standalone SVGs that match the source (the generator's --check passes)", () => {
    const root = fileURLToPath(new URL("../..", import.meta.url));
    const out = execFileSync(process.execPath, ["scripts/build-module-icons.mjs", "--check"], { cwd: root, encoding: "utf8" });
    expect(out).toContain("module icons match modules.json");
  });
});
