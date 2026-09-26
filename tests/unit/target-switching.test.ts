import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { CompiledPayload, MusicSpec } from "@/core/musicspec/ir/types";
import { compile } from "@/core/musicspec/serialize";
import { catalog } from "@/data/taxonomy";

/**
 * Target switching is a projection, not a mutation (docs/SPEC.md A5, §3 S2). Compiling for
 * one engine and then another never touches the spec, and coming back to an engine gives the
 * same payload hash. The spec is deep-frozen, so any write inside a serializer throws.
 */
const load = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8")) as MusicSpec;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach((item) => deepFreeze(item));
    Object.freeze(value);
  }
  return value;
}

const TARGETS = ["suno", "eleven", "flow"] as const;

function payloadFor(spec: MusicSpec, engine: string): CompiledPayload {
  const result = compile(spec, engine, catalog);
  if (!result.ok) throw new Error(result.error.message);
  return result.payload;
}

describe.each(["jinn-v1.2.spec.json", "jinn-v1.1.spec.json"])("target switching on %s", (fixture) => {
  const original = load(fixture);

  it("Suno → Eleven → Flow → Suno leaves the spec deep-equal and the Suno hash unchanged", () => {
    const spec = deepFreeze(structuredClone(original));
    const first = payloadFor(spec, "suno");
    payloadFor(spec, "eleven");
    payloadFor(spec, "flow");
    const last = payloadFor(spec, "suno");
    expect(spec).toEqual(original);
    expect(last.hash).toBe(first.hash);
    expect(last.fields).toEqual(first.fields);
  });

  const pairs = TARGETS.flatMap((a) => TARGETS.filter((b) => b !== a).map((b) => [a, b] as const));
  it.each(pairs)("round-trips %s → %s → back", (a, b) => {
    const spec = deepFreeze(structuredClone(original));
    const before = payloadFor(spec, a);
    const other = payloadFor(spec, b);
    const after = payloadFor(spec, a);
    expect(spec).toEqual(original);
    expect(after.hash).toBe(before.hash);
    expect(other.engine).toBe(b);
    expect(other.coverage.engine).toBe(b);
  });

  it("gives each target its own payload and coverage report", () => {
    const hashes = TARGETS.map((engine) => payloadFor(original, engine).hash);
    expect(new Set(hashes).size).toBe(TARGETS.length);
  });
});
