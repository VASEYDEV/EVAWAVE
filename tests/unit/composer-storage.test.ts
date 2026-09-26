import { afterEach, describe, expect, it, vi } from "vitest";

import { commit, emptyHistory } from "@/core/musicspec/history";
import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import { specHash } from "@/core/musicspec/variants";
import { COMPOSER_KEY, hasUnsavedWork, identityOf, openedCopy, parseComposer, stillCurrent, workingHash, writeComposer, type SongAttachment } from "@/lib/composer/storage";

/** The composer's saved working copy and its song attachment (src/lib/composer/storage.ts). */
const edited = () =>
  commit(emptyHistory(), defaultMusicSpec(), [{ op: "set", path: "/D6/tempo/bpm", value: 140, confidence: 1, rationale: "composer edit" }], "Tempo");

const attachment = (over: Partial<SongAttachment> = {}): SongAttachment => ({
  songId: "song-1",
  ownerId: "owner-1",
  title: "Jinn",
  revision: 2,
  savedHash: workingHash(defaultMusicSpec(), null),
  baseVariantId: null,
  baseLabel: null,
  variantLabels: [],
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseComposer", () => {
  it("reads back what the composer wrote, with and without a song", () => {
    const step = edited();
    expect(parseComposer(JSON.stringify(step))).toEqual(step);
    const withSong = { ...step, song: attachment({ baseVariantId: "v-1", baseLabel: "v1.0", variantLabels: ["v1.0"] }) };
    expect(parseComposer(JSON.stringify(withSong))).toEqual(withSong);
  });

  it("returns null for nothing, junk, or a value that is not a working copy", () => {
    for (const raw of [null, "", "{", "null", "42", JSON.stringify({ spec: { irVersion: 2 }, history: { nodes: [], cursor: 0 } }), JSON.stringify({ spec: defaultMusicSpec() })]) {
      expect(parseComposer(raw)).toBeNull();
    }
  });

  it("keeps the working copy but drops a malformed attachment", () => {
    const step = edited();
    const withoutBase = Object.fromEntries(Object.entries(attachment()).filter(([key]) => key !== "baseVariantId"));
    for (const song of [{ songId: "s" }, attachment({ revision: 1.5 }), { ...attachment(), variantLabels: [1] }, withoutBase, "song-1"]) {
      expect(parseComposer(JSON.stringify({ ...step, song }))).toEqual(step);
    }
  });
});

describe("writeComposer", () => {
  it("writes the spec and its attachment in one setItem, so neither is ever stored without the other", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    writeComposer({ ...edited(), song: attachment() });
    expect(setItem).toHaveBeenCalledTimes(1);
    const [key, value] = setItem.mock.calls[0] as [string, string];
    expect(key).toBe(COMPOSER_KEY);
    expect(parseComposer(value)?.song).toEqual(attachment());
  });

  it("fails soft when storage refuses", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    expect(() => writeComposer(edited())).not.toThrow();
  });
});

describe("hasUnsavedWork", () => {
  it("is false for nothing and for a fresh copy, true once a fresh copy is edited", () => {
    expect(hasUnsavedWork(null)).toBe(false);
    expect(hasUnsavedWork({ history: emptyHistory(), spec: defaultMusicSpec() })).toBe(false);
    expect(hasUnsavedWork(edited())).toBe(true);
  });

  it("compares an attached copy with its last save", () => {
    const step = edited();
    expect(hasUnsavedWork({ ...step, song: attachment({ savedHash: workingHash(step.spec, null) }) })).toBe(false);
    expect(hasUnsavedWork({ ...step, song: attachment() })).toBe(true);
  });

  it("counts the base variant as part of the copy: the same spec from another base is unsaved", () => {
    const step = edited();
    const saved = workingHash(step.spec, "v-1");
    expect(hasUnsavedWork({ ...step, song: attachment({ baseVariantId: "v-1", savedHash: saved }) })).toBe(false);
    expect(hasUnsavedWork({ ...step, song: attachment({ baseVariantId: "v-0", savedHash: saved }) })).toBe(true);
    expect(hasUnsavedWork({ ...step, song: attachment({ baseVariantId: null, savedHash: saved }) })).toBe(true);
  });
});

describe("workingHash", () => {
  it("is the spec's hash with its base, so neither can match the other's", () => {
    const spec = edited().spec;
    expect(workingHash(spec, null)).not.toBe(workingHash(spec, "v-1"));
    expect(workingHash(spec, "v-1")).toBe(workingHash(structuredClone(spec), "v-1"));
    expect(workingHash(spec, "v-1")).not.toBe(workingHash(defaultMusicSpec(), "v-1"));
    expect(workingHash(spec, null).startsWith(specHash(spec))).toBe(true);
  });
});

describe("openedCopy", () => {
  it("opens a song's spec with a fresh undo history and its attachment", () => {
    const spec = edited().spec;
    const opened = openedCopy(spec, attachment());
    expect(opened.history).toEqual(emptyHistory());
    expect(opened.spec).toBe(spec);
    expect(opened.song).toEqual(attachment());
  });
});

describe("stillCurrent", () => {
  it("lets a save or freeze attach only to the copy it started from", () => {
    const from = identityOf(attachment({ baseVariantId: "v-1", revision: 3 }));
    // The same copy, even after local edits or a newer title: attach.
    expect(stillCurrent(attachment({ baseVariantId: "v-1", revision: 3, title: "Renamed", savedHash: "x" }), from)).toBe(true);
    // Another tab opened another song, another variant of this one, or a newer save: do not.
    expect(stillCurrent(attachment({ songId: "song-2", baseVariantId: "v-1", revision: 3 }), from)).toBe(false);
    expect(stillCurrent(attachment({ baseVariantId: "v-0", revision: 3 }), from)).toBe(false);
    expect(stillCurrent(attachment({ baseVariantId: "v-1", revision: 4 }), from)).toBe(false);
    expect(stillCurrent(undefined, from)).toBe(false);
  });

  it("lets a first save attach only while the copy is still unattached", () => {
    expect(identityOf(undefined)).toBeNull();
    expect(stillCurrent(undefined, null)).toBe(true);
    expect(stillCurrent(attachment(), null)).toBe(false);
  });
});

