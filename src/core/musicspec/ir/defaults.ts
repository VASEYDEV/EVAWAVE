import type {
  BlockSize,
  InstrumentationDelta,
  IRPatch,
  MeterLock,
  OpenPocket,
  OutputIntentDelta,
  Reference,
  SectionCap,
  Structure,
  Tempo,
  Transition,
  VocalsDelta,
} from "./types";

/**
 * Every v0.3 field's default, from the IR v0.3 delta §7 attachment map and the per-field
 * defaults stated in its type comments. Factories return fresh objects because several
 * defaults hold arrays: a shared constant would let one spec's edits leak into another.
 * The root `MusicSpec` default is composed in S1b, once the v0.2 containers are merged.
 */

/** A `Weighted<T>` wrapper that is absent means weight 1 (delta §1). */
export const DEFAULT_WEIGHT = 1;
/** `Transition.bars` lead-in length when unset (delta §3). */
export const DEFAULT_TRANSITION_BARS = 2;
/** `Structure.blockSize` (delta §3, §7). */
export const DEFAULT_BLOCK_SIZE: BlockSize = 8;

/** D6 theory profile. */
export function defaultTempo(): Tempo {
  return { bpm: 120, source: "manual" };
}

/** D6 theory profile. */
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

/** D7 structure. */
export function defaultStructure(): Structure {
  return { sections: [], blockSize: DEFAULT_BLOCK_SIZE };
}

/** `InstrumentationDelta.sectionCap` (delta §4). */
export function defaultSectionCap(): SectionCap {
  return { warnAt: 6, blockAt: 8 };
}

/** D5 instrumentation. */
export function defaultInstrumentationDelta(): InstrumentationDelta {
  return { bundles: [], synthRoles: [], sectionCap: defaultSectionCap() };
}

/** D8 vocals. */
export function defaultVocalsDelta(): VocalsDelta {
  return { instrumental: false };
}

/** D10 negative space and output intent. */
export function defaultOutputIntentDelta(): OutputIntentDelta {
  return { targets: ["suno"], activeTarget: "suno", houseBudgets: {}, negativeSpace: [] };
}

/** MusicSpec root, new in v0.3. */
export function defaultReferences(): Reference[] {
  return [];
}

/** MusicSpec root, new in v0.3; working-copy only, never part of a Variant snapshot. */
export function defaultPatches(): IRPatch[] {
  return [];
}

/** `Section.openPocket` (delta §3). */
export function defaultOpenPocket(): OpenPocket {
  return { kind: "none" };
}

/** `Section.transitionOut` (delta §3). */
export function defaultTransition(): Transition {
  return { kind: "none" };
}
