import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The three typefaces (guide §06: three families, closed) are self-hosted under the SIL Open
 * Font License. This pins the files, their licences, and that nothing in src/ reaches for a
 * font host at runtime.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const fontsDir = join(root, "src/fonts");
const fontsTs = readFileSync(join(root, "src/app/fonts.ts"), "utf8");

const FAMILIES = [
  { file: "BebasNeue-Regular.woff2", licence: "OFL-BebasNeue.txt", variable: "--font-bebas" },
  { file: "RedditSans-Variable.woff2", licence: "OFL-RedditSans.txt", variable: "--font-sans" },
  { file: "JetBrainsMono-Variable.woff2", licence: "OFL-JetBrainsMono.txt", variable: "--font-jetbrains" },
];

describe("brand typefaces", () => {
  it.each(FAMILIES)("ships $file as woff2 with its OFL licence and wires it to $variable", ({ file, licence, variable }) => {
    const path = join(fontsDir, file);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).subarray(0, 4).toString("latin1")).toBe("wOF2");
    expect(statSync(path).size).toBeGreaterThan(10_000);
    expect(readFileSync(join(fontsDir, licence), "utf8")).toMatch(/SIL Open Font License/i);
    expect(fontsTs).toContain(`../fonts/${file}`);
    expect(fontsTs).toContain(`variable: "${variable}"`);
  });

  it("adds no fourth family and loads nothing from a font host", () => {
    expect(readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"))).toHaveLength(3);
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    for (const f of walk(join(root, "src")).filter((f) => /\.(tsx?|css)$/.test(f))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|next\/font\/google/);
    }
  });

  it("turns ligatures off for the technical face, as the guide requires in interfaces", () => {
    expect(fontsTs).toMatch(/'liga' 0/);
  });
});
