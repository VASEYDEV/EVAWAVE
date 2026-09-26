#!/usr/bin/env node
/**
 * Generates the instrument bank in src/data/taxonomy/instruments/ from
 * docs/evawave/instrument-bank-seed-v0.1.md (docs/SPEC.md §3, S3). The seed is read, never
 * written. The output is deterministic: the same seed always gives the same bytes, and
 * `--check` fails when the committed files are out of date or the seed has changed.
 *
 * Generated from the seed's enumerable sections:
 *   §1   General MIDI Level 1 programs, with the family defaults and curation notes
 *   §2   General MIDI percussion notes (GM1 35–81, GM2 27–34 and 82–87)
 *   §8.2 drum machines and digitized-sample kits
 *   §9   world sets
 * Left for curation batches (they are prose, not records): §3 GS/XG, §4 orchestral, §5 band,
 * §6 contemporary, §7 synth archetypes (SynthRole), §8.1 and §8.3 kits (DrumPattern) and the
 * GM2 kits. manifest.json lists them with the reason.
 *
 * A seed item that names an instrument already in the bank (the curated
 * src/data/taxonomy/instruments.json, or an earlier generated record) is merged into it
 * and listed in the manifest, never duplicated. The curated record always wins.
 *
 * Usage: node scripts/build-instrument-bank.mjs            write the files
 *        node scripts/build-instrument-bank.mjs --check    exit 1 if they are out of date
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SEED_PATH = "docs/evawave/instrument-bank-seed-v0.1.md";
const OUT_DIR = "src/data/taxonomy/instruments";

const REGISTERS = ["sub", "bass", "low-mid", "mid", "high-mid", "high"];
const ROLES = ["lead", "stab", "sub", "bass", "pad", "arp", "texture", "rhythm", "drone", "counter", "keys", "pluck"];
const UNVERIFIED = { suno: "unverified", eleven: "unverified", flow: "unverified" };

/** GM family label → Instrument.family, with per-program exceptions (seed §1 defaults column). */
const GM_FAMILY = {
  Piano: "keyboard",
  "Chromatic percussion": "percussion",
  Organ: "keyboard",
  Guitar: "string",
  Bass: "string",
  "Strings (solo/section)": "string",
  Ensemble: "string",
  Brass: "brass",
  Reed: "wind",
  Pipe: "wind",
  "Synth lead": "electronic",
  "Synth pad": "electronic",
  "Synth effects": "electronic",
  Percussive: "percussion",
  "Sound effects": "other",
};
const GM_FAMILY_EXCEPTIONS = { 23: "wind", 39: "electronic", 40: "electronic", 48: "percussion", 51: "electronic", 52: "electronic", 53: "voice", 54: "voice", 55: "electronic", 56: "other", 63: "electronic", 64: "electronic" };
/** Seed §1 curation note: GM's "Ethnic" programs are filed in their regional sets (§9). */
const GM_ETHNIC = new Set([105, 106, 107, 108, 109, 110, 111, 112]);
/** Seed §2 mapping rule: GM percussion notes with a KitPiece. */
const KIT_PIECE = { 36: "kick", 38: "snare", 39: "clap", 37: "rim", 42: "hat-closed", 46: "hat-open", 49: "crash", 57: "crash", 51: "ride", 41: "perc-2", 43: "perc-2", 45: "perc-2", 47: "perc-1", 48: "perc-1", 50: "perc-1" };
/** Seed items that name a GM record under another spelling. */
const SAME_AS = { steelpan: "steel drums" };
/** Seed items whose qualifier names a different instrument, not a regional variant. */
const KEEP_QUALIFIED = new Set(["tar (frame drum)"]);

export function kebab(text) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lower-case, accent-free, single-spaced: the key two spellings share. */
function norm(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The body of the section whose heading starts with `heading`, up to the next heading of the same or higher level. */
export function sectionOf(md, heading) {
  const lines = md.split("\n");
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start < 0) throw new Error(`seed has no section '${heading}'`);
  const level = /^#+/.exec(heading)?.[0].length ?? 2;
  const end = lines.findIndex((line, i) => i > start && /^#+ /.test(line) && (/^#+/.exec(line)?.[0].length ?? 9) <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

function tableRows(text) {
  return text
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
    .slice(1)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

/** "low-mid–high" → ['low-mid', 'mid', 'high-mid', 'high']; "full range" → every register. */
function registerRange(text) {
  if (/full range/.test(text)) return [...REGISTERS];
  const match = /\b(sub|bass|low-mid|mid|high-mid|high)–(sub|bass|low-mid|mid|high-mid|high)\b/.exec(text);
  if (!match) return [];
  const [from, to] = [REGISTERS.indexOf(match[1]), REGISTERS.indexOf(match[2])];
  return REGISTERS.slice(from, to + 1);
}

function rolesFrom(text) {
  const listed = /roles: ([^;]+)/.exec(text)?.[1] ?? "";
  return listed
    .split(",")
    .map((role) => role.replace(/\(.*?\)/g, "").trim())
    .filter((role) => ROLES.includes(role));
}

/** "Acoustic Guitar (nylon)" → "nylon acoustic guitar"; "Slap Bass 1" → "slap bass". */
function gmPromptPhrase(name, family) {
  const qualified = /^(.+?) \((.+)\)$/.exec(name);
  let phrase = qualified ? `${qualified[2]} ${qualified[1]}` : name;
  phrase = phrase.replace(/ \d+\b/g, "").toLowerCase();
  if (family === "Synth effects") phrase = phrase.replace(/\bfx\b/, "synth effect");
  if (family === "Synth lead" || family === "Synth pad") phrase = `${phrase.replace(/\b(lead|pad)\b/, "synth $1")}`;
  return phrase.replace(/\s+/g, " ").trim();
}

/** The index of `needle` in `text` outside parentheses, or -1. */
function topLevelIndex(text, needle) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") depth--;
    if (depth === 0 && text.startsWith(needle, i)) return i;
  }
  return -1;
}

/** Splits on commas and semicolons outside parentheses. */
function splitItems(text) {
  const items = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if ((ch === "," || ch === ";") && depth === 0) {
      items.push(current);
      current = "";
    } else current += ch;
  }
  items.push(current);
  return items.map((item) => item.trim().replace(/\.$/, "")).filter(Boolean);
}

function record(fields) {
  return {
    id: fields.id,
    name: fields.name,
    family: fields.family,
    region: fields.region ?? null,
    register: fields.register ?? [],
    timbre: fields.timbre ?? [],
    articulationIds: fields.articulationIds ?? [],
    playStyles: fields.playStyles ?? [],
    idiomaticRoles: fields.idiomaticRoles ?? [],
    aliases: fields.aliases ?? {},
    reliability: fields.reliability ?? { ...UNVERIFIED },
    bundleIds: fields.bundleIds ?? [],
    description: fields.description,
    promptPhrase: fields.promptPhrase,
    commonNames: fields.commonNames ?? [],
  };
}

/** Tracks every name the bank already answers to, so a seed item never duplicates a record. */
class Bank {
  constructor(curated) {
    this.keys = new Map();
    this.merged = [];
    for (const r of curated) this.index(r, "curated");
  }
  index(r, source) {
    for (const key of [r.id.replace(/-/g, " "), r.name, ...r.commonNames].map(norm)) {
      if (!this.keys.has(key)) this.keys.set(key, { id: r.id, source });
    }
  }
  find(...names) {
    for (const name of names) {
      const key = norm(SAME_AS[norm(name)] ?? name);
      const hit = this.keys.get(key) ?? this.keys.get(key.replace(/s$/, "")) ?? this.keys.get(`${key}s`);
      if (hit) return hit;
    }
    return undefined;
  }
  /** Adds `r` unless the bank already has it; returns whether it was added. */
  add(list, r, seedItem, ...names) {
    const hit = this.find(r.name, ...names) ?? (this.keys.has(norm(r.id.replace(/-/g, " "))) ? this.keys.get(norm(r.id.replace(/-/g, " "))) : undefined);
    if (hit) {
      this.merged.push({ seed: seedItem, into: hit.id, source: hit.source });
      return false;
    }
    list.push(r);
    this.index(r, "generated");
    return true;
  }
}

function gmPrograms(md, bank, example) {
  const out = [];
  for (const [familyLabel, programs, defaults] of tableRows(sectionOf(md, "## 1. General MIDI Level 1"))) {
    const register = registerRange(defaults);
    for (const entry of programs.split(" · ")) {
      const match = /^(\d+) (.+)$/.exec(entry.trim());
      if (!match) continue;
      const program = Number(match[1]);
      const gmName = match[2];
      if (GM_ETHNIC.has(program)) continue;
      const family = GM_FAMILY_EXCEPTIONS[program] ?? GM_FAMILY[familyLabel];
      let roles = rolesFrom(defaults);
      if (program === 48) roles = ["rhythm"];
      if (program === 56) roles = ["stab"];
      let fields = {
        id: kebab(gmName),
        name: gmName,
        family,
        register,
        idiomaticRoles: roles,
        description: `General MIDI program ${program} (seed §1, ${familyLabel}).`,
        promptPhrase: gmPromptPhrase(gmName, familyLabel),
        commonNames: [gmName],
      };
      // Seed §1 curation notes: GM 5/6 split into tine and reed/FM electric pianos; GM 24 is the bandoneon.
      if (program === 5) fields = { ...example, commonNames: [...example.commonNames, gmName], description: `${example.description} General MIDI program 5 (seed §1, §11).` };
      if (program === 6) fields = { ...fields, id: "electric-piano-reed-fm", name: "Reed and FM electric piano", promptPhrase: "reed electric piano", commonNames: ["Wurlitzer", "DX EP", gmName] };
      if (program === 24) fields = { ...fields, id: "bandoneon", name: "Bandoneon", promptPhrase: "bandoneon", commonNames: ["bandoneon", gmName] };
      bank.add(out, record(fields), `GM ${program} ${gmName}`, gmName);
    }
  }
  return out;
}

function gmPercussion(md, bank) {
  const out = [];
  const notes = [];
  const gm1 = sectionOf(md, "### 2.1 GM1 notes");
  for (const entry of gm1.trim().split(" · ")) {
    const match = /^(\d+) (.+)$/.exec(entry.trim());
    if (match) notes.push([Number(match[1]), match[2], "GM1"]);
  }
  for (const line of sectionOf(md, "### 2.2 GM2 additions").split("\n")) {
    const match = /^Notes (\d+)–(\d+): (.+)\.$/.exec(line.trim());
    if (!match) continue;
    match[3].split(" · ").forEach((name, i) => notes.push([Number(match[1]) + i, name.trim(), "GM2"]));
  }
  for (const [note, name, level] of notes) {
    const piece = KIT_PIECE[note];
    const fields = {
      id: kebab(name),
      name,
      family: "percussion",
      idiomaticRoles: ["rhythm"],
      description: `General MIDI percussion note ${note} (${level}, seed §2)${piece ? `; kit piece: ${piece}` : ""}.`,
      promptPhrase: name.toLowerCase(),
      commonNames: [name],
    };
    bank.add(out, record(fields), `GM note ${note} ${name}`, name);
  }
  return out;
}

function drumMachines(md, bank) {
  const section = sectionOf(md, "### 8.2 Drum machines");
  const shared = /Sampling and processing `playStyles` shared by these: (.+)\.$/m.exec(section)?.[1] ?? "";
  const playStyles = shared.split(",").map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const [phrase, trait, names] of tableRows(section)) {
    const fields = {
      id: kebab(phrase),
      name: phrase.charAt(0).toUpperCase() + phrase.slice(1),
      family: "electronic",
      playStyles,
      idiomaticRoles: ["rhythm"],
      description: `${trait.charAt(0).toUpperCase() + trait.slice(1)} (seed §8.2).`,
      promptPhrase: phrase,
      commonNames: names.split(",").map((n) => n.trim()).filter(Boolean),
    };
    // Match on the record phrase only: kits share brand names ("808") with single pieces.
    bank.add(out, record(fields), `§8.2 ${phrase}`, phrase);
  }
  return out;
}

function worldSets(md, bank) {
  const out = [];
  for (const line of sectionOf(md, "## 9. World sets").split("\n")) {
    const match = /^\*\*(.+?):\*\*\s*(.+)$/.exec(line.trim());
    if (!match) continue;
    const region = match[1].replace(/\s*\(.*\)$/, "").trim();
    let percussion = false;
    for (let item of splitItems(match[2])) {
      if (/^percussion:/i.test(item)) {
        percussion = true;
        item = item.replace(/^percussion:\s*/i, "");
      }
      const seedItem = `${region}: ${item}`;
      const withAt = topLevelIndex(item, " with ");
      const note = withAt < 0 ? "" : item.slice(withAt + 1);
      const bare = withAt < 0 ? item : item.slice(0, withAt);
      const qualifier = /\((.+)\)$/.exec(bare)?.[1];
      const base = KEEP_QUALIFIED.has(norm(bare)) ? bare : bare.replace(/\s*\(.+\)$/, "").trim();
      const andAt = topLevelIndex(base, " and ");
      const parts = andAt < 0 ? [base] : [base.slice(0, andAt), base.slice(andAt + 5)];
      for (const part of parts) {
        const synonyms = part.split("/").map((s) => s.trim()).filter(Boolean);
        const name = synonyms[0];
        if (!name) continue;
        const details = [qualifier && `(${qualifier})`, note].filter(Boolean).join(" ");
        const fields = {
          id: kebab(name),
          name: name.charAt(0).toUpperCase() + name.slice(1),
          family: percussion ? "percussion" : "other",
          region,
          idiomaticRoles: percussion ? ["rhythm"] : [],
          description: `${region} world set (seed §9)${details ? `; seed note: ${details}` : ""}.${percussion ? "" : " Family is assigned at curation."}`,
          promptPhrase: name.toLowerCase(),
          commonNames: synonyms,
        };
        bank.add(out, record(fields), seedItem, ...synonyms);
      }
    }
  }
  return out;
}

const NOT_GENERATED = [
  { section: "§2.2 GM2 drum kits", reason: "Kit presets are DrumPattern records, not instruments." },
  { section: "§3 GS and XG variation banks", reason: "The seed schedules them as a batch import from the published tables." },
  { section: "§4 Orchestral and symphonic", reason: "Prose lists that need curation into records (names lack their family noun, techniques are mixed in)." },
  { section: "§5 Concert, brass, marching and big band", reason: "Prose lists that need curation into records." },
  { section: "§6 Contemporary and popular", reason: "Prose lists that need curation into records (for example '12-string', 'electric humbucker')." },
  { section: "§7 Synthesizer archetypes", reason: "SynthRole records, not instruments." },
  { section: "§8.1 Acoustic drum kits and §8.3 genre kits", reason: "DrumPattern seeds whose grids are filled at curation." },
];

/** Every output file, keyed by path relative to the repo root, as the exact bytes to write. */
export function buildBank() {
  const seed = readFileSync(`${root}${SEED_PATH}`, "utf8");
  const curated = JSON.parse(readFileSync(`${root}src/data/taxonomy/instruments.json`, "utf8"));
  const techniques = new Set(JSON.parse(readFileSync(`${root}src/data/taxonomy/techniques.json`, "utf8")).map((t) => t.id));
  const bundles = new Set(JSON.parse(readFileSync(`${root}src/data/taxonomy/bundles.json`, "utf8")).map((b) => b.id));

  const exampleBlocks = [...sectionOf(seed, "## 11. Example records").matchAll(/```json\n([\s\S]+?)\n```/g)].map((m) => JSON.parse(m[1]));
  const tineExample = exampleBlocks.find((r) => r.id === "electric-piano-tine");
  if (!tineExample) throw new Error("seed §11 has no electric-piano-tine example");
  const example = {
    ...tineExample,
    articulationIds: tineExample.articulationIds.filter((id) => techniques.has(id)),
    bundleIds: tineExample.bundleIds.filter((id) => bundles.has(id)),
  };

  const bank = new Bank(curated);
  const files = {
    "gm-programs.json": gmPrograms(seed, bank, example),
    "gm-percussion.json": gmPercussion(seed, bank),
    "drum-machines.json": drumMachines(seed, bank),
    "world.json": worldSets(seed, bank),
  };
  const manifest = {
    seed: SEED_PATH,
    seedSha256: createHash("sha256").update(seed).digest("hex"),
    generator: "scripts/build-instrument-bank.mjs",
    counts: Object.fromEntries(Object.entries(files).map(([name, records]) => [name, records.length])),
    mergedIntoExisting: bank.merged,
    notGenerated: NOT_GENERATED,
  };
  const out = {};
  for (const [name, records] of Object.entries(files)) out[`${OUT_DIR}/${name}`] = `${JSON.stringify(records, null, 2)}\n`;
  out[`${OUT_DIR}/manifest.json`] = `${JSON.stringify(manifest, null, 2)}\n`;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = buildBank();
  if (process.argv.includes("--check")) {
    const stale = Object.entries(files).filter(([path, bytes]) => {
      try {
        return readFileSync(`${root}${path}`, "utf8") !== bytes;
      } catch {
        return true;
      }
    });
    if (stale.length) {
      console.error(`instrument bank out of date: ${stale.map(([p]) => p).join(", ")}. Run node scripts/build-instrument-bank.mjs`);
      process.exit(1);
    }
    console.log("instrument bank matches the seed");
  } else {
    mkdirSync(`${root}${OUT_DIR}`, { recursive: true });
    for (const [path, bytes] of Object.entries(files)) writeFileSync(`${root}${path}`, bytes);
    console.log(`wrote ${Object.keys(files).join(", ")}`);
  }
}
