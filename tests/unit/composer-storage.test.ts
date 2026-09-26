import { describe, expect, it } from "vitest";

import { commit, emptyHistory } from "@/core/musicspec/history";
import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import { parseComposer } from "@/lib/composer/storage";

/** The composer's saved working copy (src/lib/composer/storage.ts), read back safely. */
const edited = () =>
  commit(emptyHistory(), defaultMusicSpec(), [{ op: "set", path: "/D6/tempo/bpm", value: 140, confidence: 1, rationale: "composer edit" }], "Tempo");

describe("parseComposer", () => {
  it("reads back what the composer wrote", () => {
    const step = edited();
    expect(parseComposer(JSON.stringify(step))).toEqual(step);
  });

  it("returns null for nothing, junk, or a value that is not a working copy", () => {
    for (const raw of [null, "", "{", "null", "42", JSON.stringify({ spec: { irVersion: 2 }, history: { nodes: [], cursor: 0 } }), JSON.stringify({ spec: defaultMusicSpec() })]) {
      expect(parseComposer(raw)).toBeNull();
    }
  });
});
