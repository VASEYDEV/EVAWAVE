import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { blueprintMarkdown } from "@/core/musicspec/blueprint";
import type { Catalog, MusicSpec } from "@/core/musicspec/ir/types";
import { catalog } from "@/data/taxonomy";

const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;

describe("word-MIDI blueprint", () => {
  const md = blueprintMarkdown(v12, catalog);

  it("states the global grid and the bar-math runtime", () => {
    expect(md).toContain("Global: 4/4 (locked) · 140 BPM half-time · D Hijaz · runtime 3:14 (113.25 bars)");
  });

  it("lists every section with its bars and time range, pickups included", () => {
    expect(md).toContain("### Section 1 · Intro · bars 1–16 · 0:00–0:27");
    expect(md).toContain("### Section 3 · Hook A · bars 33.5–48.5 · 0:56–1:23");
    expect(md.match(/^### Section /gm)).toHaveLength(v12.D7.sections.length);
  });

  it("carries blueprint-only content that no engine receives", () => {
    expect(md).toContain("- Harmony: Dm · B♭ · Gm · A, two bars each");
    expect(md).toContain("- Contrast (last 4 bars, drill): sliding 808s, displaced snare, then back to trap grid");
  });

  it("scrubs listed names like every other export", () => {
    const withName: Catalog = { ...catalog, lineageNames: ["Oskeline"] };
    const spec = structuredClone(v12);
    spec.D7.sections[0]!.notes = ["an Oskeline-style swell"];
    expect(blueprintMarkdown(spec, withName)).not.toMatch(/oskeline/i);
  });
});
