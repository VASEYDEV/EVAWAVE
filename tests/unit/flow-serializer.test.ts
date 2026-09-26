import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { computeBarMath } from "@/core/musicspec/barmath";
import { getProfile } from "@/core/musicspec/engines";
import type { MusicSpec } from "@/core/musicspec/ir/types";
import { lint } from "@/core/musicspec/lint";
import { clock, compileFlow } from "@/core/musicspec/serialize/flow";
import { catalog } from "@/data/taxonomy";

/** Google Flow Music contracts (docs/SPEC.md §2.6, §3 S2). */
const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;
const flow = getProfile("flow");
const payload = compileFlow(v12, flow, catalog);
const script = String(payload.fields.producer_script).split("\n");

describe("compileFlow", () => {
  it("refuses a profile for another engine", () => {
    expect(() => compileFlow(v12, getProfile("eleven"), catalog)).toThrow(/flow profile/);
  });

  it("writes BPM as a number and Length as whole seconds of bar-math runtime", () => {
    expect(payload.fields.bpm).toBe(140);
    const runtime = computeBarMath(v12.D6.tempo, "4/4", v12.D7).runtimeSec;
    expect(payload.fields.length).toBe(Math.round(runtime));
  });

  it("writes one Producer line per section plus the pickup, contrast, transition and silence lines", () => {
    const sectionLines = v12.D7.sections.map((s) => script.findIndex((line) => line.includes(`${s.label}, `) && line.includes("bars)")));
    expect(sectionLines.every((i) => i >= 0)).toBe(true);
    expect(sectionLines).toEqual([...sectionLines].sort((a, b) => a - b));
    expect(script.filter((line) => /\. Pickup into /.test(line))).toHaveLength(2);
    expect(script.filter((line) => /contrast, /.test(line))).toEqual([
      "8. Hook B contrast, 1:58–2:05: last 4 bars drill contrast: sliding 808s, displaced snare, then back to trap grid.",
    ]);
    expect(script.filter((line) => /\. End of /.test(line))).toEqual(["11. End of Bridge, at 2:33: timpani roll, choir swell, sub drop."]);
    expect(script.filter((line) => /\. Silence after /.test(line))).toEqual(["9. Silence after Hook B, 2:05–2:06: drop to silence for 1 beat."]);
    expect(script).toHaveLength(v12.D7.sections.length + 5);
  });

  it("numbers the Producer lines from 1 and times sections from bar math", () => {
    script.forEach((line, i) => expect(line.startsWith(`${i + 1}. `)).toBe(true));
    expect(script[0]).toBe(
      "1. Intro, 0:00–0:27 (16 bars), very soft: desert wind, nay in maqam Saba over a steady 4/4 pulse, low oud drone on D, mazhar on 1 and 3, no drums.",
    );
    expect(script).toContain("6. Pickup into Hook B, at 1:51: filter sweep closing, two-beat drum-roll pickup.");
  });

  it("ends Sound with the negatives inline and reports negative space as approximated", () => {
    expect(String(payload.fields.sound)).toMatch(/No vocals, no lyrics\. Avoid: vocals, .* flamenco\.$/);
    expect(payload.coverage.items).toContainEqual(expect.objectContaining({ path: "/D10/negativeSpace", state: "approximated", reason: "no-field" }));
  });

  it("leaves Lyrics empty for an instrumental and passes user lyrics through untouched", () => {
    expect(payload.fields.lyrics).toBe("");
    expect(payload.toggles).toEqual({ instrumental: true });
    const vocal = structuredClone(v12);
    vocal.D8.instrumental = false;
    vocal.D8.lyricsPassthrough = "[Verse]\nUSER-LINE";
    const vocalPayload = compileFlow(vocal, flow, catalog);
    expect(vocalPayload.fields.lyrics).toBe("[Verse]\nUSER-LINE");
    expect(vocalPayload.toggles).toEqual({ instrumental: false });
  });

  it("writes the title and lints without blocks", () => {
    expect(payload.fields.title).toBe("Jinn on the Dune");
    expect(lint(v12, flow, catalog, payload).filter((r) => r.severity === "block")).toEqual([]);
  });
});

describe("clock", () => {
  it.each([
    [0, "0:00"],
    [59.4, "0:59"],
    [59.6, "1:00"],
    [194.1, "3:14"],
  ])("formats %d s as %s", (sec, text) => expect(clock(sec)).toBe(text));
});
