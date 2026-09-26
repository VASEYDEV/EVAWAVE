import { describe, expect, it } from "vitest";

import { analyseAudio } from "@/core/musicspec/analysis/features";
import { applyReviewedPatch, audioProfileBase, AUDIO_DRAFT_MODEL, draftFromAudio, reviewPatch } from "@/core/musicspec/intake";
import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import type { AudioFeatures, IRPatch, StyleProfile } from "@/core/musicspec/ir/types";
import { lint, lintStyleProfile, lowConfidenceOps, protectedOps } from "@/core/musicspec/lint";
import { getProfile } from "@/core/musicspec/engines";
import { catalog } from "@/data/taxonomy";

import { clickTrack, mix, triad } from "../support/signals";

const features = analyseAudio(mix(clickTrack(140, 16, 22050), triad(62, true, 16, 22050)), 22050);
const meta = { createdAt: "2026-09-26T12:00:00Z", sourceRef: "a".repeat(64) };
const patch = draftFromAudio(features, meta);
const opAt = (p: IRPatch, path: string) => p.ops.find((o) => o.path === path);

describe("draftFromAudio (§1.7 step 4)", () => {
  it("proposes tempo and key from the measured traits", () => {
    expect(opAt(patch, "/D6/tempo")).toEqual(expect.objectContaining({ op: "merge", value: { bpm: 140, source: "analysis" } }));
    expect(opAt(patch, "/D6/key")).toEqual(expect.objectContaining({ op: "merge", value: { tonic: "D", modeId: "aeolian" } }));
    expect(opAt(patch, "/D9/character")?.value).toEqual([expect.stringMatching(/^integrated loudness -?\d+(\.\d)? LUFS, loudness range \d+(\.\d)? LU$/)]);
  });

  it("is a proposed audio-analysis patch with a deterministic id", () => {
    expect(patch).toEqual(expect.objectContaining({ source: "audio-analysis", status: "proposed", model: AUDIO_DRAFT_MODEL, acceptedPaths: [], rejectedPaths: [] }));
    expect(draftFromAudio(features, meta)).toEqual(patch);
    expect(draftFromAudio(features, { ...meta, sourceRef: "b".repeat(64) }).id).not.toBe(patch.id);
  });

  it("gives every op a confidence and a one-sentence rationale", () => {
    for (const o of patch.ops) {
      expect(o.confidence).toBeGreaterThanOrEqual(0);
      expect(o.confidence).toBeLessThanOrEqual(1);
      expect(o.rationale).toMatch(/\.$/);
    }
  });

  it("runs the lineage pass on every value and rationale", () => {
    const scrubbed = draftFromAudio(features, meta, ["Chroma", "brooding"]);
    expect(JSON.stringify(scrubbed)).not.toMatch(/chroma|brooding/i);
  });

  it("proposes no tempo, meter or key from silence", () => {
    const silent = draftFromAudio(analyseAudio(new Float32Array(22050 * 4), 22050), meta);
    expect(silent.ops.map((o) => o.path)).toEqual(["/D2/moods", "/D9/character"].filter((p) => opAt(silent, p)));
    expect(opAt(silent, "/D6/tempo")).toBeUndefined();
  });
});

describe("review and apply (§1.7 step 5, §2.4)", () => {
  it("applies only the accepted ops to the profile base", () => {
    const reviewed = reviewPatch(patch, new Set(["/D6/tempo", "/D6/key"]));
    expect(reviewed.status).toBe("partial");
    const { doc, applied, refused } = applyReviewedPatch(audioProfileBase(), reviewed);
    expect(applied.map((o) => o.path)).toEqual(["/D6/tempo", "/D6/key"]);
    expect(refused).toEqual([]);
    expect(doc.D6?.tempo).toEqual({ bpm: 140, source: "analysis" });
    expect(doc.D6?.key).toEqual({ tonic: "D", modeId: "aeolian" });
    expect(doc.D9).toEqual(audioProfileBase().D9);
  });

  it("leaves the spec untouched for a proposed or rejected patch", () => {
    const base = audioProfileBase();
    expect(applyReviewedPatch(base, patch).doc).toBe(base);
    expect(applyReviewedPatch(base, reviewPatch(patch, new Set())).doc).toBe(base);
    expect(reviewPatch(patch, new Set(patch.ops.map((o) => o.path))).status).toBe("accepted");
  });

  it("refuses an op on a protected root even when it is accepted (PT-2)", () => {
    const forged: IRPatch = { ...patch, ops: [...patch.ops, { op: "set", path: "/references/0", value: {}, confidence: 1, rationale: "forged." }] };
    const { doc, refused } = applyReviewedPatch(defaultMusicSpec(), reviewPatch(forged, new Set(["/references/0"])));
    expect(refused.map((o) => o.path)).toEqual(["/references/0"]);
    expect(doc.references).toEqual([]);
  });
});

describe("PT-1, PT-2, PV-1", () => {
  it("PT-1 flags low-confidence ops as info, and PT-2 blocks protected targets", () => {
    const forged: IRPatch = { ...patch, ops: [...patch.ops, { op: "set", path: "/patches/0", value: {}, confidence: 1, rationale: "forged." }] };
    const spec = { ...defaultMusicSpec(), patches: [forged] };
    const results = lint(spec, getProfile("suno"), catalog);
    const pt1 = results.filter((r) => r.ruleId === "PT-1");
    expect(pt1.every((r) => r.severity === "info")).toBe(true);
    expect(pt1.map((r) => r.path)).toEqual(lowConfidenceOps(forged, "/patches/0").map((r) => r.path));
    expect(results.filter((r) => r.ruleId === "PT-2")).toEqual([expect.objectContaining({ severity: "block", path: `/patches/0/ops/${forged.ops.length - 1}` })]);
    expect(protectedOps(patch, "/patches/0")).toEqual([]);
  });

  const profile = (confidence: number, source: "analysis" | "tap", kind: StyleProfile["provenance"]["kind"] = "audio-analysis"): StyleProfile => {
    const base = audioProfileBase();
    return {
      id: "p",
      ownerId: "local",
      name: "Imported",
      provenance: { kind },
      spec: { ...base, D6: { ...defaultMusicSpec().D6, tempo: { bpm: 140, source } } },
      features: { ...features, bpm: { ...features.bpm, confidence } } as AudioFeatures,
      genreIds: [],
      tags: [],
      createdAt: meta.createdAt,
      updatedAt: meta.createdAt,
    };
  };

  it("PV-1 badges a low-confidence analysed tempo until a person sets it", () => {
    expect(lintStyleProfile(profile(0.5, "analysis"))).toEqual([expect.objectContaining({ ruleId: "PV-1", severity: "info" })]);
    expect(lintStyleProfile(profile(0.5, "tap"))).toEqual([]);
    expect(lintStyleProfile(profile(0.9, "analysis"))).toEqual([]);
    expect(lintStyleProfile(profile(0.5, "analysis", "hand-built"))).toEqual([]);
  });
});
