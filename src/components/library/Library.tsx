"use client";

/**
 * The library page's client side (docs/SPEC.md §1.6, §3 S4). It reads and writes through the
 * signed-in user's session; row level security scopes every query to that user.
 */
import { useEffect, useId, useMemo, useState } from "react";

import type { MusicSpec } from "@/core/musicspec/ir/types";
import { createLibraryClient } from "@/lib/library/client";
import {
  createStyleProfile,
  createTag,
  deleteFile,
  deleteStyleProfile,
  deleteTag,
  loadLibrary,
  profileSpecFrom,
  setLink,
  type LibraryData,
} from "@/lib/library/repository";

const COMPOSER_KEY = "evawave:composer:v1";

/** The composer's working spec from this browser, if there is one. */
function composerSpec(): MusicSpec | null {
  try {
    const saved = window.localStorage.getItem(COMPOSER_KEY);
    const parsed = saved ? (JSON.parse(saved) as { spec?: MusicSpec }) : null;
    return parsed?.spec?.irVersion === 1 ? parsed.spec : null;
  } catch {
    return null;
  }
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
  const [data, setData] = useState<LibraryData | null>(null);
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
    let live = true;
    loadLibrary(client).then(
      (loaded) => {
        if (live) setData(loaded);
      },
      (error: unknown) => {
        if (live) setStatus(error instanceof Error ? error.message : "Could not load the library.");
      },
    );
    return () => {
      live = false;
    };
  }, [client, version]);

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

  return (
    <div className="library">
      <p role="status" aria-live="polite">
        {data ? status : status || "Loading your library…"}
      </p>

      <section className="panel" aria-labelledby="profiles-heading">
        <h3 id="profiles-heading">Style profiles</h3>
        <div className="add-row">
          <label htmlFor={nameId}>Profile name</label>
          <input id={nameId} type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
          <button
            type="button"
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
        <p className="hint">Metadata only: audio and images stay on this device (A6). Audio import arrives in S5.</p>
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
                <button type="button" className="danger" onClick={() => void run("Delete file record", () => deleteFile(client, asset.id))}>
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
