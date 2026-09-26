/**
 * Defaults for MusicSpec IR v1 (docs/SPEC.md §2.3). Every factory returns a fresh object, so
 * callers can mutate a default without touching another spec's copy.
 */
import type {
  MeterLock,
  MusicSpec,
  OpenPocket,
  Section,
  SectionKind,
  SectionScope,
  Tempo,
  Transition,
} from "./types";

/** Default weight when a `Weighted<T>` is created without one. */
export const DEFAULT_WEIGHT = 1;
/** Default lead-in length of a transition, in bars. */
export const DEFAULT_TRANSITION_BARS = 2;

export function defaultTempo(): Tempo {
  return { bpm: 120, source: "manual" };
}

export function defaultMeterLock(): MeterLock {
  return {
    enabled: false,
    signature: "4/4",
    feel: "straight",
    subdivision: 16,
    driftSuppression: true,
    allowedExtensions: [],
    restatement: "style-and-sections",
  };
}

export function defaultSectionScope(): SectionScope {
  return { instrumentIds: [], synthRoleIds: [], techniqueIds: [], percussionRhythmIds: [] };
}

export function defaultOpenPocket(): OpenPocket {
  return { kind: "none" };
}

export function defaultTransition(): Transition {
  return { kind: "none" };
}

/** A new, empty section: 8 bars at mf with no cues. */
export function defaultSection(id: string, kind: SectionKind, label: string): Section {
  return {
    id,
    kind,
    label,
    bars: 8,
    dynamics: "mf",
    scope: defaultSectionScope(),
    cues: [],
    openPocket: defaultOpenPocket(),
    transitionOut: defaultTransition(),
  };
}

/** An empty, valid MusicSpec with every container at its default. */
export function defaultMusicSpec(): MusicSpec {
  return {
    irVersion: 1,
    D1: { stack: [], formPhrase: "" },
    D2: { moods: [], imagery: [], palette: [] },
    D3: { techniques: [] },
    D4: { traits: [] },
    D5: {
      instruments: [],
      bundles: [],
      drums: { patternIds: [] },
      synthRoles: [],
      textures: [],
      sectionCap: { warnAt: 6, blockAt: 8 },
    },
    D6: { tempo: defaultTempo(), meterLock: defaultMeterLock(), key: { tonic: "C", modeId: "ionian" }, harmony: [] },
    D7: { sections: [], blockSize: 8 },
    D8: { instrumental: false, voice: [] },
    D9: { character: [], techniqueIds: [] },
    D10: { targets: ["suno"], activeTarget: "suno", houseBudgets: {}, negativeSpace: [] },
    references: [],
    patches: [],
  };
}
