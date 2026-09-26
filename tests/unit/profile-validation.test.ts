import { describe, expect, it } from "vitest";

import { ENGINE_PROFILES, getProfile, ProfileError, validateProfile } from "@/core/musicspec/engines";
import suno from "@/core/musicspec/engines/profiles/suno.json";
import udio from "@/core/musicspec/engines/profiles/udio.json";

/** The loader validates every profile at import (docs/SPEC.md §1.3); these prove it rejects bad data. */
type Mutable = Record<string, unknown> & { fields: Record<string, unknown>[] };
const copy = (profile: unknown): Mutable => structuredClone(profile) as Mutable;

describe("validateProfile", () => {
  it("accepts the four installed profiles", () => {
    expect(Object.keys(ENGINE_PROFILES)).toEqual(["suno", "eleven", "flow", "udio"]);
    expect(getProfile("suno").id).toBe("suno");
    expect(getProfile("udio").status).toBe("stub");
  });

  it("rejects an unknown engine id", () => {
    expect(() => validateProfile({ ...copy(suno), id: "other" }, "x")).toThrow(ProfileError);
  });

  it("rejects an unknown confidence level", () => {
    expect(() => validateProfile({ ...copy(suno), confidence: "lore" })).toThrow(/confidence/);
  });

  it("requires a halted block on a stub and a verification block on a live profile", () => {
    const stub = copy(udio);
    delete stub.halted;
    expect(() => validateProfile(stub)).toThrow(/halted/);
    const live = copy(suno);
    delete live.verification;
    expect(() => validateProfile(live)).toThrow(/verification/);
  });

  it("keeps character caps on text fields and numeric bounds on number fields", () => {
    const capOnNumber = copy(suno);
    capOnNumber.fields[0] = { ...capOnNumber.fields[0], kind: "number", hardLimit: 10 };
    expect(() => validateProfile(capOnNumber)).toThrow(/character cap/);
    const boundOnText = copy(suno);
    boundOnText.fields[0] = { ...boundOnText.fields[0], kind: "text", min: 1 };
    expect(() => validateProfile(boundOnText)).toThrow(/numeric bound/);
  });

  it("rejects duplicate field ids", () => {
    const dup = copy(suno);
    dup.fields.push({ ...dup.fields[0] });
    expect(() => validateProfile(dup)).toThrow(/unique/);
  });

  it("requires a support level for every dimension", () => {
    const missing = copy(suno);
    missing.supports = { ...(missing.supports as object), D7: "sometimes" };
    expect(() => validateProfile(missing)).toThrow(/supports\.D7/);
  });
});
