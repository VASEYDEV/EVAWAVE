import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getProfile } from "@/core/musicspec/engines";
import { defaultMusicSpec, defaultSection } from "@/core/musicspec/ir/defaults";
import type { Catalog, EngineProfile, MusicSpec } from "@/core/musicspec/ir/types";
import { compileSuno } from "@/core/musicspec/serialize/suno";
import { catalog } from "@/data/taxonomy";

/** Suno serializer contracts beyond the golden file (docs/SPEC.md §2.4, §2.6). */
const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;
const suno = getProfile("suno");

function edited(edit: (spec: MusicSpec) => void): MusicSpec {
  const spec = structuredClone(v12);
  edit(spec);
  return spec;
}

describe("compileSuno", () => {
  it("refuses a profile for another engine", () => {
    expect(() => compileSuno(v12, getProfile("eleven"), catalog)).toThrow(/suno profile/);
  });

  it("compiles the default spec without throwing", () => {
    const spec = defaultMusicSpec();
    spec.D7.sections.push(defaultSection("verse", "verse", "Verse"));
    const payload = compileSuno(spec, suno, catalog);
    expect(payload.fields.lyrics).toBe("[Verse]");
    expect(payload.toggles).toEqual({ instrumental: false });
  });

  it("passes user lyrics through untouched with the Instrumental toggle off", () => {
    const passthrough = "[Verse]\nUSER-TEXT-PLACEHOLDER\n\n[Hook]\nUSER-TEXT-PLACEHOLDER";
    const spec = edited((s) => {
      s.D8.instrumental = false;
      s.D8.lyricsPassthrough = passthrough;
    });
    const payload = compileSuno(spec, suno, catalog);
    expect(payload.fields.lyrics).toBe(passthrough);
    expect(payload.toggles).toEqual({ instrumental: false });
  });

  it("restates the meter in every section bracket with style-and-sections", () => {
    const spec = edited((s) => void (s.D6.meterLock.restatement = "style-and-sections"));
    const sections = String(compileSuno(spec, suno, catalog).fields.lyrics)
      .split("\n\n")
      .filter((bracket) => / – /.test(bracket) && !/pickup|Timpani|Filter sweep/.test(bracket));
    expect(sections).toHaveLength(8);
    // A clause after a set-off contrast joins with "; " (§2.4); every other clause with ", ".
    for (const bracket of sections) expect(bracket).toMatch(/[,;] strict 4\/4\]$/);
  });

  it("puts a start-position silence drop before its section", () => {
    const spec = edited((s) => {
      const outro = s.D7.sections.at(-1);
      if (outro) outro.silenceAfter = { beats: 2, position: "start" };
    });
    const brackets = String(compileSuno(spec, suno, catalog).fields.lyrics).split("\n\n");
    expect(brackets.at(-2)).toBe("[Drop to silence]");
    expect(brackets.at(-1)).toMatch(/^\[Outro – /);
  });

  it("applies wording precedence: override, then profile alias, then record alias, then promptPhrase", () => {
    const style = (spec: MusicSpec, profile: EngineProfile = suno, cat: Catalog = catalog) => String(compileSuno(spec, profile, cat).fields.style);
    // Profile alias beats the record's promptPhrase.
    expect(style(v12)).toContain("Egyptian tabla darbuka");
    // An override beats the profile alias.
    const overridden = edited((s) => {
      const tabla = s.D5.instruments.find((u) => u.value.instrumentId === "tabla-egyptian");
      if (tabla) tabla.value.phraseOverride = "clay goblet drum";
    });
    expect(style(overridden)).toContain("clay goblet drum");
    expect(style(overridden)).not.toContain("Egyptian tabla darbuka");
    // Without a profile alias, the record's own alias wins over its promptPhrase.
    const riqAliased: Catalog = { ...catalog, instruments: { ...catalog.instruments, riq: { ...catalog.instruments.riq!, aliases: { suno: "jingle frame drum" } } } };
    expect(style(v12, suno, riqAliased)).toContain("jingle frame drum");
    // The drift-fallback alias is never read on a normal compile.
    expect(style(v12)).not.toMatch(/, darbuka[,;.]/);
  });

  it("marks an alias substitution in the coverage report", () => {
    const aliased = compileSuno(v12, suno, catalog).coverage.items.filter((item) => item.reason === "alias-substituted");
    expect(aliased.map((item) => item.path)).toEqual(["/D5/instruments/7"]);
  });

  it("adds the profile's drift words as a meter-drift class when the lock is on and the class is missing", () => {
    const spec = edited((s) => void (s.D10.negativeSpace = s.D10.negativeSpace.filter((n) => n.class !== "meter-drift")));
    const exclude = String(compileSuno(spec, suno, catalog).fields.exclude);
    expect(exclude.startsWith("vocals, rap vocals, singing, lyrics, autotune, shuffle, shuffled")).toBe(true);
  });

  it("scrubs a listed name from every field, whatever the source", () => {
    const invented = "Oskeline Marrowby";
    const withName: Catalog = { ...catalog, lineageNames: [invented] };
    const spec = edited((s) => {
      s.D2.moods.push({ value: `${invented}-style menace`, weight: 1 });
      s.D10.title = `Jinn for ${invented}`;
      s.D7.sections[0]?.cues.push({ slot: "fx", text: `${invented} riser` });
    });
    const fields = Object.values(compileSuno(spec, suno, withName).fields).join("\n");
    expect(fields).not.toMatch(/oskeline|marrowby/i);
  });
});
