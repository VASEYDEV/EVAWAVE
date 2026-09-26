"use client";

/**
 * The take log for one variant (docs/SPEC.md §1.6, §3 S7): what an engine did with it, as
 * the owner heard it. A take names the engine and version, may point at the render on the
 * engine's side (never the audio), and records a verdict, the drift heard and the words
 * blamed for it. Takes are never edited; a mistaken one is deleted and logged again.
 */
import { useId, useState } from "react";

import { ENGINE_PROFILES } from "@/core/musicspec/engines";
import type { DriftKind, Take } from "@/core/musicspec/ir/types";
import type { LibraryClient } from "@/lib/library/repository";
import { clampText, DRIFT_KINDS, deleteTake, logTake, renderLink, TAKE_LIMITS, wordsBlamed } from "@/lib/library/songs";

const LIVE_ENGINES = ["suno", "eleven", "flow"] as const satisfies readonly Take["engine"][];
const VERDICTS: readonly Take["verdict"][] = ["keep", "kill", "extend", "rerun"];

const DRIFT_LABELS: Record<DriftKind, string> = {
  meter: "Meter",
  tempo: "Tempo",
  key: "Key",
  "vocals-appeared": "Vocals appeared",
  "section-skipped": "Section skipped",
  "instrument-misread": "Instrument misread",
  "genre-bleed": "Genre bleed",
  length: "Length",
  other: "Other",
};

export function TakeLog({ client, variantId, variantLabel, takes, onChanged, onStatus }: { client: LibraryClient; variantId: string; variantLabel: string; takes: readonly Take[]; onChanged: () => void; onStatus: (message: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<(typeof LIVE_ENGINES)[number]>("suno");
  const [engineVersion, setEngineVersion] = useState(ENGINE_PROFILES.suno.version);
  const [renderRef, setRenderRef] = useState("");
  const [verdict, setVerdict] = useState<Take["verdict"]>("keep");
  const [drifted, setDrifted] = useState<DriftKind[]>([]);
  const [words, setWords] = useState("");
  const [notes, setNotes] = useState("");

  const act = async (what: string, action: () => Promise<unknown>) => {
    setBusy(true);
    onStatus(`${what}…`);
    try {
      await action();
      onStatus(`${what}: done.`);
      onChanged();
      return true;
    } catch (error) {
      onStatus(error instanceof Error ? error.message : `${what} failed.`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const logged = await act(`Log a take on ${variantLabel}`, () => logTake(client, { variantId, engine, engineVersion, renderRef, verdict, drifted, wordsBlamed: wordsBlamed(words), notes }));
    if (logged) {
      setRenderRef("");
      setDrifted([]);
      setWords("");
      setNotes("");
      setOpen(false);
    }
  };

  return (
    <div className="takes">
      <h5 id={`${id}-heading`}>Takes of {variantLabel}</h5>
      {takes.length ? (
        <ul className="take-list" aria-labelledby={`${id}-heading`}>
          {takes.map((take) => {
            const link = renderLink(take.renderRef);
            return (
              <li key={take.id}>
                <p>
                  <strong>{take.verdict}</strong> · {ENGINE_PROFILES[take.engine].displayName} <span className="readout">{take.engineVersion}</span> · {new Date(take.createdAt).toLocaleString()}
                </p>
                {take.drifted.length ? <p>Drift: {take.drifted.map((d) => DRIFT_LABELS[d]).join(", ")}</p> : null}
                {take.wordsBlamed.length ? <p>Words blamed: {take.wordsBlamed.join(", ")}</p> : null}
                {take.notes ? <p>{take.notes}</p> : null}
                {take.renderRef ? (
                  <p>
                    Render:{" "}
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        {take.renderRef}
                      </a>
                    ) : (
                      <code>{take.renderRef}</code>
                    )}
                  </p>
                ) : null}
                <button type="button" className="danger" disabled={busy} onClick={() => void act("Delete the take", () => deleteTake(client, take.id))}>
                  Delete this {take.verdict} take
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No takes logged yet.</p>
      )}
      {open ? (
        <form
          className="take-form"
          aria-label={`Log a take on ${variantLabel}`}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-engine`}>Engine</label>
            <select
              id={`${id}-engine`}
              value={engine}
              onChange={(e) => {
                const next = e.target.value as (typeof LIVE_ENGINES)[number];
                setEngine(next);
                setEngineVersion(ENGINE_PROFILES[next].version);
              }}
            >
              {LIVE_ENGINES.map((e) => (
                <option key={e} value={e}>
                  {ENGINE_PROFILES[e].displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-version`}>Engine version</label>
            <input id={`${id}-version`} type="text" required value={engineVersion} onChange={(e) => setEngineVersion(clampText(e.target.value, TAKE_LIMITS.engineVersion))} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-ref`}>Render link or id</label>
            <input id={`${id}-ref`} type="text" value={renderRef} onChange={(e) => setRenderRef(clampText(e.target.value, TAKE_LIMITS.renderRef))} aria-describedby={`${id}-ref-hint`} />
            <p className="hint" id={`${id}-ref-hint`}>
              Where the render lives on the engine&apos;s side. Never the audio itself.
            </p>
          </div>
          <fieldset className="group">
            <legend>Verdict</legend>
            {VERDICTS.map((v) => (
              <div className="field field-check" key={v}>
                <input id={`${id}-verdict-${v}`} type="radio" name={`${id}-verdict`} value={v} checked={verdict === v} onChange={() => setVerdict(v)} />
                <label htmlFor={`${id}-verdict-${v}`}>{v[0]?.toUpperCase() + v.slice(1)}</label>
              </div>
            ))}
          </fieldset>
          <fieldset className="group">
            <legend>Drift heard</legend>
            {DRIFT_KINDS.map((d) => (
              <div className="field field-check" key={d}>
                <input
                  id={`${id}-drift-${d}`}
                  type="checkbox"
                  checked={drifted.includes(d)}
                  onChange={(e) => setDrifted((now) => (e.target.checked ? [...now, d] : now.filter((x) => x !== d)))}
                />
                <label htmlFor={`${id}-drift-${d}`}>{DRIFT_LABELS[d]}</label>
              </div>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor={`${id}-words`}>Words blamed</label>
            <input id={`${id}-words`} type="text" value={words} onChange={(e) => setWords(e.target.value)} aria-describedby={`${id}-words-hint`} />
            <p className="hint" id={`${id}-words-hint`}>
              The prompt words you think caused the drift, separated by commas.
            </p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-notes`}>Notes</label>
            <textarea id={`${id}-notes`} rows={3} value={notes} onChange={(e) => setNotes(clampText(e.target.value, TAKE_LIMITS.notes))} />
          </div>
          <div className="row-actions">
            <button type="submit" className="primary" disabled={busy}>
              Log take
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" disabled={busy} onClick={() => setOpen(true)}>
          Log a take on {variantLabel}
        </button>
      )}
    </div>
  );
}
