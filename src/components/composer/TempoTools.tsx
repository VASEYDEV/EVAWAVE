"use client";

/**
 * Tap tempo and the metronome, in the Engine + Form module (docs/SPEC.md §1.8). Assign writes
 * the rounded BPM to `D6.tempo.bpm` with `source: 'tap'`; bar math updates at once.
 */
import { useEffect, useId, useRef, useState } from "react";

import { beatsPerBar } from "@/core/musicspec/barmath";
import { assignableBpm, emptyTaps, lastTapAt, reading, tap, TAP_RESET_MS, TEMPO_MAX_BPM, TEMPO_MIN_BPM, type MetronomeSettings } from "@/core/musicspec/tempo";
import { Metronome } from "@/lib/audio/metronome";

import { op, useComposer } from "./state";

function fmt(bpm: number | null): string {
  return bpm === null ? "–" : String(Math.round(bpm));
}

export function TempoTools() {
  const { spec, edit } = useComposer();
  const [taps, setTaps] = useState(emptyTaps);
  const [running, setRunning] = useState(false);
  const [halfTime, setHalfTime] = useState(spec.D6.meterLock.feel === "half-time");
  const [subdivision, setSubdivision] = useState<MetronomeSettings["subdivision"]>(1);
  const [volume, setVolume] = useState(0.5);
  const metronome = useRef<Metronome | null>(null);
  const subId = useId();
  const volumeId = useId();
  const halfId = useId();

  const bpm = reading(taps).bpm;
  // Only a tempo the tempo field would accept can be assigned.
  const assignable = assignableBpm(taps);
  const settings: MetronomeSettings = { bpm: spec.D6.tempo.bpm, beatsPerBar: beatsPerBar(spec.D6.meterLock.signature), halfTimeAccent: halfTime, subdivision };

  // Clear the reading once the sequence times out (§1.8: 2 s without a tap, kept or discarded, resets).
  useEffect(() => {
    const last = lastTapAt(taps);
    if (last === undefined) return;
    const timer = setTimeout(() => setTaps(emptyTaps()), Math.max(0, last + TAP_RESET_MS - performance.now()) + 1);
    return () => clearTimeout(timer);
  }, [taps]);

  useEffect(() => {
    metronome.current?.update(settings, volume);
  });

  useEffect(() => () => void metronome.current?.stop(), []);

  const toggle = async () => {
    if (running) {
      await metronome.current?.stop();
      setRunning(false);
      return;
    }
    metronome.current ??= new Metronome(settings, volume);
    try {
      await metronome.current.start();
      setRunning(true);
    } catch {
      setRunning(false);
    }
  };

  return (
    <fieldset className="group tempo-tools">
      <legend>Tap tempo and metronome</legend>
      <div className="row-actions">
        <button type="button" className="tap" onClick={() => setTaps((s) => tap(s, performance.now()))}>
          Tap
        </button>
        <p aria-live="polite" className="readout" data-testid="tap-reading">
          {bpm === null
            ? "Tap four times on the beat."
            : `${fmt(bpm)} BPM · half ${fmt(reading(taps).halfTime)} · double ${fmt(reading(taps).doubleTime)}${taps.discarded ? " · last tap ignored" : ""}${assignable === null ? ` · outside ${TEMPO_MIN_BPM}–${TEMPO_MAX_BPM}, not assignable` : ""}`}
        </p>
        <button
          type="button"
          disabled={assignable === null}
          onClick={() => assignable !== null && edit([op("set", "/D6/tempo/bpm", assignable), op("set", "/D6/tempo/source", "tap")], "Assign tapped tempo")}
        >
          Assign {assignable === null ? "" : `${assignable} BPM`}
        </button>
      </div>
      <div className="row-actions">
        <button type="button" aria-pressed={running} onClick={() => void toggle()}>
          {running ? "Stop metronome" : "Start metronome"}
        </button>
        <div className="field field-check">
          <input id={halfId} type="checkbox" checked={halfTime} onChange={(e) => setHalfTime(e.target.checked)} />
          <label htmlFor={halfId}>Half-time accents (1 and 3)</label>
        </div>
        <div className="field">
          <label htmlFor={subId}>Subdivision clicks</label>
          <select id={subId} value={subdivision} onChange={(e) => setSubdivision(Number(e.target.value) as MetronomeSettings["subdivision"])}>
            <option value={1}>Off</option>
            <option value={2}>8ths</option>
            <option value={4}>16ths</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={volumeId}>Metronome volume</label>
          <input id={volumeId} type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        </div>
      </div>
    </fieldset>
  );
}
