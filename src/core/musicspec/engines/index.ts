/**
 * The installed engine profiles, validated at module load (docs/SPEC.md §1.3).
 */
import type { EngineId, EngineProfile } from "../ir/types";

import eleven from "./profiles/eleven.json";
import flow from "./profiles/flow.json";
import suno from "./profiles/suno.json";
import udio from "./profiles/udio.json";
import { validateProfile } from "./profile";

export { DIMENSIONS, ENGINE_IDS, ProfileError, validateProfile } from "./profile";

export const ENGINE_PROFILES: Readonly<Record<EngineId, EngineProfile>> = {
  suno: validateProfile(suno, "profiles/suno.json"),
  eleven: validateProfile(eleven, "profiles/eleven.json"),
  flow: validateProfile(flow, "profiles/flow.json"),
  udio: validateProfile(udio, "profiles/udio.json"),
};

export function getProfile(id: EngineId): EngineProfile {
  return ENGINE_PROFILES[id];
}
