/**
 * Audio import to a draft StyleProfile patch (docs/SPEC.md §1.7). Everything runs on the
 * device: the file is hashed, decoded and analysed here, and only metadata and features ever
 * leave (A6). Import itself stores nothing. The screen keeps the blob on the device only after
 * a library save succeeds: the saved row is the reference /library can remove it by, so no
 * stored blob is ever unreachable. The steps that touch the platform are injected, so tests
 * can run the same pipeline and prove no request carries audio.
 */
import { channelCount } from "@/core/musicspec/analysis/channels";
import { analyseAudio } from "@/core/musicspec/analysis/features";
import type { PcmAudio } from "@/core/musicspec/analysis/wav";
import { AUDIO_DRAFT_MODEL, audioProfileSpec, draftFromAudio, reviewPatch } from "@/core/musicspec/intake";
import type { AudioFeatures, IRPatch, StyleProfile } from "@/core/musicspec/ir/types";
import { profileName } from "@/lib/library/schema";

/**
 * The largest file an import reads: 100 MiB, about 9.9 minutes of 16-bit 44.1 kHz stereo WAV
 * or 6 minutes at 24-bit 48 kHz, and any compressed track of normal length. Web Audio decodes
 * the whole file at once, so a bigger one could exhaust a phone tab's memory before it could
 * be cancelled. A streaming decoder (WebCodecs) would lift this.
 */
export const IMPORT_MAX_BYTES = 100 * 1024 * 1024;

/**
 * The longest recording an import decodes: 10 minutes. Web Audio decodes to 32-bit float, so
 * the bytes a file takes say little about the memory its decode takes (a 100 MiB MP3 can hold
 * an hour and a half). Ten minutes of stereo at DECODE_SAMPLE_RATE is about 230 MB of samples.
 */
export const IMPORT_MAX_SECONDS = 600;

/**
 * The rate an import decodes at, whatever the device runs at (an audio interface can run at
 * 192 kHz), so the decoded size depends only on duration and channels. BS.1770 K-weighting is
 * exact at 48 kHz.
 */
export const DECODE_SAMPLE_RATE = 48000;

/**
 * Channels × seconds an import decodes: ten minutes of stereo, about 230 MB of samples at
 * DECODE_SAMPLE_RATE, and the mix of a multichannel file adds one channel more. Mono and
 * stereo keep the whole IMPORT_MAX_SECONDS; 5.1 runs to 200 seconds, 7.1 to 150.
 */
export const IMPORT_MAX_CHANNEL_SECONDS = 2 * IMPORT_MAX_SECONDS;

/** The channels an import assumes when the file's header does not say: 7.1. */
export const IMPORT_ASSUMED_CHANNELS = 8;

const minutes = (seconds: number) => {
  const value = Number((seconds / 60).toFixed(1));
  return `${value} minute${value === 1 ? "" : "s"}`;
};

/**
 * The recording is longer than an import decodes: IMPORT_MAX_SECONDS, or less for a file with
 * more than two channels (`channels`, or "unknown" when its header does not say). Nothing was
 * read beyond the header, and nothing was decoded.
 */
export class ImportTooLongError extends Error {
  constructor(seconds: number, limitSeconds = IMPORT_MAX_SECONDS, channels?: number | "unknown") {
    super(
      channels === "unknown"
        ? `This recording runs ${minutes(seconds)}, and its file does not say how many channels it has; imports take such recordings up to ${minutes(limitSeconds)} for now.`
        : channels !== undefined
          ? `This recording has ${channels} channels and runs ${minutes(seconds)}; imports take ${channels}-channel recordings up to ${minutes(limitSeconds)} for now.`
          : `This recording is ${Math.round(seconds / 60)} minutes long; imports take recordings up to ${IMPORT_MAX_SECONDS / 60} minutes for now.`,
    );
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
  /** Decodes the file's bytes to PCM, keeping the channels (Web Audio at DECODE_SAMPLE_RATE in the browser). */
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
  if (seconds !== undefined) {
    if (seconds > IMPORT_MAX_SECONDS) throw new ImportTooLongError(seconds);
    // Web Audio decodes every channel at once, so the channel count bounds the length too.
    const channels = await channelCount(headerReader(file), file.size);
    signal?.throwIfAborted();
    const limit = IMPORT_MAX_CHANNEL_SECONDS / (channels ?? IMPORT_ASSUMED_CHANNELS);
    if (seconds > limit) throw new ImportTooLongError(seconds, limit, channels ?? "unknown");
  }
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

/**
 * The StyleProfile a review makes: only the accepted fields (a rejected tempo, meter or key is
 * absent, not a default), named `name` or after the file, with the `id` Create fixed. The
 * import page derives it from the current review on every change, so what Save and Download
 * send is always what the review shows.
 */
export function profileFromReview(result: ImportResult, accepted: ReadonlySet<string>, name: string, id: string): { profile: StyleProfile; acceptedCount: number } {
  const reviewed = reviewPatch(result.patch, accepted);
  const { doc } = audioProfileSpec(reviewed);
  return {
    acceptedCount: reviewed.acceptedPaths.length,
    profile: {
      id,
      ownerId: "local",
      name: profileName(name, result.asset.filename),
      provenance: { kind: "audio-analysis", sourceRef: result.asset.sha256, analysedOn: result.analysedOn, model: AUDIO_DRAFT_MODEL },
      spec: doc,
      features: result.features,
      genreIds: [],
      tags: [],
      createdAt: result.analysedOn,
      updatedAt: result.analysedOn,
    },
  };
}

/** Reads byte ranges of `file` without loading the rest of it. */
function headerReader(file: File) {
  return async (offset: number, length: number) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
}

/** Hex sha256 with Web Crypto, available in browsers and Node 22+. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
