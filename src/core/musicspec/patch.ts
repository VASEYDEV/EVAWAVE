/**
 * `PatchOp` application with inverses (docs/SPEC.md §2.2, §2.4). Every composer edit and
 * every accepted intake patch is a list of ops on a MusicSpec, addressed by RFC 6901 JSON
 * pointers. Application is copy-on-write: the input is never mutated, and untouched
 * branches of the tree are shared with the result.
 *
 * Each applied op returns its inverse, a `set` or `remove` that restores exactly what the
 * op changed, so the undo history (history.ts) never needs a snapshot of the whole spec.
 */
import type { PatchOp } from "./ir/types";

/** Thrown for a malformed pointer or an op that does not fit the document. */
export class PatchError extends Error {
  override name = "PatchError";
}

const FORBIDDEN_TOKENS = new Set(["__proto__", "constructor", "prototype"]);

type Json = unknown;
type Container = Record<string, Json> | Json[];

/** "/D7/sections/0/label" → ["D7", "sections", "0", "label"]. */
export function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new PatchError(`pointer must start with '/': ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((token) => {
      const decoded = token.replace(/~1/g, "/").replace(/~0/g, "~");
      if (FORBIDDEN_TOKENS.has(decoded)) throw new PatchError(`pointer token '${decoded}' is not allowed`);
      return decoded;
    });
}

export function formatPointer(tokens: readonly string[]): string {
  return tokens.map((token) => `/${token.replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");
}

function isContainer(value: Json): value is Container {
  return typeof value === "object" && value !== null;
}

function isPlainObject(value: Json): value is Record<string, Json> {
  return isContainer(value) && !Array.isArray(value);
}

function arrayIndex(token: string, length: number, allowEnd: boolean): number {
  if (token === "-" && allowEnd) return length;
  if (!/^(0|[1-9]\d*)$/.test(token)) throw new PatchError(`'${token}' is not an array index`);
  const index = Number(token);
  if (index > length || (index === length && !allowEnd)) throw new PatchError(`index ${index} is out of range`);
  return index;
}

/** The value at `pointer`, or undefined when any step is missing. */
export function getAt(doc: Json, pointer: string): Json {
  let node = doc;
  for (const token of parsePointer(pointer)) {
    if (Array.isArray(node)) {
      if (!/^(0|[1-9]\d*)$/.test(token)) return undefined;
      node = node[Number(token)];
    } else if (isPlainObject(node)) {
      node = Object.prototype.hasOwnProperty.call(node, token) ? node[token] : undefined;
    } else return undefined;
  }
  return node;
}

export function hasAt(doc: Json, pointer: string): boolean {
  const tokens = parsePointer(pointer);
  if (!tokens.length) return true;
  const parent = getAt(doc, formatPointer(tokens.slice(0, -1)));
  const last = tokens[tokens.length - 1] as string;
  if (Array.isArray(parent)) return /^(0|[1-9]\d*)$/.test(last) && Number(last) < parent.length;
  return isPlainObject(parent) && Object.prototype.hasOwnProperty.call(parent, last);
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

/**
 * Rebuilds the path to `tokens`, calling `change` on the parent container copy. Missing
 * intermediate objects are created; a missing array is an error.
 */
function updateParent(doc: Json, tokens: readonly string[], change: (parent: Container, last: string) => void): Json {
  if (!tokens.length) throw new PatchError("an op cannot target the document root");
  const rebuild = (node: Json, depth: number): Json => {
    const token = tokens[depth] as string;
    if (depth === tokens.length - 1) {
      if (!isContainer(node)) throw new PatchError(`no container at ${formatPointer(tokens.slice(0, depth))}`);
      const copy: Container = Array.isArray(node) ? [...node] : { ...node };
      change(copy, token);
      return copy;
    }
    if (Array.isArray(node)) {
      const index = arrayIndex(token, node.length, false);
      const copy = [...node];
      copy[index] = rebuild(node[index], depth + 1);
      return copy;
    }
    if (isPlainObject(node)) {
      const child = Object.prototype.hasOwnProperty.call(node, token) ? node[token] : undefined;
      const next = child === undefined ? (/^(0|[1-9]\d*|-)$/.test(tokens[depth + 1] as string) ? undefined : {}) : child;
      if (next === undefined) throw new PatchError(`no array at ${formatPointer(tokens.slice(0, depth + 1))}`);
      return { ...node, [token]: rebuild(next, depth + 1) };
    }
    throw new PatchError(`no container at ${formatPointer(tokens.slice(0, depth))}`);
  };
  return rebuild(doc, 0);
}

/** The pointer of the shallowest missing step on the way to `tokens`, or null when the parent exists. */
function firstCreated(doc: Json, tokens: readonly string[]): string | null {
  for (let depth = 1; depth < tokens.length; depth++) {
    const prefix = formatPointer(tokens.slice(0, depth));
    if (!hasAt(doc, prefix)) return prefix;
  }
  return null;
}

function restoreOp(pointer: string, existed: boolean, old: Json): PatchOp {
  return existed
    ? { op: "set", path: pointer, value: clone(old), confidence: 1, rationale: "inverse" }
    : { op: "remove", path: pointer, confidence: 1, rationale: "inverse" };
}

/**
 * Applies one op and returns the new document with the op that undoes it.
 * - `set` creates or replaces (`-` appends to an array).
 * - `merge` shallow-merges a plain object into the object at the path.
 * - `append` adds the value (or each element of an array value) to the array at the path,
 *   creating it when absent.
 * - `remove` deletes a key or splices an array element.
 */
export function applyOp<T>(doc: T, op: PatchOp): { doc: T; inverse: PatchOp } {
  const applied = applyRaw(doc, op);
  // When the op created intermediate objects, undoing it removes the outermost one.
  const created = op.op === "remove" || hasAt(doc, op.path) ? null : firstCreated(doc, parsePointer(op.path));
  return created === null ? applied : { doc: applied.doc, inverse: { op: "remove", path: created, confidence: 1, rationale: "inverse" } };
}

function applyRaw<T>(doc: T, op: PatchOp): { doc: T; inverse: PatchOp } {
  const tokens = parsePointer(op.path);
  const existed = hasAt(doc, op.path);
  const old = existed ? getAt(doc, op.path) : undefined;

  switch (op.op) {
    case "set": {
      const next = updateParent(doc, tokens, (parent, last) => {
        if (Array.isArray(parent)) parent[arrayIndex(last, parent.length, true)] = clone(op.value);
        else parent[last] = clone(op.value);
      });
      const endIndex = tokens[tokens.length - 1] === "-" ? String((getAt(doc, formatPointer(tokens.slice(0, -1))) as Json[]).length) : null;
      const inversePath = endIndex === null ? op.path : formatPointer([...tokens.slice(0, -1), endIndex]);
      return { doc: next as T, inverse: restoreOp(inversePath, existed && endIndex === null, old) };
    }
    case "merge": {
      if (!isPlainObject(op.value)) throw new PatchError("merge needs a plain object value");
      if (existed && !isPlainObject(old)) throw new PatchError(`merge target ${op.path} is not an object`);
      const next = updateParent(doc, tokens, (parent, last) => {
        const base = isPlainObject(old) ? old : {};
        (parent as Record<string, Json>)[last] = { ...base, ...clone(op.value as Record<string, Json>) };
      });
      return { doc: next as T, inverse: restoreOp(op.path, existed, old) };
    }
    case "append": {
      if (existed && !Array.isArray(old)) throw new PatchError(`append target ${op.path} is not an array`);
      const items = Array.isArray(op.value) ? op.value : [op.value];
      const next = updateParent(doc, tokens, (parent, last) => {
        const base = Array.isArray(old) ? old : [];
        (parent as Record<string, Json>)[last] = [...base, ...clone(items)];
      });
      return { doc: next as T, inverse: restoreOp(op.path, existed, old) };
    }
    case "remove": {
      if (!existed) throw new PatchError(`nothing to remove at ${op.path}`);
      const parentPointer = formatPointer(tokens.slice(0, -1));
      const parentBefore = getAt(doc, parentPointer);
      const next = updateParent(doc, tokens, (parent, last) => {
        if (Array.isArray(parent)) parent.splice(arrayIndex(last, parent.length, false), 1);
        else delete parent[last];
      });
      // An array element's inverse restores the whole array, so indices stay exact.
      const inverse = Array.isArray(parentBefore) ? restoreOp(parentPointer, true, parentBefore) : restoreOp(op.path, true, old);
      return { doc: next as T, inverse };
    }
  }
}

/** Applies ops in order; the inverse list undoes them in reverse order. */
export function applyOps<T>(doc: T, ops: readonly PatchOp[]): { doc: T; inverse: PatchOp[] } {
  let current = doc;
  const inverse: PatchOp[] = [];
  for (const op of ops) {
    const applied = applyOp(current, op);
    current = applied.doc;
    inverse.unshift(applied.inverse);
  }
  return { doc: current, inverse };
}
