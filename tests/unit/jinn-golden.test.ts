import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getProfile } from "@/core/musicspec/engines";
import type { MusicSpec } from "@/core/musicspec/ir/types";
import { lint } from "@/core/musicspec/lint";
import { compileSuno } from "@/core/musicspec/serialize/suno";
import { catalog } from "@/data/taxonomy";

/**
 * Jinn v1.2 is ground truth (ADR 0004). The Suno compile of the v1.2 IR must equal the three
 * fenced fields of docs/evawave/reference/jinn-v1.2-condensed.md byte for byte. The file is
 * read at run time and never copied, so the test cannot drift from the reference.
 */
const repoFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const jinnFile = readFileSync(repoFile("docs/evawave/reference/jinn-v1.2-condensed.md"), "utf8");
const spec = JSON.parse(readFileSync(repoFile("tests/fixtures/jinn-v1.2.spec.json"), "utf8")) as MusicSpec;

function fencedBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let open: string[] | null = null;
  for (const line of markdown.split("\n")) {
    if (open === null && line.startsWith("```")) open = [];
    else if (open !== null && line === "```") {
      blocks.push(open.join("\n"));
      open = null;
    } else if (open !== null) open.push(line);
  }
  return blocks;
}

const [style, exclude, lyrics] = fencedBlocks(jinnFile);
const payload = compileSuno(spec, getProfile("suno"), catalog);

describe("Jinn v1.2 golden file (Suno v6)", () => {
  it("reads three fields from the reference file", () => {
    expect([style, exclude, lyrics].every((block) => typeof block === "string" && block.length > 0)).toBe(true);
    expect(jinnFile).toContain("Total paste content: 2779 characters");
  });

  it("compiles the Style field byte for byte", () => {
    expect(payload.fields.style).toBe(style);
  });

  it("compiles the Exclude Styles field byte for byte", () => {
    expect(payload.fields.exclude).toBe(exclude);
  });

  it("compiles the Lyrics field byte for byte", () => {
    expect(payload.fields.lyrics).toBe(lyrics);
  });

  it("matches the reference character counts (998 + 222 + 1,559 = 2,779)", () => {
    const counts = [payload.fields.style, payload.fields.exclude, payload.fields.lyrics].map((field) => [...String(field)].length);
    expect(counts).toEqual([998, 222, 1559]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2779);
  });

  it("sets the Instrumental toggle ON", () => {
    expect(payload.toggles).toEqual({ instrumental: true });
  });

  it("lints with no block-severity result", () => {
    const blocks = lint(spec, getProfile("suno"), catalog, payload).filter((result) => result.severity === "block");
    expect(blocks).toEqual([]);
  });

  it("compiles deterministically", () => {
    const again = compileSuno(structuredClone(spec), getProfile("suno"), catalog);
    expect(again.hash).toBe(payload.hash);
    expect(again.fields).toEqual(payload.fields);
  });
});
