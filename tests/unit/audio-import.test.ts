import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { decodeWav, encodeWav, WavError } from "@/core/musicspec/analysis/wav";
import { applyReviewedPatch, audioProfileBase, AUDIO_DRAFT_MODEL, reviewPatch } from "@/core/musicspec/intake";
import { lintStyleProfile } from "@/core/musicspec/lint";
import { blobInTab, storeInOpfs } from "@/lib/audio/browser";
import { importAudio, sha256Hex, type ImportDeps } from "@/lib/audio/import";
import { saveImport } from "@/lib/library/repository";
import type { Database } from "@/lib/library/schema";

import { clickTrack, mix, triad } from "../support/signals";

/**
 * S5 acceptance (docs/SPEC.md §3, §1.7): an imported WAV yields a StyleProfile with
 * provenance 'audio-analysis', reviewed as a patch diff, and no request ever carries audio.
 * Every fetch is recorded, both the global one and the Supabase client's, through import,
 * review and the library save.
 */
const wav = encodeWav(mix(clickTrack(140, 12, 22050), triad(62, true, 12, 22050)), 22050);
const wavBytes = new Uint8Array(wav);
const file = new File([wav], "desert-loop.wav", { type: "audio/wav" });

interface Recorded {
  url: string;
  method: string;
  body: string | null;
  bodyKind: string;
}

function recorder() {
  const requests: Recorded[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = init?.body ?? null;
    requests.push({
      url,
      method: init?.method ?? "GET",
      body: typeof body === "string" ? body : null,
      bodyKind: body === null ? "none" : typeof body === "string" ? "string" : Object.prototype.toString.call(body),
    });
    const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object") ?? false;
    const row = url.includes("/files") ? { id: "file-1" } : { id: "profile-1" };
    return new Response(JSON.stringify(single ? row : [row]), { status: 201, headers: { "content-type": "application/json" } });
  });
  return { requests, fetchMock };
}

const nodeDeps = (): ImportDeps => ({
  decode: async (bytes) => decodeWav(bytes),
  digest: sha256Hex,
  now: () => "2026-09-26T12:00:00.000Z",
});

/**
 * True when `haystack` contains a run of the WAV's sample data: raw, hex, or base64 at any of
 * the three byte alignments base64 can start on.
 */
function carriesAudio(haystack: string): boolean {
  const start = 4096;
  const raw = Buffer.from(wavBytes.subarray(start, start + 60));
  if (haystack.includes(raw.toString("latin1")) || haystack.includes(raw.toString("hex")) || haystack.includes("RIFF")) return true;
  return [0, 1, 2].some((shift) => haystack.includes(Buffer.from(wavBytes.subarray(start + shift, start + shift + 60)).toString("base64")));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("audio import (§1.7)", () => {
  it("yields a reviewed audio-analysis StyleProfile, and no request carries audio", async () => {
    const { requests, fetchMock } = recorder();
    vi.stubGlobal("fetch", fetchMock);

    // Import: hash, decode, analyse, draft. No network at all, and nothing stored: the screen
    // keeps the blob only when a profile is created from it.
    const imported = await importAudio(file, nodeDeps());
    expect(requests).toEqual([]);
    expect(imported.asset).toEqual({ kind: "audio", filename: "desert-loop.wav", mime: "audio/wav", bytes: wav.byteLength, sha256: await sha256Hex(wav), localOnly: true });
    expect(imported.patch.status).toBe("proposed");

    // Review: accept every op, then apply to the profile base.
    const reviewed = reviewPatch(imported.patch, new Set(imported.patch.ops.map((o) => o.path)));
    const { doc: spec } = applyReviewedPatch(audioProfileBase(), reviewed);
    expect(spec.D6?.tempo).toEqual({ bpm: 140, source: "analysis" });
    expect(spec.D6?.key).toEqual({ tonic: "D", modeId: "aeolian" });

    // Save to the library through a real Supabase client whose fetch is recorded.
    const client = createClient<Database>("https://project.supabase.test", "anon-key-for-tests", { global: { fetch: fetchMock }, auth: { persistSession: false } });
    const saved = await saveImport(client, {
      file: { filename: imported.asset.filename, mime: imported.asset.mime, bytes: imported.asset.bytes, sha256: imported.asset.sha256, features: imported.features },
      profile: { name: "Desert loop", spec, analysedOn: imported.analysedOn, model: AUDIO_DRAFT_MODEL },
    });
    expect(saved).toEqual({ fileId: "file-1", profileId: "profile-1" });

    // Only two JSON rows left the device, and neither carries audio.
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /rest/v1/files", "POST /rest/v1/style_profiles"]);
    for (const request of requests) {
      expect(request.bodyKind).toBe("string");
      expect(carriesAudio(request.body ?? "")).toBe(false);
    }
    const sent = requests.reduce((n, r) => n + (r.body?.length ?? 0), 0);
    expect(sent).toBeLessThan(wav.byteLength / 20);

    // The saved profile row names its provenance and cites the file, not the audio.
    const profileRow = JSON.parse(requests[1]?.body ?? "{}") as { provenance: { kind: string; sourceRef: string; model: string } };
    expect(profileRow.provenance).toEqual({ kind: "audio-analysis", sourceRef: "file-1", analysedOn: "2026-09-26T12:00:00.000Z", model: AUDIO_DRAFT_MODEL });
    expect(lintStyleProfile({ id: "profile-1", ownerId: "u", name: "Desert loop", provenance: profileRow.provenance as never, spec, features: imported.features, genreIds: [], tags: [], createdAt: "", updatedAt: "" })).toEqual([]);
  });

  it("proves the detector: a body with the audio in it is caught", () => {
    expect(carriesAudio(Buffer.from(wavBytes).toString("base64"))).toBe(true);
    expect(carriesAudio(JSON.stringify({ data: Buffer.from(wavBytes.subarray(1000)).toString("base64") }))).toBe(true);
    expect(carriesAudio(Buffer.from(wavBytes.subarray(2000)).toString("hex"))).toBe(true);
    expect(carriesAudio(JSON.stringify({ features: { bpm: 140 } }))).toBe(false);
  });
});

describe("import order", () => {
  it("rejects a file that cannot be decoded before any analysis", async () => {
    const now = vi.fn(() => "2026-09-26T12:00:00.000Z");
    const deps: ImportDeps = {
      ...nodeDeps(),
      now,
      decode: async () => {
        throw new WavError("not a RIFF/WAVE file");
      },
    };
    await expect(importAudio(new File([new Uint8Array([1, 2, 3])], "broken.wav"), deps)).rejects.toThrow(WavError);
    expect(now).not.toHaveBeenCalled();
  });
});

describe("a superseded import", () => {
  it("stops before analysis once a newer choice aborts it", async () => {
    const controller = new AbortController();
    const now = vi.fn(() => "2026-09-26T12:00:00.000Z");
    const deps: ImportDeps = {
      ...nodeDeps(),
      now,
      decode: async (bytes) => {
        // The person picks another file while this one decodes.
        controller.abort();
        return decodeWav(bytes);
      },
    };
    await expect(importAudio(file, deps, controller.signal)).rejects.toThrow(/abort/i);
    expect(now).not.toHaveBeenCalled();
  });
});

describe("the storage fallback", () => {
  it("keeps the blob in the tab when OPFS is missing, as the import reports", async () => {
    // Node has no navigator.storage, like a browser without OPFS.
    const blob = new Blob([wav]);
    expect(await storeInOpfs("fallback-sha", blob)).toBe("memory");
    expect(blobInTab("fallback-sha")).toBe(blob);
  });
});
