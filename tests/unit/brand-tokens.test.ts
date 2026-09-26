import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The brand tokens against the Vasey Multimedia Brand System v2.0 (ADR 0005,
 * docs/design/brand-application.md). The guide's rule is "measured, not asserted": every
 * designed pairing below is computed with the WCAG 2.x relative-luminance formula, the same
 * formula the guide's own contrast matrix uses, so its published figures are reproduced here
 * to two decimals and the app's pairings are held to their thresholds.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const tokensCss = readFileSync(join(root, "src/app/styles/tokens.css"), "utf8");

const tokens = Object.fromEntries([...tokensCss.matchAll(/--(vm-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]!.trim()]));

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const t = (name: string) => {
  const value = tokens[name];
  if (!value) throw new Error(`token --${name} is missing from tokens.css`);
  return value.toLowerCase();
};

describe("CORE palette (guide §03)", () => {
  it("carries the guide's values verbatim, as hex literals", () => {
    expect(t("vm-turquoise")).toBe("#00b8d9");
    expect(t("vm-teal")).toBe("#397281");
    expect(t("vm-field")).toBe("#052e3a");
    expect(t("vm-navy")).toBe("#191970");
    expect(t("vm-accent-blue")).toBe("#454cfc");
    expect(t("vm-silver")).toBe("#c9d0d3");
    expect(t("vm-charcoal")).toBe("#29363f");
    expect(t("vm-beam")).toBe("#22e8f5");
    for (const [name, value] of Object.entries(tokens)) {
      if (name === "vm-line" || /^vm-(turquoise|teal|field|navy|accent-blue|silver|charcoal|beam)$/.test(name)) {
        expect(value, `--${name} must be a six-digit hex literal so this test can measure it`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("reproduces the guide's contrast matrix (§10) to two decimals", () => {
    expect(contrast(t("vm-silver"), t("vm-charcoal"))).toBeCloseTo(7.94, 2);
    expect(contrast(t("vm-silver"), t("vm-field"))).toBeCloseTo(9.22, 2);
    expect(contrast(t("vm-turquoise"), t("vm-field"))).toBeCloseTo(6.07, 2);
    expect(contrast(t("vm-turquoise"), t("vm-charcoal"))).toBeCloseTo(5.23, 2);
    expect(contrast(t("vm-beam"), t("vm-field"))).toBeCloseTo(9.55, 2);
    expect(contrast(t("vm-beam"), t("vm-charcoal"))).toBeCloseTo(8.22, 2);
    expect(contrast(t("vm-teal"), t("vm-silver"))).toBeCloseTo(3.45, 2);
    expect(contrast(t("vm-accent-blue"), t("vm-charcoal"))).toBeCloseTo(2.18, 2);
  });

  it("holds every pairing the interface uses to its WCAG threshold", () => {
    const AAA = 7, AA = 4.5, UI = 3;
    // Body text on the field and on elevated surfaces.
    expect(contrast(t("vm-silver"), t("vm-field"))).toBeGreaterThanOrEqual(AAA);
    expect(contrast(t("vm-silver"), t("vm-charcoal"))).toBeGreaterThanOrEqual(AAA);
    // Headings, icons and links in Turquoise on both surfaces.
    expect(contrast(t("vm-turquoise"), t("vm-field"))).toBeGreaterThanOrEqual(AA);
    expect(contrast(t("vm-turquoise"), t("vm-charcoal"))).toBeGreaterThanOrEqual(AA);
    // Primary buttons: Turquoise fills carry Charcoal ink (guide §03).
    expect(contrast(t("vm-charcoal"), t("vm-turquoise"))).toBeGreaterThanOrEqual(AA);
    // The signature, where it appears.
    expect(contrast(t("vm-beam"), t("vm-field"))).toBeGreaterThanOrEqual(AAA);
    // Control borders (WCAG 1.4.11) and the focus ring against both surfaces.
    expect(contrast(t("vm-line"), t("vm-charcoal"))).toBeGreaterThanOrEqual(UI);
    expect(contrast(t("vm-line"), t("vm-field"))).toBeGreaterThanOrEqual(UI);
    expect(contrast(t("vm-turquoise"), t("vm-charcoal"))).toBeGreaterThanOrEqual(UI);
    expect(contrast(t("vm-turquoise"), t("vm-field"))).toBeGreaterThanOrEqual(UI);
  });

  it("derives the one surface tint from the bookends alone: Silver 50 % into Charcoal", () => {
    const mix = (a: string, b: string) =>
      "#" +
      [1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0")).join("");
    expect(t("vm-line")).toBe(mix(t("vm-silver"), t("vm-charcoal")));
  });

  it("never sets Accent Blue as text: it collapses to 2.18:1 on Charcoal", () => {
    expect(contrast(t("vm-accent-blue"), t("vm-charcoal"))).toBeLessThan(4.5);
    const styles = readdirSync(join(root, "src/app/styles")).map((f) => readFileSync(join(root, "src/app/styles", f), "utf8")).join("\n");
    expect(styles).not.toMatch(/color:\s*var\(--vm-accent-blue\)/);
  });
});

describe("brand rules the stylesheet must keep (guide §10)", () => {
  const styles = readdirSync(join(root, "src/app/styles")).map((f) => [f, readFileSync(join(root, "src/app/styles", f), "utf8")] as const);

  it("uses BEAM once: only the kicker's slash may carry the signature", () => {
    const uses = styles.flatMap(([f, css]) => [...css.matchAll(/^[^\n]*var\(--vm-beam\)[^\n]*$/gm)].map((m) => `${f}: ${m[0].trim()}`));
    expect(uses).toEqual(["pages.css: color: var(--vm-beam);"]);
  });

  it("names no colour outside the token layer", () => {
    for (const [f, css] of styles) {
      if (f === "tokens.css") continue;
      expect(css, `${f} must reference tokens, not literals`).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i);
    }
  });

  it("carries no emoji in any interface source", () => {
    const emoji = /[\u{1F000}-\u{1FAFF}]/u;
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    const offenders = walk(join(root, "src")).filter((f) => /\.(tsx?|css)$/.test(f) && emoji.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
