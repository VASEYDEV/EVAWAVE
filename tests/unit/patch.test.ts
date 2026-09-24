import { describe, expect, it } from "vitest";

import { applyPatch, parsePointer, PROTECTED_ROOTS } from "@/core/musicspec/ir/patch";
import type { IRPatch, PatchOp } from "@/core/musicspec/ir/types";

/**
 * `applyPatch` is the only mutation path for intake (BUILD-BRIEF §2). Paths follow the IR
 * v0.3 delta's own example (`/D6/tempo/bpm`); the fixture below is a plain object shaped
 * like a working spec, not the v0.2 type, which S1b merges from the owner's sources.
 */

function op(kind: PatchOp["op"], path: string, value?: unknown): PatchOp {
  return { op: kind, path, value, confidence: 0.9, rationale: `${kind} ${path}` };
}

function patch(ops: PatchOp[], status: IRPatch["status"] = "accepted"): IRPatch {
  return {
    id: "patch-1",
    source: "text",
    createdAt: "2026-09-24T00:00:00Z",
    ops,
    status,
    acceptedPaths: [],
    rejectedPaths: [],
  };
}

function spec() {
  return {
    D6: { tempo: { bpm: 120, source: "manual" }, meterLock: { enabled: false, signature: "4/4" } },
    D7: { sections: [{ id: "intro", bars: 8 }, { id: "hook", bars: 16 }] },
    references: [{ id: "ref-1", kind: "audio", weight: 1 }],
    patches: [],
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

const everyPath = (ops: PatchOp[]) => ops.map((o) => o.path);

describe("parsePointer (RFC 6901)", () => {
  it("splits tokens and decodes ~1 then ~0", () => {
    expect(parsePointer("/D6/tempo/bpm")).toEqual(["D6", "tempo", "bpm"]);
    expect(parsePointer("/a~1b/c~0d")).toEqual(["a/b", "c~d"]);
    expect(parsePointer("/a~01")).toEqual(["a~1"]);
    expect(parsePointer("/")).toEqual([""]);
    expect(parsePointer("/0")).toEqual(["0"]);
  });

  it("rejects the whole-document pointer, a missing leading slash and a bad escape", () => {
    expect(parsePointer("")).toBeNull();
    expect(parsePointer("D6/tempo")).toBeNull();
    expect(parsePointer("/a~2")).toBeNull();
    expect(parsePointer("/a~")).toBeNull();
  });
});

describe("applyPatch: gates", () => {
  it("a proposed patch never touches the working spec (delta §5)", () => {
    const input = spec();
    const ops = [op("set", "/D6/tempo/bpm", 140)];
    const result = applyPatch(input, patch(ops, "proposed"), everyPath(ops));
    expect(result.spec).toBe(input);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([{ op: ops[0], reason: "proposed-patch" }]);
    expect(input.D6.tempo.bpm).toBe(120);
  });

  it("an op whose path is not accepted is a no-op (S1 acceptance)", () => {
    const input = spec();
    const ops = [op("set", "/D6/tempo/bpm", 140), op("set", "/D6/tempo/source", "tap")];
    const result = applyPatch(input, patch(ops), ["/D6/tempo/source"]);
    expect(result.skipped).toEqual([{ op: ops[0], reason: "not-accepted" }]);
    expect(result.applied).toEqual([ops[1]]);
    expect(result.spec.D6.tempo).toEqual({ bpm: 120, source: "tap" });
  });

  it("returns the same object when no op applies", () => {
    const input = spec();
    const result = applyPatch(input, patch([op("set", "/D6/tempo/bpm", 140)]), []);
    expect(result.spec).toBe(input);
  });

  it("PT-2 protects exactly the delta's provenance roots", () => {
    // Spelled out rather than read from the constant, so emptying the constant fails here.
    expect([...PROTECTED_ROOTS]).toEqual(["references", "patches"]);
  });

  it.each(["references", "patches"])("PT-2: refuses accepted ops under /%s", (root) => {
    const input = spec();
    const ops = [op("set", `/${root}/0`, { id: "x" }), op("append", `/${root}`, { id: "y" }), op("remove", `/${root}`)];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.applied).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual(["protected-path", "protected-path", "protected-path"]);
    expect(result.spec).toBe(input);
  });

  it("does not treat a longer key that starts with a protected root as protected", () => {
    const input = { ...spec(), referencesNote: "" };
    const ops = [op("set", "/referencesNote", "ok")];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.applied).toEqual(ops);
  });

  it.each(["", "D6/tempo/bpm", "/D6/~2", "/__proto__/polluted", "/D6/constructor/prototype/x", "/prototype"])(
    "skips the malformed or forbidden path %j as invalid-path",
    (path) => {
      const input = spec();
      const ops = [op("set", path, 1)];
      const result = applyPatch(input, patch(ops), [path]);
      expect(result.skipped).toEqual([{ op: ops[0], reason: "invalid-path" }]);
      expect(result.spec).toBe(input);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    },
  );

  it("reports the reason in order: invalid path, then protected, then not accepted", () => {
    const input = spec();
    const ops = [op("set", "bad", 1), op("set", "/patches/0", 1), op("set", "/D6/tempo/bpm", 1)];
    const result = applyPatch(input, patch(ops), []);
    expect(result.skipped.map((s) => s.reason)).toEqual(["invalid-path", "protected-path", "not-accepted"]);
  });
});

describe("applyPatch: set", () => {
  it("replaces a leaf and leaves the input untouched", () => {
    const input = deepFreeze(spec());
    const ops = [op("set", "/D6/tempo/bpm", 140)];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec.D6.tempo.bpm).toBe(140);
    expect(input.D6.tempo.bpm).toBe(120);
    expect(result.applied).toEqual(ops);
    expect(result.skipped).toEqual([]);
  });

  it("shares untouched subtrees with the input", () => {
    const input = spec();
    const ops = [op("set", "/D6/tempo/bpm", 140)];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec).not.toBe(input);
    expect(result.spec.D6).not.toBe(input.D6);
    expect(result.spec.D7).toBe(input.D7);
    expect(result.spec.D6.meterLock).toBe(input.D6.meterLock);
  });

  it("creates a missing intermediate object, as on a v0.2 document without v0.3 fields", () => {
    const input = deepFreeze({ D6: { key: "D" } });
    const ops = [op("set", "/D6/tempo/bpm", 140)];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec).toEqual({ D6: { key: "D", tempo: { bpm: 140 } } });
  });

  it("does not create a missing array parent", () => {
    const input = deepFreeze({ D7: {} });
    const ops = [op("set", "/D7/sections/0/bars", 8), op("set", "/D7/sections/-", { id: "a" })];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.skipped.map((s) => s.reason)).toEqual(["invalid-path", "invalid-path"]);
    expect(result.spec).toBe(input);
  });

  it("sets by array index, at the end index and with the - token", () => {
    const input = deepFreeze(spec());
    const ops = [
      op("set", "/D7/sections/0/bars", 4),
      op("set", "/D7/sections/2", { id: "bridge", bars: 8 }),
      op("set", "/D7/sections/-", { id: "outro", bars: 4 }),
    ];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec.D7.sections).toEqual([
      { id: "intro", bars: 4 },
      { id: "hook", bars: 16 },
      { id: "bridge", bars: 8 },
      { id: "outro", bars: 4 },
    ]);
  });

  it("rejects an out-of-range index and a path through a primitive", () => {
    const input = deepFreeze(spec());
    const ops = [op("set", "/D7/sections/5", {}), op("set", "/D6/tempo/bpm/x", 1)];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.skipped.map((s) => s.reason)).toEqual(["invalid-path", "invalid-path"]);
  });

  it("rejects a set without a value", () => {
    const ops = [op("set", "/D6/tempo/bpm")];
    const result = applyPatch(spec(), patch(ops), everyPath(ops));
    expect(result.skipped).toEqual([{ op: ops[0], reason: "type-mismatch" }]);
  });

  it("applies ops in order, so a later op on the same path wins", () => {
    const ops = [op("set", "/D6/tempo/bpm", 130), op("set", "/D6/tempo/bpm", 140)];
    const result = applyPatch(spec(), patch(ops), everyPath(ops));
    expect(result.spec.D6.tempo.bpm).toBe(140);
    expect(result.applied).toEqual(ops);
  });
});

describe("applyPatch: merge", () => {
  it("shallow-merges into an existing object", () => {
    const input = deepFreeze(spec());
    const ops = [op("merge", "/D6/tempo", { bpm: 140, feltBpm: 70 })];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec.D6.tempo).toEqual({ bpm: 140, source: "manual", feltBpm: 70 });
  });

  it("merges into an absent target by creating it", () => {
    const input = deepFreeze({ D6: {} });
    const ops = [op("merge", "/D6/tempo", { bpm: 140 })];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec).toEqual({ D6: { tempo: { bpm: 140 } } });
  });

  it("merges into an array element by index", () => {
    const ops = [op("merge", "/D7/sections/1", { label: "Hook" })];
    const result = applyPatch(spec(), patch(ops), everyPath(ops));
    expect(result.spec.D7.sections[1]).toEqual({ id: "hook", bars: 16, label: "Hook" });
  });

  it("rejects a non-object value or a non-object target", () => {
    const ops = [op("merge", "/D6/tempo", 140), op("merge", "/D6/tempo/bpm", { x: 1 }), op("merge", "/D7/sections", { x: 1 })];
    const result = applyPatch(spec(), patch(ops), everyPath(ops));
    expect(result.skipped.map((s) => s.reason)).toEqual(["type-mismatch", "type-mismatch", "type-mismatch"]);
  });
});

describe("applyPatch: append", () => {
  it("appends one element, or every element of an array value", () => {
    const input = deepFreeze(spec());
    const ops = [op("append", "/D7/sections", { id: "bridge", bars: 8 }), op("append", "/D7/sections", [{ id: "a" }, { id: "b" }])];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec.D7.sections.map((s: { id: string }) => s.id)).toEqual(["intro", "hook", "bridge", "a", "b"]);
    expect(input.D7.sections).toHaveLength(2);
  });

  it("creates the array when the target is absent", () => {
    const input = deepFreeze({ D10: {} });
    const ops = [op("append", "/D10/negativeSpace", { class: "custom", terms: ["swing"] })];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec).toEqual({ D10: { negativeSpace: [{ class: "custom", terms: ["swing"] }] } });
  });

  it("rejects a non-array target and a missing value", () => {
    const ops = [op("append", "/D6/tempo", 1), op("append", "/D7/sections")];
    const result = applyPatch(spec(), patch(ops), everyPath(ops));
    expect(result.skipped.map((s) => s.reason)).toEqual(["type-mismatch", "type-mismatch"]);
  });
});

describe("applyPatch: remove", () => {
  it("removes an object key and an array index", () => {
    const input = deepFreeze(spec());
    const ops = [op("remove", "/D6/meterLock"), op("remove", "/D7/sections/0")];
    const result = applyPatch(input, patch(ops), everyPath(ops));
    expect(result.spec.D6).toEqual({ tempo: { bpm: 120, source: "manual" } });
    expect(result.spec.D7.sections).toEqual([{ id: "hook", bars: 16 }]);
    expect(input.D7.sections).toHaveLength(2);
  });

  it("rejects an absent key, an out-of-range index and the - token", () => {
    const ops = [op("remove", "/D6/nothing"), op("remove", "/D7/sections/9"), op("remove", "/D7/sections/-"), op("remove", "/D8/x")];
    const result = applyPatch(spec(), patch(ops), everyPath(ops));
    expect(result.skipped.map((s) => s.reason)).toEqual(["invalid-path", "invalid-path", "invalid-path", "invalid-path"]);
  });
});
