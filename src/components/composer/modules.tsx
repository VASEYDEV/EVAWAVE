"use client";

/**
 * Composer modules 1–7, 10 and 11 (docs/SPEC.md §1.5). Sections (9) and Transitions (8)
 * live in their own files. Every control writes one `PatchOp` through `useComposer`.
 */
import { useId, useState } from "react";

import { computeBarMath } from "@/core/musicspec/barmath";
import type { EngineId, TechniqueTarget } from "@/core/musicspec/ir/types";
import { formatPointer } from "@/core/musicspec/patch";

import { CheckboxField, CheckboxList, IdPicker, LinesField, NumberField, OptionalBlock, SelectField, TextField } from "./fields";
import { Module } from "./Module";
import {
  bundleOptions,
  drumPatternOptions,
  ENGINES,
  EXTENSIONS,
  FEELS,
  GENRE_ROLES,
  genreOptions,
  instrumentOptions,
  modeOptions,
  NEGATIVE_CLASSES,
  PITCH_CLASSES,
  RESTATEMENTS,
  SIGNATURES,
  SUBDIVISIONS,
  synthRoleOptions,
  techniqueOptions,
} from "./options";
import { op, useComposer } from "./state";

function RemoveButton({ path, label }: { path: string; label: string }) {
  const { edit } = useComposer();
  return (
    <button type="button" className="danger" onClick={() => edit([op("remove", path)], `Remove ${label}`)}>
      Remove {label}
    </button>
  );
}

/** A text entry plus an Add button, for appending new list items. */
function AddText({ label, onAdd }: { label: string; onAdd: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div className="add-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <button type="button" onClick={add}>
        Add
      </button>
    </div>
  );
}

/** A `Weighted<string>[]` (moods, textures): each entry's text and weight, in order. */
function WeightedStrings({ path, noun, items }: { path: string; noun: string; items: { value: string; weight: number }[] }) {
  const { edit } = useComposer();
  return (
    <div className="list" data-ir-path={path}>
      {items.map((_, i) => (
        <div className="row" key={i}>
          <TextField path={`${path}/${i}/value`} label={`${noun} ${i + 1}`} />
          <NumberField path={`${path}/${i}/weight`} label={`${noun} ${i + 1} weight`} min={0} max={1} step={0.1} />
          <RemoveButton path={`${path}/${i}`} label={`${noun} ${i + 1}`} />
        </div>
      ))}
      <AddText label={`New ${noun.toLowerCase()}`} onAdd={(text) => edit([op("append", path, { value: text, weight: 1 })], `Add ${noun.toLowerCase()}`)} />
    </div>
  );
}

function TargetSwitcher() {
  const { spec, edit } = useComposer();
  const name = useId();
  return (
    <fieldset className="targets" data-ir-path="/D10/activeTarget">
      <legend>Target engine</legend>
      {ENGINES.map((engine) => {
        const halted = engine.id === "udio";
        return (
          <div className="field field-check" key={engine.id}>
            <input
              id={`${name}-${engine.id}`}
              type="radio"
              name={name}
              value={engine.id}
              checked={spec.D10.activeTarget === engine.id}
              disabled={halted}
              aria-describedby={halted ? `${name}-halted` : undefined}
              onChange={() => edit([op("set", "/D10/activeTarget", engine.id)], `Target: ${engine.label}`)}
            />
            <label htmlFor={`${name}-${engine.id}`}>{engine.label}</label>
            {halted ? (
              <span id={`${name}-halted`} className="hint">
                Halted (decision A12)
              </span>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

function formatSec(sec: number): string {
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function EngineFormModule() {
  const { spec, edit, catalog } = useComposer();
  const lock = spec.D6.meterLock;
  const math = computeBarMath(spec.D6.tempo, lock.signature, spec.D7);
  return (
    <Module number={1} title="Engine + Form" owns="Target, D1, D6 tempo and meter lock, runtime" open>
      <TargetSwitcher />
      <TextField path="/D1/formPhrase" label="Form phrase" hint="The genre and form clause, for example 'Egyptian Atlanta trap beat'." />
      <div className="list" data-ir-path="/D1/stack">
        <h3>Genre stack</h3>
        {spec.D1.stack.map((_, i) => (
          <div className="row" key={i}>
            <SelectField path={`/D1/stack/${i}/value/genreId`} label={`Genre ${i + 1}`} options={genreOptions(catalog)} />
            <SelectField path={`/D1/stack/${i}/value/role`} label={`Genre ${i + 1} role`} options={GENRE_ROLES} />
            <NumberField path={`/D1/stack/${i}/weight`} label={`Genre ${i + 1} weight`} min={0} max={1} step={0.1} />
            <RemoveButton path={`/D1/stack/${i}`} label={`genre ${i + 1}`} />
          </div>
        ))}
        <button type="button" onClick={() => edit([op("append", "/D1/stack", { value: { genreId: Object.keys(catalog.genres)[0] ?? "", role: "core" }, weight: 1 })], "Add genre")}>
          Add genre
        </button>
      </div>
      <NumberField path="/D6/tempo/bpm" label="Tempo (BPM)" min={20} max={300} extra={[op("set", "/D6/tempo/source", "manual")]} />
      <fieldset className="group">
        <legend>Meter lock</legend>
        <CheckboxField path="/D6/meterLock/enabled" label="Lock the meter" />
        <SelectField path="/D6/meterLock/signature" label="Signature" options={SIGNATURES} />
        <SelectField path="/D6/meterLock/feel" label="Feel" options={FEELS} />
        <SelectField path="/D6/meterLock/subdivision" label="Grid" options={SUBDIVISIONS} numeric />
        <CheckboxField path="/D6/meterLock/driftSuppression" label="Block drift words" />
        <CheckboxList legend="Allowed extensions" path="/D6/meterLock/allowedExtensions" values={lock.allowedExtensions} options={EXTENSIONS.map((e) => ({ value: e, label: e }))} />
        <SelectField path="/D6/meterLock/restatement" label="Restate the meter in" options={RESTATEMENTS} />
      </fieldset>
      <NumberField path="/D7/runtimeTargetSec" label="Runtime target (seconds)" optional min={1} />
      <p className="readout" aria-label="Bar math">
        1 bar = {math.barSec.toFixed(3)} s · 8 bars = {math.block8Sec.toFixed(2)} s · 16 bars = {math.block16Sec.toFixed(2)} s · runtime {formatSec(math.runtimeSec)}
      </p>
    </Module>
  );
}

export function KeyModeModule() {
  const { spec, catalog } = useComposer();
  return (
    <Module number={2} title="Key + Mode" owns="D6 key and harmony">
      <SelectField path="/D6/key/tonic" label="Tonic" options={PITCH_CLASSES} />
      <SelectField path="/D6/key/modeId" label="Mode" options={modeOptions(catalog, spec.D10.activeTarget)} hint="Flags show modes the target engine renders only approximately." />
      <TextField path="/D6/key/phraseOverride" label="Key wording" optional hint="Replaces the generated key text, for example 'D Hijaz maqam, dark minor'." />
      <LinesField path="/D6/harmony" label="Harmony notes" hint="Blueprint only; never sent to an engine. One per line." />
    </Module>
  );
}

const GRID_PIECES = ["kick", "808", "snare", "clap", "rim", "hat-closed", "hat-open", "perc-1", "perc-2", "crash", "ride"] as const;

export function DrumGrammarModule() {
  const { spec, catalog } = useComposer();
  return (
    <Module number={3} title="Drum Grammar" owns="D5 drums">
      <IdPicker path="/D5/drums/patternIds" label="Drum patterns" options={drumPatternOptions(catalog)} hint="The first pattern is the core; its prose is used unless you override it." />
      <TextField path="/D5/drums/label" label="Drums label" optional />
      <TextField path="/D5/drums/proseOverride" label="Drums wording" optional multiline />
      {spec.D5.drums.patternIds.map((id) => {
        const pattern = catalog.drumPatterns[id];
        if (!pattern) return null;
        const pieces = GRID_PIECES.filter((piece) => pattern.grid[piece]?.length);
        return (
          <table className="grid" key={id}>
            <caption>{pattern.name}: 16th grid</caption>
            <thead>
              <tr>
                <th scope="col">Piece</th>
                {Array.from({ length: 16 }, (_, i) => (
                  <th scope="col" key={i}>
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pieces.map((piece) => (
                <tr key={piece}>
                  <th scope="row">{piece}</th>
                  {Array.from({ length: 16 }, (_, i) => {
                    const hit = pattern.grid[piece]?.includes(i);
                    return (
                      <td key={i} className={hit ? "hit" : undefined}>
                        {hit ? <span aria-label="hit">●</span> : <span aria-label="rest">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </Module>
  );
}

export function RegionalBundleModule() {
  const { spec, edit, catalog } = useComposer();
  const [choice, setChoice] = useState("");
  const addId = useId();
  const options = bundleOptions(catalog);
  return (
    <Module number={4} title="Regional Bundle" owns="D5 bundles">
      {spec.D5.bundles.map((use, i) => {
        const record = catalog.bundles[use.bundleId];
        const base = `/D5/bundles/${i}`;
        return (
          <fieldset className="group" key={i} data-ir-path={base}>
            <legend>{record?.name ?? use.bundleId}</legend>
            <TextField path={`${base}/label`} label="Clause label" optional />
            <SelectField path={`${base}/anchorInstrumentId`} label="Anchor instrument" options={(record?.instrumentIds ?? []).map((id) => ({ value: id, label: catalog.instruments[id]?.name ?? id }))} />
            <CheckboxList legend="Rhythms named song-wide" path={`${base}/rhythmIds`} values={use.rhythmIds} options={(record?.rhythmIds ?? []).map((id) => ({ value: id, label: catalog.rhythms[id]?.name ?? id }))} />
            {i > 0 ? (
              <OptionalBlock
                label={`Mix with ${catalog.bundles[spec.D5.bundles[0]?.bundleId ?? ""]?.name ?? "the first bundle"} (RB-1)`}
                present={Boolean(use.crossBundle)}
                onAdd={() => edit([op("set", `${base}/crossBundle`, { withBundleId: spec.D5.bundles[0]?.bundleId ?? "", reason: "" })], "Allow cross-bundle use")}
                onRemove={() => edit([op("remove", `${base}/crossBundle`)], "Remove cross-bundle flag")}
              >
                <TextField path={`${base}/crossBundle/reason`} label="Why these bundles mix" />
              </OptionalBlock>
            ) : null}
            <RemoveButton path={base} label={record?.name ?? use.bundleId} />
          </fieldset>
        );
      })}
      <div className="add-row">
        <label htmlFor={addId}>Add a bundle</label>
        <select id={addId} value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Choose a bundle</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() => {
            const record = catalog.bundles[choice];
            if (!record) return;
            edit([op("append", "/D5/bundles", { bundleId: record.id, anchorInstrumentId: record.anchorInstrumentId, rhythmIds: [] })], `Add bundle ${record.id}`);
            setChoice("");
          }}
        >
          Add
        </button>
      </div>
    </Module>
  );
}

export function InstrumentsModule() {
  const { spec, edit, catalog } = useComposer();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const searchId = useId();
  const roleId = useId();
  const q = query.trim().toLowerCase();
  const used = new Set(spec.D5.instruments.map((u) => u.value.instrumentId));
  const matches = q ? instrumentOptions(catalog).filter((o) => !used.has(o.value) && o.label.toLowerCase().includes(q)).slice(0, 12) : [];
  const sectionOptions = spec.D7.sections.map((s) => ({ value: s.id, label: s.label }));
  return (
    <Module number={5} title="Instruments + Synth Roles" owns="D5 instruments, synth roles, section cap">
      <h3>Palette</h3>
      {spec.D5.instruments.map((use, i) => {
        const name = catalog.instruments[use.value.instrumentId]?.name ?? use.value.instrumentId;
        const base = `/D5/instruments/${i}`;
        return (
          <div className="row" key={i} data-ir-path={base}>
            <strong>{name}</strong>
            <TextField path={`${base}/value/phraseOverride`} label={`${name} wording`} optional />
            <NumberField path={`${base}/weight`} label={`${name} weight`} min={0} max={1} step={0.1} />
            <SelectField path={`${base}/value/bundleId`} label={`${name} bundle`} optional options={spec.D5.bundles.map((b) => ({ value: b.bundleId, label: catalog.bundles[b.bundleId]?.name ?? b.bundleId }))} />
            <RemoveButton path={base} label={name} />
          </div>
        );
      })}
      <label htmlFor={searchId}>Search instruments</label>
      <input id={searchId} type="search" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
      {matches.length ? (
        <ul className="matches" aria-label="Instrument matches">
          {matches.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  edit([op("append", "/D5/instruments", { value: { instrumentId: o.value }, weight: 1 })], `Add instrument ${o.value}`);
                  setQuery("");
                }}
              >
                Add {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <h3>Synth roles</h3>
      {spec.D5.synthRoles.map((use, i) => {
        const name = catalog.synthRoles[use.synthRoleId]?.name ?? use.synthRoleId;
        const base = `/D5/synthRoles/${i}`;
        return (
          <fieldset className="group" key={i} data-ir-path={base}>
            <legend>{name}</legend>
            <CheckboxList legend="Sections" path={`${base}/position/sectionIds`} values={use.position.sectionIds} options={sectionOptions} />
            <TextField path={`${base}/proseOverride`} label={`${name} wording`} optional />
            <RemoveButton path={base} label={name} />
          </fieldset>
        );
      })}
      <div className="add-row">
        <label htmlFor={roleId}>Add a synth role</label>
        <select id={roleId} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Choose a role</option>
          {synthRoleOptions(catalog).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!role}
          onClick={() => {
            edit([op("append", "/D5/synthRoles", { synthRoleId: role, position: { sectionIds: [], phrases: [], beats: [] } })], `Add synth role ${role}`);
            setRole("");
          }}
        >
          Add
        </button>
      </div>
      <fieldset className="group">
        <legend>Named instruments per section (SC-1)</legend>
        <NumberField path="/D5/sectionCap/warnAt" label="Warn at" min={1} />
        <NumberField path="/D5/sectionCap/blockAt" label="Block at" min={1} />
      </fieldset>
    </Module>
  );
}

export function TechniqueModule() {
  const { spec, edit, catalog } = useComposer();
  const [technique, setTechnique] = useState("");
  const [target, setTarget] = useState("song");
  const techniqueId = useId();
  const targetId = useId();
  const palette = spec.D5.instruments.map((u) => ({ value: u.value.instrumentId, label: catalog.instruments[u.value.instrumentId]?.name ?? u.value.instrumentId }));
  return (
    <Module number={6} title="Expression + Technique" owns="D3 techniques, section technique scope">
      {spec.D3.techniques.map((use, i) => {
        const name = catalog.techniques[use.techniqueId]?.name ?? use.techniqueId;
        const on = use.target.kind === "song" ? "the whole song" : (catalog.instruments[use.target.instrumentId]?.name ?? use.target.instrumentId);
        return (
          <div className="row" key={i} data-ir-path={`/D3/techniques/${i}`}>
            <span>
              {name} on {on}
            </span>
            <RemoveButton path={`/D3/techniques/${i}`} label={`${name} on ${on}`} />
          </div>
        );
      })}
      <div className="add-row">
        <label htmlFor={techniqueId}>Technique</label>
        <select id={techniqueId} value={technique} onChange={(e) => setTechnique(e.target.value)}>
          <option value="">Choose a technique</option>
          {techniqueOptions(catalog).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label htmlFor={targetId}>Applies to</label>
        <select id={targetId} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="song">The whole song</option>
          {palette.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!technique}
          onClick={() => {
            const t: TechniqueTarget = target === "song" ? { kind: "song" } : { kind: "instrument", instrumentId: target, sectionIds: [] };
            edit([op("append", "/D3/techniques", { techniqueId: technique, target: t })], `Add technique ${technique}`);
            setTechnique("");
          }}
        >
          Add
        </button>
      </div>
      {spec.D7.sections.map((section, i) => (
        <IdPicker key={section.id} path={`/D7/sections/${i}/scope/techniqueIds`} label={`${section.label} techniques`} options={techniqueOptions(catalog)} />
      ))}
    </Module>
  );
}

export function TexturesModule() {
  const { spec, catalog } = useComposer();
  return (
    <Module number={7} title="Textures" owns="D5 textures, D9 production">
      <WeightedStrings path="/D5/textures" noun="Texture" items={spec.D5.textures} />
      <LinesField path="/D9/character" label="Production character" />
      <IdPicker path="/D9/techniqueIds" label="Production techniques" options={techniqueOptions(catalog)} />
    </Module>
  );
}

export function MoodModule() {
  const { spec, edit } = useComposer();
  return (
    <Module number={10} title="Mood + Imagery" owns="D2, D4">
      <WeightedStrings path="/D2/moods" noun="Mood" items={spec.D2.moods} />
      <LinesField path="/D2/imagery" label="Imagery" hint="Drafting notes; not emitted by Suno. One per line." />
      <h3>Era and lineage traits</h3>
      {spec.D4.traits.map((_, i) => (
        <div className="row" key={i}>
          <TextField path={`/D4/traits/${i}/value/trait`} label={`Trait ${i + 1}`} hint="Describe the sound, never a name (LN-1)." />
          <TextField path={`/D4/traits/${i}/value/era`} label={`Trait ${i + 1} era`} optional />
          <TextField path={`/D4/traits/${i}/value/scene`} label={`Trait ${i + 1} scene`} optional />
          <NumberField path={`/D4/traits/${i}/weight`} label={`Trait ${i + 1} weight`} min={0} max={1} step={0.1} />
          <RemoveButton path={`/D4/traits/${i}`} label={`trait ${i + 1}`} />
        </div>
      ))}
      <AddText label="New trait" onAdd={(text) => edit([op("append", "/D4/traits", { value: { trait: text }, weight: 1 })], "Add trait")} />
    </Module>
  );
}

function HouseBudgets() {
  const { spec, edit } = useComposer();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const keyId = useId();
  const valueId = useId();
  return (
    <fieldset className="group" data-ir-path="/D10/houseBudgets">
      <legend>House budgets</legend>
      {Object.keys(spec.D10.houseBudgets).map((k) => {
        const path = `/D10/houseBudgets${formatPointer([k])}`;
        return (
          <div className="row" key={k}>
            <NumberField path={path} label={k} min={0} />
            <RemoveButton path={path} label={`budget ${k}`} />
          </div>
        );
      })}
      <div className="add-row">
        <label htmlFor={keyId}>Budget key</label>
        <input id={keyId} type="text" placeholder="suno.total" value={key} onChange={(e) => setKey(e.target.value)} />
        <label htmlFor={valueId}>Characters</label>
        <input id={valueId} type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          type="button"
          disabled={!/^[a-z]+\.[a-z_]+$/.test(key) || !(Number(value) > 0)}
          onClick={() => {
            edit([op("set", `/D10/houseBudgets${formatPointer([key])}`, Number(value))], `Budget ${key}`);
            setKey("");
            setValue("");
          }}
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}

export function OutputModule() {
  const { spec, edit } = useComposer();
  return (
    <Module number={11} title="Negative Space + Output" owns="D8, D10">
      <h3>Negative space</h3>
      {spec.D10.negativeSpace.map((entry, i) => (
        <fieldset className="group" key={i} data-ir-path={`/D10/negativeSpace/${i}`}>
          <legend>{entry.class}</legend>
          <SelectField path={`/D10/negativeSpace/${i}/class`} label={`Exclude class ${i + 1}`} options={NEGATIVE_CLASSES} />
          <LinesField path={`/D10/negativeSpace/${i}/terms`} label={`Exclude class ${i + 1} terms`} />
          <RemoveButton path={`/D10/negativeSpace/${i}`} label={`${entry.class} class`} />
        </fieldset>
      ))}
      <button type="button" onClick={() => edit([op("append", "/D10/negativeSpace", { class: "custom", terms: [] })], "Add exclude class")}>
        Add exclude class
      </button>
      <TextField path="/D10/title" label="Title" optional />
      <CheckboxField path="/D8/instrumental" label="Instrumental" />
      <TextField path="/D8/lyricsPassthrough" label="Your lyrics" optional multiline hint="Your own lyrics only; they pass through unchanged. EVAWAVE never writes lyrics." />
      <LinesField path="/D8/voice" label="Voice character" />
      <CheckboxList legend="Targets" path="/D10/targets" values={spec.D10.targets} options={ENGINES.map((e) => ({ value: e.id as EngineId, label: e.label, disabled: e.id === "udio" }))} />
      <HouseBudgets />
      <LinesField path="/D10/acknowledgedDrops" label="Acknowledged drops" hint="'<engine>:<path>' per line; clears CV-2 for that item." />
    </Module>
  );
}
