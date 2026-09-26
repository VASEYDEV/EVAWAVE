import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { analyseAudio } from "@/core/musicspec/analysis/features";
import { decodeWav, encodeWav, WavError, type PcmAudio } from "@/core/musicspec/analysis/wav";
import { applyReviewedPatch, audioProfileBase, AUDIO_DRAFT_MODEL, reviewPatch } from "@/core/musicspec/intake";
import { lintStyleProfile } from "@/core/musicspec/lint";
import { blobInTab, deleteWithLocalAudio, removeLocalAudio, storeInOpfs } from "@/lib/audio/browser";
import { importAudio, sha256Hex, type ImportDeps } from "@/lib/audio/import";
import { deleteFile, LibraryError, saveImport, saveImportAndKeepAudio, type ImportRecord } from "@/lib/library/repository";
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
    const row = url.includes("/rpc/save_import") ? { file_id: "file-1", profile_id: "profile-1" } : { id: "row-1" };
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
      profile: { id: PROFILE_ID, name: "Desert loop", spec, analysedOn: imported.analysedOn, model: AUDIO_DRAFT_MODEL },
    });
    expect(saved).toEqual({ fileId: "file-1", profileId: "profile-1" });

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

describe("keeping the audio with a library save", () => {
  const record: ImportRecord = {
    file: { filename: "desert-loop.wav", mime: "audio/wav", bytes: wav.byteLength, sha256: "c".repeat(64), features: { durationSec: 12 } as never },
    profile: { id: PROFILE_ID, name: "Desert loop", spec: {}, analysedOn: "2026-09-26T12:00:00.000Z", model: AUDIO_DRAFT_MODEL },
  };
  const clientWith = (fetchMock: typeof fetch) => createClient<Database>("https://project.supabase.test", "anon-key-for-tests", { global: { fetch: fetchMock }, auth: { persistSession: false } });

  it("stores the audio only after the save succeeds", async () => {
    const { fetchMock } = recorder();
    const store = vi.fn(async () => "opfs" as const);
    await expect(saveImportAndKeepAudio(clientWith(fetchMock), record, file, store)).resolves.toBe("opfs");
    expect(store).toHaveBeenCalledWith("c".repeat(64), file);
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
  function fakeOpfs() {
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
    });
    vi.stubGlobal("navigator", { storage: { getDirectory: async () => directory("") } });
    return files;
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

  it("drops the in-tab copy once OPFS takes the file", async () => {
    const blob = new Blob([wav]);
    expect(await storeInOpfs(a("recovered-sha"), blob)).toBe("memory");
    const files = fakeOpfs();
    expect(await storeInOpfs(a("recovered-sha"), blob)).toBe("opfs");
    expect(files.has(`audio/${OWNER_A}/recovered-sha`)).toBe(true);
    expect(blobInTab(a("recovered-sha"))).toBeUndefined();
  });

  it("removes the in-tab copy where OPFS is missing", async () => {
    expect(await storeInOpfs(a("tab-sha"), new Blob([wav]))).toBe("memory");
    expect(await storeInOpfs(b("tab-sha"), new Blob([wav]))).toBe("memory");
    await removeLocalAudio(a("tab-sha"));
    expect(blobInTab(a("tab-sha"))).toBeUndefined();
    expect(blobInTab(b("tab-sha"))).toBeDefined();
  });
});
