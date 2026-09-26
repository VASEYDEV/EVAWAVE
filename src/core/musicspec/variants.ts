/**
 * Variants (docs/SPEC.md §1.6, §2.4, §3 S6): the field diff between two frozen specs, the
 * hash that tells a saved working copy from an edited one, the next variant label, and the
 * coverage a variant records per live engine.
 *
 * Pure: everything here works on JSON values. Specs are normalised through a JSON round
 * trip first, so a diff computed in the browser reads the same after the database has
 * stored it (JSON has no `undefined`).
 */
import { ENGINE_PROFILES } from "./engines";
import type { Catalog, CoverageReport, EngineId, FieldDiff, LintResult, MusicSpec, PatchOp, TargetOverride } from "./ir/types";
import { lint } from "./lint";
import { formatPointer, PatchError } from "./patch";
import { SERIALIZERS, compile } from "./serialize";
import { hash53 } from "./text";

/** A JSON round trip: drops `undefined` members, as storage and the network would. */
export function normalise<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Natural order for pointer tokens: runs of digits compare as numbers, so `D2` sorts before
 * `D10` and element 2 before element 10. Ties fall back to plain comparison, so the order
 * is total and the same everywhere.
 */
export function naturalCompare(a: string, b: string): number {
  const chunk = /(\d+|\D+)/g;
  const as = a.match(chunk) ?? [];
  const bs = b.match(chunk) ?? [];
  for (let i = 0; i < Math.min(as.length, bs.length); i++) {
    const x = as[i] as string;
    const y = bs[i] as string;
    if (x === y) continue;
    const xNum = /^\d/.test(x);
    const yNum = /^\d/.test(y);
    if (xNum && yNum) {
      const byValue = Number(x) - Number(y);
      if (byValue !== 0) return byValue;
    }
    return x < y ? -1 : 1;
  }
  if (as.length !== bs.length) return as.length - bs.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

function walk(before: unknown, after: unknown, tokens: string[], out: FieldDiff[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(naturalCompare);
    for (const key of keys) {
      const path = [...tokens, key];
      const inBefore = Object.prototype.hasOwnProperty.call(before, key);
      const inAfter = Object.prototype.hasOwnProperty.call(after, key);
      if (!inBefore) out.push({ path: formatPointer(path), after: after[key] });
      else if (!inAfter) out.push({ path: formatPointer(path), before: before[key] });
      else walk(before[key], after[key], path, out);
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      const path = [...tokens, String(i)];
      if (i >= before.length) out.push({ path: formatPointer(path), after: after[i] });
      else if (i >= after.length) out.push({ path: formatPointer(path), before: before[i] });
      else walk(before[i], after[i], path, out);
    }
    return;
  }
  // A leaf that changed, or a subtree whose type changed: one entry at its root.
  if (before !== after) out.push({ path: formatPointer(tokens), before, after });
}

/**
 * The field diff from `before` to `after`: one entry per changed leaf, and one entry at the
 * root of any subtree that was added, removed or changed type. Objects are compared by key,
 * arrays by index. Entries come in natural pointer order.
 */
export function diffSpecs(before: MusicSpec, after: MusicSpec): FieldDiff[] {
  return diffJson(before, after);
}

/**
 * {@link diffSpecs} for any two JSON values. When the two differ at the root itself (a
 * scalar change, or an object against an array), the diff is one entry with the empty
 * pointer, which {@link diffToOps} refuses.
 */
export function diffJson(before: unknown, after: unknown): FieldDiff[] {
  const out: FieldDiff[] = [];
  walk(normalise(before), normalise(after), [], out);
  return out;
}

function tokensOf(pointer: string): string[] {
  return pointer === "" ? [] : pointer.slice(1).split("/");
}

function comparePointers(a: string, b: string): number {
  const x = tokensOf(a);
  const y = tokensOf(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const byToken = naturalCompare(x[i] as string, y[i] as string);
    if (byToken !== 0) return byToken;
  }
  return x.length - y.length;
}

/**
 * The patch ops that turn `before` into `after` for a diff from {@link diffJson}. Removals
 * go first, deepest and highest index first, so no removal shifts an index another op still
 * needs; sets follow in pointer order, so array elements are appended in sequence.
 *
 * A patch op cannot target the document root, so a diff that replaces the whole document
 * (two values of different types, or two different scalars) is refused here rather than
 * turned into an op that `applyOps` would reject. Two specs never produce one: both are
 * objects, so their diff is always below the root.
 */
export function diffToOps(diff: readonly FieldDiff[]): PatchOp[] {
  if (diff.some((d) => d.path === "")) {
    throw new PatchError("a diff that replaces the whole document cannot be replayed as patch ops; its `after` is the new document");
  }
  const removals = diff.filter((d) => !("after" in d)).sort((a, b) => comparePointers(b.path, a.path));
  const sets = diff.filter((d) => "after" in d).sort((a, b) => comparePointers(a.path, b.path));
  return [
    ...removals.map((d): PatchOp => ({ op: "remove", path: d.path, confidence: 1, rationale: "variant diff" })),
    ...sets.map((d): PatchOp => ({ op: "set", path: d.path, value: d.after, confidence: 1, rationale: "variant diff" })),
  ];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

/** A content hash of a spec that ignores key order and `undefined` members. */
export function specHash(spec: MusicSpec): string {
  return hash53(JSON.stringify(canonical(normalise(spec))));
}

const LABEL = /^v(\d+)\.(\d+)$/;

/**
 * The label the next variant will get: `v1.0` for the first, then one past the highest
 * minor. The database assigns the real label (`v1.<seq − 1>`); this is the preview the
 * composer shows, and the RLS test holds the two to the same answer.
 */
export function nextVariantLabel(labels: readonly string[]): string {
  const minors = labels.flatMap((label) => {
    const match = LABEL.exec(label);
    return match && match[1] === "1" ? [Number(match[2])] : [];
  });
  return minors.length ? `v1.${Math.max(...minors) + 1}` : "v1.0";
}

/**
 * The coverage a variant records: one report per engine with a serializer. An engine whose
 * compile fails (Udio is halted and has none) gets no report, so the record is partial.
 * Reports carry no `compiledAt`; the app stamps time.
 */
export function variantCoverage(spec: MusicSpec, catalog: Catalog): Partial<Record<EngineId, CoverageReport>> {
  const reports: Partial<Record<EngineId, CoverageReport>> = {};
  for (const engine of Object.keys(SERIALIZERS) as EngineId[]) {
    const result = compile(spec, engine, catalog);
    if (result.ok) reports[engine] = result.payload.coverage;
  }
  return reports;
}

/**
 * The LN-1 blocks that stop a freeze: a variant is immutable, so an artist or producer name
 * frozen into one could only leave with the whole song. Checked against every live engine's
 * payload, the spec's prose, and the target overrides the variant would carry.
 */
export function freezeBlockers(spec: MusicSpec, catalog: Catalog, overrides: readonly TargetOverride[] = []): LintResult[] {
  const seen = new Set<string>();
  const blocks: LintResult[] = [];
  for (const engine of Object.keys(SERIALIZERS) as EngineId[]) {
    const result = compile(spec, engine, catalog);
    for (const hit of lint(spec, ENGINE_PROFILES[engine], catalog, result.ok ? result.payload : undefined, { overrides })) {
      if (hit.ruleId !== "LN-1" || hit.severity !== "block") continue;
      const key = `${hit.path}\u0000${hit.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(hit);
    }
  }
  return blocks;
}
