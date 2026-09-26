"use client";

/**
 * Module 9, Sections, and module 8, Transitions (docs/SPEC.md §1.5). Sections own bars,
 * dynamics, scope, the ordered cues, mode, pocket and blueprint notes. Transitions own the
 * block rule and each section's pickup, contrast phrase, silence drop and transition out.
 */
import { useId, useState } from "react";

import { defaultSection } from "@/core/musicspec/ir/defaults";
import type { Section, SectionKind } from "@/core/musicspec/ir/types";

import { CheckboxField, CheckboxList, IdPicker, LinesField, NumberField, NumberListField, OptionalBlock, SelectField, TextField } from "./fields";
import { Module } from "./Module";
import {
  BEATS,
  contrastStyleOptions,
  CUE_SLOTS,
  cueRefOptions,
  DYNAMICS,
  instrumentOptions,
  modeOptions,
  POCKET_KINDS,
  POSITIONS,
  rhythmOptions,
  SECTION_KINDS,
  SIGNATURES,
  synthRoleOptions,
  TRANSITION_KINDS,
} from "./options";
import { op, useComposer } from "./state";

function kebab(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A section id from its label, unique within the song. */
function sectionId(label: string, taken: readonly Section[]): string {
  const base = kebab(label) || "section";
  const ids = new Set(taken.map((s) => s.id));
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  return id;
}

function CueEditor({ index, section }: { index: number; section: Section }) {
  const { edit } = useComposer();
  const base = `/D7/sections/${index}/cues`;
  const name = `Section ${index + 1} cue`;
  return (
    <fieldset className="group" data-ir-path={base}>
      <legend>Section {index + 1} cues, in bracket order</legend>
      <ol className="cues">
        {section.cues.map((cue, j) => (
          <li key={j} className="row">
            <SelectField path={`${base}/${j}/slot`} label={`${name} ${j + 1} slot`} options={CUE_SLOTS} />
            {cue.slot === "pocket" || cue.slot === "contrast" ? (
              <p className="hint">Renders the section&apos;s {cue.slot === "pocket" ? "open pocket" : "contrast phrase"} here.</p>
            ) : (
              <>
                <TextField path={`${base}/${j}/text`} label={`${name} ${j + 1} text`} />
                <TextField path={`${base}/${j}/ref`} label={`${name} ${j + 1} voices`} optional list="cue-refs" hint="A record id; pick from the list or leave empty." />
                <NumberListField path={`${base}/${j}/phrases`} label={`${name} ${j + 1} phrases`} optional hint="Limit to phrases, for example 2, 4." />
              </>
            )}
            <div className="row-actions">
              <button
                type="button"
                disabled={j === 0}
                onClick={() => edit([op("set", base, moved(section.cues, j, j - 1))], `Move ${name.toLowerCase()} ${j + 1} up`)}
              >
                Move cue {j + 1} up
              </button>
              <button
                type="button"
                disabled={j === section.cues.length - 1}
                onClick={() => edit([op("set", base, moved(section.cues, j, j + 1))], `Move ${name.toLowerCase()} ${j + 1} down`)}
              >
                Move cue {j + 1} down
              </button>
              <button type="button" className="danger" onClick={() => edit([op("remove", `${base}/${j}`)], `Remove ${name.toLowerCase()} ${j + 1}`)}>
                Remove cue {j + 1}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => edit([op("append", base, { slot: "lead", text: "" })], `Add ${name.toLowerCase()}`)}>
        Add cue to section {index + 1}
      </button>
    </fieldset>
  );
}

function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function SectionsModule() {
  const { spec, edit, catalog } = useComposer();
  const [kind, setKind] = useState<SectionKind>("verse");
  const [label, setLabel] = useState("");
  const kindId = useId();
  const labelId = useId();
  const sections = spec.D7.sections;
  return (
    <Module number={9} title="Sections" owns="D7 sections: bars, scope, cues, dynamics, pocket">
      <datalist id="cue-refs">
        {cueRefOptions(catalog).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </datalist>
      {sections.map((section, i) => {
        const base = `/D7/sections/${i}`;
        return (
          <details className="section-card" key={section.id} open>
            <summary>
              Section {i + 1}: {section.label} ({section.bars} bars)
            </summary>
            <div className="row">
              <TextField path={`${base}/label`} label={`Section ${i + 1} label`} />
              <SelectField path={`${base}/kind`} label={`Section ${i + 1} kind`} options={SECTION_KINDS} />
              <NumberField path={`${base}/bars`} label={`Section ${i + 1} bars`} min={1} hint="8 or 16 by convention." />
              <SelectField path={`${base}/dynamics`} label={`Section ${i + 1} dynamics`} options={DYNAMICS} />
              <SelectField path={`${base}/modeId`} label={`Section ${i + 1} mode`} optional options={modeOptions(catalog, spec.D10.activeTarget)} />
            </div>
            <IdPicker path={`${base}/scope/instrumentIds`} label={`Section ${i + 1} instruments`} options={instrumentOptions(catalog)} hint="Counts toward the section cap (SC-1)." />
            <IdPicker path={`${base}/scope/synthRoleIds`} label={`Section ${i + 1} synth roles`} options={synthRoleOptions(catalog)} />
            <IdPicker path={`${base}/scope/percussionRhythmIds`} label={`Section ${i + 1} rhythms`} options={rhythmOptions(catalog)} hint="Checked against the meter lock (ML-2)." />
            <CueEditor index={i} section={section} />
            <div className="row">
              <SelectField path={`${base}/openPocket/kind`} label={`Section ${i + 1} open pocket`} options={POCKET_KINDS} />
              {section.openPocket.kind !== "none" ? <TextField path={`${base}/openPocket/note`} label={`Section ${i + 1} pocket note`} optional /> : null}
            </div>
            <TextField path={`${base}/styleClause`} label={`Section ${i + 1} style clause`} optional hint="One clause for the style field, for example the bridge's drop." />
            <TextField path={`${base}/harmony`} label={`Section ${i + 1} harmony`} optional hint="Blueprint only." />
            <LinesField path={`${base}/notes`} label={`Section ${i + 1} blueprint notes`} hint="Word-MIDI notes; linted, never sent to an engine." />
            <div className="row-actions">
              <button type="button" disabled={i === 0} onClick={() => edit([op("set", "/D7/sections", moved(sections, i, i - 1))], `Move section ${i + 1} up`)}>
                Move section {i + 1} up
              </button>
              <button type="button" disabled={i === sections.length - 1} onClick={() => edit([op("set", "/D7/sections", moved(sections, i, i + 1))], `Move section ${i + 1} down`)}>
                Move section {i + 1} down
              </button>
              <button type="button" className="danger" onClick={() => edit([op("remove", base)], `Remove section ${i + 1}`)}>
                Remove section {i + 1}
              </button>
            </div>
          </details>
        );
      })}
      <div className="add-row">
        <label htmlFor={kindId}>New section kind</label>
        <select id={kindId} value={kind} onChange={(e) => setKind(e.target.value as SectionKind)}>
          {SECTION_KINDS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label htmlFor={labelId}>New section label</label>
        <input id={labelId} type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button
          type="button"
          disabled={!label.trim()}
          onClick={() => {
            const text = label.trim();
            edit([op("append", "/D7/sections", defaultSection(sectionId(text, sections), kind, text))], `Add section ${text}`);
            setLabel("");
          }}
        >
          Add section
        </button>
      </div>
    </Module>
  );
}

export function TransitionsModule() {
  const { spec, edit, catalog } = useComposer();
  const [selected, setSelected] = useState(0);
  const pickId = useId();
  const sections = spec.D7.sections;
  const index = Math.min(selected, Math.max(sections.length - 1, 0));
  const section = sections[index];
  const base = `/D7/sections/${index}`;
  const lock = spec.D6.meterLock;
  return (
    <Module number={8} title="Transitions" owns="D7 block rule, pickups, silence drops, contrast phrases">
      <OptionalBlock
        label="State a block transition rule"
        present={Boolean(spec.D7.blockRule)}
        onAdd={() => edit([op("set", "/D7/blockRule", { kinds: ["riser"], everyBars: [8, 16] })], "Add block rule")}
        onRemove={() => edit([op("remove", "/D7/blockRule")], "Remove block rule")}
      >
        <CheckboxList
          legend="Block transitions"
          path="/D7/blockRule/kinds"
          values={spec.D7.blockRule?.kinds ?? []}
          options={TRANSITION_KINDS.filter((o) => o.value !== "none" && o.value !== "silence")}
        />
        <NumberListField path="/D7/blockRule/everyBars" label="Every n bars" />
        <TextField path="/D7/blockRule/phraseOverride" label="Block rule wording" optional />
      </OptionalBlock>
      {section ? (
        <>
          <div className="field">
            <label htmlFor={pickId}>Section to edit</label>
            <select id={pickId} value={index} onChange={(e) => setSelected(Number(e.target.value))}>
              {sections.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.label}
                </option>
              ))}
            </select>
          </div>
          <OptionalBlock
            label="Pickup bar before this section"
            present={Boolean(section.pickupBefore)}
            onAdd={() => edit([op("set", `${base}/pickupBefore`, { beats: 2, content: "", returnTo: lock.signature })], "Add pickup")}
            onRemove={() => edit([op("remove", `${base}/pickupBefore`)], "Remove pickup")}
          >
            <SelectField path={`${base}/pickupBefore/beats`} label="Pickup length" options={BEATS} numeric />
            <TextField path={`${base}/pickupBefore/content`} label="Pickup content" />
            <SelectField path={`${base}/pickupBefore/returnTo`} label="Pickup returns to" options={SIGNATURES} />
            <CheckboxField path={`${base}/pickupBefore/announce`} label="Announce the pickup bar" defaultValue />
          </OptionalBlock>
          <OptionalBlock
            label="Contrast phrase in this section"
            present={Boolean(section.contrast)}
            onAdd={() =>
              edit(
                [op("set", `${base}/contrast`, { styleId: Object.keys(catalog.drumPatterns)[0] ?? "", bars: 4, position: "end", changes: [], returnRule: "" })],
                "Add contrast phrase",
              )
            }
            onRemove={() => edit([op("remove", `${base}/contrast`)], "Remove contrast phrase")}
          >
            <SelectField path={`${base}/contrast/styleId`} label="Contrast style" options={contrastStyleOptions(catalog)} />
            <NumberField path={`${base}/contrast/bars`} label="Contrast bars" min={1} />
            <SelectField path={`${base}/contrast/position`} label="Contrast position" options={POSITIONS} />
            <LinesField path={`${base}/contrast/changes`} label="Contrast changes" />
            <TextField path={`${base}/contrast/returnRule`} label="Contrast return rule" hint="Required (CP-1), for example 'then back to trap grid'." />
            <TextField path={`${base}/contrast/label`} label="Contrast style word" optional />
          </OptionalBlock>
          <OptionalBlock
            label="Silence drop"
            present={Boolean(section.silenceAfter)}
            onAdd={() => edit([op("set", `${base}/silenceAfter`, { beats: 1, position: "end" })], "Add silence drop")}
            onRemove={() => edit([op("remove", `${base}/silenceAfter`)], "Remove silence drop")}
          >
            <NumberField path={`${base}/silenceAfter/beats`} label="Silence beats" min={1} max={8} />
            <SelectField path={`${base}/silenceAfter/position`} label="Silence position" options={POSITIONS} />
          </OptionalBlock>
          <fieldset className="group">
            <legend>Transition out</legend>
            <SelectField path={`${base}/transitionOut/kind`} label="Transition out" options={TRANSITION_KINDS} />
            {section.transitionOut.kind !== "none" ? (
              <>
                <TextField path={`${base}/transitionOut/note`} label="Transition wording" optional />
                <CheckboxField path={`${base}/transitionOut/bracket`} label="Its own bracket" />
              </>
            ) : null}
          </fieldset>
        </>
      ) : (
        <p className="hint">Add a section to edit its transitions.</p>
      )}
    </Module>
  );
}
