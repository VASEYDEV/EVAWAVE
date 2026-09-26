import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ENGINE_PROFILES } from "@/core/musicspec/engines";
import type { MusicSpec } from "@/core/musicspec/ir/types";
import { compile } from "@/core/musicspec/serialize";
import { catalog } from "@/data/taxonomy";

const spec = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;

describe("compile", () => {
  it.each(["suno", "eleven", "flow"])("compiles for %s", (engine) => {
    const result = compile(spec, engine, catalog);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.engine).toBe(engine);
      expect(result.payload.profileVersion).toBe(ENGINE_PROFILES[engine as "suno"].version);
      expect(result.payload.hash).toMatch(/^[0-9a-f]{14}$/);
    }
  });

  it("refuses Udio with a typed engine-halted error (A12)", () => {
    const result = compile(spec, "udio", catalog);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "engine-halted", engine: "udio" }) });
    if (!result.ok) expect(result.error.message).toContain("A12");
  });

  it("refuses an engine with no installed profile", () => {
    expect(compile(spec, "other", catalog)).toEqual({ ok: false, error: expect.objectContaining({ code: "engine-unknown", engine: "other" }) });
  });

  it("refuses a profile installed under another engine's id", () => {
    const profiles = { ...ENGINE_PROFILES, flow: ENGINE_PROFILES.suno };
    expect(compile(spec, "flow", catalog, profiles)).toEqual({ ok: false, error: expect.objectContaining({ code: "profile-invalid" }) });
  });
});
