"use client";

/**
 * Audio import (docs/SPEC.md §1.7): import, analyse on-device, draft a patch, review it per
 * field, and build a StyleProfile with `provenance.kind = 'audio-analysis'`. Saving sends only
 * the file's metadata and the profile (A6).
 */
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";

import { AUDIO_DRAFT_MODEL } from "@/core/musicspec/intake";
import { lintStyleProfile, lowConfidenceOps } from "@/core/musicspec/lint";
import { catalog } from "@/data/taxonomy";
import { browserImportDeps, inTurnForLocalAudio, keepAudioFor } from "@/lib/audio/browser";
import { importAudio, ImportLengthUnknownError, ImportTooLargeError, ImportTooLongError, profileFromReview, type ImportResult } from "@/lib/audio/import";
import { createLibraryClient } from "@/lib/library/client";
import { saveImportAndKeepAudio } from "@/lib/library/repository";
import { clampProfileName, recordFilename, recordMime } from "@/lib/library/schema";
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
  // Set by Create. The profile itself is derived from the current review and name, so an
  // edit after Create reaches what Save and Download send.
  const [profileId, setProfileId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<File | null>(null);
  // A newer file choice aborts the import in flight, so its analysis never lands.
  const inFlight = useRef<AbortController | null>(null);
  // Leaving the page aborts it too, which terminates the analysis worker.
  useEffect(() => {
    const flight = inFlight;
    return () => flight.current?.abort();
  }, []);

  const profile = useMemo(() => (result && profileId ? profileFromReview(result, accepted, name, profileId).profile : null), [result, accepted, name, profileId]);

  const lowConfidence = useMemo(() => new Set(result ? lowConfidenceOps(result.patch, "").map((r) => Number(r.path.split("/").pop())) : []), [result]);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setResult(null);
    setProfileId(null);
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
      setStatus(
        error instanceof ImportTooLargeError || error instanceof ImportTooLongError || error instanceof ImportLengthUnknownError
          ? `Could not analyse ${file.name}: ${error.message}`
          : `Could not analyse ${file.name}: ${error instanceof Error ? error.message : "unknown error"}. Try a WAV, MP3, AAC or FLAC file.`,
      );
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handle(event.dataTransfer.files[0]);
  };

  const createProfile = () => {
    if (!result) return;
    // Made here, so saving the same profile twice upserts one library row.
    const id = crypto.randomUUID();
    setProfileId(id);
    const { acceptedCount } = profileFromReview(result, accepted, name, id);
    setStatus(`Style profile created from ${acceptedCount} accepted field(s). Save it to the library to keep it and its audio, or download it.`);
  };

  // A download keeps no audio on the device: nothing in the app could reach or remove it.
  // The profile cites the audio by its sha256, and the person still has the original file.
  const downloadProfile = () => {
    if (!profile) return;
    download(`${profile.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "profile"}-style-profile.json`, `${JSON.stringify(profile, null, 2)}\n`);
    setStatus(`Downloaded "${profile.name}". Only a library save keeps the audio on this device.`);
  };

  const save = async () => {
    if (!result || !profile || !source) return;
    const current = inFlight.current;
    // A newer file choice replaces the import in flight; this save must not report over it.
    const report = (message: string) => {
      if (inFlight.current === current) setStatus(message);
    };
    if (!getSupabasePublicConfig()) {
      report("The library needs Supabase, which is not configured here. Download the profile instead.");
      return;
    }
    try {
      const client = createLibraryClient();
      const { data } = await client.auth.getSession();
      if (!data.session) {
        report("Sign in to save to your library (Library → Sign in).");
        return;
      }
      const { asset, features, analysedOn } = result;
      const record = {
        file: { filename: recordFilename(asset.filename), mime: recordMime(asset.mime), bytes: asset.bytes, sha256: asset.sha256, features },
        profile: { id: profile.id, name: profile.name, spec: profile.spec, analysedOn, model: AUDIO_DRAFT_MODEL },
      };
      // The save and the store take the file's turn for this account, so a delete of the same
      // file cannot land between them; the audio is kept only if the rows are this account's.
      const ownerId = data.session.user.id;
      const storedIn = await inTurnForLocalAudio({ ownerId, sha256: asset.sha256 }, () => saveImportAndKeepAudio(client, record, source, keepAudioFor(ownerId)));
      const kept =
        storedIn === "not-kept"
          ? "The account changed during the save, so the audio was not kept on this device; import the file again to keep it."
          : storedIn === "unsupported"
            ? "This browser cannot coordinate its tabs (no Web Locks), so the audio was not kept on this device."
            : `The audio stays ${storedIn === "opfs" ? "in this browser's private storage" : "in memory for this tab only"}.`;
      report(`Saved "${profile.name}" and the file's metadata to your library. ${kept}`);
    } catch (error) {
      report(error instanceof Error ? error.message : "Saving failed.");
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
        <input
          id={inputId}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared once taken, so choosing the same file again (a retry) fires change again.
            e.target.value = "";
            void handle(file);
          }}
        />
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
            <input id={nameId} type="text" value={name} onChange={(e) => setName(clampProfileName(e.target.value))} />
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
            <dd data-testid="profile-tempo">{profile.spec.D6?.tempo ? `${profile.spec.D6.tempo.bpm} BPM (${profile.spec.D6.tempo.source})` : "not set"}</dd>
            <dt>Meter</dt>
            <dd>{profile.spec.D6?.meterLock?.signature ?? "not set"}</dd>
            <dt>Key</dt>
            <dd data-testid="profile-key">
              {profile.spec.D6?.key ? `${profile.spec.D6.key.tonic} ${catalog.modes[profile.spec.D6.key.modeId]?.name ?? profile.spec.D6.key.modeId}` : "not set"}
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
            <button type="button" onClick={downloadProfile}>
              Download profile JSON
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
