import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MusicSpec } from "@/core/musicspec/ir/types";

import { openRlsDatabase, type RlsHarness } from "../support/rls";

/**
 * S7 acceptance (docs/SPEC.md §3): takes are owner-only under RLS, can only be logged on the
 * caller's own variant, are never edited, leave with their song, and never carry audio.
 * The real migrations run in PGlite over the Supabase shim (tests/support/rls.ts).
 */
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const v12 = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/jinn-v1.2.spec.json", import.meta.url)), "utf8")) as MusicSpec;

let h: RlsHarness;
const ids = { song: "", variant: "", take: "", bSong: "", bVariant: "" };

const LOG = "insert into public.takes (variant_id, engine, engine_version, render_ref, verdict, drifted, words_blamed, notes) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id";
type TakeValues = { engine: string; version: string; ref: string | null; verdict: string; drifted: string[]; words: string[]; notes: string };
const take = (over: Partial<TakeValues> = {}): TakeValues => ({ engine: "suno", version: "v6", ref: "https://suno.example/song/abc", verdict: "kill", drifted: ["meter"], words: ["shuffled 16ths"], notes: "Drifted to 6/8 in the bridge.", ...over });

async function log(user: string | null, variant: string, values: TakeValues = take()): Promise<string> {
  const [row] = await h.as(user, () => h.rows(LOG, [variant, values.engine, values.version, values.ref, values.verdict, values.drifted, values.words, values.notes]));
  return String(row?.id);
}

/** A song with one frozen variant, owned by `user`. */
async function songWithVariant(user: string, title: string): Promise<[string, string]> {
  const [song] = await h.as(user, () => h.rows("insert into public.songs (title, spec) values ($1, $2::jsonb) returning id", [title, JSON.stringify(v12)]));
  const [frozen] = await h.as(user, () =>
    h.rows("select * from public.freeze_variant($1, 0, $2, $3::jsonb, null)", [song?.id, title, JSON.stringify(v12)]),
  );
  return [String(song?.id), String(frozen?.variant_id)];
}

beforeAll(async () => {
  h = await openRlsDatabase([A, B]);
  [ids.song, ids.variant] = await songWithVariant(A, "A song");
  ids.take = await log(A, ids.variant);
  [ids.bSong, ids.bVariant] = await songWithVariant(B, "B song");
});

afterAll(async () => {
  await h.db.close();
});

describe("takes: user B against user A's", () => {
  it("A reads its take (positive control), and it keeps every field", async () => {
    const [row] = await h.as(A, () => h.rows("select * from public.takes where id = $1", [ids.take]));
    expect(row).toMatchObject({ owner_id: A, variant_id: ids.variant, engine: "suno", engine_version: "v6", verdict: "kill", drifted: ["meter"], words_blamed: ["shuffled 16ths"] });
  });

  it("B reads none of A's takes, and cannot delete one", async () => {
    expect(await h.as(B, () => h.rows("select * from public.takes where owner_id = $1", [A]))).toEqual([]);
    expect(await h.as(B, () => h.rows("delete from public.takes where id = $1 returning id", [ids.take]))).toEqual([]);
    expect(await h.truth("takes", "id = $1", [ids.take])).toHaveLength(1);
  });

  it("B cannot log a take on A's variant, nor A on B's", async () => {
    await expect(log(B, ids.variant)).rejects.toThrow(/row-level security|foreign key/);
    await expect(log(A, ids.bVariant)).rejects.toThrow(/row-level security|foreign key/);
    expect(await h.truth("takes", "variant_id = $1", [ids.bVariant])).toEqual([]);
  });

  it("B cannot forge a take for A: the owner column is not writable", async () => {
    await expect(
      h.as(B, () => h.rows("insert into public.takes (owner_id, variant_id, engine, engine_version, verdict) values ($1, $2, 'suno', 'v6', 'keep')", [A, ids.variant])),
    ).rejects.toThrow(/permission denied/);
  });

  it("anon reaches no take", async () => {
    await expect(h.as(null, () => h.rows("select * from public.takes"))).rejects.toThrow(/permission denied/);
    await expect(log(null, ids.variant)).rejects.toThrow(/permission denied/);
  });
});

describe("takes are a log", () => {
  it("the owner cannot edit a take", async () => {
    await expect(h.as(A, () => h.rows("update public.takes set verdict = 'keep' where id = $1", [ids.take]))).rejects.toThrow(/permission denied/);
  });

  it("the owner deletes a mistaken take", async () => {
    const mistaken = await log(A, ids.variant, take({ verdict: "keep" }));
    expect(await h.as(A, () => h.rows("delete from public.takes where id = $1 returning id", [mistaken]))).toHaveLength(1);
    expect(await h.truth("takes", "id = $1", [mistaken])).toEqual([]);
  });

  it("deleting a song removes its variants' takes", async () => {
    const [song, variant] = await songWithVariant(A, "Doomed");
    await log(A, variant);
    await log(A, variant, take({ verdict: "rerun" }));
    expect(await h.truth("takes", "variant_id = $1", [variant])).toHaveLength(2);
    expect(await h.as(A, () => h.rows("delete from public.songs where id = $1 returning id", [song]))).toHaveLength(1);
    expect(await h.truth("takes", "variant_id = $1", [variant])).toEqual([]);
  });
});

describe("take checks", () => {
  it("never carries audio: a data: URL is refused as a render reference", async () => {
    for (const ref of ["data:audio/wav;base64,UklGRg==", "  DATA:audio/mpeg;base64,AAAA"]) {
      await expect(log(A, ids.variant, take({ ref }))).rejects.toThrow(/check constraint/);
    }
    await expect(log(A, ids.variant, take({ ref: "x".repeat(2049) }))).rejects.toThrow(/check constraint/);
    await expect(log(A, ids.variant, take({ ref: null }))).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("takes only live engines, known verdicts and known drift kinds", async () => {
    await expect(log(A, ids.variant, take({ engine: "udio" }))).rejects.toThrow(/check constraint/);
    await expect(log(A, ids.variant, take({ verdict: "maybe" }))).rejects.toThrow(/check constraint/);
    await expect(log(A, ids.variant, take({ drifted: ["meter", "vibes"] }))).rejects.toThrow(/check constraint/);
    await expect(log(A, ids.variant, take({ engine: "flow", version: "lyria-3.5", drifted: ["tempo", "genre-bleed", "other"] }))).resolves.toBeTruthy();
  });

  it("bounds the words blamed, the notes and the engine version", async () => {
    await expect(log(A, ids.variant, take({ words: Array.from({ length: 51 }, (_, i) => `w${i}`) }))).rejects.toThrow(/check constraint/);
    await expect(log(A, ids.variant, take({ words: ["ok", ""] }))).rejects.toThrow(/check constraint/);
    await expect(log(A, ids.variant, take({ notes: "n".repeat(4001) }))).rejects.toThrow(/check constraint/);
    await expect(log(A, ids.variant, take({ notes: "🎵".repeat(4000) }))).resolves.toBeTruthy();
    await expect(log(A, ids.variant, take({ version: "" }))).rejects.toThrow(/check constraint/);
  });
});
