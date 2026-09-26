import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getProfile } from "@/core/musicspec/engines";
import type { MusicSpec } from "@/core/musicspec/ir/types";
import { lint } from "@/core/musicspec/lint";
import { compileSuno } from "@/core/musicspec/serialize/suno";
import { catalog } from "@/data/taxonomy";

/**
 * Jinn v1.1 is the negative fixture (docs/SPEC.md §3, S1). tests/fixtures/jinn-v1.1.spec.json
 * encodes docs/evawave/reference/jinn-v1.1-egypt-blueprint.md with the meter lock the
 * blueprint declares ("Global: 4/4"): its sections, cues, word-MIDI notes, rhythms and
 * techniques. Under that lock the linter must block its drift vocabulary and its 2/4 rhythms,
 * the defects v1.2 fixed. The blueprint's Style-field nod to a named choral work is left out;
 * lineage has its own test.
 */
const repoFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const blueprint = readFileSync(repoFile("docs/evawave/reference/jinn-v1.1-egypt-blueprint.md"), "utf8");
const spec = JSON.parse(readFileSync(repoFile("tests/fixtures/jinn-v1.1.spec.json"), "utf8")) as MusicSpec;
const suno = getProfile("suno");
const payload = compileSuno(spec, suno, catalog);
const results = lint(spec, suno, catalog, payload);
const blocks = results.filter((r) => r.severity === "block");

/** The fenced block that follows a heading in the blueprint. */
function blockAfter(heading: string): string {
  const start = blueprint.indexOf(heading);
  const open = blueprint.indexOf("```\n", start);
  const close = blueprint.indexOf("\n```", open + 4);
  return blueprint.slice(open + 4, close);
}

describe("Jinn v1.1 negative fixture", () => {
  it("fails ML-1 on each drift phrase the blueprint uses", () => {
    const terms = new Set(
      blocks.filter((r) => r.ruleId === "ML-1").map((r) => /drift word "([^"]+)"/.exec(r.message)?.[1]),
    );
    for (const term of ["shuffled", "shuffle", "rubato", "trance rhythm", "two cycles per bar"]) expect(terms).toContain(term);
  });

  it("finds the drift words where the blueprint put them", () => {
    const paths = blocks.filter((r) => r.ruleId === "ML-1").map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/D7/sections/0/cues/1/text", // nay flute rubato
        "/D7/sections/1/cues/6/text", // sagat finger cymbals shuffled 16ths
        "/D7/sections/3/cues/1/text", // zar trance rhythm
        "/D7/sections/3/notes/0", // two cycles per bar
        "catalog:techniques/light-shuffle/promptPhrase", // light shuffle on sagat and tabla
      ]),
    );
  });

  it("fails ML-2 on the 2/4 zar/ayyub and malfuf rhythms", () => {
    expect(blocks.filter((r) => r.ruleId === "ML-2").map((r) => r.path)).toEqual([
      "/D5/bundles/0/rhythmIds/3",
      "/D7/sections/3/scope/percussionRhythmIds/0",
      "/D7/sections/6/scope/percussionRhythmIds/0",
    ]);
  });

  it("warns TQ-1 for the meter-risk techniques and ML-4 for the missing meter-drift class", () => {
    const warnings = results.filter((r) => r.severity === "warn").map((r) => `${r.ruleId} ${r.path}`);
    expect(warnings).toEqual(
      expect.arrayContaining(["TQ-1 catalog:techniques/light-shuffle", "TQ-1 catalog:techniques/taqsim", "ML-4 /D10/negativeSpace"]),
    );
  });

  it("encodes the blueprint's section brackets", () => {
    const lyrics = blockAfter("## 3. SUNO — Lyrics field");
    // The blueprint closes with an [End] tag; IR v1 has no end marker, so it is compared without it.
    expect(`${payload.fields.lyrics}\n\n[End]`).toBe(lyrics);
  });
});
