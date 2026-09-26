"use client";

/**
 * Composer state (docs/SPEC.md §1.5, §3 S3, S6). The working spec changes only through
 * `PatchOp`s committed to the core history, so every input is undoable and an edit after an
 * undo keeps the old branch reachable. The spec, its history and the song it is attached to
 * persist in this browser (`src/lib/composer/storage.ts`) and follow other tabs; songs and
 * their variants persist in the library.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";

import { commit, emptyHistory, jumpTo, redo, undo, type History } from "@/core/musicspec/history";
import { defaultMusicSpec } from "@/core/musicspec/ir/defaults";
import type { Catalog, MusicSpec, PatchOp } from "@/core/musicspec/ir/types";
import { PatchError } from "@/core/musicspec/patch";
import { catalog } from "@/data/taxonomy";
import { COMPOSER_KEY, parseComposer, readComposer, stillCurrent, writeComposer, type AttachmentIdentity, type SavedComposer, type SongAttachment } from "@/lib/composer/storage";

type Action =
  | { type: "edit"; ops: PatchOp[]; label: string; coalesce?: string }
  | { type: "undo" }
  | { type: "redo"; childId?: number }
  | { type: "jump"; nodeId: number }
  | { type: "load"; saved: SavedComposer | null }
  | { type: "attach"; song: SongAttachment | undefined; from: AttachmentIdentity | null };

/**
 * The working copy, and whether the saved one has been read yet. Nothing is written until it
 * has, so a tab never stores (and broadcasts) a blank copy over the saved one; kept in the
 * reducer so React's double effect run in development cannot see a stale flag.
 */
interface ComposerState {
  copy: SavedComposer;
  loaded: boolean;
}

/** The step functions return a spec and history; the attachment rides along unchanged. */
function keepSong(state: SavedComposer, step: { history: History; spec: MusicSpec }): SavedComposer {
  return state.song ? { ...step, song: state.song } : step;
}

function copyReducer(state: SavedComposer, action: Exclude<Action, { type: "load" }>): SavedComposer {
  switch (action.type) {
    case "edit":
      try {
        return keepSong(state, commit(state.history, state.spec, action.ops, action.label, action.coalesce ? { coalesce: action.coalesce } : {}));
      } catch (error) {
        // An op that does not fit the spec is dropped whole, so the spec never half-applies.
        if (error instanceof PatchError) return state;
        throw error;
      }
    case "undo":
      return keepSong(state, undo(state.history, state.spec));
    case "redo":
      return keepSong(state, redo(state.history, state.spec, action.childId));
    case "jump":
      return keepSong(state, jumpTo(state.history, state.spec, action.nodeId));
    case "attach":
      // Only onto the copy the save or freeze started from (see `stillCurrent`).
      if (!stillCurrent(state.song, action.from)) return state;
      return action.song ? { history: state.history, spec: state.spec, song: action.song } : { history: state.history, spec: state.spec };
  }
}

export interface ComposerApi {
  spec: MusicSpec;
  history: History;
  catalog: Catalog;
  /** The library song this working copy belongs to, if any. */
  song: SongAttachment | undefined;
  /**
   * Attaches the working copy to a song after a save or freeze that started from the copy
   * `from` identifies. Ignored when the copy has moved on since (another tab opened another
   * song or variant), so a late result never lands on the wrong copy.
   */
  attach(song: SongAttachment | undefined, from: AttachmentIdentity | null): void;
  /** Commits `ops` as one undo step; a `coalesce` key folds consecutive typing into it. */
  edit(ops: PatchOp[], label: string, coalesce?: string): void;
  undo(): void;
  redo(childId?: number): void;
  jumpTo(nodeId: number): void;
}

function reducer(state: ComposerState, action: Action): ComposerState {
  if (action.type === "load") return { copy: action.saved ?? state.copy, loaded: true };
  const copy = copyReducer(state.copy, action);
  return copy === state.copy ? state : { copy, loaded: state.loaded };
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

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, (): ComposerState => ({ copy: { history: emptyHistory(), spec: defaultMusicSpec() }, loaded: false }));

  // Loaded after mount so the server render and the first client render agree.
  useEffect(() => {
    dispatch({ type: "load", saved: readComposer() });
  }, []);

  useEffect(() => {
    if (state.loaded) writeComposer(state.copy);
  }, [state]);

  // Another tab saved, froze, opened a song or edited: follow it, so no tab writes back a
  // stale attachment. Writing the same value again fires no event, so tabs settle.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== COMPOSER_KEY) return;
      const saved = parseComposer(event.newValue);
      if (saved) dispatch({ type: "load", saved });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const edit = useCallback((ops: PatchOp[], label: string, coalesce?: string) => dispatch({ type: "edit", ops, label, ...(coalesce ? { coalesce } : {}) }), []);
  const api = useMemo<ComposerApi>(
    () => ({
      spec: state.copy.spec,
      history: state.copy.history,
      catalog,
      song: state.copy.song,
      attach: (song: SongAttachment | undefined, from: AttachmentIdentity | null) => dispatch({ type: "attach", song, from }),
      edit,
      undo: () => dispatch({ type: "undo" }),
      redo: (childId?: number) => dispatch({ type: "redo", ...(childId === undefined ? {} : { childId }) }),
      jumpTo: (nodeId: number) => dispatch({ type: "jump", nodeId }),
    }),
    [state, edit],
  );

  return <ComposerContext.Provider value={api}>{children}</ComposerContext.Provider>;
}
