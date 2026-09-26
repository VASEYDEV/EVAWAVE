"use client";

/**
 * A song's variants (docs/SPEC.md §3 S6, S7): each frozen snapshot with its parent, its
 * coverage per engine, its field diff and its take log, newest first. Any variant can be
 * opened in the composer, which is how a fork starts: the next freeze from that copy takes
 * the variant as parent.
 */
import { useEffect, useMemo, useState } from "react";

import { ENGINE_PROFILES } from "@/core/musicspec/engines";
import type { Take, Variant } from "@/core/musicspec/ir/types";
import { catalog } from "@/data/taxonomy";
import { createLibraryClient } from "@/lib/library/client";
import { coverageScores, describeChange, loadSong, songAttachment, type StoredSong } from "@/lib/library/songs";

import { OpenInComposer } from "./OpenInComposer";
import { TakeLog } from "./TakeLog";
import { useViewer } from "./useViewer";

export function SongHistory({ songId }: { songId: string }) {
  const client = useMemo(() => createLibraryClient(), []);
  // The song as loaded, and for whom: it is shown only while that account is signed in.
  const [loaded, setLoaded] = useState<{ viewer: string; song: StoredSong & { variants: Variant[]; takes: Take[] } } | null>(null);
  const [status, setStatus] = useState("");
  // Bumped after a take is logged or deleted; the effect below reloads when it changes.
  const [version, setVersion] = useState(0);
  const viewer = useViewer(client);

  useEffect(() => {
    if (!viewer) return;
    let live = true;
    loadSong(client, songId, catalog).then(
      (song) => {
        if (live) setLoaded({ viewer, song });
      },
      (error: unknown) => {
        if (live) setStatus(error instanceof Error ? error.message : "Could not load the song.");
      },
    );
    return () => {
      live = false;
    };
  }, [client, songId, version, viewer]);

  // Another account's (or a signed-out) view never shows what was loaded for someone else.
  const data = loaded && loaded.viewer === viewer ? loaded.song : null;
  const labels = new Map((data?.variants ?? []).map((v) => [v.id, v.label]));
  const base = data?.song.baseVariantId ? (data.variants.find((v) => v.id === data.song.baseVariantId) ?? null) : null;

  return (
    <div className="library">
      <p role="status" aria-live="polite">
        {viewer === null ? "You are signed out. Sign in again to see this song." : data ? status : status || "Loading the song…"}
      </p>
      {data ? (
        <>
          <section className="panel" aria-labelledby="song-title">
            <h3 id="song-title">{data.song.title}</h3>
            <p className="hint">
              Saved {new Date(data.song.updatedAt).toLocaleString()} · {data.variants.length === 1 ? "1 variant" : `${data.variants.length} variants`} · working copy{" "}
              {base ? `from ${base.label}` : "not frozen yet"}
            </p>
            <div className="row-actions">
              <OpenInComposer label="Open the working copy in the composer" open={async () => ({ spec: data.song.spec, song: songAttachment(data, data.variants, base) })} onError={setStatus} />
            </div>
          </section>
          <section className="panel" aria-labelledby="variants-heading">
            <h3 id="variants-heading">Variants</h3>
            {data.variants.length ? (
              <ol className="library-list variants" reversed>
                {[...data.variants].reverse().map((variant) => {
                  const parent = variant.parentVariantId ? labels.get(variant.parentVariantId) : undefined;
                  const scores = coverageScores(variant);
                  return (
                    <li key={variant.id}>
                      <h4 className="variant-label">{variant.label}</h4>
                      <p className="hint">
                        Frozen {new Date(variant.createdAt).toLocaleString()} · {parent ? `from ${parent}` : "the first variant"}
                      </p>
                      {scores.length ? (
                        <p className="readout">
                          Coverage: {scores.map(({ engine, score }) => `${ENGINE_PROFILES[engine].displayName} ${Math.round(score * 100)}%`).join(" · ")}
                        </p>
                      ) : null}
                      {parent ? (
                        variant.diff.length ? (
                          <details>
                            <summary>
                              {variant.diff.length === 1 ? "1 change" : `${variant.diff.length} changes`} from {parent}
                            </summary>
                            <ul className="diff">
                              {variant.diff.map((change) => (
                                <li key={change.path}>
                                  <code>{change.path}</code> {describeChange(change)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <p>No changes from {parent}.</p>
                        )
                      ) : null}
                      <div className="row-actions">
                        <OpenInComposer label={`Open ${variant.label} in the composer`} open={async () => ({ spec: variant.specSnapshot, song: songAttachment(data, data.variants, variant) })} onError={setStatus} />
                      </div>
                      <TakeLog
                        client={client}
                        variantId={variant.id}
                        variantLabel={variant.label}
                        takes={data.takes.filter((t) => t.variantId === variant.id)}
                        onChanged={() => setVersion((v) => v + 1)}
                        onStatus={setStatus}
                      />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p>No variants yet. Freeze one from the composer&apos;s Song panel.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
