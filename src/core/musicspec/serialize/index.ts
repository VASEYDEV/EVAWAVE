/**
 * `compile(spec, engineId, catalog)` (docs/SPEC.md §2.6, S2). It resolves the installed
 * profile and runs that engine's serializer. Switching the active target is a projection:
 * it re-runs this function and never mutates the spec (A5). Udio is halted (A12), so it
 * gets a typed `CompileError` and no payload.
 */
import { ENGINE_PROFILES } from "../engines";
import type { Catalog, CompiledPayload, CompileError, EngineId, EngineProfile, MusicSpec } from "../ir/types";
import { compileEleven } from "./eleven";
import { compileFlow } from "./flow";
import { compileSuno } from "./suno";

export type CompileResult = { ok: true; payload: CompiledPayload } | { ok: false; error: CompileError };

type Serializer = (spec: MusicSpec, profile: EngineProfile, catalog: Catalog) => CompiledPayload;

/** The live serializers. Udio has none by decision (A12). */
export const SERIALIZERS: Readonly<Partial<Record<EngineId, Serializer>>> = {
  suno: compileSuno,
  eleven: compileEleven,
  flow: compileFlow,
};

/**
 * Compiles `spec` for `engineId`. Never throws for a halted or unknown engine: the result
 * carries a `CompileError` instead, so the target picker can render the refusal.
 */
export function compile(
  spec: MusicSpec,
  engineId: string,
  catalog: Catalog,
  profiles: Readonly<Record<string, EngineProfile>> = ENGINE_PROFILES,
): CompileResult {
  const profile = profiles[engineId];
  if (!profile) return { ok: false, error: { code: "engine-unknown", engine: engineId, message: `No engine profile is installed for '${engineId}'.` } };
  if (profile.status === "stub") {
    const reason = profile.halted ? ` (decision ${profile.halted.decision}, ${profile.halted.on})` : "";
    return { ok: false, error: { code: "engine-halted", engine: engineId, message: `${profile.displayName} is halted${reason}; it has no serializer.` } };
  }
  const serializer = SERIALIZERS[profile.id];
  if (!serializer || profile.id !== engineId) {
    return { ok: false, error: { code: "profile-invalid", engine: engineId, message: `The profile installed for '${engineId}' has no matching serializer.` } };
  }
  return { ok: true, payload: serializer(spec, profile, catalog) };
}

export { compileEleven, compileFlow, compileSuno };
