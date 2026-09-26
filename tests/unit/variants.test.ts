import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import type { Catalog, FieldDiff, MusicSpec } from "@/core/musicspec/ir/types";
import { applyOps, PatchError } from "@/core/musicspec/patch";
import { diffJson, diffSpecs, diffToOps, freezeBlockers, naturalCompare, nextVariantLabel, normalise, specHash, variantCoverage } from "@/core/musicspec/variants";
import { catalog } from "@/data/taxonomy";

/**
 * Variants (docs/SPEC.md §2.4, §3 S6). The acceptance comes from the Build Brief's library
 * session: forking Jinn v1.1 into v1.2 shows the BPM 142 → 140 diff. Names seeded for LN-1
 * are invented, never real.
 */
const fixture = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8")) as MusicSpec;
const v11 = fixture("jinn-v1.1.spec.json");
const v12 = fixture("jinn-v1.2.spec.json");

/** Applies a diff to `before` through the patch engine the composer uses. */
const replay = (before: unknown, diff: readonly FieldDiff[]) => applyOps(normalise(before), diffToOps(diff)).doc;

describe("diffSpecs", () => {
  it("shows the Jinn v1.1 → v1.2 tempo change as BPM 142 → 140", () => {
    const diff = diffSpecs(v11, v12);
    expect(diff).toContainEqual({ path: "/D6/tempo/bpm", before: 142, after: 140 });
    expect(diff).toContainEqual({ path: "/D6/tempo/feltBpm", before: 71, after: 70 });
  });

  it("replays exactly: applying the Jinn diff to v1.1 gives v1.2, and back", () => {
    expect(replay(v11, diffSpecs(v11, v12))).toEqual(normalise(v12));
    expect(replay(v12, diffSpecs(v12, v11))).toEqual(normalise(v11));
  });

  it("is empty for a spec against itself and against its own JSON round trip", () => {
    expect(diffSpecs(v12, v12)).toEqual([]);
    expect(diffSpecs(v12, normalise(v12))).toEqual([]);
  });

  it("ignores undefined members, which storage cannot keep", () => {
    expect(diffJson({ a: undefined, b: 1 }, { b: 1 })).toEqual([]);
  });

  it("reports an added, removed or retyped subtree once, at its root", () => {
    expect(diffJson({ a: 1 }, { a: 1, b: { c: [1, 2] } })).toEqual([{ path: "/b", after: { c: [1, 2] } }]);
    expect(diffJson({ a: 1, b: {} }, { a: 1 })).toEqual([{ path: "/b", before: {} }]);
    expect(diffJson({ a: [1, 2] }, { a: { 0: 1 } })).toEqual([{ path: "/a", before: [1, 2], after: { 0: 1 } }]);
    expect(diffJson({ a: null }, { a: {} })).toEqual([{ path: "/a", before: null, after: {} }]);
  });

  it("marks additions and removals by the absent side, which survives JSON", () => {
    const diff = diffJson({ list: [1, 2, 3] }, { list: [1], extra: true });
    expect(diff).toEqual([
      { path: "/extra", after: true },
      { path: "/list/1", before: 2 },
      { path: "/list/2", before: 3 },
    ]);
    expect(normalise(diff)).toEqual(diff);
    for (const entry of normalise(diff)) expect("before" in entry && "after" in entry).toBe(false);
  });

  it("reports a change at the root itself once, and refuses to turn it into patch ops", () => {
    expect(diffJson(1, 2)).toEqual([{ path: "", before: 1, after: 2 }]);
    expect(diffJson({ a: 1 }, [1])).toEqual([{ path: "", before: { a: 1 }, after: [1] }]);
    expect(() => diffToOps(diffJson(1, 2))).toThrow(PatchError);
    expect(() => diffToOps(diffJson({ a: 1 }, [1]))).toThrow("cannot be replayed as patch ops");
  });

  it("escapes ~ and / in keys, and replays them", () => {
    const before = { "a/b": { "c~d": 1 } };
    const after = { "a/b": { "c~d": 2 } };
    expect(diffJson(before, after)).toEqual([{ path: "/a~1b/c~0d", before: 1, after: 2 }]);
    expect(replay(before, diffJson(before, after))).toEqual(after);
  });

  it("orders pointers naturally: D2 before D10, element 2 before element 10", () => {
    const before = { D10: 0, D2: 0, list: Array.from({ length: 12 }, () => 0) };
    const after = { D10: 1, D2: 1, list: Array.from({ length: 12 }, () => 1) };
    const paths = diffJson(before, after).map((d) => d.path);
    expect(paths.slice(0, 2)).toEqual(["/D2", "/D10"]);
    expect(paths.slice(2)).toEqual(Array.from({ length: 12 }, (_, i) => `/list/${i}`));
    expect(["b10", "b2", "a", "b1"].sort(naturalCompare)).toEqual(["a", "b1", "b2", "b10"]);
  });

  it("replays shrinking and growing arrays, nested and together", () => {
    const cases: [unknown, unknown][] = [
      [{ a: [1, 2, 3, 4] }, { a: [9] }],
      [{ a: [] }, { a: [1, 2, 3] }],
      [{ a: [[1, 2, 3], [4]] }, { a: [[1], [4, 5, 6], [7]] }],
      [{ a: [{ x: [1, 2] }, { y: 1 }] }, { a: [{ x: [] }] }],
      [{ a: {}, b: [1] }, { b: [] }],
    ];
    for (const [before, after] of cases) expect(replay(before, diffJson(before, after))).toEqual(after);
  });

  it("replays random edits of the Jinn spec (seeded)", () => {
    // mulberry32: a small seeded generator, so a failure reproduces.
    let seed = 0x5eed;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    const mutate = (node: unknown, depth: number): unknown => {
      if (Array.isArray(node)) {
        const copy = node.map((item) => (random() < 0.3 ? mutate(item, depth + 1) : item));
        if (random() < 0.2 && copy.length) copy.splice(Math.floor(random() * copy.length), 1);
        if (random() < 0.2) copy.push(pick(["added", 7, { fresh: true }, [1, 2]]));
        return copy;
      }
      if (typeof node === "object" && node !== null) {
        const copy: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(node)) {
          const roll = random();
          if (roll < 0.05) continue;
          copy[key] = roll < 0.35 && depth < 8 ? mutate(value, depth + 1) : value;
        }
        if (random() < 0.1) copy[pick(["new", "x/y", "t~k", "10"])] = pick([0, "s", null, { k: [1] }]);
        return copy;
      }
      return random() < 0.5 ? pick([0, 1.5, "changed", true, null, { was: node }]) : node;
    };
    for (let round = 0; round < 60; round++) {
      const after = mutate(v12, 0);
      expect(replay(v12, diffJson(v12, after))).toEqual(normalise(after));
    }
  });
});

describe("specHash", () => {
  it("ignores key order and undefined members, and changes with content", () => {
    const reordered = JSON.parse(JSON.stringify(v12, Object.keys(v12).reverse())) as MusicSpec;
    const shuffled = { ...v12, D6: { ...v12.D6, tempo: { feltBpm: v12.D6.tempo.feltBpm, bpm: v12.D6.tempo.bpm, source: v12.D6.tempo.source } } } as MusicSpec;
    expect(specHash(shuffled)).toBe(specHash(v12));
    expect(specHash({ ...v12, extra: undefined } as unknown as MusicSpec)).toBe(specHash(v12));
    expect(specHash(v11)).not.toBe(specHash(v12));
    expect(specHash(reordered)).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe("nextVariantLabel", () => {
  it("starts at v1.0 and counts minors as numbers, so v1.10 follows v1.9", () => {
    expect(nextVariantLabel([])).toBe("v1.0");
    expect(nextVariantLabel(["v1.0"])).toBe("v1.1");
    expect(nextVariantLabel(["v1.9", "v1.10", "v1.2"])).toBe("v1.11");
    expect(nextVariantLabel(["draft", "v2.3"])).toBe("v1.0");
  });
});

describe("variantCoverage", () => {
  it("records one report per engine with a serializer, and none for halted Udio", () => {
    const coverage = variantCoverage(v12, catalog);
    expect(Object.keys(coverage).sort()).toEqual(["eleven", "flow", "suno"]);
    for (const report of Object.values(coverage)) {
      expect(report?.compiledAt).toBeUndefined();
      expect(report?.score).toBeGreaterThan(0);
    }
  });

  it("records all three reports for a fresh working copy, which a first freeze may be", () => {
    const coverage = variantCoverage(defaultMusicSpec(), catalog);
    expect(Object.keys(coverage).sort()).toEqual(["eleven", "flow", "suno"]);
    for (const report of Object.values(coverage)) expect(Array.isArray(report?.items)).toBe(true);
  });
});

describe("freezeBlockers", () => {
  const INVENTED = "Quillon Vantreese";
  const withName: Catalog = { ...catalog, lineageNames: [...catalog.lineageNames, INVENTED] };

  it("is empty for a spec that lints clean of names", () => {
    expect(freezeBlockers(v12, withName)).toEqual([]);
  });

  it("reads the target overrides a variant would carry, once however many engines lint them", () => {
    const override = { engine: "flow" as const, fieldId: "sound", text: `glassy pads like ${INVENTED}`, basedOnCompiledHash: "h", createdAt: "c" };
    const blocks = freezeBlockers(v12, withName, [override]);
    expect(blocks).toEqual([expect.objectContaining({ ruleId: "LN-1", severity: "block", path: "overrides/0" })]);
    expect(freezeBlockers(v12, withName, [{ ...override, text: "glassy pads" }])).toEqual([]);
  });

  it("reports an invented producer name once, whichever engines see it", () => {
    const spec = structuredClone(v12);
    spec.D1.formPhrase = `${spec.D1.formPhrase} in the style of ${INVENTED}`;
    const blocks = freezeBlockers(spec, withName);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((b) => b.ruleId === "LN-1" && b.severity === "block")).toBe(true);
    expect(new Set(blocks.map((b) => `${b.path}|${b.message}`)).size).toBe(blocks.length);
    expect(blocks.map((b) => b.path)).toContain("/D1/formPhrase");
  });
});
