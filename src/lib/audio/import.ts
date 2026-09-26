/**
 * Audio import to a draft StyleProfile patch (docs/SPEC.md §1.7). Everything runs on the
 * device: the file is hashed, kept in local storage, decoded and analysed here, and only
 * metadata and features ever leave (A6). The steps that touch the platform are injected, so
 * tests can run the same pipeline and prove no request carries audio.
 */
import { analyseAudio } from "@/core/musicspec/analysis/features";
import type { PcmAudio } from "@/core/musicspec/analysis/wav";
import { draftFromAudio } from "@/core/musicspec/intake";
import type { AudioFeatures, IRPatch } from "@/core/musicspec/ir/types";

export interface ImportDeps {
  /** Decodes the file's bytes to mono PCM (Web Audio in the browser). */
  decode(bytes: ArrayBuffer): Promise<PcmAudio>;
  /** Hex sha256 of the bytes, for dedupe and as the local key. */
  digest(bytes: ArrayBuffer): Promise<string>;
  /** Keeps the blob on the device (OPFS); resolves to where it went. */
  store(sha256: string, file: Blob): Promise<"opfs" | "memory">;
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
  storedIn: "opfs" | "memory";
}

export interface ImportResult {
  asset: ImportedAsset;
  features: AudioFeatures;
  patch: IRPatch;
  analysedOn: string;
}

export async function importAudio(file: File, deps: ImportDeps): Promise<ImportResult> {
  const bytes = await file.arrayBuffer();
  const sha256 = await deps.digest(bytes);
  const storedIn = await deps.store(sha256, file);
  const pcm = await deps.decode(bytes);
  const features = analyseAudio(pcm.samples, pcm.sampleRate);
  const analysedOn = deps.now();
  const patch = draftFromAudio(features, { createdAt: analysedOn, sourceRef: sha256 }, deps.lineageNames ?? []);
  return {
    asset: { kind: "audio", filename: file.name, mime: file.type || "application/octet-stream", bytes: bytes.byteLength, sha256, localOnly: true, storedIn },
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
