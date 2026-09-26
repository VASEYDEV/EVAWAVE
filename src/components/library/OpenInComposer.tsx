"use client";

/**
 * Opens a song, or one of its variants, as the composer's working copy (docs/SPEC.md §3 S6).
 * The copy in this browser is replaced, with a fresh undo history, so when it holds unsaved
 * work the first press only warns and a second, explicit press replaces it.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MusicSpec } from "@/core/musicspec/ir/types";
import { hasUnsavedWork, openedCopy, readComposer, writeComposer, type SongAttachment } from "@/lib/composer/storage";

export interface Opening {
  spec: MusicSpec;
  song: SongAttachment;
}

export function OpenInComposer({ label, open, onError }: { label: string; open: () => Promise<Opening>; onError: (message: string) => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!confirming && hasUnsavedWork(readComposer())) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      const { spec, song } = await open();
      // The load took a round trip, and another tab may have edited meanwhile: ask again
      // rather than replace work the first check never saw.
      if (!confirming && hasUnsavedWork(readComposer())) {
        setConfirming(true);
        setBusy(false);
        return;
      }
      writeComposer(openedCopy(spec, song));
      router.push("/");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not open it in the composer.");
      setBusy(false);
    }
  };

  return confirming ? (
    <span className="confirm">
      <span>The composer holds unsaved work, which opening this would replace.</span>
      <button type="button" className="danger" disabled={busy} onClick={() => void go()}>
        Replace the unsaved working copy
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
        Keep it
      </button>
    </span>
  ) : (
    <button type="button" disabled={busy} onClick={() => void go()}>
      {label}
    </button>
  );
}
