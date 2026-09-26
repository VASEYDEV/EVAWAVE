import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { analyseAudio } from "@/core/musicspec/analysis/features";
import { decodeWav, encodeWav, WavError, type PcmAudio } from "@/core/musicspec/analysis/wav";
import { applyReviewedPatch, audioProfileBase, AUDIO_DRAFT_MODEL, reviewPatch } from "@/core/musicspec/intake";
import { lintStyleProfile } from "@/core/musicspec/lint";
import { blobInTab, decodeWithWebAudio, deleteWithLocalAudio, inTurnForLocalAudio, keepAudioFor, removeLocalAudio, storeInOpfs } from "@/lib/audio/browser";
import {
  IMPORT_ASSUMED_CHANNELS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_DECODE_BYTES,
  IMPORT_MAX_SECONDS,
  importAudio,
  importLimitSeconds,
  ImportLengthUnknownError,
  ImportTooLargeError,
  ImportTooLongError,
  profileFromReview,
  sha256Hex,
  type ImportDeps,
} from "@/lib/audio/import";
import { deleteFile, hasFileRecord, LibraryError, saveImport, saveImportAndKeepAudio, type ImportRecord } from "@/lib/library/repository";
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
const PROFILE_ID = "5f0c6a52-2f7e-4d4b-9a51-0b8e6d3c1a27";

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
    const row = url.includes("/rpc/save_import") ? { file_id: "file-1", profile_id: "profile-1", owner: OWNER_A } : { id: "row-1" };
    return new Response(JSON.stringify(single ? row : [row]), { status: 201, headers: { "content-type": "application/json" } });
  });
  return { requests, fetchMock };
}

const nodeDeps = (): ImportDeps => ({
  decode: async (bytes) => decodeWav(bytes),
  // The fixture's length, as a media element reads it from the metadata.
  probeDuration: async () => 12,
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
      profile: { id: PROFILE_ID, name: "Desert loop", spec, analysedOn: imported.analysedOn, model: AUDIO_DRAFT_MODEL },
    });
    expect(saved).toEqual({ fileId: "file-1", profileId: "profile-1", ownerId: OWNER_A });

    // One JSON request left the device, the atomic save_import call, and it carries no audio.
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /rest/v1/rpc/save_import"]);
    for (const request of requests) {
      expect(request.bodyKind).toBe("string");
      expect(carriesAudio(request.body ?? "")).toBe(false);
    }
    const sent = requests.reduce((n, r) => n + (r.body?.length ?? 0), 0);
    expect(sent).toBeLessThan(wav.byteLength / 20);

    // The call carries the file's metadata and the profile with its device-made id; the
    // function writes both in one transaction and cites the file in the provenance
    // (tests/integration/library-rls.test.ts runs it under RLS).
    const args = JSON.parse(requests[0]?.body ?? "{}") as { file: { sha256: string }; profile: { id: string; analysedOn: string; model: string } };
    expect(args.file.sha256).toBe(imported.asset.sha256);
    expect(args.profile).toEqual(expect.objectContaining({ id: PROFILE_ID, analysedOn: "2026-09-26T12:00:00.000Z", model: AUDIO_DRAFT_MODEL }));
    const provenance = { kind: "audio-analysis" as const, sourceRef: saved.fileId, analysedOn: imported.analysedOn, model: AUDIO_DRAFT_MODEL };
    expect(lintStyleProfile({ id: saved.profileId, ownerId: "u", name: "Desert loop", provenance, spec, features: imported.features, genreIds: [], tags: [], createdAt: "", updatedAt: "" })).toEqual([]);
  });

  it("proves the detector: a body with the audio in it is caught", () => {
    expect(carriesAudio(Buffer.from(wavBytes).toString("base64"))).toBe(true);
    expect(carriesAudio(JSON.stringify({ data: Buffer.from(wavBytes.subarray(1000)).toString("base64") }))).toBe(true);
    expect(carriesAudio(Buffer.from(wavBytes.subarray(2000)).toString("hex"))).toBe(true);
    expect(carriesAudio(JSON.stringify({ features: { bpm: 140 } }))).toBe(false);
  });
});

describe("the profile a review makes", () => {
  it("follows the current review and name, keeping the id Create fixed", async () => {
    const result = await importAudio(file, nodeDeps());
    const all = new Set(result.patch.ops.map((o) => o.path));
    const created = profileFromReview(result, all, "Desert loop", "profile-1");
    expect(created.profile.spec.D6?.tempo).toEqual({ bpm: 140, source: "analysis" });
    expect(created.acceptedCount).toBe(all.size);
    // Unticking the tempo and renaming after Create: the same profile, without the tempo.
    const edited = profileFromReview(result, new Set([...all].filter((path) => path !== "/D6/tempo")), "Desert loop, no tempo", "profile-1");
    expect(edited.profile.id).toBe("profile-1");
    expect(edited.profile.name).toBe("Desert loop, no tempo");
    expect(edited.profile.spec.D6?.tempo).toBeUndefined();
    expect(edited.profile.spec.D6?.key).toEqual(created.profile.spec.D6?.key);
    expect(edited.acceptedCount).toBe(all.size - 1);
    expect(edited.profile.provenance).toMatchObject({ kind: "audio-analysis", sourceRef: result.asset.sha256, analysedOn: result.analysedOn });
  });
});

describe("keeping the audio with a library save", () => {
  const record: ImportRecord = {
    file: { filename: "desert-loop.wav", mime: "audio/wav", bytes: wav.byteLength, sha256: "c".repeat(64), features: { durationSec: 12 } as never },
    profile: { id: PROFILE_ID, name: "Desert loop", spec: {}, analysedOn: "2026-09-26T12:00:00.000Z", model: AUDIO_DRAFT_MODEL },
  };
  const clientWith = (fetchMock: typeof fetch) => createClient<Database>("https://project.supabase.test", "anon-key-for-tests", { global: { fetch: fetchMock }, auth: { persistSession: false } });

  it("stores the audio only after the save succeeds, under the owner the rows were written for", async () => {
    const { fetchMock } = recorder();
    const store = vi.fn(async () => "opfs" as const);
    await expect(saveImportAndKeepAudio(clientWith(fetchMock), record, file, store)).resolves.toBe("opfs");
    expect(store).toHaveBeenCalledWith({ ownerId: OWNER_A, sha256: "c".repeat(64) }, file);
  });

  it("stores nothing when the save fails", async () => {
    const failing = vi.fn(async () => new Response(JSON.stringify({ message: "connection lost" }), { status: 503, headers: { "content-type": "application/json" } }));
    const store = vi.fn(async () => "opfs" as const);
    await expect(saveImportAndKeepAudio(clientWith(failing as unknown as typeof fetch), record, file, store)).rejects.toThrow();
    expect(store).not.toHaveBeenCalled();
  });
});

describe("analysis off the main thread", () => {
  it("hands the decoded audio and the signal to deps.analyse when there is one", async () => {
    const controller = new AbortController();
    const analyse = vi.fn(async (pcm: PcmAudio, signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      return analyseAudio(pcm.samples, pcm.sampleRate, pcm.channelData);
    });
    const imported = await importAudio(file, { ...nodeDeps(), analyse }, controller.signal);
    expect(analyse).toHaveBeenCalledTimes(1);
    expect(Math.round(imported.features.bpm.value)).toBe(140);
  });

  it("rejects when a newer choice aborts the analysis in flight", async () => {
    const controller = new AbortController();
    const now = vi.fn(() => "2026-09-26T12:00:00.000Z");
    const analyse = async (_pcm: PcmAudio, signal?: AbortSignal) => {
      controller.abort();
      signal?.throwIfAborted();
      throw new Error("unreachable");
    };
    await expect(importAudio(file, { ...nodeDeps(), analyse, now }, controller.signal)).rejects.toThrow(/abort/i);
    expect(now).not.toHaveBeenCalled();
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
  it("refuses a file over the size limit without reading it, and reads one at the limit", async () => {
    const sized = (size: number) => {
      const f = new File([wav], "big.wav", { type: "audio/wav" });
      Object.defineProperty(f, "size", { value: size });
      return f;
    };
    const over = sized(IMPORT_MAX_BYTES + 1);
    const readOver = vi.spyOn(over, "arrayBuffer");
    await expect(importAudio(over, nodeDeps())).rejects.toBeInstanceOf(ImportTooLargeError);
    expect(readOver).not.toHaveBeenCalled();
    const at = sized(IMPORT_MAX_BYTES);
    const readAt = vi.spyOn(at, "arrayBuffer");
    await importAudio(at, nodeDeps());
    expect(readAt).toHaveBeenCalledTimes(1);
  });

  it("refuses a recording over the length limit without reading it, from its metadata", async () => {
    const withLength = (seconds: number | undefined) => ({ ...nodeDeps(), probeDuration: vi.fn(async () => seconds) });
    const fresh = () => new File([wav], "long.wav", { type: "audio/wav" });
    const over = fresh();
    const readOver = vi.spyOn(over, "arrayBuffer");
    await expect(importAudio(over, withLength(IMPORT_MAX_SECONDS + 1))).rejects.toBeInstanceOf(ImportTooLongError);
    expect(readOver).not.toHaveBeenCalled();
    // At the limit, the import goes ahead.
    const ok = fresh();
    const read = vi.spyOn(ok, "arrayBuffer");
    await importAudio(ok, withLength(IMPORT_MAX_SECONDS));
    expect(read).toHaveBeenCalledTimes(1);
    // When the metadata cannot tell, nothing bounds the decode, so the import is refused.
    for (const seconds of [undefined, Number.POSITIVE_INFINITY, Number.NaN]) {
      const unknown = fresh();
      const readUnknown = vi.spyOn(unknown, "arrayBuffer");
      await expect(importAudio(unknown, withLength(seconds))).rejects.toBeInstanceOf(ImportLengthUnknownError);
      expect(readUnknown).not.toHaveBeenCalled();
    }
  });

  it("bounds a multichannel recording's length by its channels, reading only the header", async () => {
    // A 16-bit six-channel WAV: the header says 6 channels, so 5.1 takes up to 200 seconds.
    const frames = 2205;
    const pcm = new DataView(new ArrayBuffer(frames * 6 * 2));
    for (let i = 0; i < frames * 6; i++) pcm.setInt16(i * 2, Math.round(8000 * Math.sin((2 * Math.PI * 440 * Math.floor(i / 6)) / 22050)), true);
    const header = new DataView(new ArrayBuffer(44));
    [..."RIFF"].forEach((c, i) => header.setUint8(i, c.charCodeAt(0)));
    header.setUint32(4, 36 + pcm.byteLength, true);
    [..."WAVEfmt "].forEach((c, i) => header.setUint8(8 + i, c.charCodeAt(0)));
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true);
    header.setUint16(22, 6, true);
    header.setUint32(24, 22050, true);
    header.setUint32(28, 22050 * 12, true);
    header.setUint16(32, 12, true);
    header.setUint16(34, 16, true);
    [..."data"].forEach((c, i) => header.setUint8(36 + i, c.charCodeAt(0)));
    header.setUint32(40, pcm.byteLength, true);
    const surround = () => new File([header, pcm], "surround.wav", { type: "audio/wav" });
    const withLength = (seconds: number) => ({ ...nodeDeps(), probeDuration: async () => seconds });
    // Six channels and their mix are seven buffers: 1800 buffer-seconds / 7.
    const limit = importLimitSeconds(6, 44 + pcm.byteLength);
    expect(limit).toBeCloseTo(1800 / 7, 9);

    const over = surround();
    const readOver = vi.spyOn(over, "arrayBuffer");
    const refused = importAudio(over, withLength(limit + 30));
    await expect(refused).rejects.toBeInstanceOf(ImportTooLongError);
    await expect(refused).rejects.toThrow("This recording has 6 channels and runs 4.8 minutes; imports take 6-channel recordings up to 4.3 minutes for now.");
    expect(readOver).not.toHaveBeenCalled();

    const at = surround();
    const readAt = vi.spyOn(at, "arrayBuffer");
    const result = await importAudio(at, withLength(limit));
    expect(readAt).toHaveBeenCalledTimes(1);
    expect(result.asset.bytes).toBe(44 + pcm.byteLength);
  });

  it("fits every buffer live at the decode's peak inside the budget", () => {
    const perSecond = 48000 * 4;
    for (let channels = 1; channels <= IMPORT_ASSUMED_CHANNELS; channels++) {
      for (const fileBytes of [0, 1_000_000, IMPORT_MAX_BYTES]) {
        const seconds = importLimitSeconds(channels, fileBytes);
        // While decoding: the encoded file and every channel. Afterwards: the channels and,
        // for more than one, their mono mix.
        expect(fileBytes + channels * seconds * perSecond).toBeLessThanOrEqual(IMPORT_MAX_DECODE_BYTES + 1e-6);
        expect((channels + (channels > 1 ? 1 : 0)) * seconds * perSecond).toBeLessThanOrEqual(IMPORT_MAX_DECODE_BYTES + 1e-6);
      }
    }
    // Mono and stereo keep ten minutes at the byte cap; a large 7.1 file gets less than a small one.
    expect(importLimitSeconds(1, IMPORT_MAX_BYTES)).toBe(IMPORT_MAX_SECONDS);
    expect(importLimitSeconds(2, IMPORT_MAX_BYTES)).toBe(IMPORT_MAX_SECONDS);
    expect(importLimitSeconds(8, 0)).toBe(200);
    expect(importLimitSeconds(8, IMPORT_MAX_BYTES)).toBeLessThan(200);
  });

  it("hands the Web Audio decoder the file's bytes without a copy, at the fixed rate", async () => {
    const seen: { rate: number; bytes: ArrayBuffer }[] = [];
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        constructor(
          _channels: number,
          _length: number,
          readonly sampleRate: number,
        ) {}
        async decodeAudioData(bytes: ArrayBuffer) {
          seen.push({ rate: this.sampleRate, bytes });
          const left = new Float32Array([0.5, -0.5]);
          const right = new Float32Array([0.25, 0.25]);
          return { numberOfChannels: 2, sampleRate: this.sampleRate, length: 2, getChannelData: (c: number) => (c === 0 ? left : right) };
        }
      },
    );
    const bytes = new ArrayBuffer(8);
    const pcm = await decodeWithWebAudio(bytes);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.bytes).toBe(bytes);
    expect(seen[0]?.rate).toBe(48000);
    expect(Array.from(pcm.samples)).toEqual([0.375, -0.125]);
  });

  it("assumes the most channels Web Audio decodes when the header does not say how many a recording has", async () => {
    const limit = importLimitSeconds(IMPORT_ASSUMED_CHANNELS, 64);
    expect(limit).toBeCloseTo(1800 / 33, 9);
    // Bytes no header reader knows, which the injected decoder reads as the mono WAV.
    const opaque = () => new File([new Uint8Array(64).fill(7)], "field-recording.bin");
    const deps = (seconds: number): ImportDeps => ({ ...nodeDeps(), decode: async () => decodeWav(wav), probeDuration: async () => seconds });
    const refused = importAudio(opaque(), deps(limit + 30));
    await expect(refused).rejects.toThrow(
      "This recording runs 84.5 seconds, and its file does not say how many channels it has; imports take such recordings up to 54.5 seconds for now.",
    );
    await expect(importAudio(opaque(), deps(limit))).resolves.toMatchObject({ asset: { filename: "field-recording.bin" } });
  });

  it("stops before reading the file when a newer choice aborts it during the header read", async () => {
    const controller = new AbortController();
    const target = new File([wav], "desert-loop.wav", { type: "audio/wav" });
    const slice = target.slice.bind(target);
    vi.spyOn(target, "slice").mockImplementation((...args) => {
      controller.abort();
      return slice(...args);
    });
    const read = vi.spyOn(target, "arrayBuffer");
    await expect(importAudio(target, { ...nodeDeps(), probeDuration: async () => 60 }, controller.signal)).rejects.toThrow(/abort/i);
    expect(read).not.toHaveBeenCalled();
  });

  it("never reads the file when a newer choice aborted it before it started", async () => {
    const controller = new AbortController();
    controller.abort();
    const read = vi.spyOn(file, "arrayBuffer");
    await expect(importAudio(file, nodeDeps(), controller.signal)).rejects.toThrow(/abort/i);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it("stops before decoding when a newer choice aborts it during the hash", async () => {
    const controller = new AbortController();
    const decode = vi.fn(async (bytes: ArrayBuffer) => decodeWav(bytes));
    const deps: ImportDeps = {
      ...nodeDeps(),
      decode,
      digest: async (bytes) => {
        controller.abort();
        return sha256Hex(bytes);
      },
    };
    await expect(importAudio(file, deps, controller.signal)).rejects.toThrow(/abort/i);
    expect(decode).not.toHaveBeenCalled();
  });

  it("waits for a superseded import's decode to settle before reading the next file", async () => {
    const events: string[] = [];
    let finishFirst!: () => void;
    const firstDecoding = new Promise<void>((resolve) => (finishFirst = resolve));
    const first = new AbortController();
    const firstImport = importAudio(file, {
      ...nodeDeps(),
      decode: async (bytes) => {
        events.push("first decode starts");
        await firstDecoding;
        events.push("first decode ends");
        return decodeWav(bytes);
      },
    }, first.signal);
    await vi.waitFor(() => expect(events).toEqual(["first decode starts"]));
    // Newer choices abort the first import, whose decode cannot stop. The second choice is
    // itself replaced once it is waiting for its turn.
    first.abort();
    const firstRefused = expect(firstImport).rejects.toThrow(/abort/i);
    const decodeNamed = (name: string): ImportDeps => ({ ...nodeDeps(), decode: async (bytes) => (events.push(`${name} decode`), decodeWav(bytes)) });
    const second = new AbortController();
    const secondFile = new File([wav], "second.wav", { type: "audio/wav" });
    const readSecond = vi.spyOn(secondFile, "arrayBuffer");
    const secondRefused = expect(importAudio(secondFile, decodeNamed("second"), second.signal)).rejects.toThrow(/abort/i);
    await new Promise((resolve) => setTimeout(resolve, 20));
    second.abort();
    const thirdFile = new File([wav], "third.wav", { type: "audio/wav" });
    const readThird = vi.spyOn(thirdFile, "arrayBuffer");
    const thirdImport = importAudio(thirdFile, decodeNamed("third"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readThird).not.toHaveBeenCalled();

    finishFirst();
    await firstRefused;
    await secondRefused;
    await expect(thirdImport).resolves.toMatchObject({ asset: { filename: "third.wav" } });
    expect(events).toEqual(["first decode starts", "first decode ends", "third decode"]);
    expect(readSecond).not.toHaveBeenCalled();
    expect(readThird).toHaveBeenCalledTimes(1);
  });

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

/** Two accounts signed in, one after the other, on the same browser. */
const OWNER_A = "00000000-0000-4000-8000-00000000000a";
const OWNER_B = "00000000-0000-4000-8000-00000000000b";

describe("the storage fallback", () => {
  it("keeps the blob in the tab when OPFS is missing, as the import reports", async () => {
    // Node has no navigator.storage, like a browser without OPFS.
    const blob = new Blob([wav]);
    expect(await storeInOpfs({ ownerId: OWNER_A, sha256: "fallback-sha" }, blob)).toBe("memory");
    expect(blobInTab({ ownerId: OWNER_A, sha256: "fallback-sha" })).toBe(blob);
  });
});

describe("local audio on the device", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * An in-memory stand-in for the Origin Private File System: a directory tree whose files
   * are keyed by their path below the root, such as "audio/<owner>/<sha256>".
   */
  function fakeOpfs({ locks = false } = {}) {
    const files = new Map<string, Blob>();
    const dirs = new Set<string>([""]);
    const notFound = () => new DOMException("not found", "NotFoundError");
    const directory = (path: string) => ({
      getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
        const child = path ? `${path}/${name}` : name;
        if (!dirs.has(child)) {
          if (!options?.create) throw notFound();
          dirs.add(child);
        }
        return directory(child);
      },
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        const file = `${path}/${name}`;
        if (!files.has(file)) {
          if (!options?.create) throw notFound();
          files.set(file, new Blob([]));
        }
        return {
          getFile: async () => files.get(file) as Blob,
          createWritable: async () => {
            let data = new Blob([]);
            return {
              write: async (blob: Blob) => {
                data = blob;
              },
              close: async () => {
                files.set(file, data);
              },
            };
          },
        };
      },
      removeEntry: async (name: string) => {
        if (!files.delete(`${path}/${name}`)) throw notFound();
      },
      // The names of the files directly in this directory.
      keys: async function* () {
        for (const file of [...files.keys()]) if (file.startsWith(`${path}/`) && !file.slice(path.length + 1).includes("/")) yield file.slice(path.length + 1);
      },
    });
    vi.stubGlobal("navigator", { storage: { getDirectory: async () => directory("") }, ...(locks ? { locks: fakeLockManager() } : {}) });
    return files;
  }

  /** Web Locks for one origin: requests for the same name run one at a time, in order. */
  function fakeLockManager() {
    const tails = new Map<string, Promise<unknown>>();
    return {
      request: (name: string, task: () => Promise<unknown>) => {
        const run = (tails.get(name) ?? Promise.resolve()).then(() => task());
        tails.set(name, run.catch(() => undefined));
        return run;
      },
    };
  }

  /** An OPFS whose every directory is `dir`, for stubbing one failing operation. */
  function opfsWith(dir: object) {
    const self = { ...dir, getDirectoryHandle: async () => self };
    vi.stubGlobal("navigator", { storage: { getDirectory: async () => self } });
  }

  const a = (sha256: string) => ({ ownerId: OWNER_A, sha256 });
  const b = (sha256: string) => ({ ownerId: OWNER_B, sha256 });

  it("removes the OPFS copy when its record is deleted", async () => {
    const files = fakeOpfs();
    expect(await storeInOpfs(a("opfs-sha"), new Blob([wav]))).toBe("opfs");
    expect(files.has(`audio/${OWNER_A}/opfs-sha`)).toBe(true);
    await removeLocalAudio(a("opfs-sha"));
    expect(files.has(`audio/${OWNER_A}/opfs-sha`)).toBe(false);
    // Removing again, a hash never stored, or an owner with nothing stored is not an error.
    await expect(removeLocalAudio(a("opfs-sha"))).resolves.toBeUndefined();
    await expect(removeLocalAudio(b("opfs-sha"))).resolves.toBeUndefined();
  });

  it("keeps each account's copy of the same file apart", async () => {
    const files = fakeOpfs();
    const blob = new Blob([wav]);
    await storeInOpfs(a("shared-sha"), blob);
    await storeInOpfs(b("shared-sha"), blob);
    expect(files.size).toBe(2);
    await deleteWithLocalAudio(a("shared-sha"), async () => {});
    expect([...files.keys()]).toEqual([`audio/${OWNER_B}/shared-sha`]);
    await removeLocalAudio(b("shared-sha"));
    expect(files.size).toBe(0);
  });

  it("rejects when OPFS refuses the removal, so the record can stay for a retry", async () => {
    const files = fakeOpfs();
    await storeInOpfs(a("locked-sha"), new Blob([wav]));
    const locked = new DOMException("the entry is locked", "NoModificationAllowedError");
    opfsWith({
      removeEntry: async () => {
        throw locked;
      },
    });
    await expect(removeLocalAudio(a("locked-sha"))).rejects.toBe(locked);
    expect(files.has(`audio/${OWNER_A}/locked-sha`)).toBe(true);
  });

  it("rejects when OPFS itself fails, but not when a private window refuses it", async () => {
    const refusing = (name: string) => vi.stubGlobal("navigator", { storage: { getDirectory: async () => Promise.reject(new DOMException("no", name)) } });
    refusing("UnknownError");
    await expect(removeLocalAudio(a("any-sha"))).rejects.toThrow("no");
    refusing("SecurityError");
    await expect(removeLocalAudio(a("any-sha"))).resolves.toBeUndefined();
  });

  it("deletes the record and the local copy together, or neither when the record's delete fails", async () => {
    const files = fakeOpfs();
    const blob = new Blob([wav]);
    const path = `audio/${OWNER_A}/paired-sha`;
    await storeInOpfs(a("paired-sha"), blob);
    await expect(deleteWithLocalAudio(a("paired-sha"), async () => Promise.reject(new Error("connection lost")))).rejects.toThrow("connection lost");
    expect(files.has(path)).toBe(true);
    expect(new Uint8Array(await (files.get(path) as Blob).arrayBuffer())).toEqual(new Uint8Array(await blob.arrayBuffer()));
    const deleteRecord = vi.fn(async () => {});
    await deleteWithLocalAudio(a("paired-sha"), deleteRecord);
    expect(deleteRecord).toHaveBeenCalledTimes(1);
    expect(files.has(path)).toBe(false);
  });

  it("says so when a failed delete can put the audio back in this tab only", async () => {
    // OPFS holds the file and lets it go, then refuses to take it back.
    let present = true;
    const blob = new Blob([wav]);
    opfsWith({
      getFileHandle: async () => ({
        getFile: async () => (present ? blob : new Blob([])),
        createWritable: async () => Promise.reject(new DOMException("quota exceeded", "QuotaExceededError")),
      }),
      removeEntry: async () => {
        present = false;
      },
    });
    const failure = deleteWithLocalAudio(a("unrestored-sha"), async () => Promise.reject(new Error("connection lost.")));
    await expect(failure).rejects.toThrow(/connection lost\. Its audio could not be put back in this browser's storage and is held in this tab only/);
    expect(present).toBe(false);
    const held = blobInTab(a("unrestored-sha"));
    expect(new Uint8Array(await (held as Blob).arrayBuffer())).toEqual(new Uint8Array(await blob.arrayBuffer()));
  });

  it("keeps the record when the local copy cannot be removed", async () => {
    fakeOpfs();
    await storeInOpfs(a("stuck-sha"), new Blob([wav]));
    const locked = new DOMException("the entry is locked", "NoModificationAllowedError");
    opfsWith({ getFileHandle: async () => ({ getFile: async () => new Blob([wav]) }), removeEntry: async () => Promise.reject(locked) });
    const deleteRecord = vi.fn(async () => {});
    await expect(deleteWithLocalAudio(a("stuck-sha"), deleteRecord)).rejects.toBe(locked);
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it("keeps a fallback copy when the OPFS removal fails, so the record keeps its audio", async () => {
    const locked = new DOMException("the entry is locked", "NoModificationAllowedError");
    // OPFS opens but cannot write (so the blob falls back to the tab), and its entry is locked.
    opfsWith({
      getFileHandle: async () => ({ getFile: async () => new Blob([]), createWritable: async () => Promise.reject(new DOMException("no writes", "NotSupportedError")) }),
      removeEntry: async () => Promise.reject(locked),
    });
    const blob = new Blob([wav]);
    expect(await storeInOpfs(a("fallback-locked-sha"), blob)).toBe("memory");
    const deleteRecord = vi.fn(async () => {});
    await expect(deleteWithLocalAudio(a("fallback-locked-sha"), deleteRecord)).rejects.toBe(locked);
    expect(deleteRecord).not.toHaveBeenCalled();
    expect(blobInTab(a("fallback-locked-sha"))).toBe(blob);
  });

  it("restores the copy when the record delete removes no row, as after an account change", async () => {
    const files = fakeOpfs();
    await storeInOpfs(a("hidden-sha"), new Blob([wav]));
    // RLS hides another owner's row, so PostgREST answers the delete with 200 and no rows.
    const answering = (rows: unknown[]) =>
      createClient<Database>("https://project.supabase.test", "anon-key-for-tests", {
        global: { fetch: (async () => new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch },
        auth: { persistSession: false },
      });
    await expect(deleteWithLocalAudio(a("hidden-sha"), () => deleteFile(answering([]), "file-id"))).rejects.toThrow(LibraryError);
    expect(files.has(`audio/${OWNER_A}/hidden-sha`)).toBe(true);
    await deleteWithLocalAudio(a("hidden-sha"), () => deleteFile(answering([{ id: "file-id" }]), "file-id"));
    expect(files.has(`audio/${OWNER_A}/hidden-sha`)).toBe(false);
  });

  it("joins a repeated delete of the same file, so no copy is restored after the record goes", async () => {
    const files = fakeOpfs();
    await storeInOpfs(a("twice-sha"), new Blob([wav]));
    // The first delete removes the row; run separately, a second would find none and fail.
    let rows = 1;
    const deleteRecord = vi.fn(async () => {
      if (rows-- < 1) throw new LibraryError("delete file: no such record for this account; reload the library");
    });
    await Promise.all([deleteWithLocalAudio(a("twice-sha"), deleteRecord), deleteWithLocalAudio(a("twice-sha"), deleteRecord)]);
    expect(deleteRecord).toHaveBeenCalledTimes(1);
    expect(files.has(`audio/${OWNER_A}/twice-sha`)).toBe(false);
    // Once it has settled, a new delete runs again.
    await expect(deleteWithLocalAudio(a("twice-sha"), deleteRecord)).rejects.toThrow(LibraryError);
    expect(deleteRecord).toHaveBeenCalledTimes(2);
  });

  it("takes turns with another tab deleting the same file, so no orphan copy comes back", async () => {
    const files = fakeOpfs({ locks: true });
    await storeInOpfs(a("two-tabs-sha"), new Blob([wav]));
    // Two tabs: separate module instances (so no shared in-tab join) on one origin's OPFS and locks.
    vi.resetModules();
    const tabOne = await import("@/lib/audio/browser");
    vi.resetModules();
    const tabTwo = await import("@/lib/audio/browser");
    let rows = 1;
    const deleteRecord = async () => {
      if (rows-- < 1) throw new LibraryError("delete file: no such record for this account; reload the library");
    };
    const results = await Promise.allSettled([tabOne.deleteWithLocalAudio(a("two-tabs-sha"), deleteRecord), tabTwo.deleteWithLocalAudio(a("two-tabs-sha"), deleteRecord)]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect(files.has(`audio/${OWNER_A}/two-tabs-sha`)).toBe(false);
  });

  it("takes turns between a delete and a save of the same file, so the saved row keeps its copy", async () => {
    const files = fakeOpfs({ locks: true });
    await storeInOpfs(a("turns-sha"), new Blob([wav]));
    let rows = 1;
    // The record delete is slow, so a save that did not wait its turn would land inside it.
    const deleting = deleteWithLocalAudio(a("turns-sha"), async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      rows = 0;
    });
    const saving = inTurnForLocalAudio(a("turns-sha"), async () => {
      rows = 1;
      return storeInOpfs(a("turns-sha"), new Blob([wav]));
    });
    await Promise.all([deleting, saving]);
    expect(rows).toBe(1);
    expect(files.has(`audio/${OWNER_A}/turns-sha`)).toBe(true);
  });

  it("keeps no audio where the browser has no Web Locks, so a save and a delete cannot race", async () => {
    const files = fakeOpfs();
    expect(await keepAudioFor(OWNER_A)(a("no-locks-sha"), new Blob([wav]))).toBe("unsupported");
    expect(files.size).toBe(0);
    expect(blobInTab(a("no-locks-sha"))).toBeUndefined();
  });

  it("keeps the audio only when the save ran as the account whose turn it holds", async () => {
    const files = fakeOpfs({ locks: true });
    const keep = keepAudioFor(OWNER_A);
    // Another tab switched accounts mid-save: the rows are B's, so A's turn keeps nothing.
    expect(await keep(b("switched-sha"), new Blob([wav]))).toBe("not-kept");
    expect(files.size).toBe(0);
    expect(await keep(a("switched-sha"), new Blob([wav]))).toBe("opfs");
    expect([...files.keys()]).toEqual([`audio/${OWNER_A}/switched-sha`]);
  });

  it("tells other tabs to drop their in-memory copy once the record is deleted, and only then", async () => {
    // Two tabs: separate module instances. OPFS is missing, so each copy lives in its tab.
    vi.resetModules();
    const holder = await import("@/lib/audio/browser");
    vi.resetModules();
    const deleter = await import("@/lib/audio/browser");
    expect(await holder.storeInOpfs(a("broadcast-sha"), new Blob([wav]))).toBe("memory");
    await expect(deleter.deleteWithLocalAudio(a("broadcast-sha"), async () => Promise.reject(new Error("connection lost")))).rejects.toThrow("connection lost");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(holder.blobInTab(a("broadcast-sha"))).toBeDefined();
    await deleter.deleteWithLocalAudio(a("broadcast-sha"), async () => {});
    await vi.waitFor(() => expect(holder.blobInTab(a("broadcast-sha"))).toBeUndefined());
  });

  it("tells other tabs to drop their in-memory copy once OPFS holds the file", async () => {
    vi.resetModules();
    const holder = await import("@/lib/audio/browser");
    vi.resetModules();
    const saver = await import("@/lib/audio/browser");
    // The holder's write fell back to memory; later OPFS works and another tab saves the file.
    expect(await holder.storeInOpfs(a("recovered-elsewhere-sha"), new Blob([wav]))).toBe("memory");
    fakeOpfs();
    expect(await saver.storeInOpfs(a("recovered-elsewhere-sha"), new Blob([wav]))).toBe("opfs");
    await vi.waitFor(() => expect(holder.blobInTab(a("recovered-elsewhere-sha"))).toBeUndefined());
  });

  it("removes local copies whose record is gone, checking each against the library first", async () => {
    const files = fakeOpfs({ locks: true });
    // A fresh module, so no fallback copy left by another test joins the candidates.
    vi.resetModules();
    const { reconcileLocalAudio, storeInOpfs } = await import("@/lib/audio/browser");
    for (const key of [a("kept-sha"), a("orphan-sha"), a("late-sha"), b("other-sha")]) await storeInOpfs(key, new Blob([wav]));
    // "late-sha" is missing from the loaded list (a truncated list, or a save since), but the library has it.
    const hasRecord = vi.fn(async (sha256: string) => sha256 === "late-sha");
    expect(await reconcileLocalAudio(OWNER_A, new Set(["kept-sha"]), hasRecord)).toEqual(["orphan-sha"]);
    expect([...files.keys()].sort()).toEqual([`audio/${OWNER_A}/kept-sha`, `audio/${OWNER_A}/late-sha`, `audio/${OWNER_B}/other-sha`]);
    expect(hasRecord.mock.calls.map(([sha256]) => sha256).sort()).toEqual(["late-sha", "orphan-sha"]);
    // An account with nothing stored here has nothing to reconcile.
    expect(await reconcileLocalAudio("00000000-0000-4000-8000-00000000000c", new Set(), hasRecord)).toEqual([]);
  });

  it("reconciles this tab's fallback copies too, where OPFS is missing", async () => {
    // Node has no navigator.storage, like a browser without OPFS. A fresh module, so no
    // fallback copy left by another test joins the candidates.
    vi.resetModules();
    const { blobInTab, reconcileLocalAudio, storeInOpfs } = await import("@/lib/audio/browser");
    expect(await storeInOpfs(a("mem-kept-sha"), new Blob([wav]))).toBe("memory");
    expect(await storeInOpfs(a("mem-orphan-sha"), new Blob([wav]))).toBe("memory");
    expect(await storeInOpfs(b("mem-other-sha"), new Blob([wav]))).toBe("memory");
    expect(await reconcileLocalAudio(OWNER_A, new Set(["mem-kept-sha"]), async () => false)).toEqual(["mem-orphan-sha"]);
    expect(blobInTab(a("mem-orphan-sha"))).toBeUndefined();
    expect(blobInTab(a("mem-kept-sha"))).toBeDefined();
    expect(blobInTab(b("mem-other-sha"))).toBeDefined();
  });

  it("tells other tabs to drop their in-memory copy when reconciliation removes it, and only then", async () => {
    // Two tabs without OPFS, each holding fallback copies. The record of one file was deleted
    // on another device; the other file's record is still there.
    vi.resetModules();
    const holder = await import("@/lib/audio/browser");
    vi.resetModules();
    const reconciler = await import("@/lib/audio/browser");
    for (const tab of [holder, reconciler]) {
      for (const sha256 of ["recon-orphan-sha", "recon-late-sha"]) expect(await tab.storeInOpfs(a(sha256), new Blob([wav]))).toBe("memory");
    }
    expect(await reconciler.reconcileLocalAudio(OWNER_A, new Set(), async (sha256) => sha256 === "recon-late-sha")).toEqual(["recon-orphan-sha"]);
    await vi.waitFor(() => expect(holder.blobInTab(a("recon-orphan-sha"))).toBeUndefined());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(holder.blobInTab(a("recon-late-sha"))).toBeDefined();
  });

  it("counts a record as gone only when the check ran as the account whose copy it is", async () => {
    const answering = (row: { present: boolean; owner: string }) =>
      createClient<Database>("https://project.supabase.test", "anon-key-for-tests", {
        global: { fetch: (async () => new Response(JSON.stringify(row), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch },
        auth: { persistSession: false },
      });
    expect(await hasFileRecord(answering({ present: false, owner: OWNER_A }), OWNER_A, "x")).toBe(false);
    expect(await hasFileRecord(answering({ present: true, owner: OWNER_A }), OWNER_A, "x")).toBe(true);
    // Another tab switched accounts mid-check: B's "no record" says nothing about A's.
    expect(await hasFileRecord(answering({ present: false, owner: OWNER_B }), OWNER_A, "x")).toBe(true);
  });

  it("drops the in-tab copy once OPFS takes the file", async () => {
    const blob = new Blob([wav]);
    expect(await storeInOpfs(a("recovered-sha"), blob)).toBe("memory");
    const files = fakeOpfs();
    expect(await storeInOpfs(a("recovered-sha"), blob)).toBe("opfs");
    expect(files.has(`audio/${OWNER_A}/recovered-sha`)).toBe(true);
    expect(blobInTab(a("recovered-sha"))).toBeUndefined();
  });

  it("puts an in-tab copy back in the tab, as it was, when the record delete fails", async () => {
    const blob = new Blob([wav]);
    expect(await storeInOpfs(a("tab-only-sha"), blob)).toBe("memory");
    await expect(deleteWithLocalAudio(a("tab-only-sha"), async () => Promise.reject(new Error("connection lost.")))).rejects.toThrow(/^connection lost\.$/);
    expect(blobInTab(a("tab-only-sha"))).toBe(blob);
  });

  it("removes the in-tab copy where OPFS is missing", async () => {
    expect(await storeInOpfs(a("tab-sha"), new Blob([wav]))).toBe("memory");
    expect(await storeInOpfs(b("tab-sha"), new Blob([wav]))).toBe("memory");
    await removeLocalAudio(a("tab-sha"));
    expect(blobInTab(a("tab-sha"))).toBeUndefined();
    expect(blobInTab(b("tab-sha"))).toBeDefined();
  });
});
