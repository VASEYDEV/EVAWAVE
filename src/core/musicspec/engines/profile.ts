/**
 * Engine profiles are data (docs/SPEC.md §1.3, §2.2). This module validates a parsed profile
 * JSON against the `EngineProfile` shape, so a malformed profile fails loudly at load time
 * instead of producing a wrong payload later.
 */
import type { Dimension, EngineField, EngineId, EngineProfile } from "../ir/types";

export const DIMENSIONS: readonly Dimension[] = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"];
export const ENGINE_IDS: readonly EngineId[] = ["suno", "eleven", "flow", "udio"];

const FIELD_KINDS = ["text", "json", "boolean", "number", "file"] as const;
const CONFIDENCES = ["verified", "partial", "community", "unverified"] as const;
const WEIGHTINGS = ["front-loaded", "uniform", "unknown"] as const;
const SUPPORT_LEVELS = ["native", "approximate", "none"] as const;
const AFFECTS = ["render", "lyrics", "orchestration"] as const;

/** Thrown when a profile does not match the `EngineProfile` shape. */
export class ProfileError extends Error {
  override name = "ProfileError";
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function fail(where: string, problem: string): never {
  throw new ProfileError(`${where}: ${problem}`);
}

function validateField(raw: unknown, where: string): EngineField {
  if (!isRecord(raw)) fail(where, "field must be an object");
  if (typeof raw.id !== "string" || raw.id === "") fail(where, "field.id must be a non-empty string");
  if (typeof raw.label !== "string") fail(where, `field ${raw.id}: label must be a string`);
  if (!oneOf(raw.kind, FIELD_KINDS)) fail(where, `field ${raw.id}: kind must be one of ${FIELD_KINDS.join(", ")}`);
  if (!Array.isArray(raw.serializesFrom) || !raw.serializesFrom.every((d) => oneOf(d, DIMENSIONS))) {
    fail(where, `field ${raw.id}: serializesFrom must list dimensions D1–D10`);
  }
  if (typeof raw.order !== "number") fail(where, `field ${raw.id}: order must be a number`);
  for (const key of ["hardLimit", "softLimit"] as const) {
    if (raw[key] !== undefined && (raw.kind !== "text" || typeof raw[key] !== "number")) {
      fail(where, `field ${raw.id}: ${key} is a character cap and belongs on text fields only`);
    }
  }
  for (const key of ["min", "max"] as const) {
    if (raw[key] !== undefined && (raw.kind !== "number" || typeof raw[key] !== "number")) {
      fail(where, `field ${raw.id}: ${key} is a numeric bound and belongs on number fields only`);
    }
  }
  if (raw.notes !== undefined && typeof raw.notes !== "string") fail(where, `field ${raw.id}: notes must be a string`);
  return raw as unknown as EngineField;
}

/**
 * Validates a parsed profile and returns it typed. Throws `ProfileError` naming the first
 * problem found.
 */
export function validateProfile(raw: unknown, source = "profile"): EngineProfile {
  if (!isRecord(raw)) fail(source, "profile must be an object");
  if (!oneOf(raw.id, ENGINE_IDS)) fail(source, `id must be one of ${ENGINE_IDS.join(", ")}`);
  const where = `${source} (${raw.id})`;
  for (const key of ["displayName", "version", "verifiedOn"] as const) {
    if (typeof raw[key] !== "string") fail(where, `${key} must be a string`);
  }
  if (!oneOf(raw.confidence, CONFIDENCES)) fail(where, "confidence is not a known level");
  if (raw.status !== "live" && raw.status !== "stub") fail(where, "status must be 'live' or 'stub'");
  if (raw.status === "stub" && !isRecord(raw.halted)) fail(where, "a stub profile must carry a halted block");
  if (raw.status === "live" && !isRecord(raw.verification)) fail(where, "a live profile must carry a verification block");
  if (isRecord(raw.verification)) {
    const v = raw.verification;
    if (typeof v.method !== "string" || !isStringArray(v.verified) || !isStringArray(v.unverified)) {
      fail(where, "verification needs method, verified[] and unverified[]");
    }
  }
  if (!Array.isArray(raw.fields)) fail(where, "fields must be an array");
  const fields = raw.fields.map((field) => validateField(field, where));
  const ids = new Set(fields.map((field) => field.id));
  if (ids.size !== fields.length) fail(where, "field ids must be unique");
  if (!Array.isArray(raw.toggles) || !raw.toggles.every((t) => isRecord(t) && typeof t.id === "string" && typeof t.effect === "string")) {
    fail(where, "toggles must be objects with id and effect");
  }
  if (
    !Array.isArray(raw.selectors) ||
    !raw.selectors.every((s) => isRecord(s) && typeof s.id === "string" && oneOf(s.affects, AFFECTS) && Array.isArray(s.options))
  ) {
    fail(where, "selectors must be objects with id, affects and options");
  }
  for (const key of ["driftWords", "bannedTerms", "postRender", "notes"] as const) {
    if (!isStringArray(raw[key])) fail(where, `${key} must be a string array`);
  }
  if (!isRecord(raw.aliases) || !Object.values(raw.aliases).every((v) => typeof v === "string")) {
    fail(where, "aliases must map ids to strings");
  }
  if (!oneOf(raw.weighting, WEIGHTINGS)) fail(where, "weighting is not a known value");
  if (!isRecord(raw.supports)) fail(where, "supports must be an object");
  const supports = raw.supports;
  for (const dimension of DIMENSIONS) {
    if (!oneOf(supports[dimension], SUPPORT_LEVELS)) fail(where, `supports.${dimension} must be native, approximate or none`);
  }
  if (raw.houseBudgets !== undefined && (!isRecord(raw.houseBudgets) || !Object.values(raw.houseBudgets).every((v) => typeof v === "number"))) {
    fail(where, "houseBudgets must map keys to numbers");
  }
  return raw as unknown as EngineProfile;
}
