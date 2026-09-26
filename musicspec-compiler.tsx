import React, { useMemo, useState } from "react";

/* ============================================================================
   VASEY.AUDIO × VASEY/AI — MusicSpec Compiler · v0.2 core
   ----------------------------------------------------------------------------
   Everything above the React component is pure logic. Lift `compileSuno`,
   `compileEleven`, `resolveLineage`, and the type-shape comments straight into
   serializers.ts when wiring the Next.js app. No UI dependencies in here.

   CANONICAL MusicSpec (v0.2) — the reconciled spine:
   {
     spec_version, title,
     intent:   { mode, targets[], duration_ms, instrumental },        // Output Intent
     genre:    [{ tag, weight }],                                     // D1 / Module A
     tone:     { valence, intensity, moods[], atmosphere[] },         // D2 / A·B
     dynamics: { range, bpm, feel, time_signature, energy_curve[] },  // D3 / C
     lineage:  { era, packs:[{ id, weight }] },                       // D4 / E
     instrumentation: { lead, harmony, bass, percussion, texture },   // D5 / D
                       // each slot: { instrument, articulation, register? }
     theory:   { key, mode, progression[], harmonic_rhythm, cadence },// D6 / F
     structure:[{ name, duration_ms, energy, delta[], lines[] }],     // D7 / H
     vocals:   { type, register, delivery, stacking[], language, adlibs }, // D8 / G
     production:[ str ],                                              // D9 / I
     negative: { global:[ str ], per_section:{ [name]: str[] } },     // D10
     meta:     { seed, notes }
   }
   Design rule (carried from Draft v0.1): every dimension is optional. The
   compiler fills nothing silently — unset dimensions are omitted, never faked.
============================================================================ */

/* --- Lineage Packs -------------------------------------------------------- */
/* The moat. Names map to weighted trait descriptors; names never leave the
   client. Two seed packs so trait injection is real and inspectable. */
const LINEAGE_PACKS = {
  "zimmer.hybrid_score": {
    display: "Hybrid Cinematic Score",
    traits: {
      production: ["cinematic wide mix", "long reverb tails", "hybrid orchestral textures"],
      instrumentation: ["low brass swells", "ostinato string pulse"],
      tone: ["epic", "foreboding"],
    },
  },
  "metro.dark_trap": {
    display: "Dark Modern Trap",
    traits: {
      production: ["sub-heavy low end", "tape saturation on drums"],
      instrumentation: ["808 with pitch glides", "triplet trap hats"],
      tone: ["menacing"],
    },
  },
};

function resolveLineage(spec) {
  // Returns descriptor arrays injected by packs, de-duplicated against nothing
  // here (the UI owns user-set values; this stays pure & additive).
  const out = { production: [], instrumentation: [], tone: [] };
  (spec.lineage?.packs || []).forEach(({ id }) => {
    const pack = LINEAGE_PACKS[id];
    if (!pack) return;
    Object.entries(pack.traits).forEach(([dim, arr]) => {
      arr.forEach((t) => { if (!out[dim].includes(t)) out[dim].push(t); });
    });
  });
  return out;
}

/* --- helpers -------------------------------------------------------------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ms = (n) => `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}s`;
const dedupe = (arr) => [...new Set(arr.filter(Boolean))];

/* --- Suno serializer ------------------------------------------------------ */
/* style_field front-load order (Draft §5.2):
   genre stack → mood → key instruments → vocal character → production → era → "{bpm} BPM" */
function compileSuno(spec) {
  const inj = resolveLineage(spec);

  const genre = (spec.genre || [])
    .slice().sort((a, b) => b.weight - a.weight).map((g) => g.tag);
  const mood = spec.tone?.moods || [];
  const instruments = dedupe([
    spec.instrumentation?.lead?.instrument,
    spec.instrumentation?.harmony?.instrument,
    spec.instrumentation?.bass?.instrument,
    spec.instrumentation?.percussion?.instrument,
    spec.instrumentation?.texture?.instrument,
    ...inj.instrumentation,
  ]);
  const vocal = spec.intent?.instrumental
    ? ["instrumental"]
    : dedupe([
        `${spec.vocals?.type || ""} ${spec.vocals?.register || ""} vocals`.trim(),
        spec.vocals?.delivery,
      ]);
  const production = dedupe([...(spec.production || []), ...inj.production]);
  const theory = [spec.theory?.key && spec.theory?.mode
    ? `${spec.theory.key} ${spec.theory.mode}` : null];
  const era = spec.lineage?.era ? [`${spec.lineage.era} production`] : [];
  const bpm = spec.dynamics?.bpm ? [`${spec.dynamics.bpm} BPM`] : [];

  const ordered = dedupe([
    ...genre, ...mood, ...theory, ...instruments, ...vocal, ...production, ...era, ...bpm,
  ]);
  let style = ordered.join(", ");

  // 1,000-char budget — front-loaded, so truncation drops the least-critical tail.
  const LIMIT = 1000;
  let truncated = null;
  if (style.length > LIMIT) {
    const cut = style.lastIndexOf(", ", LIMIT);
    truncated = style.slice(0, cut > 0 ? cut : LIMIT);
  }

  // lyrics_field: sections → [Name, cues] + lines; instrumental → [Instrumental Break]
  const lyrics = (spec.structure || []).map((s) => {
    const head = `[${s.name}${s.delta?.length ? ` — ${s.delta.join("; ")}` : ""}]`;
    if (!s.lines?.length) return `${head}\n[Instrumental Break]`;
    return `${head}\n${s.lines.join("\n")}`;
  }).join("\n\n");

  const exclude = (spec.negative?.global || []).join(", ");

  // Extension Kit — re-paste at every extend to defeat drift (Draft §5.2).
  const extensionKit = dedupe([...genre.slice(0, 3), ...bpm, ...theory]).join(", ");

  return { style, styleLength: style.length, truncated, lyrics, exclude, extensionKit };
}

/* --- Eleven serializer ---------------------------------------------------- */
/* Full mode composition_plan (Draft §5.3). */
function compileEleven(spec) {
  const inj = resolveLineage(spec);
  const genre = (spec.genre || []).slice().sort((a, b) => b.weight - a.weight).map((g) => g.tag);
  const leads = dedupe([
    spec.instrumentation?.lead?.instrument,
    spec.instrumentation?.bass?.instrument,
    ...inj.instrumentation,
  ]);
  const positive_global_styles = dedupe([
    ...genre,
    ...(spec.tone?.moods || []),
    ...leads,
    spec.dynamics?.bpm ? `${spec.dynamics.bpm} BPM` : null,
    spec.theory?.key && spec.theory?.mode ? `${spec.theory.key} ${spec.theory.mode}` : null,
    ...dedupe([...(spec.production || []), ...inj.production]).slice(0, 3),
  ]);
  const negative_global_styles = dedupe(spec.negative?.global || []);

  const sections = (spec.structure || []).slice(0, 30).map((s) => ({
    section_name: (s.name || "Section").slice(0, 100),
    duration_ms: clamp(s.duration_ms || 8000, 3000, 120000),
    positive_local_styles: dedupe(s.delta || []).slice(0, 50),
    negative_local_styles: dedupe(spec.negative?.per_section?.[s.name] || []).slice(0, 50),
    lines: s.lines || [],
  }));

  const music_length_ms = sections.reduce((a, s) => a + s.duration_ms, 0);

  return {
    composition_plan: { positive_global_styles, negative_global_styles, sections },
    music_length_ms,
    force_instrumental: !!spec.intent?.instrumental,
    model_id: "music_v1",
  };
}

/* --- Linter --------------------------------------------------------------- */
function lint(spec, suno, eleven) {
  const out = [];
  if (suno.styleLength > 1000)
    out.push({ level: "warn", msg: `Suno style field is ${suno.styleLength}/1000 chars — tail will be silently truncated. Front-loaded, so lowest-priority descriptors drop first.` });
  const overlong = eleven.composition_plan.sections.filter((s) => s.duration_ms >= 120000);
  if (overlong.length) out.push({ level: "warn", msg: `${overlong.length} section(s) hit the Eleven 120,000ms ceiling and were clamped.` });
  if (eleven.composition_plan.sections.length > 30)
    out.push({ level: "warn", msg: "More than 30 sections — Eleven accepts max 30; extras dropped." });
  const curve = spec.dynamics?.energy_curve?.length || 0;
  const secs = spec.structure?.length || 0;
  if (curve && secs && curve !== secs)
    out.push({ level: "info", msg: `Energy curve has ${curve} points but there are ${secs} sections — they should align 1:1 for the timeline overlay.` });
  if (spec.dynamics?.bpm && (spec.dynamics.bpm < 60 || spec.dynamics.bpm > 200))
    out.push({ level: "info", msg: `BPM ${spec.dynamics.bpm} is outside Lyria's 60–200 live range — fine for Suno/Eleven, will clamp for JAM mode.` });
  if (!out.length) out.push({ level: "ok", msg: "Spec compiles clean across both targets." });
  return out;
}

/* --- Worked example (Jinn-adjacent, from Draft v0.1) ---------------------- */
const EXAMPLE_SPEC = {
  spec_version: "0.2",
  title: "untitled-session",
  intent: { mode: "create", targets: ["eleven", "suno"], duration_ms: 180000, instrumental: false },
  genre: [
    { tag: "cinematic orchestral", weight: 0.6 },
    { tag: "trap", weight: 0.4 },
  ],
  tone: { valence: "dark", intensity: 8, moods: ["menacing", "triumphant"], atmosphere: ["vast", "ritual"] },
  dynamics: { range: "wide", bpm: 142, feel: "halftime", time_signature: "4/4", energy_curve: [3, 5, 9, 6, 10, 2] },
  lineage: { era: "modern", packs: [{ id: "zimmer.hybrid_score", weight: 0.5 }, { id: "metro.dark_trap", weight: 0.5 }] },
  instrumentation: {
    lead: { instrument: "solo duduk", articulation: "legato, ornamented" },
    harmony: { instrument: "low string ostinato", articulation: "staccato, pulsing" },
    bass: { instrument: "808 sub", articulation: "pitch glides" },
    percussion: { instrument: "hybrid orchestral + trap hats", articulation: "triplet rolls" },
    texture: { instrument: "distant choir pads", articulation: "swelling" },
  },
  theory: { key: "E", mode: "phrygian dominant", progression: ["i", "bII", "i", "bvii"], harmonic_rhythm: "1 chord / bar", cadence: "phrygian half-cadence into drops" },
  structure: [
    { name: "Intro", duration_ms: 15000, energy: 3, delta: ["solo duduk over drone"], lines: [] },
    { name: "Verse 1", duration_ms: 35000, energy: 5, delta: ["sparse 808", "hats enter"], lines: ["..."] },
    { name: "Hook", duration_ms: 30000, energy: 9, delta: ["full orchestra + 808s"], lines: ["..."] },
    { name: "Verse 2", duration_ms: 35000, energy: 6, delta: [], lines: ["..."] },
    { name: "Hook 2", duration_ms: 35000, energy: 10, delta: ["key center lifts", "drums double"], lines: ["..."] },
    { name: "Outro", duration_ms: 30000, energy: 2, delta: ["strip to duduk + drone"], lines: [] },
  ],
  vocals: { type: "male", register: "baritone", delivery: "half-sung, aggressive flow", stacking: ["doubled hooks"], language: "English", adlibs: "sparse" },
  production: ["cinematic wide mix", "sub-heavy low end", "tape saturation on drums", "long reverb tails"],
  negative: { global: ["edm build risers", "pop chord loops", "lo-fi crackle"], per_section: { Outro: ["heavy drums"] } },
  meta: { seed: null, notes: "Jinn-adjacent palette" },
};

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MODES = ["major", "minor", "dorian", "phrygian", "phrygian dominant", "lydian", "mixolydian", "harmonic minor", "double harmonic"];
const MODES_LIST = MODES;

/* ============================================================================
   UI — proof surface. VASEY design language; serializers above are the product.
============================================================================ */
export default function App() {
  const [spec, setSpec] = useState(EXAMPLE_SPEC);
  const [newNeg, setNewNeg] = useState("");
  const [copied, setCopied] = useState("");

  const suno = useMemo(() => compileSuno(spec), [spec]);
  const eleven = useMemo(() => compileEleven(spec), [spec]);
  const warnings = useMemo(() => lint(spec, suno, eleven), [spec, suno, eleven]);
  const injected = useMemo(() => resolveLineage(spec), [spec]);

  const set = (patch) => setSpec((s) => ({ ...s, ...patch }));
  const setIn = (key, patch) => setSpec((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  const copy = (label, text) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1400);
  };

  const elevenJson = JSON.stringify(
    { composition_plan: eleven.composition_plan, music_length_ms: eleven.music_length_ms, force_instrumental: eleven.force_instrumental, model_id: eleven.model_id },
    null, 2
  );

  const showSuno = spec.intent.targets.includes("suno");
  const showEleven = spec.intent.targets.includes("eleven");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
        :root{
          --void:#0A0E14; --panel:#0F1520; --panel2:#141B26; --line:#1E2733;
          --teal:#31E6C9; --teal-dim:rgba(49,230,201,.10); --teal-line:rgba(49,230,201,.32);
          --ink:#E8ECF1; --muted:#8A96A5; --warn:#F5B23E; --warn-dim:rgba(245,178,62,.12);
        }
        *{box-sizing:border-box}
        .vc-root{min-height:100vh;background:var(--void);color:var(--ink);
          font-family:'Inter',system-ui,sans-serif;font-size:14px;line-height:1.5;
          background-image:radial-gradient(900px 500px at 78% -10%, rgba(49,230,201,.06), transparent 60%);}
        .vc-wrap{max-width:1280px;margin:0 auto;padding:28px 22px 64px;}
        .vc-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;
          border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:24px;}
        .vc-mark{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:.06em;line-height:1;}
        .vc-mark b{color:var(--teal);font-weight:400;}
        .vc-sub{color:var(--muted);font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-top:6px;}
        .vc-ver{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);
          border:1px solid var(--line);border-radius:999px;padding:5px 11px;}
        .vc-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;position:relative;}
        /* signature: the diagonal teal beam dividing spec from compile rail */
        .vc-beam{position:absolute;top:-8px;bottom:-8px;left:50%;width:1px;
          background:linear-gradient(180deg,transparent,var(--teal-line) 12%,var(--teal) 50%,var(--teal-line) 88%,transparent);
          transform:translateX(-50%) skewX(-9deg);box-shadow:0 0 18px rgba(49,230,201,.35);pointer-events:none;}
        .vc-col{padding:0 26px;min-width:0;}
        .vc-col.left{padding-left:0;} .vc-col.right{padding-right:0;}
        .vc-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;
          text-transform:uppercase;color:var(--muted);margin:0 0 14px;}
        .vc-card{background:linear-gradient(180deg,var(--panel),rgba(15,21,32,.6));
          border:1px solid var(--line);border-radius:12px;padding:15px 16px;margin-bottom:12px;
          backdrop-filter:blur(6px);}
        .vc-card h4{margin:0 0 11px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:600;}
        .vc-row{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}
        .vc-chip{font-size:12px;padding:5px 10px;border-radius:7px;border:1px solid var(--teal-line);
          background:var(--teal-dim);color:var(--ink);display:inline-flex;align-items:center;gap:7px;}
        .vc-chip.neg{border-color:var(--warn);background:var(--warn-dim);}
        .vc-chip.inj{border-style:dashed;opacity:.85;}
        .vc-chip button{background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:0;line-height:1;}
        .vc-chip button:hover{color:var(--ink);}
        .vc-w{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--teal);}
        .vc-field{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:9px 0;}
        .vc-field label{color:var(--muted);font-size:12px;}
        .vc-field .val{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink);}
        input[type=range]{accent-color:var(--teal);width:150px;}
        select,input[type=text],input[type=number]{background:var(--panel2);color:var(--ink);
          border:1px solid var(--line);border-radius:7px;padding:6px 9px;font-family:inherit;font-size:12px;}
        select:focus,input:focus{outline:2px solid var(--teal);outline-offset:1px;}
        .vc-toggle{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;}
        .vc-toggle button{background:var(--panel2);color:var(--muted);border:none;padding:6px 12px;
          font-family:'JetBrains Mono',monospace;font-size:11px;cursor:pointer;letter-spacing:.04em;}
        .vc-toggle button.on{background:var(--teal-dim);color:var(--teal);box-shadow:inset 0 -2px 0 var(--teal);}
        .vc-sec{display:flex;align-items:center;gap:8px;margin:7px 0;}
        .vc-sec input[type=text]{flex:1;min-width:0;}
        .vc-sec .dur{width:78px;} .vc-sec .en{width:54px;}
        .vc-sec button.del{background:none;border:none;color:var(--muted);cursor:pointer;font-size:15px;}
        .vc-sec button.del:hover{color:var(--warn);}
        .vc-add{background:none;border:1px dashed var(--line);color:var(--muted);border-radius:7px;
          padding:6px 10px;font-size:12px;cursor:pointer;margin-top:6px;}
        .vc-add:hover{border-color:var(--teal-line);color:var(--teal);}
        .vc-out{background:#070A0F;border:1px solid var(--line);border-radius:10px;margin-bottom:14px;overflow:hidden;}
        .vc-out-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;
          border-bottom:1px solid var(--line);}
        .vc-out-head .t{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);font-weight:600;}
        .vc-meter{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);}
        .vc-meter.over{color:var(--warn);}
        .vc-copy{background:var(--teal-dim);border:1px solid var(--teal-line);color:var(--teal);
          border-radius:6px;padding:4px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;
          cursor:pointer;letter-spacing:.06em;text-transform:uppercase;}
        .vc-copy:hover{background:rgba(49,230,201,.18);}
        pre.vc-pay{margin:0;padding:14px;font-family:'JetBrains Mono',monospace;font-size:11.5px;line-height:1.6;
          color:#C8D2DD;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow:auto;}
        pre.vc-pay .k{color:var(--teal);}
        .vc-lint{display:flex;gap:9px;align-items:flex-start;font-size:12px;padding:9px 12px;border-radius:8px;
          margin-bottom:8px;border:1px solid var(--line);background:var(--panel);}
        .vc-lint .dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex-shrink:0;}
        .vc-lint.warn .dot{background:var(--warn);} .vc-lint.warn{border-color:var(--warn);background:var(--warn-dim);}
        .vc-lint.ok .dot{background:var(--teal);} .vc-lint.info .dot{background:var(--muted);}
        .vc-lint span{color:var(--ink);}
        .vc-note{font-size:11px;color:var(--muted);margin-top:4px;}
        @media (max-width:880px){
          .vc-grid{grid-template-columns:1fr;}
          .vc-beam{display:none;}
          .vc-col{padding:0;} .vc-col.right{margin-top:30px;border-top:1px solid var(--line);padding-top:24px;}
        }
        @media (prefers-reduced-motion:reduce){*{transition:none!important;}}
      `}</style>

      <div className="vc-root">
        <div className="vc-wrap">
          <header className="vc-head">
            <div>
              <div className="vc-mark">VASEY.AUDIO <b>×</b> VASEY/AI</div>
              <div className="vc-sub">MusicSpec Compiler — one spec, every engine grammar</div>
            </div>
            <div className="vc-ver">spec_v0.2 · core</div>
          </header>

          <div className="vc-grid">
            <div className="vc-beam" />

            {/* ---------------- SPEC (control surface) ---------------- */}
            <div className="vc-col left">
              <p className="vc-eyebrow">01 — MusicSpec (canonical IR)</p>

              <div className="vc-card">
                <h4>Intent</h4>
                <div className="vc-field">
                  <label>Targets</label>
                  <div className="vc-toggle">
                    {["suno", "eleven"].map((t) => (
                      <button key={t} className={spec.intent.targets.includes(t) ? "on" : ""}
                        onClick={() => setIn("intent", {
                          targets: spec.intent.targets.includes(t)
                            ? spec.intent.targets.filter((x) => x !== t)
                            : [...spec.intent.targets, t],
                        })}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="vc-field">
                  <label>Instrumental</label>
                  <div className="vc-toggle">
                    {[["false", "vocal"], ["true", "instrumental"]].map(([v, lbl]) => (
                      <button key={v} className={String(spec.intent.instrumental) === v ? "on" : ""}
                        onClick={() => setIn("intent", { instrumental: v === "true" })}>{lbl}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="vc-card">
                <h4>D1 · Genre stack</h4>
                <div className="vc-row">
                  {spec.genre.map((g, i) => (
                    <span key={g.tag} className="vc-chip">{g.tag}<span className="vc-w">{g.weight.toFixed(1)}</span>
                      <button aria-label={`remove ${g.tag}`}
                        onClick={() => set({ genre: spec.genre.filter((_, j) => j !== i) })}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="vc-card">
                <h4>D3 · Dynamics &amp; energy</h4>
                <div className="vc-field">
                  <label>BPM</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="range" min="60" max="200" value={spec.dynamics.bpm}
                      onChange={(e) => setIn("dynamics", { bpm: +e.target.value })} />
                    <span className="val">{spec.dynamics.bpm}</span>
                  </div>
                </div>
                <div className="vc-field">
                  <label>Feel</label>
                  <span className="val">{spec.dynamics.feel} · {spec.dynamics.time_signature}</span>
                </div>
              </div>

              <div className="vc-card">
                <h4>D6 · Theory</h4>
                <div className="vc-field">
                  <label>Key</label>
                  <select value={spec.theory.key} onChange={(e) => setIn("theory", { key: e.target.value })}>
                    {KEYS.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div className="vc-field">
                  <label>Mode</label>
                  <select value={spec.theory.mode} onChange={(e) => setIn("theory", { mode: e.target.value })}>
                    {MODES_LIST.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="vc-note">{spec.theory.progression.join(" – ")} · {spec.theory.cadence}</div>
              </div>

              <div className="vc-card">
                <h4>D4 · Lineage packs <span style={{ color: "var(--teal)", fontWeight: 400 }}>→ traits injected client-side</span></h4>
                <div className="vc-row" style={{ marginBottom: 10 }}>
                  {spec.lineage.packs.map((p) => (
                    <span key={p.id} className="vc-chip">{LINEAGE_PACKS[p.id]?.display || p.id}<span className="vc-w">{p.weight.toFixed(1)}</span></span>
                  ))}
                </div>
                <div className="vc-row">
                  {[...injected.production, ...injected.instrumentation, ...injected.tone].map((t) => (
                    <span key={t} className="vc-chip inj">{t}</span>
                  ))}
                </div>
                <div className="vc-note">Names never leave the client — only these descriptors reach the engines.</div>
              </div>

              <div className="vc-card">
                <h4>D7 · Structure</h4>
                {spec.structure.map((s, i) => (
                  <div className="vc-sec" key={i}>
                    <input type="text" value={s.name}
                      onChange={(e) => { const st = [...spec.structure]; st[i] = { ...s, name: e.target.value }; set({ structure: st }); }} />
                    <input className="dur" type="number" step="1000" value={s.duration_ms}
                      onChange={(e) => { const st = [...spec.structure]; st[i] = { ...s, duration_ms: +e.target.value }; set({ structure: st }); }} />
                    <input className="en" type="number" min="1" max="10" value={s.energy}
                      onChange={(e) => { const st = [...spec.structure]; st[i] = { ...s, energy: +e.target.value }; set({ structure: st }); }} />
                    <button className="del" aria-label="remove section"
                      onClick={() => set({ structure: spec.structure.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
                <button className="vc-add"
                  onClick={() => set({ structure: [...spec.structure, { name: "New Section", duration_ms: 20000, energy: 5, delta: [], lines: [] }] })}>
                  + add section
                </button>
              </div>

              <div className="vc-card">
                <h4>D10 · Negative space</h4>
                <div className="vc-row" style={{ marginBottom: 10 }}>
                  {spec.negative.global.map((n, i) => (
                    <span key={n} className="vc-chip neg">{n}
                      <button aria-label={`remove ${n}`}
                        onClick={() => setIn("negative", { global: spec.negative.global.filter((_, j) => j !== i) })}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" placeholder="exclude…" value={newNeg} style={{ flex: 1 }}
                    onChange={(e) => setNewNeg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newNeg.trim()) { setIn("negative", { global: dedupe([...spec.negative.global, newNeg.trim()]) }); setNewNeg(""); } }} />
                  <button className="vc-add" style={{ marginTop: 0 }}
                    onClick={() => { if (newNeg.trim()) { setIn("negative", { global: dedupe([...spec.negative.global, newNeg.trim()]) }); setNewNeg(""); } }}>add</button>
                </div>
              </div>
            </div>

            {/* ---------------- COMPILE RAIL ---------------- */}
            <div className="vc-col right">
              <p className="vc-eyebrow">02 — Compiled payloads</p>

              {warnings.map((w, i) => (
                <div key={i} className={`vc-lint ${w.level}`}>
                  <span className="dot" /><span>{w.msg}</span>
                </div>
              ))}

              {showSuno && (
                <>
                  <div className="vc-out" style={{ marginTop: 14 }}>
                    <div className="vc-out-head">
                      <span className="t">Suno · style field</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span className={`vc-meter ${suno.styleLength > 1000 ? "over" : ""}`}>{suno.styleLength}/1000</span>
                        <button className="vc-copy" onClick={() => copy("suno-style", suno.style)}>{copied === "suno-style" ? "copied" : "copy"}</button>
                      </div>
                    </div>
                    <pre className="vc-pay">{suno.truncated || suno.style}</pre>
                  </div>

                  <div className="vc-out">
                    <div className="vc-out-head">
                      <span className="t">Suno · lyrics field</span>
                      <button className="vc-copy" onClick={() => copy("suno-lyr", suno.lyrics)}>{copied === "suno-lyr" ? "copied" : "copy"}</button>
                    </div>
                    <pre className="vc-pay">{suno.lyrics}</pre>
                  </div>

                  <div className="vc-out">
                    <div className="vc-out-head">
                      <span className="t">Suno · exclude + extension kit</span>
                      <button className="vc-copy" onClick={() => copy("suno-ex", `EXCLUDE: ${suno.exclude}\nEXT KIT: ${suno.extensionKit}`)}>{copied === "suno-ex" ? "copied" : "copy"}</button>
                    </div>
                    <pre className="vc-pay"><span className="k">exclude</span>  {suno.exclude}{"\n"}<span className="k">ext kit</span>  {suno.extensionKit}</pre>
                  </div>
                </>
              )}

              {showEleven && (
                <div className="vc-out">
                  <div className="vc-out-head">
                    <span className="t">Eleven · composition_plan</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="vc-meter">{eleven.composition_plan.sections.length}/30 sec · {ms(eleven.music_length_ms)}</span>
                      <button className="vc-copy" onClick={() => copy("eleven", elevenJson)}>{copied === "eleven" ? "copied" : "copy"}</button>
                    </div>
                  </div>
                  <pre className="vc-pay">{elevenJson}</pre>
                </div>
              )}

              {!showSuno && !showEleven && (
                <div className="vc-card" style={{ marginTop: 14 }}>Select a target engine to compile.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
