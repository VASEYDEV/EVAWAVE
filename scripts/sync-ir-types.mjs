#!/usr/bin/env node
/**
 * Writes src/core/musicspec/ir/types.ts from the single TypeScript block in docs/SPEC.md §2.2.
 * The spec is the source of truth for IR v1 (ADR 0004). tests/unit/ir-types-sync.test.ts
 * fails when the two drift, so an IR change always lands in the spec first.
 *
 * Usage: node scripts/sync-ir-types.mjs            write the file
 *        node scripts/sync-ir-types.mjs --check    exit 1 if the file is out of date
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** The one ```ts fenced block in the spec, parsed line by line. */
export function specTypeBlock(spec) {
  const blocks = [];
  let open = null;
  for (const line of spec.split("\n")) {
    if (open === null && line.startsWith("```")) {
      open = { language: line.slice(3).trim(), lines: [] };
    } else if (open !== null && line === "```") {
      if (open.language === "ts") blocks.push(open.lines.join("\n"));
      open = null;
    } else if (open !== null) {
      open.lines.push(line);
    }
  }
  if (blocks.length !== 1) throw new Error(`docs/SPEC.md must hold exactly one ts block, found ${blocks.length}`);
  return blocks[0];
}

export const HEADER = `/**
 * MusicSpec IR v1 types. Generated from docs/SPEC.md §2.2 by scripts/sync-ir-types.mjs.
 * Do not edit by hand: change the spec, then run \`node scripts/sync-ir-types.mjs\`.
 */
`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = `${root}src/core/musicspec/ir/types.ts`;
  const expected = `${HEADER}${specTypeBlock(readFileSync(`${root}docs/SPEC.md`, "utf8"))}\n`;
  if (process.argv.includes("--check")) {
    if (readFileSync(target, "utf8") !== expected) {
      console.error("src/core/musicspec/ir/types.ts is out of date: run node scripts/sync-ir-types.mjs");
      process.exit(1);
    }
    console.log("src/core/musicspec/ir/types.ts matches docs/SPEC.md");
  } else {
    writeFileSync(target, expected);
    console.log("wrote src/core/musicspec/ir/types.ts");
  }
}
