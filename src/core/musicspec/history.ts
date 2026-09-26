/**
 * Non-destructive undo/redo (docs/SPEC.md §3, S3). The history is an append-only tree of
 * edits. Each node holds the `PatchOp`s it applied and their inverses. Undo and redo move a
 * cursor. An edit after an undo starts a new branch, and the undone branch stays reachable:
 * nothing is ever deleted, and `jumpTo` reaches any node.
 *
 * Pure: the functions return new history and spec values and never mutate their inputs.
 */
import type { PatchOp } from "./ir/types";
import { applyOps } from "./patch";

export interface HistoryNode {
  id: number;
  /** Null only for the root, which stands for the starting spec. */
  parent: number | null;
  label: string;
  ops: PatchOp[];
  inverse: PatchOp[];
  /** Child ids in creation order; the last one is the redo default. */
  children: number[];
  /** Set while a node may absorb further typing into the same field (see `coalesce`). */
  coalesceKey?: string;
}

export interface History {
  nodes: HistoryNode[];
  cursor: number;
}

export interface Step<T> {
  history: History;
  spec: T;
}

export function emptyHistory(): History {
  return { nodes: [{ id: 0, parent: null, label: "Start", ops: [], inverse: [], children: [] }], cursor: 0 };
}

function node(history: History, id: number): HistoryNode {
  const found = history.nodes[id];
  if (!found || found.id !== id) throw new Error(`history has no node ${id}`);
  return found;
}

/** The node without its coalesce key: once the user moves on, it never absorbs more typing. */
function sealed(n: HistoryNode): HistoryNode {
  return { id: n.id, parent: n.parent, label: n.label, ops: n.ops, inverse: n.inverse, children: n.children };
}

function replaceNode(history: History, next: HistoryNode): HistoryNode[] {
  return history.nodes.map((n) => (n.id === next.id ? next : n));
}

export interface CommitOptions {
  /**
   * Typing into one field should be one undo step. When the cursor node is a leaf created
   * with the same key, the new ops are folded into it: its ops become the latest ones and
   * its inverse keeps the value from before the first keystroke.
   */
  coalesce?: string;
}

/** Applies `ops` as a new node under the cursor (or folds them in; see `CommitOptions`). */
export function commit<T>(history: History, spec: T, ops: readonly PatchOp[], label: string, options: CommitOptions = {}): Step<T> {
  if (!ops.length) return { history, spec };
  const current = node(history, history.cursor);
  if (options.coalesce && current.coalesceKey === options.coalesce && current.children.length === 0) {
    const reverted = applyOps(spec, current.inverse).doc;
    const applied = applyOps(reverted, [...current.ops, ...ops]);
    // The folded node keeps the inverse of the combined edit from the original state.
    const merged: HistoryNode = { ...current, ops: [...current.ops, ...ops], inverse: applied.inverse };
    return { history: { nodes: replaceNode(history, merged), cursor: current.id }, spec: applied.doc };
  }
  const applied = applyOps(spec, ops);
  const id = history.nodes.length;
  const created: HistoryNode = { id, parent: current.id, label, ops: [...ops], inverse: applied.inverse, children: [] };
  if (options.coalesce) created.coalesceKey = options.coalesce;
  const parent = sealed({ ...current, children: [...current.children, id] });
  return { history: { nodes: [...replaceNode(history, parent), created], cursor: id }, spec: applied.doc };
}

export function canUndo(history: History): boolean {
  return node(history, history.cursor).parent !== null;
}

export function canRedo(history: History): boolean {
  return node(history, history.cursor).children.length > 0;
}

/** Steps back to the cursor's parent. A no-op at the root. */
export function undo<T>(history: History, spec: T): Step<T> {
  const current = node(history, history.cursor);
  if (current.parent === null) return { history, spec };
  return { history: { nodes: replaceNode(history, sealed(current)), cursor: current.parent }, spec: applyOps(spec, current.inverse).doc };
}

/** Steps forward to a child: `childId`, or the most recently created one. A no-op at a leaf. */
export function redo<T>(history: History, spec: T, childId?: number): Step<T> {
  const current = node(history, history.cursor);
  const target = childId ?? current.children[current.children.length - 1];
  if (target === undefined) return { history, spec };
  if (!current.children.includes(target)) throw new Error(`node ${target} is not a child of the cursor`);
  return { history: { ...history, cursor: target }, spec: applyOps(spec, node(history, target).ops).doc };
}

function pathToRoot(history: History, id: number): number[] {
  const path: number[] = [];
  for (let at: number | null = id; at !== null; at = node(history, at).parent) path.push(at);
  return path;
}

/** Moves the cursor to any node: undo up to the common ancestor, then redo down. */
export function jumpTo<T>(history: History, spec: T, targetId: number): Step<T> {
  node(history, targetId);
  const targetPath = pathToRoot(history, targetId);
  let step: Step<T> = { history, spec };
  while (!targetPath.includes(step.history.cursor)) step = undo(step.history, step.spec);
  const down = targetPath.slice(0, targetPath.indexOf(step.history.cursor)).reverse();
  for (const id of down) step = redo(step.history, step.spec, id);
  return step;
}

/** Nodes with no children: the tips of every branch, the current one included. */
export function branchTips(history: History): HistoryNode[] {
  return history.nodes.filter((n) => n.children.length === 0 && n.parent !== null);
}
