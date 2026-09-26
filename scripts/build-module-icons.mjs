#!/usr/bin/env node
/**
 * Writes one standalone SVG per module icon to assets/icons/modules/ from the single source,
 * assets/icons/modules.json (docs/SPEC.md §1.9), for designers and the Vector Iconography
 * project. The app renders the same JSON inline so the stroke takes the module hue.
 *
 * Usage: node scripts/build-module-icons.mjs            write the SVGs
 *        node scripts/build-module-icons.mjs --check    exit 1 if they are out of date
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = JSON.parse(readFileSync(`${root}assets/icons/modules.json`, "utf8"));

const escape = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function svgFor(name) {
  const shapes = source.icons[name].map(([tag, attrs]) => `  <${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escape(v)}"`).join(" ")}/>`);
  return [
    `<!-- EVAWAVE module icon "${name}" (${source.status}). Generated from assets/icons/modules.json; do not edit. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${source.viewBox}" fill="none" stroke="currentColor" stroke-width="${source.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = Object.fromEntries(Object.keys(source.icons).map((name) => [`assets/icons/modules/${name}.svg`, svgFor(name)]));
  if (process.argv.includes("--check")) {
    const stale = Object.entries(files).filter(([path, svg]) => {
      try {
        return readFileSync(`${root}${path}`, "utf8") !== svg;
      } catch {
        return true;
      }
    });
    if (stale.length) {
      console.error(`module icons out of date: ${stale.map(([p]) => p).join(", ")}. Run node scripts/build-module-icons.mjs`);
      process.exit(1);
    }
    console.log("module icons match modules.json");
  } else {
    mkdirSync(`${root}assets/icons/modules`, { recursive: true });
    for (const [path, svg] of Object.entries(files)) writeFileSync(`${root}${path}`, svg);
    console.log(`wrote ${Object.keys(files).length} icons`);
  }
}
