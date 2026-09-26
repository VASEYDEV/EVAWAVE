/**
 * Audio import to a draft StyleProfile patch (docs/SPEC.md §1.7). Everything runs on the
 * device: the file is hashed, decoded and analysed here, and only metadata and features ever
 * leave (A6). Import itself stores nothing. The screen keeps the blob on the device only after
 * a library save succeeds: the saved row is the reference /library can remove it by, so no
 * stored blob is ever unreachable. The steps that touch the platform are injected, so tests
 * can run the same pipeline and prove no request carries audio.
 */
import { analyseAudio } from "@/core/musicspec/analysis/features";
import type { PcmAudio } from "@/core/musicspec/analysis/wav";
import { draftFromAudio } from "@/core/musicspec/intake";
import type { AudioFeatures, IRPatch } from "@/core/musicspec/ir/types";

/**
 * The largest file an import reads: 100 MiB, about 9.9 minutes of 16-bit 44.1 kHz stereo WAV
 * or 6 minutes at 24-bit 48 kHz, and any compressed track of normal length. Web Audio decodes
 * the whole file at once, so a bigger one could exhaust a phone tab's memory before it could
 * be cancelled. A streaming decoder (WebCodecs) would lift this.
 */
export const IMPORT_MAX_BYTES = 100 * 1024 * 1024;

/**
 * The longest recording an import decodes: 10 minutes. Web Audio decodes to 32-bit float at
 * the device rate, so the bytes a file takes say little about the memory its decode takes
 * (a 100 MiB MP3 can hold an hour and a half). Ten minutes of stereo at 48 kHz is about
 * 230 MB of samples.
 */
export const IMPORT_MAX_SECONDS = 600;

/** The recording is longer than IMPORT_MAX_SECONDS; nothing was read or decoded. */
export class ImportTooLongError extends Error {
  constructor(seconds: number) {
    super(`This recording is ${Math.round(seconds / 60)} minutes long; imports take recordings up to ${IMPORT_MAX_SECONDS / 60} minutes for now.`);
    this.name = "ImportTooLongError";
  }
}

/** The file is over IMPORT_MAX_BYTES; nothing was read. */
export class ImportTooLargeError extends Error {
  constructor(bytes: number) {
    super(`This file is ${(bytes / 1024 / 1024).toFixed(0)} MB; imports take files up to ${IMPORT_MAX_BYTES / 1024 / 1024} MB for now.`);
    this.name = "ImportTooLargeError";
  }
}

export interface ImportDeps {
  /** Decodes the file's bytes to PCM, keeping the channels (Web Audio in the browser). */
  decode(bytes: ArrayBuffer): Promise<PcmAudio>;
  /** Hex sha256 of the bytes, for dedupe and as the local key. */
  digest(bytes: ArrayBuffer): Promise<string>;
  /**
   * The recording's duration in seconds, from its metadata, without reading the file into
   * memory; undefined when it cannot tell. The browser asks a media element.
   */
  probeDuration?(file: File): Promise<number | undefined>;
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
 * choice) stops it at the next stage: before the read, the hash, the decode or the analysis, and during
 * an analysis that `deps.analyse` can stop. The promise then rejects with the signal's reason.
 */
export async function importAudio(file: File, deps: ImportDeps, signal?: AbortSignal): Promise<ImportResult> {
  // An import superseded before it starts never reads the file: it can be large.
  signal?.throwIfAborted();
  if (file.size > IMPORT_MAX_BYTES) throw new ImportTooLargeError(file.size);
  const seconds = await deps.probeDuration?.(file);
  signal?.throwIfAborted();
  if (seconds !== undefined && seconds > IMPORT_MAX_SECONDS) throw new ImportTooLongError(seconds);
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
