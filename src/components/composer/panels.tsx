"use client";

/**
 * Cross-cutting composer panels (docs/SPEC.md §1.5): live budget meters, the lint panel,
 * the coverage report for the active target, the export pane and the undo history.
 */
import { useId, useState } from "react";

import { blueprintMarkdown } from "@/core/musicspec/blueprint";
import { canRedo, canUndo, branchTips } from "@/core/musicspec/history";
import type { CompiledPayload, CompiledValue, EngineProfile, LintResult } from "@/core/musicspec/ir/types";
import type { CompileResult } from "@/core/musicspec/serialize";

import { useComposer } from "./state";

function text(value: CompiledValue | undefined): string {
  if (value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

export function BudgetMeters({ payload, profile }: { payload: CompiledPayload; profile: EngineProfile }) {
  const fields = profile.fields.filter((f) => f.kind === "text" && (f.hardLimit !== undefined || f.softLimit !== undefined));
  if (!fields.length) return null;
  return (
    <section className="panel" aria-labelledby="budgets-heading">
      <h2 id="budgets-heading">Budgets · {profile.displayName}</h2>
      <ul className="meters">
        {fields.map((field) => {
          const length = [...text(payload.fields[field.id])].length;
          const cap = field.hardLimit ?? field.softLimit ?? 0;
          const over = length > cap;
          return (
            <li key={field.id}>
              <label htmlFor={`meter-${field.id}`}>
                {field.label}: {length} / {cap}
                {field.softLimit !== undefined && field.softLimit !== cap ? ` (house ${field.softLimit})` : ""}
                {over ? " — over the limit" : ""}
              </label>
              <meter id={`meter-${field.id}`} min={0} max={cap} high={field.softLimit ?? cap} optimum={0} value={Math.min(length, cap)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function LintPanel({ results }: { results: LintResult[] }) {
  const blocks = results.filter((r) => r.severity === "block").length;
  const warns = results.filter((r) => r.severity === "warn").length;
  return (
    <section className="panel" aria-labelledby="lint-heading">
      <h2 id="lint-heading">Lint</h2>
      <p aria-live="polite">
        {blocks} blocking · {warns} warnings · {results.length - blocks - warns} notes
      </p>
      <ul className="lint">
        {results.map((r, i) => (
          <li key={i} className={`lint-${r.severity}`}>
            <strong>
              {r.ruleId} {r.severity}
            </strong>{" "}
            <code>{r.path}</code> {r.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CoveragePanel({ payload }: { payload: CompiledPayload }) {
  const gaps = payload.coverage.items.filter((item) => item.state !== "expressed");
  return (
    <section className="panel" aria-labelledby="coverage-heading">
      <h2 id="coverage-heading">Coverage · {Math.round(payload.coverage.score * 100)}%</h2>
      {gaps.length ? (
        <ul className="coverage">
          {gaps.map((item) => (
            <li key={item.path}>
              <strong>{item.state}</strong> <code>{item.path}</code>
              {item.reason ? ` (${item.reason})` : ""}
              {item.detail ? `: ${item.detail}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>Everything in the spec is expressed natively.</p>
      )}
    </section>
  );
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(title: string | undefined): string {
  return (title ?? "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("copied");
        } catch {
          setState("failed");
        }
      }}
    >
      {state === "copied" ? `Copied ${label}` : state === "failed" ? `Copy failed: select the text` : `Copy ${label}`}
    </button>
  );
}

/** Files per target (docs/SPEC.md §1.5, exports). */
function exportFiles(payload: CompiledPayload, name: string): { filename: string; content: string; type: string }[] {
  const f = payload.fields;
  switch (payload.engine) {
    case "suno":
      return [{ filename: `${name}-suno.txt`, type: "text/plain", content: `STYLE\n${text(f.style)}\n\nEXCLUDE STYLES\n${text(f.exclude)}\n\nLYRICS\n${text(f.lyrics)}\n\nTITLE\n${text(f.title)}\n\nInstrumental: ${payload.toggles.instrumental ? "ON" : "OFF"}\n` }];
    case "eleven":
      return [
        { filename: `${name}-eleven-plan.json`, type: "application/json", content: `${JSON.stringify({ composition_plan: f.composition_plan, music_length_ms: f.music_length_ms, model_id: f.model_id }, null, 2)}\n` },
        { filename: `${name}-eleven-prompt.txt`, type: "text/plain", content: `${text(f.prompt)}\n` },
      ];
    case "flow":
      return [
        { filename: `${name}-flow-compose.txt`, type: "text/plain", content: `SOUND\n${text(f.sound)}\n\nLYRICS\n${text(f.lyrics)}\n\nBPM ${text(f.bpm)} · LENGTH ${text(f.length)} s · TITLE ${text(f.title)}\n\nInstrumental: ${payload.toggles.instrumental ? "ON" : "OFF"}\n` },
        { filename: `${name}-flow-producer.txt`, type: "text/plain", content: `${text(f.producer_script)}\n` },
      ];
    default:
      return [];
  }
}

export function ExportPane({ result, profile }: { result: CompileResult; profile: EngineProfile }) {
  const { spec, catalog } = useComposer();
  const name = slug(spec.D10.title);
  const specJson = `${JSON.stringify(spec, null, 2)}\n`;
  return (
    <section className="panel" aria-labelledby="export-heading">
      <h2 id="export-heading">Export · {profile.displayName}</h2>
      {result.ok ? (
        <>
          {profile.fields
            .filter((field) => field.kind !== "file" && result.payload.fields[field.id] !== undefined)
            .sort((a, b) => a.order - b.order)
            .map((field) => {
              const value = text(result.payload.fields[field.id]);
              const id = `export-${field.id}`;
              return (
                <div className="field" key={field.id}>
                  <label htmlFor={id}>
                    {profile.displayName} {field.label}
                  </label>
                  <textarea id={id} readOnly rows={field.kind === "json" ? 8 : 4} value={value} />
                  <CopyButton label={field.label} value={value} />
                </div>
              );
            })}
          {Object.entries(result.payload.toggles).map(([toggle, on]) => (
            <p key={toggle}>
              {profile.toggles.find((t) => t.id === toggle)?.label ?? toggle}: <strong>{on ? "ON" : "OFF"}</strong>
            </p>
          ))}
          <div className="row-actions">
            {exportFiles(result.payload, name).map((file) => (
              <button key={file.filename} type="button" onClick={() => download(file.filename, file.content, file.type)}>
                Download {file.filename}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p role="status">{result.error.message}</p>
      )}
      <h3>Engine-agnostic</h3>
      <div className="field">
        <label htmlFor="export-musicspec">MusicSpec JSON</label>
        <textarea id="export-musicspec" readOnly rows={6} value={specJson} />
      </div>
      <div className="row-actions">
        <button type="button" onClick={() => download(`${name}-musicspec.json`, specJson, "application/json")}>
          Download {name}-musicspec.json
        </button>
        <button type="button" onClick={() => download(`${name}-blueprint.md`, blueprintMarkdown(spec, catalog), "text/markdown")}>
          Download {name}-blueprint.md
        </button>
      </div>
    </section>
  );
}

export function HistoryPanel() {
  const { history, undo, redo, jumpTo } = useComposer();
  const tips = branchTips(history);
  const current = history.nodes[history.cursor];
  const listId = useId();
  return (
    <section className="panel" aria-labelledby="history-heading">
      <h2 id="history-heading">History</h2>
      <div className="row-actions">
        <button type="button" onClick={undo} disabled={!canUndo(history)} aria-keyshortcuts="Control+Z Meta+Z">
          Undo
        </button>
        <button type="button" onClick={() => redo()} disabled={!canRedo(history)} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z">
          Redo
        </button>
      </div>
      <p aria-live="polite">
        At: {current?.label ?? "Start"} · {history.nodes.length - 1} edits kept
      </p>
      {tips.length > 1 ? (
        <>
          <h3 id={listId}>Branches</h3>
          <ul aria-labelledby={listId} className="branches">
            {tips.map((tip) => {
              const here = tip.id === history.cursor;
              return (
                <li key={tip.id}>
                  <span>
                    Edit {tip.id}: {tip.label}
                    {here ? " (current)" : ""}
                  </span>
                  {here ? null : (
                    <button type="button" onClick={() => jumpTo(tip.id)}>
                      Go to branch at edit {tip.id}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
