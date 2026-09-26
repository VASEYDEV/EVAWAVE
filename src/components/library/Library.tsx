"use client";

/**
 * The library page's client side (docs/SPEC.md §1.6, §3 S4). It reads and writes through the
 * signed-in user's session; row level security scopes every query to that user.
 */
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import type { MusicSpec } from "@/core/musicspec/ir/types";
import { catalog } from "@/data/taxonomy";
import { deleteWithLocalAudio, reconcileLocalAudio } from "@/lib/audio/browser";
import { readComposer } from "@/lib/composer/storage";
import { createLibraryClient } from "@/lib/library/client";
import {
  createStyleProfile,
  createTag,
  deleteFile,
  deleteStyleProfile,
  deleteTag,
  hasFileRecord,
  loadLibrary,
  profileSpecFrom,
  setLink,
  type LibraryData,
} from "@/lib/library/repository";
import { clampProfileName } from "@/lib/library/schema";
import { deleteSong, listSongs, loadSong, songAttachment, type SongSummary } from "@/lib/library/songs";

import { OpenInComposer } from "./OpenInComposer";
import { useViewer } from "./useViewer";

/** The composer's working spec from this browser, if there is one. */
function composerSpec(): MusicSpec | null {
  return readComposer()?.spec ?? null;
}

function Links({ legend, options, selected, onToggle }: { legend: string; options: { id: string; label: string }[]; selected: readonly string[]; onToggle: (id: string, on: boolean) => void }) {
  const id = useId();
  if (!options.length) return null;
  return (
    <fieldset className="checklist">
      <legend>{legend}</legend>
      {options.map((o) => (
        <div className="field field-check" key={o.id}>
          <input id={`${id}-${o.id}`} type="checkbox" checked={selected.includes(o.id)} onChange={(e) => onToggle(o.id, e.target.checked)} />
          <label htmlFor={`${id}-${o.id}`}>{o.label}</label>
        </div>
      ))}
    </fieldset>
  );
}

export function Library() {
  const client = useMemo(() => createLibraryClient(), []);
  const viewer = useViewer(client);
  // What was loaded, and for whom: it is shown only while that account is signed in.
  const [library, setLibrary] = useState<{ viewer: string; data: LibraryData } | null>(null);
  const [songList, setSongList] = useState<{ viewer: string; songs: SongSummary[] } | null>(null);
  // The song whose delete is waiting for its second, explicit press.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [profileName, setProfileName] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [tagColour, setTagColour] = useState("#4fd6e0");
  const nameId = useId();
  const labelId = useId();
  const colourId = useId();

  // Bumped after every write; the effect below reloads when it changes.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!viewer) return;
    let live = true;
    loadLibrary(client).then(
      (loaded) => {
        if (live) setLibrary({ viewer, data: loaded });
        // Housekeeping: drop this device's copies whose record was deleted on another device.
        // A failure leaves them for the next visit.
        const known = new Set(loaded.files.map((f) => f.asset.sha256));
        void client.auth
          .getSession()
          .then(({ data: { session } }) => (session ? reconcileLocalAudio(session.user.id, known, (sha256) => hasFileRecord(client, session.user.id, sha256)) : undefined))
          .catch(() => undefined);
      },
      (error: unknown) => {
        if (live) setStatus(error instanceof Error ? error.message : "Could not load the library.");
      },
    );
    // Songs load on their own, so a failure there leaves the rest of the library usable.
    listSongs(client).then(
      (loaded) => {
        if (live) setSongList({ viewer, songs: loaded });
      },
      (error: unknown) => {
        if (live) setStatus(error instanceof Error ? error.message : "Could not load your songs.");
      },
    );
    return () => {
      live = false;
    };
  }, [client, version, viewer]);

  // Another account's (or a signed-out) view never shows what was loaded for someone else.
  const data = library && library.viewer === viewer ? library.data : null;
  const songs = songList && songList.viewer === viewer ? songList.songs : null;

  const run = async (what: string, action: () => Promise<void>) => {
    setStatus(`${what}…`);
    try {
      await action();
      setVersion((v) => v + 1);
      setStatus(`${what}: done.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${what} failed.`);
    }
  };

  const genreOptions = (data?.genres ?? []).map((g) => ({ id: g.id, label: g.name }));
  const tagOptions = (data?.tags ?? []).map((t) => ({ id: t.id, label: t.label }));

  if (viewer === null) {
    return (
      <div className="library">
        <p role="status" aria-live="polite">
          You are signed out. <Link href="/login?next=/library">Sign in</Link> again to see your library.
        </p>
      </div>
    );
  }

  return (
    <div className="library">
      <p role="status" aria-live="polite">
        {data ? status : status || "Loading your library…"}
      </p>

      <section className="panel" aria-labelledby="songs-heading">
        <h3 id="songs-heading">Songs</h3>
        <p className="hint">Keep the composer&apos;s working copy as a song, and freeze its variants, from the composer&apos;s Song panel.</p>
        {songs?.length ? (
          <ul className="library-list">
            {songs.map((s) => (
              <li key={s.id}>
                <h4>{s.title}</h4>
                <p className="hint">
                  updated {new Date(s.updatedAt).toLocaleString()} · {s.variantCount === 1 ? "1 variant" : `${s.variantCount} variants`}
                </p>
                <div className="row-actions">
                  <OpenInComposer
                    label={`Open ${s.title} in the composer`}
                    open={async () => {
                      const loaded = await loadSong(client, s.id, catalog);
                      const base = loaded.variants.find((v) => v.id === loaded.song.baseVariantId) ?? null;
                      return { spec: loaded.song.spec, song: songAttachment(loaded, loaded.variants, base) };
                    }}
                    onError={setStatus}
                  />
                  <Link href={`/songs/${s.id}`}>Variants of {s.title}</Link>
                </div>
                <div className="row-actions">
                  {confirmDelete === s.id ? (
                    <>
                      <button type="button" className="danger" onClick={() => void run("Delete song", () => deleteSong(client, s.id, s.revision)).then(() => setConfirmDelete(null))}>
                        {/* Everything the delete takes with it: the variants, and every take logged on them. */}
                        {s.variantCount
                          ? `Delete ${s.title}, its ${s.variantCount === 1 ? "variant" : `${s.variantCount} variants`} and every take logged on ${s.variantCount === 1 ? "it" : "them"}`
                          : `Delete ${s.title}`}
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)}>
                        Keep {s.title}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="danger" onClick={() => setConfirmDelete(s.id)}>
                      Delete {s.title}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>{songs ? "No songs yet." : "Loading your songs…"}</p>
        )}
      </section>

      <section className="panel" aria-labelledby="profiles-heading">
        <h3 id="profiles-heading">Style profiles</h3>
        <div className="add-row">
          <label htmlFor={nameId}>Profile name</label>
          <input id={nameId} type="text" value={profileName} onChange={(e) => setProfileName(clampProfileName(e.target.value))} />
          <button
            type="button"
            className="primary"
            disabled={!profileName.trim()}
            onClick={() => {
              const spec = composerSpec();
              if (!spec) {
                setStatus("There is no composer spec in this browser to save yet.");
                return;
              }
              void run("Save style profile", () => createStyleProfile(client, profileName.trim(), profileSpecFrom(spec), { kind: "hand-built" })).then(() => setProfileName(""));
            }}
          >
            Save the composer&apos;s current spec as a profile
          </button>
        </div>
        {data?.profiles.length ? (
          <ul className="library-list">
            {data.profiles.map((p) => (
              <li key={p.id}>
                <h4>{p.name}</h4>
                <p className="hint">
                  {p.provenance.kind} · updated {new Date(p.updatedAt).toLocaleString()}
                </p>
                <Links legend={`${p.name}: genres`} options={genreOptions} selected={p.genreIds} onToggle={(g, on) => void run("Update genres", () => setLink(client, "style_profile_genres", p.id, g, on))} />
                <Links legend={`${p.name}: tags`} options={tagOptions} selected={p.tags} onToggle={(t, on) => void run("Update tags", () => setLink(client, "style_profile_tags", p.id, t, on))} />
                <button type="button" className="danger" onClick={() => void run("Delete style profile", () => deleteStyleProfile(client, p.id))}>
                  Delete {p.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No style profiles yet.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="files-heading">
        <h3 id="files-heading">Files</h3>
        <p className="hint">Metadata only: audio and images stay on this device (A6). Deleting a record also removes its audio from this device.</p>
        {data?.files.length ? (
          <ul className="library-list">
            {data.files.map(({ asset, genreIds, tagIds }) => (
              <li key={asset.id}>
                <h4>{asset.filename}</h4>
                <p className="hint">
                  {asset.kind} · {asset.mime} · {asset.bytes.toLocaleString()} bytes
                </p>
                <Links legend={`${asset.filename}: genres`} options={genreOptions} selected={genreIds} onToggle={(g, on) => void run("Update genres", () => setLink(client, "file_genres", asset.id, g, on))} />
                <Links legend={`${asset.filename}: tags`} options={tagOptions} selected={tagIds} onToggle={(t, on) => void run("Update tags", () => setLink(client, "file_tags", asset.id, t, on))} />
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    void run("Delete file record", () => deleteWithLocalAudio({ ownerId: asset.ownerId, sha256: asset.sha256 }, () => deleteFile(client, asset.id)))
                  }
                >
                  Delete {asset.filename}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No files yet.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="tags-heading">
        <h3 id="tags-heading">Tags</h3>
        <div className="add-row">
          <label htmlFor={labelId}>Tag label</label>
          <input id={labelId} type="text" maxLength={60} value={tagLabel} onChange={(e) => setTagLabel(e.target.value)} />
          <label htmlFor={colourId}>Colour</label>
          <input id={colourId} type="color" value={tagColour} onChange={(e) => setTagColour(e.target.value)} />
          <button type="button" disabled={!tagLabel.trim()} onClick={() => void run("Create tag", () => createTag(client, tagLabel.trim(), tagColour)).then(() => setTagLabel(""))}>
            Add tag
          </button>
        </div>
        {data?.tags.length ? (
          <ul className="chips" aria-label="Your tags">
            {data.tags.map((t) => (
              <li key={t.id}>
                <span className="swatch" style={{ background: t.colour ?? "transparent" }} aria-hidden="true" />
                <span>{t.label}</span>
                <button type="button" className="chip-remove" aria-label={`Delete tag ${t.label}`} onClick={() => void run("Delete tag", () => deleteTag(client, t.id))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No tags yet.</p>
        )}
      </section>
    </div>
  );
}
