"use client";

/**
 * Audio import (docs/SPEC.md §1.7): import, analyse on-device, draft a patch, review it per
 * field, and build a StyleProfile with `provenance.kind = 'audio-analysis'`. Saving sends only
 * the file's metadata and the profile (A6).
 */
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";

import { applyReviewedPatch, audioProfileBase, AUDIO_DRAFT_MODEL, reviewPatch } from "@/core/musicspec/intake";
import type { StyleProfile } from "@/core/musicspec/ir/types";
import { lintStyleProfile, lowConfidenceOps } from "@/core/musicspec/lint";
import { catalog } from "@/data/taxonomy";
import { browserImportDeps, storeInOpfs } from "@/lib/audio/browser";
import { importAudio, type ImportResult } from "@/lib/audio/import";
import { createLibraryClient } from "@/lib/library/client";
import { saveImport } from "@/lib/library/repository";
import { PROFILE_NAME_MAX, profileName } from "@/lib/library/schema";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

function formatSec(sec: number): string {
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => (typeof v === "object" && v && "value" in v ? String((v as { value: unknown }).value) : describe(v))).join(", ");
  if (typeof value === "object" && value !== null) return Object.entries(value).map(([k, v]) => `${k}: ${describe(v)}`).join(", ");
  return String(value);
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AudioImport() {
  const inputId = useId();
  const nameId = useId();
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<File | null>(null);
  // A newer file choice aborts the import in flight, so its analysis never lands.
  const inFlight = useRef<AbortController | null>(null);
  // Leaving the page aborts it too, which terminates the analysis worker.
  useEffect(() => {
    const flight = inFlight;
    return () => flight.current?.abort();
  }, []);

  const lowConfidence = useMemo(() => new Set(result ? lowConfidenceOps(result.patch, "").map((r) => Number(r.path.split("/").pop())) : []), [result]);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setResult(null);
    setProfile(null);
    setSource(null);
    setStatus(`Analysing ${file.name} on this device…`);
    // Let the status paint before the analysis takes the main thread.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const imported = await importAudio(file, { ...browserImportDeps, lineageNames: catalog.lineageNames }, controller.signal);
      if (controller.signal.aborted) return;
      setResult(imported);
      setSource(file);
      setAccepted(new Set(imported.patch.ops.filter((o) => o.confidence >= 0.5).map((o) => o.path)));
      setName(file.name.replace(/\.[^.]+$/, ""));
      setStatus(`Analysed ${file.name} on this device. Review the proposed fields below; nothing is kept until you save or download a profile.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(`Could not analyse ${file.name}: ${error instanceof Error ? error.message : "unknown error"}. Try a WAV, MP3, AAC or FLAC file.`);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handle(event.dataTransfer.files[0]);
  };

  const createProfile = () => {
    if (!result) return;
    const reviewed = reviewPatch(result.patch, accepted);
    const { doc } = applyReviewedPatch(audioProfileBase(), reviewed);
    setProfile({
      // Made here, so saving the same profile twice upserts one library row.
      id: crypto.randomUUID(),
      ownerId: "local",
      name: profileName(name, result.asset.filename),
      provenance: { kind: "audio-analysis", sourceRef: result.asset.sha256, analysedOn: result.analysedOn, model: AUDIO_DRAFT_MODEL },
      spec: doc,
      features: result.features,
      genreIds: [],
      tags: [],
      createdAt: result.analysedOn,
      updatedAt: result.analysedOn,
    });
    setStatus(`Style profile created from ${reviewed.acceptedPaths.length} accepted field(s). Save it to the library or download it to keep it and its audio.`);
  };

  /**
   * Keeps the blob on the device (§1.7, A6). Called only once something durable refers to
   * it, a library row or a downloaded profile, so no stored blob is ever unreachable.
   */
  const keepAudio = async (sha256: string, file: File): Promise<string> =>
    (await storeInOpfs(sha256, file)) === "opfs" ? "in this browser's private storage" : "in memory for this tab only";

  const downloadProfile = async () => {
    if (!result || !profile || !source) return;
    const current = inFlight.current;
    // Download first, inside the click, so the browser keeps it tied to the gesture.
    download(`${profile.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "profile"}-style-profile.json`, `${JSON.stringify(profile, null, 2)}\n`);
    const where = await keepAudio(result.asset.sha256, source);
    if (inFlight.current === current) setStatus(`Downloaded "${profile.name}". The audio stays ${where}.`);
  };

  const save = async () => {
    if (!result || !profile || !source) return;
    const current = inFlight.current;
    if (!getSupabasePublicConfig()) {
      setStatus("The library needs Supabase, which is not configured here. Download the profile instead.");
      return;
    }
    try {
      const client = createLibraryClient();
      const { data } = await client.auth.getSession();
      if (!data.session) {
        setStatus("Sign in to save to your library (Library → Sign in).");
        return;
      }
      const { asset, features, analysedOn } = result;
      await saveImport(client, {
        file: { filename: asset.filename, mime: asset.mime, bytes: asset.bytes, sha256: asset.sha256, features },
        profile: { id: profile.id, name: profile.name, spec: profile.spec, analysedOn, model: AUDIO_DRAFT_MODEL },
      });
      const where = await keepAudio(asset.sha256, source);
      if (inFlight.current === current) setStatus(`Saved "${profile.name}" and the file's metadata to your library. The audio stays ${where}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Saving failed.");
    }
  };

  const f = result?.features;
  const badges = profile ? lintStyleProfile(profile) : [];

  return (
    <div className="import">
      <div
        className={`dropzone${dragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <label htmlFor={inputId}>Choose an audio file, or drop one here</label>
        <input id={inputId} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg" onChange={(e) => void handle(e.target.files?.[0])} />
      </div>
      <p role="status" aria-live="polite">
        {status}
      </p>

      {f ? (
        <section className="panel" aria-labelledby="features-heading">
          <h3 id="features-heading">Measured on this device</h3>
          <dl className="features">
            <dt>Duration</dt>
            <dd>{formatSec(f.durationSec)}</dd>
            <dt>Tempo</dt>
            <dd>
              {f.bpm.value ? `${f.bpm.value.toFixed(1)} BPM (half ${f.bpm.halfTimeCandidate.toFixed(1)}, double ${f.bpm.doubleTimeCandidate.toFixed(1)}), ${Math.round(f.bpm.confidence * 100)}% confident` : "no steady pulse found"}
            </dd>
            <dt>Meter</dt>
            <dd>
              {f.meter.signature} ({Math.round(f.meter.confidence * 100)}%)
            </dd>
            <dt>Key</dt>
            <dd>
              {f.key.tonic} {f.key.mode} ({Math.round(f.key.confidence * 100)}%)
            </dd>
            <dt>Loudness</dt>
            <dd>
              {f.loudness.integratedLufs.toFixed(1)} LUFS integrated, {f.loudness.loudnessRange.toFixed(1)} LU range
            </dd>
            <dt>Sections</dt>
            <dd>{f.sections.length} by energy</dd>
            <dt>Spectrum</dt>
            <dd>
              centroid {Math.round(f.spectral.centroidHz)} Hz, brightness {Math.round(f.spectral.brightness * 100)}%, sub {Math.round(f.spectral.subWeight * 100)}%, {f.spectral.transientDensity.toFixed(1)} onsets/s
            </dd>
          </dl>
        </section>
      ) : null}

      {result ? (
        <section className="panel" aria-labelledby="review-heading">
          <h3 id="review-heading">Review the proposed profile</h3>
          <p className="hint">Nothing applies until you accept it. Low-confidence suggestions start unticked.</p>
          <ul className="review" aria-label={`Proposed fields (${result.patch.ops.length})`}>
            {result.patch.ops.map((o, i) => {
              const id = `${inputId}-op-${i}`;
              return (
                <li key={o.path} className="review-item">
                  <div className="field field-check">
                    <input
                      id={id}
                      type="checkbox"
                      checked={accepted.has(o.path)}
                      onChange={(e) =>
                        setAccepted((current) => {
                          const next = new Set(current);
                          if (e.target.checked) next.add(o.path);
                          else next.delete(o.path);
                          return next;
                        })
                      }
                    />
                    <label htmlFor={id}>
                      Accept <code>{o.path}</code>
                    </label>
                  </div>
                  <dl className="features">
                    <dt>Proposed</dt>
                    <dd>{describe(o.value)}</dd>
                    <dt>Confidence</dt>
                    <dd>
                      {Math.round(o.confidence * 100)}%{lowConfidence.has(i) ? <span className="badge"> · low confidence</span> : null}
                    </dd>
                    <dt>Why</dt>
                    <dd>{o.rationale}</dd>
                  </dl>
                </li>
              );
            })}
          </ul>
          <div className="add-row">
            <label htmlFor={nameId}>Profile name</label>
            <input id={nameId} type="text" maxLength={PROFILE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" onClick={createProfile}>
              Create style profile
            </button>
          </div>
        </section>
      ) : null}

      {profile ? (
        <section className="panel" aria-labelledby="profile-heading" data-testid="profile">
          <h3 id="profile-heading">{profile.name}</h3>
          <dl className="features">
            <dt>Provenance</dt>
            <dd data-testid="provenance">{profile.provenance.kind}</dd>
            <dt>Tempo</dt>
            <dd data-testid="profile-tempo">
              {profile.spec.D6?.tempo.bpm} BPM ({profile.spec.D6?.tempo.source})
            </dd>
            <dt>Key</dt>
            <dd>
              {profile.spec.D6?.key.tonic} {catalog.modes[profile.spec.D6?.key.modeId ?? ""]?.name ?? profile.spec.D6?.key.modeId}
            </dd>
          </dl>
          {badges.map((b) => (
            <p key={b.ruleId} className="badge">
              {b.ruleId}: {b.message}
            </p>
          ))}
          <div className="row-actions">
            <button type="button" onClick={() => void save()}>
              Save to library
            </button>
            <button type="button" onClick={() => void downloadProfile()}>
              Download profile JSON
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
