"use client";

/**
 * The composer's song panel (docs/SPEC.md §3 S6): keep the working copy as a library song,
 * save it, and freeze it as the next immutable variant. It needs Supabase and a session;
 * without either it says so, and the composer keeps working in this browser.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { nextVariantLabel, specHash } from "@/core/musicspec/variants";
import type { SongAttachment } from "@/lib/composer/storage";
import { createLibraryClient } from "@/lib/library/client";
import { createSong, freezeVariant, saveSong, songTitle } from "@/lib/library/songs";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

import { useComposer } from "./state";

type Setup = "ready" | "absent" | "partial";

/** Supabase's public settings, read the same way on the server render and in the browser. */
function supabaseSetup(): Setup {
  try {
    return getSupabasePublicConfig() ? "ready" : "absent";
  } catch {
    return "partial";
  }
}

export function SongPanel() {
  const { spec, catalog, song, attach } = useComposer();
  const setup = supabaseSetup();
  const client = useMemo(() => (setup === "ready" ? createLibraryClient() : null), [setup]);
  // undefined while the session is being checked, null when signed out.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.auth.getSession().then(
      ({ data }) => {
        if (live) setUserId(data.session?.user.id ?? null);
      },
      () => {
        if (live) setUserId(null);
      },
    );
    const { data } = client.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  /** Runs a library action, reporting its outcome in the panel's live line. */
  const run = async (what: string, action: (library: NonNullable<typeof client>) => Promise<string>) => {
    if (!client) return;
    setBusy(true);
    setStatus(`${what}…`);
    try {
      setStatus(await action(client));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${what} failed.`);
    } finally {
      setBusy(false);
    }
  };

  const saveAsNew = () =>
    run("Saving as a new song", async (library) => {
      // The copy as it is now: edits made while the request runs stay unsaved.
      const saving = spec;
      const created = await createSong(library, saving);
      attach({
        songId: created.song.id,
        ownerId: created.song.ownerId,
        title: created.song.title,
        revision: created.revision,
        savedHash: specHash(saving),
        baseVariantId: null,
        baseLabel: null,
        variantLabels: [],
      });
      return `Saved as a new song: ${created.song.title}.`;
    });

  const save = (attached: SongAttachment) =>
    run("Saving the song", async (library) => {
      const saving = spec;
      // Overrides are not edited anywhere yet (SPEC §1.4), so the working copy carries none.
      const revision = await saveSong(library, { songId: attached.songId, revision: attached.revision, spec: saving, overrides: [], baseVariantId: attached.baseVariantId });
      attach({ ...attached, title: songTitle(saving), revision, savedHash: specHash(saving) });
      return "Saved.";
    });

  const freeze = (attached: SongAttachment) =>
    run("Freezing a variant", async (library) => {
      const freezing = spec;
      const frozen = await freezeVariant(library, { songId: attached.songId, revision: attached.revision, spec: freezing, overrides: [], baseVariantId: attached.baseVariantId }, catalog);
      attach({
        ...attached,
        title: songTitle(freezing),
        revision: frozen.revision,
        savedHash: specHash(freezing),
        baseVariantId: frozen.variantId,
        baseLabel: frozen.label,
        variantLabels: [...attached.variantLabels, frozen.label],
      });
      return `Frozen as ${frozen.label}.`;
    });

  let body: ReactNode;
  if (setup === "absent") {
    body = <p>Songs need Supabase, which is not configured for this deployment. This working copy stays in this browser.</p>;
  } else if (setup === "partial") {
    body = <p>Songs are unavailable: Supabase is only partly configured for this deployment. This working copy stays in this browser.</p>;
  } else if (userId === undefined) {
    body = <p>Checking your sign-in…</p>;
  } else if (userId === null) {
    body = (
      <p>
        <Link href="/login?next=/">Sign in</Link> to keep this working copy as a song, with its variants.
      </p>
    );
  } else if (!song || song.ownerId !== userId) {
    body = (
      <>
        <p>
          {song ? "This working copy came from another account's song. " : "Not saved as a song yet. "}
          It would be saved as <strong>{songTitle(spec)}</strong>.
        </p>
        <div className="row-actions">
          <button type="button" className="primary" disabled={busy} onClick={() => void saveAsNew()}>
            Save as new song
          </button>
        </div>
      </>
    );
  } else {
    const unsaved = specHash(spec) !== song.savedHash;
    const next = nextVariantLabel(song.variantLabels);
    body = (
      <>
        <p>
          <strong>{song.title}</strong>
        </p>
        <p className="readout">
          {unsaved ? "Unsaved changes" : "Saved"} · {song.baseLabel ? `from ${song.baseLabel}` : "no variant yet"}
        </p>
        <div className="row-actions">
          <button type="button" className="primary" disabled={busy || !unsaved} onClick={() => void save(song)}>
            Save song
          </button>
          <button type="button" disabled={busy} onClick={() => void freeze(song)}>
            Freeze as {next}
          </button>
          <button type="button" disabled={busy} onClick={() => void saveAsNew()}>
            Save as new song
          </button>
        </div>
        <p>
          <Link href={`/songs/${song.songId}`}>Variants of {song.title}</Link>
        </p>
      </>
    );
  }

  return (
    <section className="panel" aria-labelledby="song-heading">
      <h2 id="song-heading">Song</h2>
      {body}
      <p aria-live="polite">{status}</p>
    </section>
  );
}
