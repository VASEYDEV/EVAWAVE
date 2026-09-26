import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { barSec, computeBarMath } from "@/core/musicspec/barmath";
import { getProfile } from "@/core/musicspec/engines";
import type { ElevenCompositionPlan, MusicSpec } from "@/core/musicspec/ir/types";
import { lint } from "@/core/musicspec/lint";
import { compileEleven, lyricsBySection } from "@/core/musicspec/serialize/eleven";
import { catalog } from "@/data/taxonomy";

/** ElevenLabs Music v2 contracts (docs/SPEC.md §2.6, §3 S2). */
const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;
const eleven = getProfile("eleven");
const payload = compileEleven(v12, eleven, catalog);
const plan = payload.fields.composition_plan as ElevenCompositionPlan;
const chunk = (header: string) => {
  const found = plan.chunks.find((c) => c.text.startsWith(header));
  if (!found) throw new Error(`no chunk ${header}`);
  return found;
};

describe("compileEleven", () => {
  it("refuses a profile for another engine", () => {
    expect(() => compileEleven(v12, getProfile("suno"), catalog)).toThrow(/eleven profile/);
  });

  it("writes one chunk per section plus one for the contrast phrase", () => {
    expect(plan.chunks.map((c) => c.text.split("\n")[0])).toEqual([
      "[Intro]",
      "[Build]",
      "[Hook A]",
      "[Verse]",
      "[Hook B]",
      "[Hook B – drill contrast]",
      "[Bridge]",
      "[Finale]",
      "[Outro]",
    ]);
  });

  it("makes chunk durations sum to music_length_ms, which is the bar-math runtime", () => {
    const sum = plan.chunks.reduce((total, c) => total + c.duration_ms, 0);
    expect(payload.fields.music_length_ms).toBe(sum);
    const runtime = computeBarMath(v12.D6.tempo, "4/4", v12.D7).runtimeSec;
    expect(sum).toBe(Math.round(runtime * 1000));
  });

  it("times the contrast chunk from its bars, plus the silence it ends with", () => {
    const contrast = chunk("[Hook B – drill contrast]");
    const expected = (4 * barSec(140) + 60 / 140) * 1000;
    expect(Math.abs(contrast.duration_ms - expected)).toBeLessThanOrEqual(1);
    expect(contrast.positive_styles).toEqual(["loud", "drill contrast", "sliding 808s", "displaced snare"]);
    expect(contrast.text.split("\n").slice(1)).toEqual(["{instrumental break}", "{then back to trap grid}", "{silence}"]);
  });

  it("folds pickups into the preceding chunk as inline directions", () => {
    expect(chunk("[Build]").text.endsWith("{two-beat pickup: snare roll, riser}")).toBe(true);
    // Hook B's pickup is not announced, so its content goes in as written.
    expect(chunk("[Verse]").text.endsWith("{filter sweep closing, two-beat drum-roll pickup}")).toBe(true);
  });

  it("puts a transition inline at the end of its section's chunk", () => {
    expect(chunk("[Bridge]").text.endsWith("{timpani roll, choir swell, sub drop}")).toBe(true);
  });

  it("front-loads the song-wide palette and the meter lock in the first chunk only", () => {
    const [first, second] = plan.chunks;
    expect(first?.positive_styles[0]).toBe("Instrumental Egyptian Atlanta trap beat, strict 4/4 common time, 140 BPM half-time, straight 16ths, no swing");
    expect(first?.positive_styles).toContain("D Hijaz maqam, dark minor");
    expect(second?.positive_styles[0]).toBe("moderately soft");
  });

  it("words positioned synths in their own chunks and section clauses in their section", () => {
    expect(chunk("[Hook A]").positive_styles).toContain("dirty detuned distorted analog saw lead with glide and pitch-bend swoops");
    expect(plan.chunks[0]?.positive_styles.join(" ")).not.toContain("pitch-bend swoops");
    expect(chunk("[Bridge]").positive_styles.at(-1)).toBe("drums drop, slower harmonized counter-melody, arpeggiated synth counterline");
  });

  it("copies the negative space into every chunk and adds lead vocals to an open pocket", () => {
    const [first] = plan.chunks;
    expect(first?.negative_styles.slice(0, 5)).toEqual(["vocals", "rap vocals", "singing", "lyrics", "autotune"]);
    expect(chunk("[Hook A]").negative_styles.at(-1)).toBe("lead vocals");
    expect(chunk("[Intro]").negative_styles).not.toContain("lead vocals");
  });

  it("stays within the house budget of 20 styles per chunk and lints without blocks", () => {
    expect(Math.max(...plan.chunks.map((c) => c.positive_styles.length))).toBeLessThanOrEqual(20);
    expect(lint(v12, eleven, catalog, payload).filter((r) => r.severity === "block")).toEqual([]);
  });

  it("sets model_id, force_instrumental and the toggle", () => {
    expect(payload.fields.model_id).toBe("music_v2");
    expect(payload.fields.force_instrumental).toBe(true);
    expect(payload.toggles).toEqual({ instrumental: true });
  });

  it("writes a simple-mode prompt with the negatives inline at the end", () => {
    const prompt = String(payload.fields.prompt);
    expect(prompt.startsWith("Instrumental Egyptian Atlanta trap beat")).toBe(true);
    expect(prompt).toMatch(/No vocals, no lyrics\. Avoid: vocals, rap vocals, .* flamenco\.$/);
  });

  it("reports the missing title field as dropped", () => {
    expect(payload.coverage.items).toContainEqual(expect.objectContaining({ path: "/D10/title", state: "dropped", reason: "no-field" }));
  });
});

describe("lyricsBySection", () => {
  const sections = v12.D7.sections;

  it("assigns lines to sections by header, in order, without rewriting them", () => {
    const { bySection, unplaced } = lyricsBySection("[Verse]\nLINE-ONE\n\nLINE-TWO\n\n[Hook B]\nLINE-THREE\n", sections);
    expect(bySection.get("verse")).toEqual(["LINE-ONE", "", "LINE-TWO"]);
    expect(bySection.get("hook-b")).toEqual(["LINE-THREE"]);
    expect(unplaced).toBe(false);
  });

  it("matches a section's bracket head as well as its label, first unused section first", () => {
    const { bySection } = lyricsBySection("[Hook]\nA\n[Hook]\nB", sections);
    expect(bySection.get("hook-a")).toEqual(["A"]);
    expect(bySection.get("hook-b")).toEqual(["B"]);
  });

  it("flags lines it could not place", () => {
    expect(lyricsBySection("LOOSE-LINE\n[Verse]\nX", sections).unplaced).toBe(true);
    expect(lyricsBySection("[Coda]\nX", sections).unplaced).toBe(true);
  });

  it("puts placed lyrics in the chunk text of a vocal song and reports placement gaps", () => {
    const vocal = structuredClone(v12);
    vocal.D8.instrumental = false;
    vocal.D8.lyricsPassthrough = "[Build]\nUSER-LINE\n[Verse]\nPOCKET-LINE\n[Coda]\nORPHAN";
    const vocalPayload = compileEleven(vocal, eleven, catalog);
    const chunks = (vocalPayload.fields.composition_plan as ElevenCompositionPlan).chunks;
    const text = (header: string) => chunks.find((c) => c.text.startsWith(header));
    expect(text("[Build]")?.text.split("\n").slice(0, 2)).toEqual(["[Build]", "USER-LINE"]);
    // Lyrics fill the Verse's open pocket, so it is no longer an instrumental break.
    expect(text("[Verse]")?.text).toContain("POCKET-LINE");
    expect(text("[Verse]")?.negative_styles).not.toContain("lead vocals");
    // Hook A's pocket stays open.
    expect(text("[Hook A]")?.text).toContain("{instrumental break}");
    expect(text("[Hook A]")?.negative_styles).toContain("lead vocals");
    expect(vocalPayload.fields.force_instrumental).toBe(false);
    expect(vocalPayload.coverage.items).toContainEqual(expect.objectContaining({ path: "/D8/lyricsPassthrough", state: "approximated" }));
  });
});
