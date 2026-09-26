/**
 * Runs the on-device analysis off the main thread (docs/SPEC.md §1.7), so a long track never
 * freezes the page, and a newer file choice stops it by terminating this worker. The samples
 * arrive transferred, not copied, and nothing leaves the device.
 *
 * Turbopack (Next 16.3.6) copies a `new URL("./x.ts", import.meta.url)` worker as a raw asset
 * instead of bundling it, so `scripts/build-analysis-worker.mjs` bundles this file into
 * `public/workers/analysis.worker.js`. Imports stay relative so that bundle needs no aliases.
 */
import { analyseAudio } from "../../core/musicspec/analysis/features";
import type { AudioFeatures } from "../../core/musicspec/ir/types";

export interface AnalysisRequest {
  samples: Float32Array;
  sampleRate: number;
  channels: Float32Array[];
}

export type AnalysisReply = { ok: true; features: AudioFeatures } | { ok: false; message: string };

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const { samples, sampleRate, channels } = event.data;
  let reply: AnalysisReply;
  try {
    reply = { ok: true, features: analyseAudio(samples, sampleRate, channels) };
  } catch (error) {
    reply = { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
