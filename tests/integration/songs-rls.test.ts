import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MusicSpec } from "@/core/musicspec/ir/types";
import { diffSpecs, nextVariantLabel } from "@/core/musicspec/variants";
import { USER_SCOPED_TABLES } from "@/lib/library/schema";

import { openRlsDatabase, type RlsHarness } from "../support/rls";

/**
 * S6 acceptance (docs/SPEC.md §3): songs and variants are owner-only under RLS, variants are
 * immutable, a save or freeze only lands on the revision it read, nothing the client derives
 * or may not write reaches a variant, and forking Jinn v1.1 into v1.2 keeps the snapshots
 * whose diff is BPM 142 → 140. The real migrations run in PGlite over the Supabase shim
 * (tests/support/rls.ts).
 */
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const fixture = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8")) as MusicSpec;
const v11 = fixture("jinn-v1.1.spec.json");
const v12 = fixture("jinn-v1.2.spec.json");
const lineageNames = JSON.parse(readFileSync(fileURLToPath(new URL("../../src/data/lineage/names.json", import.meta.url)), "utf8")) as string[];

const SONG_TABLES = ["songs", "variants", "takes"] as const;

let h: RlsHarness;
/** Rows made in `beforeAll`: A's song with its first variant, and a second A song with one. */
const ids = { song: "", variant: "", other: "", otherVariant: "" };

const FREEZE = "select * from public.freeze_variant($1, $2, $3, $4::jsonb, $5)";
type Frozen = { variant_id: string; variant_label: string; song_revision: number; owner: string };

/** Creates a song as `user` and returns its id. */
async function song(user: string, title: string, spec: MusicSpec = v11): Promise<string> {
  const [row] = await h.as(user, () => h.rows("insert into public.songs (title, spec) values ($1, $2::jsonb) returning id", [title, JSON.stringify(spec)]));
  return String(row?.id);
}

async function revision(id: string): Promise<number> {
  const [row] = await h.truth("songs", "id = $1", [id]);
  return Number(row?.revision);
}

/** Freezes `id` as `user` at the song's current revision (or `rev`), with `spec` as the working copy. */
async function freeze(user: string | null, id: string, options: { spec?: unknown; parent?: string | null; rev?: number } = {}): Promise<Frozen> {
  const rev = options.rev ?? (await revision(id));
  const spec = options.spec ?? v11;
  const [row] = await h.as(user, () => h.rows(FREEZE, [id, rev, "Jinn", JSON.stringify(spec), options.parent ?? null]));
  return row as Frozen;
}

beforeAll(async () => {
  h = await openRlsDatabase([A, B]);
  ids.song = await song(A, "A song");
  ids.variant = (await freeze(A, ids.song)).variant_id;
  ids.other = await song(A, "Another A song");
  ids.otherVariant = (await freeze(A, ids.other)).variant_id;
});

afterAll(async () => {
  await h.db.close();
});

describe("songs and variants: user B against user A's rows", () => {
  it("registers the song tables as user-scoped, so the shared library suite covers them too", () => {
    expect(USER_SCOPED_TABLES).toEqual(expect.arrayContaining([...SONG_TABLES]));
  });

  it("A reads its song and variant (positive control)", async () => {
    expect(await h.as(A, () => h.rows("select id from public.songs where id = $1", [ids.song]))).toHaveLength(1);
    expect(await h.as(A, () => h.rows("select id from public.variants where id = $1", [ids.variant]))).toHaveLength(1);
  });

  it("B reads none of A's songs or variants", async () => {
    for (const table of SONG_TABLES) {
      expect(await h.as(B, () => h.rows(`select * from public.${table} where owner_id = $1`, [A]))).toEqual([]);
    }
    expect(await h.as(B, () => h.rows("select * from public.songs where id = $1", [ids.song]))).toEqual([]);
  });

  it("B can neither update nor delete A's song", async () => {
    const before = await h.truth("songs", "id = $1", [ids.song]);
    expect(await h.as(B, () => h.rows("update public.songs set title = 'stolen' where id = $1 returning id", [ids.song]))).toEqual([]);
    expect(await h.as(B, () => h.rows("delete from public.songs where id = $1 returning id", [ids.song]))).toEqual([]);
    expect(await h.truth("songs", "id = $1", [ids.song])).toEqual(before);
  });

  it("B cannot forge a song for A: the owner column is not writable", async () => {
    await expect(h.as(B, () => h.rows("insert into public.songs (owner_id, title, spec) values ($1, 'forged', $2::jsonb)", [A, JSON.stringify(v11)]))).rejects.toThrow(/permission denied/);
  });

  it("B cannot add a variant to A's song, directly or by freezing it", async () => {
    await expect(
      h.as(B, () => h.rows("insert into public.variants (song_id, spec_snapshot) values ($1, $2::jsonb)", [ids.song, JSON.stringify(v11)])),
    ).rejects.toThrow(/permission denied/);
    const rev = await revision(ids.song);
    await expect(freeze(B, ids.song, { rev })).rejects.toThrow(/changed elsewhere or is not yours/);
    expect(await revision(ids.song)).toBe(rev);
    expect(await h.truth("variants", "song_id = $1", [ids.song])).toHaveLength(1);
  });

  it("B cannot hang a variant under A's variant from a song of B's own", async () => {
    const mine = await song(B, "B song");
    await expect(freeze(B, mine, { parent: ids.variant })).rejects.toThrow(/foreign key/);
    expect(await h.truth("variants", "song_id = $1", [mine])).toEqual([]);
  });

  it("anon reads nothing and cannot freeze", async () => {
    for (const table of SONG_TABLES) await expect(h.as(null, () => h.rows(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    await expect(freeze(null, ids.song)).rejects.toThrow(/permission denied/);
  });
});

describe("variants are immutable", () => {
  it("the owner cannot update a variant", async () => {
    await expect(h.as(A, () => h.rows("update public.variants set spec_snapshot = $2::jsonb where id = $1", [ids.variant, JSON.stringify(v12)]))).rejects.toThrow(/permission denied/);
    await expect(h.as(A, () => h.rows("update public.variants set overrides = '[]' where id = $1", [ids.variant]))).rejects.toThrow(/permission denied/);
  });

  it("the owner cannot delete a variant", async () => {
    await expect(h.as(A, () => h.rows("delete from public.variants where id = $1", [ids.variant]))).rejects.toThrow(/permission denied/);
    expect(await h.truth("variants", "id = $1", [ids.variant])).toHaveLength(1);
  });

  it("the owner cannot insert a variant directly, only freeze one, so no variant skips the revision check", async () => {
    const before = await h.truth("variants", "song_id = $1", [ids.song]);
    await expect(
      h.as(A, () => h.rows("insert into public.variants (song_id, parent_variant_id, spec_snapshot) values ($1, $2, $3::jsonb)", [ids.song, ids.variant, JSON.stringify(v12)])),
    ).rejects.toThrow(/permission denied/);
    expect(await h.truth("variants", "song_id = $1", [ids.song])).toEqual(before);
  });

  it("the owner cannot choose a variant's sequence or rewrite a song's owner, brand or revision", async () => {
    await expect(h.as(A, () => h.rows("insert into public.variants (song_id, seq, spec_snapshot) values ($1, 99, $2::jsonb)", [ids.song, JSON.stringify(v11)]))).rejects.toThrow(/permission denied/);
    for (const set of [`owner_id = '${B}'`, "brand = 'VASEY.AUDIO'", "revision = 0", "created_at = now()"]) {
      await expect(h.as(A, () => h.rows(`update public.songs set ${set} where id = $1`, [ids.song]))).rejects.toThrow(/permission denied/);
    }
  });

  it("deleting a song removes its variants, which the owner could not delete one by one", async () => {
    const doomed = await song(A, "Doomed");
    const first = await freeze(A, doomed);
    await freeze(A, doomed, { parent: first.variant_id });
    expect(await h.truth("variants", "song_id = $1", [doomed])).toHaveLength(2);
    expect(await h.as(A, () => h.rows("delete from public.songs where id = $1 returning id", [doomed]))).toHaveLength(1);
    expect(await h.truth("variants", "song_id = $1", [doomed])).toEqual([]);
  });
});

describe("saving and freezing only land on the revision they read", () => {
  it("a save bumps the revision by one, and a stale save changes nothing", async () => {
    const id = await song(A, "Revisions");
    expect(await revision(id)).toBe(0);
    const save = "update public.songs set spec = $2::jsonb where id = $1 and revision = $3 returning revision";
    expect(await h.as(A, () => h.rows(save, [id, JSON.stringify(v12), 0]))).toEqual([{ revision: 1 }]);
    // A second tab still holding revision 0.
    expect(await h.as(A, () => h.rows(save, [id, JSON.stringify(v11), 0]))).toEqual([]);
    const [row] = await h.truth("songs", "id = $1", [id]);
    expect((row?.spec as MusicSpec).D6.tempo.bpm).toBe(140);
  });

  it("a stale freeze raises and writes nothing", async () => {
    const id = await song(A, "Stale freeze");
    await h.as(A, () => h.rows("update public.songs set title = 'moved on' where id = $1", [id]));
    await expect(freeze(A, id, { rev: 0 })).rejects.toThrow(/changed elsewhere/);
    expect(await h.truth("variants", "song_id = $1", [id])).toEqual([]);
    expect(await revision(id)).toBe(1);
  });

  it("a freeze saves the working copy, bumps the revision once and makes the variant the base", async () => {
    const id = await song(A, "Freeze saves");
    const frozen = await freeze(A, id, { spec: v12 });
    expect(frozen).toMatchObject({ variant_label: "v1.0", song_revision: 1, owner: A });
    const [row] = await h.truth("songs", "id = $1", [id]);
    expect([row?.base_variant_id, (row?.spec as MusicSpec).D6.tempo.bpm, row?.title]).toEqual([frozen.variant_id, 140, "Jinn"]);
  });

  it("a freeze keeps the working copy's patches on the song, never in the variant", async () => {
    const id = await song(A, "Patches");
    const patch = { id: "p-1", source: "audio-analysis", createdAt: "c", ops: [], status: "proposed", acceptedPaths: [], rejectedPaths: [] };
    const frozen = await freeze(A, id, { spec: { ...v12, patches: [patch] } });
    const [variant] = await h.truth("variants", "id = $1", [frozen.variant_id]);
    const [row] = await h.truth("songs", "id = $1", [id]);
    expect((variant?.spec_snapshot as MusicSpec).patches).toEqual([]);
    expect((row?.spec as MusicSpec).patches).toEqual([patch]);
  });

  it("a spec that is not a MusicSpec aborts the freeze whole: no variant, no save", async () => {
    const id = await song(A, "Bad spec");
    await expect(freeze(A, id, { spec: { D6: { tempo: { bpm: 140 } } } })).rejects.toThrow(/check constraint/);
    expect(await h.truth("variants", "song_id = $1", [id])).toEqual([]);
    const [row] = await h.truth("songs", "id = $1", [id]);
    expect([row?.revision, (row?.spec as MusicSpec).D6.tempo.bpm]).toEqual([0, 142]);
  });
});

describe("a variant holds only what the client may write", () => {
  it("stores no diff and no coverage: both are derived from the snapshots on read", async () => {
    const [row] = await h.truth("variants", "id = $1", [ids.variant]);
    expect(Object.keys(row ?? {})).not.toContain("diff");
    expect(Object.keys(row ?? {})).not.toContain("coverage");
  });

  it("freeze_variant takes no overrides, diff or coverage from the caller", async () => {
    const rev = await revision(ids.song);
    const legacy = "select * from public.freeze_variant($1, $2, 'Jinn', $3::jsonb, '[]'::jsonb, null, '[]'::jsonb, '{}'::jsonb)";
    await expect(h.as(A, () => h.rows(legacy, [ids.song, rev, JSON.stringify(v12)]))).rejects.toThrow(/does not exist/);
    expect(await revision(ids.song)).toBe(rev);
  });

  it("the owner cannot write a song's target overrides, on insert or update", async () => {
    const override = JSON.stringify([{ engine: "suno", fieldId: "style", text: "hand-tuned", basedOnCompiledHash: "h", createdAt: "c" }]);
    await expect(h.as(A, () => h.rows("insert into public.songs (title, spec, overrides) values ('x', $1::jsonb, $2::jsonb)", [JSON.stringify(v11), override]))).rejects.toThrow(/permission denied/);
    await expect(h.as(A, () => h.rows("update public.songs set overrides = $2::jsonb where id = $1", [ids.song, override]))).rejects.toThrow(/permission denied/);
    const [row] = await h.truth("songs", "id = $1", [ids.song]);
    expect(row?.overrides).toEqual([]);
  });

  it("a freeze copies the song's own overrides into the variant, and keeps them on the song", async () => {
    const id = await song(A, "Overrides");
    const overrides = [{ engine: "flow", fieldId: "sound", text: "glassy pads", basedOnCompiledHash: "h", createdAt: "c" }];
    // Written as the database owner: the path a future override editor would take.
    await h.db.exec("reset role");
    await h.rows("update public.songs set overrides = $2::jsonb where id = $1", [id, JSON.stringify(overrides)]);
    const frozen = await freeze(A, id, { spec: v12 });
    const [variant] = await h.truth("variants", "id = $1", [frozen.variant_id]);
    const [row] = await h.truth("songs", "id = $1", [id]);
    expect([variant?.overrides, row?.overrides]).toEqual([overrides, overrides]);
  });
});

describe("LN-1 in the database", () => {
  it("holds the lineage names of src/data/lineage/names.json, and no API role can read them", async () => {
    const stored = (await h.truth("lineage_names", "true", [])).map((row) => String(row.name));
    expect(stored.sort()).toEqual([...lineageNames].sort());
    await expect(h.as(A, () => h.rows("select name from public.lineage_names"))).rejects.toThrow(/permission denied/);
    await expect(h.as(null, () => h.rows("select name from public.lineage_names"))).rejects.toThrow(/permission denied/);
  });

  it("refuses to freeze a spec that names one, anywhere but its references, as a whole word", async () => {
    // Invented names only, added for this test and removed after it.
    await h.db.exec("reset role");
    await h.rows("insert into public.lineage_names (name) values ('Quillon Vantreese'), ('Q.V.')");
    try {
      const id = await song(A, "LN-1");
      const named = (edit: (spec: MusicSpec) => void) => {
        const spec = structuredClone(v12);
        edit(spec);
        return spec;
      };
      for (const spec of [
        named((s) => (s.D1.formPhrase = `${s.D1.formPhrase} in the style of Quillon Vantreese`)),
        named((s) => (s.D7.sections[0]!.label = "intro after quillon vantreese")),
        named((s) => (s.D10.title = "A Q.V. homage")),
      ]) {
        const rev = await revision(id);
        await expect(freeze(A, id, { spec })).rejects.toThrow(/LN-1/);
        expect(await h.truth("variants", "song_id = $1", [id])).toEqual([]);
        expect(await revision(id)).toBe(rev);
      }
      // Inside a longer word, with the escaped dots matching anything, or in the references,
      // which are never sent to an engine: frozen.
      for (const spec of [
        named((s) => (s.D1.formPhrase = `${s.D1.formPhrase} after Quillon Vantreeses`)),
        named((s) => (s.D10.title = "QxVx")),
        { ...v12, references: [{ id: "Quillon Vantreese", kind: "song", roles: [], weight: 0.5, provenance: { kind: "hand-built" } }] },
      ]) {
        await expect(freeze(A, id, { spec })).resolves.toMatchObject({ owner: A });
      }
    } finally {
      await h.db.exec("reset role");
      await h.rows("delete from public.lineage_names where name in ('Quillon Vantreese', 'Q.V.')");
    }
  });
});

describe("labels, parents and bases", () => {
  it("numbers variants v1.0, v1.1 … v1.10, as the composer's preview does", async () => {
    const id = await song(A, "Many");
    const labels: string[] = [];
    let parent: string | null = null;
    for (let i = 0; i < 11; i++) {
      const frozen: Frozen = await freeze(A, id, { parent });
      expect(frozen.variant_label).toBe(nextVariantLabel(labels));
      labels.push(frozen.variant_label);
      parent = frozen.variant_id;
    }
    expect(labels.slice(-2)).toEqual(["v1.9", "v1.10"]);
  });

  it("refuses a parent or a base from another song", async () => {
    const rev = await revision(ids.song);
    await expect(freeze(A, ids.song, { parent: ids.otherVariant, rev })).rejects.toThrow(/foreign key/);
    expect(await revision(ids.song)).toBe(rev);
    await expect(h.as(A, () => h.rows("update public.songs set base_variant_id = $2 where id = $1", [ids.song, ids.otherVariant]))).rejects.toThrow(/foreign key/);
  });

  it("forks Jinn v1.1 into v1.2, whose stored snapshots give the BPM 142 → 140 diff, and forks again from v1.0", async () => {
    const id = await song(A, "Jinn", v11);
    const base = await freeze(A, id, { spec: v11 });
    const fork = await freeze(A, id, { spec: v12, parent: base.variant_id });
    const [parent] = await h.truth("variants", "id = $1", [base.variant_id]);
    const [stored] = await h.truth("variants", "id = $1", [fork.variant_id]);
    expect([stored?.label, stored?.parent_variant_id]).toEqual(["v1.1", base.variant_id]);
    // The diff the song page shows, derived from what the database kept.
    expect(diffSpecs(parent?.spec_snapshot as MusicSpec, stored?.spec_snapshot as MusicSpec)).toContainEqual({ path: "/D6/tempo/bpm", before: 142, after: 140 });
    // A second fork from v1.0, while v1.1 exists, still numbers on and keeps its own parent.
    const again = await freeze(A, id, { spec: v11, parent: base.variant_id });
    const [second] = await h.truth("variants", "id = $1", [again.variant_id]);
    expect([second?.label, second?.parent_variant_id]).toEqual(["v1.2", base.variant_id]);
  });
});

describe("song checks", () => {
  it("labels every song VASEY.AUDIO by default and accepts nothing else", async () => {
    const [row] = await h.truth("songs", "id = $1", [ids.song]);
    expect(row?.brand).toBe("VASEY.AUDIO");
    // Not even a superuser write can relabel a song with the tool's own brand.
    await h.db.exec("reset role");
    await expect(h.rows("insert into public.songs (owner_id, title, spec, brand) values ($1, 'x', $2::jsonb, 'VASEY/AI')", [A, JSON.stringify(v11)])).rejects.toThrow(/check constraint/);
  });

  it("accepts titles of 1 to 200 characters, counted as code points", async () => {
    const insert = "insert into public.songs (title, spec) values ($1, $2::jsonb) returning id";
    const spec = JSON.stringify(v11);
    await expect(h.as(A, () => h.rows(insert, ["🎵".repeat(200), spec]))).resolves.toHaveLength(1);
    await expect(h.as(A, () => h.rows(insert, ["t".repeat(201), spec]))).rejects.toThrow(/check constraint/);
    await expect(h.as(A, () => h.rows(insert, ["", spec]))).rejects.toThrow(/check constraint/);
  });

  it("refuses a spec that is not a MusicSpec object, or one over a megabyte", async () => {
    const insert = "insert into public.songs (title, spec) values ('x', $1::jsonb)";
    await expect(h.as(A, () => h.rows(insert, ["[]"]))).rejects.toThrow(/check constraint/);
    await expect(h.as(A, () => h.rows(insert, ['{"D1":{}}']))).rejects.toThrow(/check constraint/);
    await expect(h.as(A, () => h.rows(insert, [JSON.stringify({ ...v11, padding: "x".repeat(1_000_001) })]))).rejects.toThrow(/check constraint/);
  });
});
