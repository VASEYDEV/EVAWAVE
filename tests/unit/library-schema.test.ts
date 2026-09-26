import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { MusicSpec } from "@/core/musicspec/ir/types";
import { profileSpecFrom } from "@/lib/library/repository";
import { PROFILE_NAME_MAX, profileName, toReferenceAsset, toStyleProfile, toTag, type FileRow, type StyleProfileRow } from "@/lib/library/schema";

const spec = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;

describe("library mappers", () => {
  it("keeps a style profile to D1–D6, D8 and D9: no structure, no output intent (§1.6)", () => {
    const slice = profileSpecFrom(spec);
    expect(Object.keys(slice).sort()).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D8", "D9"]);
  });

  it("maps a style profile row with its links, sorted", () => {
    const row: StyleProfileRow = {
      id: "p1",
      owner_id: "u1",
      name: "Desert trap",
      provenance: { kind: "hand-built" },
      spec: { D6: spec.D6 },
      features: null,
      created_at: "2026-09-26T00:00:00Z",
      updated_at: "2026-09-26T01:00:00Z",
    };
    expect(toStyleProfile(row, { genreIds: ["drill", "atlanta-trap"], tagIds: ["t2", "t1"] })).toEqual({
      id: "p1",
      ownerId: "u1",
      name: "Desert trap",
      provenance: { kind: "hand-built" },
      spec: { D6: spec.D6 },
      genreIds: ["atlanta-trap", "drill"],
      tags: ["t1", "t2"],
      createdAt: "2026-09-26T00:00:00Z",
      updatedAt: "2026-09-26T01:00:00Z",
    });
  });

  it("maps a file row as a local-only reference asset", () => {
    const row: FileRow = { id: "f1", owner_id: "u1", kind: "audio", filename: "a.wav", mime: "audio/wav", bytes: 10, sha256: "a".repeat(64), local_only: true, features: null, palette: null, created_at: "2026-09-26T00:00:00Z" };
    expect(toReferenceAsset(row)).toEqual({ id: "f1", ownerId: "u1", kind: "audio", filename: "a.wav", mime: "audio/wav", bytes: 10, sha256: "a".repeat(64), localOnly: true, createdAt: "2026-09-26T00:00:00Z" });
  });

  it("maps a tag, dropping a null colour", () => {
    expect(toTag({ id: "t1", owner_id: "u1", label: "dark", colour: null, created_at: "x" })).toEqual({ id: "t1", ownerId: "u1", label: "dark" });
  });
});

describe("profile names", () => {
  it("keeps names inside the library's 200-character limit, from the typed name or the filename", () => {
    expect(profileName("  Desert loop  ", "desert-loop.wav")).toBe("Desert loop");
    expect(profileName("   ", "desert-loop.wav")).toBe("desert-loop.wav");
    expect(profileName("x".repeat(250), "a.wav")).toHaveLength(PROFILE_NAME_MAX);
    expect(profileName("", `${"y".repeat(240)}.wav`)).toHaveLength(PROFILE_NAME_MAX);
  });
});
