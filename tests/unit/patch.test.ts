import { describe, expect, it } from "vitest";

import type { PatchOp } from "@/core/musicspec/ir/types";
import { applyOp, applyOps, formatPointer, getAt, parsePointer, PatchError } from "@/core/musicspec/patch";

const op = (o: Omit<PatchOp, "confidence" | "rationale">): PatchOp => ({ confidence: 1, rationale: "test", ...o });

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const base = () => deepFreeze({ a: { b: 1 }, list: [10, 20, 30], text: "x" });

describe("pointers", () => {
  it("parses and formats RFC 6901 escapes", () => {
    expect(parsePointer("/a~1b/c~0d")).toEqual(["a/b", "c~d"]);
    expect(formatPointer(["a/b", "c~d"])).toBe("/a~1b/c~0d");
    expect(parsePointer("")).toEqual([]);
  });

  it("rejects a relative pointer and prototype tokens", () => {
    expect(() => parsePointer("a/b")).toThrow(PatchError);
    expect(() => parsePointer("/__proto__/x")).toThrow(PatchError);
  });

  it("reads values and reports missing ones as undefined", () => {
    expect(getAt(base(), "/list/1")).toBe(20);
    expect(getAt(base(), "/a/missing/deep")).toBeUndefined();
  });
});

describe("applyOp", () => {
  it.each<[string, PatchOp]>([
    ["set a new key", op({ op: "set", path: "/a/c", value: 2 })],
    ["set an existing key", op({ op: "set", path: "/a/b", value: 5 })],
    ["set creating intermediate objects", op({ op: "set", path: "/x/y/z", value: true })],
    ["set appending with -", op({ op: "set", path: "/list/-", value: 40 })],
    ["set replacing an index", op({ op: "set", path: "/list/0", value: 11 })],
    ["merge", op({ op: "merge", path: "/a", value: { c: 3 } })],
    ["append an element", op({ op: "append", path: "/list", value: 40 })],
    ["append many to a new array", op({ op: "append", path: "/fresh", value: [1, 2] })],
    ["remove a key", op({ op: "remove", path: "/text" })],
    ["remove an array element", op({ op: "remove", path: "/list/1" })],
  ])("%s, and its inverse restores the document", (_name, patch) => {
    const doc = base();
    const { doc: next, inverse } = applyOp(doc, patch);
    expect(next).not.toEqual(doc);
    expect(applyOp(next, inverse).doc).toEqual(doc);
  });

  it("never mutates its input and shares untouched branches", () => {
    const doc = base();
    const { doc: next } = applyOp(doc, op({ op: "set", path: "/text", value: "y" }));
    expect(doc.text).toBe("x");
    expect(next.a).toBe(doc.a);
  });

  it("rejects ops that do not fit the document", () => {
    expect(() => applyOp(base(), op({ op: "remove", path: "/nope" }))).toThrow(PatchError);
    expect(() => applyOp(base(), op({ op: "merge", path: "/list", value: { a: 1 } }))).toThrow(PatchError);
    expect(() => applyOp(base(), op({ op: "append", path: "/text", value: 1 }))).toThrow(PatchError);
    expect(() => applyOp(base(), op({ op: "set", path: "/list/9", value: 1 }))).toThrow(PatchError);
    expect(() => applyOp(base(), op({ op: "set", path: "/missing/0", value: 1 }))).toThrow(PatchError);
    expect(() => applyOp(base(), op({ op: "set", path: "", value: 1 }))).toThrow(PatchError);
  });
});

describe("applyOps", () => {
  it("applies in order and undoes in reverse", () => {
    const doc = base();
    const ops = [op({ op: "append", path: "/list", value: 40 }), op({ op: "remove", path: "/list/0" }), op({ op: "set", path: "/list/0", value: 99 })];
    const { doc: next, inverse } = applyOps(doc, ops);
    expect(next.list).toEqual([99, 30, 40]);
    expect(applyOps(next, inverse).doc).toEqual(doc);
  });
});
