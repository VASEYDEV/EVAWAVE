import { describe, expect, it } from "vitest";

import { findNames, scrubNames } from "@/core/musicspec/lineage";

/** Invented names only (docs/SPEC.md §2.7): tests never use a real artist or producer. */
const NAMES = ["Quillon Vantreese", "DJ Marrowby", "Oskeline"];

describe("findNames", () => {
  it("finds listed names case-insensitively as whole words, in list order", () => {
    expect(findNames("a dj marrowby bounce with a quillon vantreese lead", NAMES)).toEqual(["Quillon Vantreese", "DJ Marrowby"]);
  });

  it("does not match inside a longer word", () => {
    expect(findNames("Oskelines and Oskeline2 are not the name", NAMES)).toEqual([]);
  });

  it("ignores blank entries", () => {
    expect(findNames("anything", ["", "  "])).toEqual([]);
  });
});

describe("scrubNames", () => {
  it("returns the text unchanged when no name occurs", () => {
    const text = "saw lead, dark pads; strict 4/4";
    expect(scrubNames(text, NAMES)).toBe(text);
  });

  it("removes a name with its possessive or -style suffix and tidies the separators", () => {
    expect(scrubNames("saw lead, Oskeline-style, dark", NAMES)).toBe("saw lead, dark");
    expect(scrubNames("Quillon Vantreese's bounce, 808", NAMES)).toBe("bounce, 808");
  });

  it("removes a name inside a bracket without leaving a dangling separator", () => {
    expect(scrubNames("[Hook – full drums, DJ Marrowby]", NAMES)).toBe("[Hook – full drums]");
    expect(scrubNames("[Hook – DJ Marrowby, full drums]", NAMES)).toBe("[Hook – full drums]");
    expect(scrubNames("[Hook – Oskeline]", NAMES)).toBe("[Hook]");
    expect(scrubNames("[Oskeline, full drums]", NAMES)).toBe("[full drums]");
  });

  it("closes a sentence the name ended", () => {
    expect(scrubNames("Synths: saw lead, Oskeline. Dark pads.", NAMES)).toBe("Synths: saw lead. Dark pads.");
  });

  it("leaves no listed name behind", () => {
    const scrubbed = scrubNames("Oskeline, oskeline and OSKELINE over a DJ Marrowby kit", NAMES);
    expect(findNames(scrubbed, NAMES)).toEqual([]);
  });
});
