"use client";

/**
 * Composer state (docs/SPEC.md §1.5, §3 S3). The working spec changes only through
 * `PatchOp`s committed to the core history, so every input is undoable and an edit after an
 * undo keeps the old branch reachable. The spec and its history persist in localStorage
 * until the S4 library lands.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";

import { commit, emptyHistory, jumpTo, redo, undo, type History, type Step } from "@/core/musicspec/history";
import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import type { Catalog, MusicSpec, PatchOp } from "@/core/musicspec/ir/types";
import { PatchError } from "@/core/musicspec/patch";
import { catalog } from "@/data/taxonomy";

const STORAGE_KEY = "evawave:composer:v1";

type Action =
  | { type: "edit"; ops: PatchOp[]; label: string; coalesce?: string }
  | { type: "undo" }
  | { type: "redo"; childId?: number }
  | { type: "jump"; nodeId: number }
  | { type: "load"; step: Step<MusicSpec> };

function reducer(state: Step<MusicSpec>, action: Action): Step<MusicSpec> {
  switch (action.type) {
    case "edit":
      try {
        return commit(state.history, state.spec, action.ops, action.label, action.coalesce ? { coalesce: action.coalesce } : {});
      } catch (error) {
        // An op that does not fit the spec is dropped whole, so the spec never half-applies.
        if (error instanceof PatchError) return state;
        throw error;
      }
    case "undo":
      return undo(state.history, state.spec);
    case "redo":
      return redo(state.history, state.spec, action.childId);
    case "jump":
      return jumpTo(state.history, state.spec, action.nodeId);
    case "load":
      return action.step;
  }
}

export interface ComposerApi {
  spec: MusicSpec;
  history: History;
  catalog: Catalog;
  /** Commits `ops` as one undo step; a `coalesce` key folds consecutive typing into it. */
  edit(ops: PatchOp[], label: string, coalesce?: string): void;
  undo(): void;
  redo(childId?: number): void;
  jumpTo(nodeId: number): void;
}

const ComposerContext = createContext<ComposerApi | null>(null);

export function useComposer(): ComposerApi {
  const api = useContext(ComposerContext);
  if (!api) throw new Error("useComposer must be used inside <ComposerProvider>");
  return api;
}

/** A composer edit: the rationale records that a person made it in the UI. */
export function op(kind: PatchOp["op"], path: string, value?: unknown): PatchOp {
  return kind === "remove" ? { op: kind, path, confidence: 1, rationale: "composer edit" } : { op: kind, path, value, confidence: 1, rationale: "composer edit" };
}

function isStep(value: unknown): value is Step<MusicSpec> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { spec?: { irVersion?: unknown }; history?: { nodes?: unknown; cursor?: unknown } };
  return v.spec?.irVersion === 1 && Array.isArray(v.history?.nodes) && typeof v.history?.cursor === "number";
}

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ history: emptyHistory(), spec: defaultMusicSpec() }));

  // Loaded after mount so the server render and the first client render agree.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      if (isStep(parsed)) dispatch({ type: "load", step: parsed });
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the composer still works.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Persisting is a convenience until S4; a full or blocked store must not break editing.
    }
  }, [state]);

  const edit = useCallback((ops: PatchOp[], label: string, coalesce?: string) => dispatch({ type: "edit", ops, label, ...(coalesce ? { coalesce } : {}) }), []);
  const api = useMemo<ComposerApi>(
    () => ({
      spec: state.spec,
      history: state.history,
      catalog,
      edit,
      undo: () => dispatch({ type: "undo" }),
      redo: (childId?: number) => dispatch({ type: "redo", ...(childId === undefined ? {} : { childId }) }),
      jumpTo: (nodeId: number) => dispatch({ type: "jump", nodeId }),
    }),
    [state, edit],
  );

  return <ComposerContext.Provider value={api}>{children}</ComposerContext.Provider>;
}
