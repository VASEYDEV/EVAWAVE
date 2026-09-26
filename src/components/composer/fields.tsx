"use client";

/**
 * Inputs bound to IR paths (docs/SPEC.md §1.5: "each input bound to an IR path"). Each one
 * reads its value with `getAt` and writes a single `PatchOp`, so every change is one undo
 * step. Typing coalesces per path. `data-ir-path` names the bound path on every control.
 */
import { useId, useState, type ReactNode } from "react";

import type { PatchOp } from "@/core/musicspec/ir/types";
import { getAt, hasAt } from "@/core/musicspec/patch";

import { op, useComposer } from "./state";

interface Bound {
  path: string;
  label: string;
  /** When set, clearing the input removes the key instead of writing an empty value. */
  optional?: boolean;
  hint?: string;
}

function Hint({ id, text }: { id: string; text?: string }) {
  return text ? (
    <span id={id} className="hint">
      {text}
    </span>
  ) : null;
}

export function TextField({ path, label, optional, hint, multiline, placeholder, list }: Bound & { multiline?: boolean; placeholder?: string; list?: string }) {
  const { spec, edit } = useComposer();
  const id = useId();
  const value = getAt(spec, path);
  const text = typeof value === "string" ? value : "";
  const change = (next: string) => {
    if (optional && next === "") {
      if (hasAt(spec, path)) edit([op("remove", path)], label, path);
    } else edit([op("set", path, next)], label, path);
  };
  const common = { id, value: text, placeholder, "data-ir-path": path, "aria-describedby": hint ? `${id}-hint` : undefined };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea {...common} rows={3} onChange={(e) => change(e.target.value)} /> : <input {...common} type="text" list={list} onChange={(e) => change(e.target.value)} />}
      <Hint id={`${id}-hint`} text={hint} />
    </div>
  );
}

export function NumberField({ path, label, optional, hint, min, max, step = 1, extra = [] }: Bound & { min?: number; max?: number; step?: number; extra?: PatchOp[] }) {
  const { spec, edit } = useComposer();
  const id = useId();
  const value = getAt(spec, path);
  // A draft keeps the text while it is not a valid number yet ("", "1."), so typing never snaps back.
  const [draft, setDraft] = useState<string | null>(null);
  const change = (text: string) => {
    setDraft(text);
    if (text === "") {
      if (optional && hasAt(spec, path)) edit([op("remove", path)], label, path);
      return;
    }
    const n = Number(text);
    if (Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) edit([op("set", path, n), ...extra], label, path);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? (typeof value === "number" ? String(value) : "")}
        data-ir-path={path}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => change(e.target.value)}
        onBlur={() => setDraft(null)}
      />
      <Hint id={`${id}-hint`} text={hint} />
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SelectField({ path, label, options, optional, hint, numeric }: Bound & { options: readonly Option[]; numeric?: boolean }) {
  const { spec, edit } = useComposer();
  const id = useId();
  const value = getAt(spec, path);
  const change = (next: string) => {
    if (optional && next === "") {
      if (hasAt(spec, path)) edit([op("remove", path)], label);
    } else edit([op("set", path, numeric ? Number(next) : next)], label);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value === undefined ? "" : String(value)} data-ir-path={path} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => change(e.target.value)}>
        {optional ? <option value="">None</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint id={`${id}-hint`} text={hint} />
    </div>
  );
}

/** A boolean at `path`. `defaultValue` is what an absent key means (PickupBar.announce defaults to true). */
export function CheckboxField({ path, label, hint, defaultValue = false }: Bound & { defaultValue?: boolean }) {
  const { spec, edit } = useComposer();
  const id = useId();
  const value = getAt(spec, path);
  const checked = typeof value === "boolean" ? value : defaultValue;
  return (
    <div className="field field-check">
      <input id={id} type="checkbox" checked={checked} data-ir-path={path} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => edit([op("set", path, e.target.checked)], label)} />
      <label htmlFor={id}>{label}</label>
      <Hint id={`${id}-hint`} text={hint} />
    </div>
  );
}

/** A string[] as one entry per line. Empty lines are dropped on commit, not while typing. */
export function LinesField({ path, label, hint }: Bound) {
  const { spec, edit } = useComposer();
  const id = useId();
  const value = getAt(spec, path);
  const lines = Array.isArray(value) ? (value as string[]) : [];
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={3}
        value={draft ?? lines.join("\n")}
        data-ir-path={path}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setDraft(e.target.value);
          edit([op("set", path, e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))], label, path);
        }}
        onBlur={() => setDraft(null)}
      />
      <Hint id={`${id}-hint`} text={hint ?? "One per line."} />
    </div>
  );
}

/** A number[] typed as "8, 16". */
export function NumberListField({ path, label, hint, optional }: Bound) {
  const { spec, edit } = useComposer();
  const id = useId();
  const value = getAt(spec, path);
  const numbers = Array.isArray(value) ? (value as number[]) : [];
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={draft ?? numbers.join(", ")}
        data-ir-path={path}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = e.target.value
            .split(/[,\s]+/)
            .filter(Boolean)
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0);
          if (optional && parsed.length === 0) {
            if (hasAt(spec, path)) edit([op("remove", path)], label, path);
          } else edit([op("set", path, parsed)], label, path);
        }}
        onBlur={() => setDraft(null)}
      />
      <Hint id={`${id}-hint`} text={hint ?? "Comma-separated whole numbers."} />
    </div>
  );
}

/** Picks ids from a long list: search, add, and remove chips. */
export function IdPicker({ path, label, options, hint }: Bound & { options: readonly Option[] }) {
  const { spec, edit } = useComposer();
  const id = useId();
  const value = getAt(spec, path);
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const [query, setQuery] = useState("");
  const byValue = new Map(options.map((o) => [o.value, o.label]));
  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => !selected.includes(o.value) && (o.label.toLowerCase().includes(q) || o.value.includes(q))).slice(0, 12) : [];
  return (
    <fieldset className="picker" data-ir-path={path}>
      <legend>{label}</legend>
      {hint ? <p className="hint">{hint}</p> : null}
      <ul className="chips" aria-label={`${label}: selected`}>
        {selected.map((v, i) => (
          <li key={v}>
            <span>{byValue.get(v) ?? v}</span>
            <button type="button" className="chip-remove" aria-label={`Remove ${byValue.get(v) ?? v} from ${label}`} onClick={() => edit([op("remove", `${path}/${i}`)], `${label}: remove ${v}`)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <label htmlFor={id}>Search {label.toLowerCase()}</label>
      <input id={id} type="search" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
      {matches.length ? (
        <ul className="matches" aria-label={`${label}: matches`}>
          {matches.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  edit([op(value === undefined ? "set" : "append", path, value === undefined ? [o.value] : o.value)], `${label}: add ${o.value}`);
                  setQuery("");
                }}
              >
                Add {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

/** Adds or removes `value` in the string array at `path`. */
function useToggleInArray(path: string, values: readonly string[]) {
  const { edit } = useComposer();
  return (value: string, on: boolean, label: string) => {
    const index = values.indexOf(value);
    if (on && index < 0) edit([op("append", path, value)], label);
    if (!on && index >= 0) edit([op("remove", `${path}/${index}`)], label);
  };
}

export function CheckboxList({ legend, path, values, options }: { legend: string; path: string; values: readonly string[]; options: readonly Option[] }) {
  const toggle = useToggleInArray(path, values);
  const id = useId();
  return (
    <fieldset className="checklist" data-ir-path={path}>
      <legend>{legend}</legend>
      {options.map((o) => (
        <div className="field field-check" key={o.value}>
          <input id={`${id}-${o.value}`} type="checkbox" checked={values.includes(o.value)} disabled={o.disabled} onChange={(e) => toggle(o.value, e.target.checked, `${legend}: ${o.value}`)} />
          <label htmlFor={`${id}-${o.value}`}>{o.label}</label>
        </div>
      ))}
    </fieldset>
  );
}

/** A group heading with a toggle, for optional sub-objects like a pickup or a contrast phrase. */
export function OptionalBlock({ label, present, onAdd, onRemove, children }: { label: string; present: boolean; onAdd: () => void; onRemove: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <fieldset className="optional">
      <div className="field field-check">
        <input id={id} type="checkbox" checked={present} onChange={(e) => (e.target.checked ? onAdd() : onRemove())} />
        <label htmlFor={id}>{label}</label>
      </div>
      {present ? <div className="optional-body">{children}</div> : null}
    </fieldset>
  );
}
