import type { IRPatch, PatchOp } from "./types";

/**
 * `applyPatch` is the only mutation path for intake (BUILD-BRIEF §2; IR v0.3 delta §5).
 *
 * - A patch with `status: 'proposed'` never touches the working spec: every op is skipped.
 * - Ops apply in order. An op applies only when its `path` is an exact member of
 *   `acceptedPaths`; the review diff accepts ops by path, so anything else is a no-op.
 * - PT-2: an op whose first token is `references` or `patches` is refused even when
 *   accepted, because patches may not edit provenance.
 * - Paths are RFC 6901 JSON pointers (`~1` = `/`, `~0` = `~`). Array tokens are digits or `-`
 *   (one past the end). `__proto__`, `constructor` and `prototype` are refused: values come
 *   from an LLM.
 * - `set` creates or replaces the target. A missing intermediate object is created, because a
 *   v0.2 document has no `tempo` yet and the delta's own example is `/D6/tempo/bpm`; a
 *   missing array parent is an invalid path. `merge` shallow-merges a plain object into a
 *   plain object (or an absent target). `append` concatenates onto an array (created when
 *   absent): an array value contributes its elements, anything else one element. `remove`
 *   deletes a key or splices an index; an absent target is an invalid path.
 * - The input spec is never mutated. Containers on the path are copied; everything else is
 *   shared with the input.
 *
 * The result reports every op as applied or skipped with a reason, which is what the
 * PatchReviewDiff needs. Skip reasons are checked in this order: `proposed-patch`,
 * `invalid-path`, `protected-path`, `not-accepted`, then `type-mismatch` from the op itself.
 */

/** PT-2: roots that patches may never edit. */
export const PROTECTED_ROOTS = ["references", "patches"] as const;

/** Property names that would reach `Object.prototype`. */
const FORBIDDEN_TOKENS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;

export type PatchSkipReason = "proposed-patch" | "invalid-path" | "protected-path" | "not-accepted" | "type-mismatch";

export interface SkippedOp {
  op: PatchOp;
  reason: PatchSkipReason;
}

export interface ApplyPatchResult<T> {
  /** The input spec when nothing applied, otherwise a new object sharing untouched subtrees with the input. */
  spec: T;
  applied: PatchOp[];
  skipped: SkippedOp[];
}

type JsonObject = Record<string, unknown>;
type Step = { ok: true; value: unknown } | { ok: false; reason: "invalid-path" | "type-mismatch" };

const INVALID_PATH: Step = { ok: false, reason: "invalid-path" };
const TYPE_MISMATCH: Step = { ok: false, reason: "type-mismatch" };

/**
 * Splits an RFC 6901 pointer into reference tokens: `/a/b~1c` → `["a", "b/c"]`. Returns null
 * for the whole-document pointer `""`, a pointer without a leading `/`, or a bad escape.
 */
export function parsePointer(path: string): string[] | null {
  if (path === "" || !path.startsWith("/")) {
    return null;
  }
  const tokens: string[] = [];
  for (const raw of path.slice(1).split("/")) {
    if (/~(?![01])/.test(raw)) {
      return null;
    }
    // ~1 first, then ~0, so "~01" decodes to "~1" and not to "/".
    tokens.push(raw.replaceAll("~1", "/").replaceAll("~0", "~"));
  }
  return tokens;
}

function isPlainObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isIndexToken(token: string): boolean {
  return token === "-" || ARRAY_INDEX.test(token);
}

/** Resolves an array token; `-` and `length` mean "one past the end" and are valid only when `allowEnd`. */
function parseIndex(token: string, length: number, allowEnd: boolean): number | null {
  if (token === "-") {
    return allowEnd ? length : null;
  }
  if (!ARRAY_INDEX.test(token)) {
    return null;
  }
  const index = Number(token);
  if (index < length || (allowEnd && index === length)) {
    return index;
  }
  return null;
}

function readChild(parent: unknown, key: string): unknown {
  if (Array.isArray(parent)) {
    const index = parseIndex(key, parent.length, false);
    return index === null ? undefined : parent[index];
  }
  if (isPlainObject(parent) && Object.hasOwn(parent, key)) {
    return parent[key];
  }
  return undefined;
}

/** A copy of `parent` with `key` set to `value`. A missing parent becomes an object unless the key names an array slot. */
function writeChild(parent: unknown, key: string, value: unknown): Step {
  if (Array.isArray(parent)) {
    const index = parseIndex(key, parent.length, true);
    if (index === null) {
      return INVALID_PATH;
    }
    const copy = parent.slice();
    copy[index] = value;
    return { ok: true, value: copy };
  }
  if (parent === undefined) {
    return isIndexToken(key) ? INVALID_PATH : { ok: true, value: { [key]: value } };
  }
  if (isPlainObject(parent)) {
    return { ok: true, value: { ...parent, [key]: value } };
  }
  return INVALID_PATH;
}

function removeChild(parent: unknown, key: string): Step {
  if (Array.isArray(parent)) {
    const index = parseIndex(key, parent.length, false);
    if (index === null) {
      return INVALID_PATH;
    }
    return { ok: true, value: [...parent.slice(0, index), ...parent.slice(index + 1)] };
  }
  if (isPlainObject(parent) && Object.hasOwn(parent, key)) {
    return { ok: true, value: Object.fromEntries(Object.entries(parent).filter(([name]) => name !== key)) };
  }
  return INVALID_PATH;
}

function applyOp(parent: unknown, key: string, op: PatchOp): Step {
  switch (op.op) {
    case "set":
      return op.value === undefined ? TYPE_MISMATCH : writeChild(parent, key, op.value);
    case "merge": {
      if (!isPlainObject(op.value)) {
        return TYPE_MISMATCH;
      }
      const target = readChild(parent, key);
      if (target !== undefined && !isPlainObject(target)) {
        return TYPE_MISMATCH;
      }
      return writeChild(parent, key, { ...(target ?? {}), ...op.value });
    }
    case "append": {
      if (op.value === undefined) {
        return TYPE_MISMATCH;
      }
      const target = readChild(parent, key);
      if (target !== undefined && !Array.isArray(target)) {
        return TYPE_MISMATCH;
      }
      const items: unknown[] = Array.isArray(op.value) ? op.value : [op.value];
      return writeChild(parent, key, [...(target ?? []), ...items]);
    }
    case "remove":
      return removeChild(parent, key);
  }
}

/** Walks to the op's parent container, applies the op there, and rebuilds the path copy-on-write. */
function descend(node: unknown, tokens: readonly string[], depth: number, op: PatchOp): Step {
  const token = tokens[depth];
  if (token === undefined) {
    return INVALID_PATH;
  }
  if (depth === tokens.length - 1) {
    return applyOp(node, token, op);
  }
  if (Array.isArray(node)) {
    const index = parseIndex(token, node.length, false);
    if (index === null) {
      return INVALID_PATH;
    }
    const inner = descend(node[index], tokens, depth + 1, op);
    if (!inner.ok) {
      return inner;
    }
    const copy = node.slice();
    copy[index] = inner.value;
    return { ok: true, value: copy };
  }
  if (node === undefined) {
    if (isIndexToken(token)) {
      return INVALID_PATH;
    }
    const inner = descend(undefined, tokens, depth + 1, op);
    return inner.ok ? { ok: true, value: { [token]: inner.value } } : inner;
  }
  if (isPlainObject(node)) {
    const inner = descend(Object.hasOwn(node, token) ? node[token] : undefined, tokens, depth + 1, op);
    return inner.ok ? { ok: true, value: { ...node, [token]: inner.value } } : inner;
  }
  return INVALID_PATH;
}

/**
 * Applies the accepted ops of `patch` to `spec` and returns the new spec with a per-op
 * report. `T` is the caller's spec type; ops add or change fields inside it, so the result
 * is presented as the same type. Validate with the schemas after applying.
 */
export function applyPatch<T extends object>(spec: T, patch: IRPatch, acceptedPaths: readonly string[]): ApplyPatchResult<T> {
  if (patch.status === "proposed") {
    return { spec, applied: [], skipped: patch.ops.map((op) => ({ op, reason: "proposed-patch" as const })) };
  }
  const accepted = new Set(acceptedPaths);
  const applied: PatchOp[] = [];
  const skipped: SkippedOp[] = [];
  let current: unknown = spec;
  for (const op of patch.ops) {
    const tokens = parsePointer(op.path);
    if (tokens === null || tokens.some((token) => FORBIDDEN_TOKENS.has(token))) {
      skipped.push({ op, reason: "invalid-path" });
      continue;
    }
    const [root] = tokens;
    if (root !== undefined && (PROTECTED_ROOTS as readonly string[]).includes(root)) {
      skipped.push({ op, reason: "protected-path" });
      continue;
    }
    if (!accepted.has(op.path)) {
      skipped.push({ op, reason: "not-accepted" });
      continue;
    }
    const step = descend(current, tokens, 0, op);
    if (!step.ok) {
      skipped.push({ op, reason: step.reason });
      continue;
    }
    current = step.value;
    applied.push(op);
  }
  return { spec: current as T, applied, skipped };
}
