/**
 * Audio import to a draft StyleProfile patch (docs/SPEC.md §1.7). Everything runs on the
 * device: the file is hashed, decoded and analysed here, and only metadata and features ever
 * leave (A6). Import itself stores nothing. The screen keeps the blob on the device only once
 * a durable reference to it exists (a saved library row or a downloaded profile), so no
 * stored blob is ever unreachable. The steps that touch the platform are injected, so tests
 * can run the same pipeline and prove no request carries audio.
 */
import { analyseAudio } from "@/core/musicspec/analysis/features";
import type { PcmAudio } from "@/core/musicspec/analysis/wav";
import { draftFromAudio } from "@/core/musicspec/intake";
import type { AudioFeatures, IRPatch } from "@/core/musicspec/ir/types";

export interface ImportDeps {
  /** Decodes the file's bytes to PCM, keeping the channels (Web Audio in the browser). */
  decode(bytes: ArrayBuffer): Promise<PcmAudio>;
  /** Hex sha256 of the bytes, for dedupe and as the local key. */
  digest(bytes: ArrayBuffer): Promise<string>;
  /**
   * Runs the analysis. The browser runs it in a worker that an abort terminates; without this
   * it runs here, synchronously (Node and the tests).
   */
  analyse?(pcm: PcmAudio, signal?: AbortSignal): Promise<AudioFeatures>;
  /** The time the analysis ran, ISO 8601; the core never reads the clock. */
  now(): string;
  lineageNames?: readonly string[];
}

export interface ImportedAsset {
  kind: "audio";
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  localOnly: true;
}

export interface ImportResult {
  asset: ImportedAsset;
  features: AudioFeatures;
  patch: IRPatch;
  analysedOn: string;
}

/**
 * Hashes, decodes and analyses `file` and drafts the patch. Aborting `signal` (a newer file
 * choice) stops it at the next stage: before the hash, the decode or the analysis, and during
 * an analysis that `deps.analyse` can stop. The promise then rejects with the signal's reason.
 */
export async function importAudio(file: File, deps: ImportDeps, signal?: AbortSignal): Promise<ImportResult> {
  const bytes = await file.arrayBuffer();
  signal?.throwIfAborted();
  const sha256 = await deps.digest(bytes);
  signal?.throwIfAborted();
  const pcm = await deps.decode(bytes);
  signal?.throwIfAborted();
  const features = deps.analyse ? await deps.analyse(pcm, signal) : analyseAudio(pcm.samples, pcm.sampleRate, pcm.channelData);
  signal?.throwIfAborted();
  const analysedOn = deps.now();
  const patch = draftFromAudio(features, { createdAt: analysedOn, sourceRef: sha256 }, deps.lineageNames ?? []);
  return {
    asset: { kind: "audio", filename: file.name, mime: file.type || "application/octet-stream", bytes: bytes.byteLength, sha256, localOnly: true },
    features,
    patch,
    analysedOn,
  };
}

/** Hex sha256 with Web Crypto, available in browsers and Node 22+. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
