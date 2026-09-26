/**
 * PV-1: an audio-analysis StyleProfile whose tempo came from a low-confidence estimate
 * (bpm confidence under 0.6). Info-level: the profile carries a low-confidence badge until a
 * person sets the tempo, which changes `D6.tempo.source` away from 'analysis'. A profile
 * without a tempo (the person did not accept one) makes no tempo claim to flag.
 */
import type { LintResult, StyleProfile } from "../../ir/types";
import { result } from "../context";

export const PROFILE_BPM_CONFIDENCE = 0.6;

export function lintStyleProfile(profile: StyleProfile): LintResult[] {
  const confidence = profile.features?.bpm.confidence;
  const source = profile.spec.D6?.tempo?.source;
  if (profile.provenance.kind !== "audio-analysis" || confidence === undefined || confidence >= PROFILE_BPM_CONFIDENCE) return [];
  if (source !== "analysis") return [];
  return [result("PV-1", "info", "/features/bpm/confidence", `tempo estimate is low-confidence (${Math.round(confidence * 100)}%); check it by ear or tap it in`)];
}
