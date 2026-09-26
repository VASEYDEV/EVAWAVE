/**
 * Browser implementations of the import steps (docs/SPEC.md §1.7): Web Audio decoding and
 * the Origin Private File System for the blob. Nothing here performs a network request.
 */
import type { PcmAudio } from "@/core/musicspec/analysis/wav";

import { sha256Hex, type ImportDeps } from "./import";

export async function decodeWithWebAudio(bytes: ArrayBuffer): Promise<PcmAudio> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const channelData = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    let samples = channelData[0] ?? new Float32Array(0);
    if (channelData.length > 1) {
      samples = new Float32Array(buffer.length);
      for (const channel of channelData) {
        for (let i = 0; i < channel.length; i++) samples[i] = (samples[i] as number) + (channel[i] as number) / channelData.length;
      }
    }
    return { sampleRate: buffer.sampleRate, samples, channels: buffer.numberOfChannels, channelData };
  } finally {
    await context.close();
  }
}

/** The fallback store: blobs this tab could not write to OPFS, keyed by sha256. */
const tabMemory = new Map<string, Blob>();

/**
 * Keeps the file in OPFS under audio/<sha256>; falls back to memory where OPFS is missing.
 * The import screen calls it when the person creates a profile from the file.
 */
export async function storeInOpfs(sha256: string, file: Blob): Promise<"opfs" | "memory"> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("audio", { create: true });
    const handle = await dir.getFileHandle(sha256, { create: true });
    const existing = await handle.getFile();
    if (existing.size !== file.size) {
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
    }
    return "opfs";
  } catch {
    // Some browsers (and private windows) have no OPFS or no createWritable; the analysis
    // still works, and the blob stays in this tab's memory only.
    tabMemory.set(sha256, file);
    return "memory";
  }
}

/** The blob the memory fallback holds for `sha256`, if this tab kept one. */
export function blobInTab(sha256: string): Blob | undefined {
  return tabMemory.get(sha256);
}

export const browserImportDeps: ImportDeps = {
  decode: decodeWithWebAudio,
  digest: sha256Hex,
  now: () => new Date().toISOString(),
};
