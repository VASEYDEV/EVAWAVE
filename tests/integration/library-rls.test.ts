import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LIBRARY_COLUMNS, USER_SCOPED_TABLES } from "@/lib/library/schema";

/**
 * S4 acceptance (docs/SPEC.md §3): user B cannot read or write user A's rows in any
 * user-scoped table. The real migrations run in PGlite (Postgres in WASM) on top of a shim
 * of Supabase's auth schema and API roles. Every statement runs as the `authenticated` role
 * with a JWT subject, exactly as the Supabase API runs a signed-in request.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const SHA = (c: string) => c.repeat(64);

let db: PGlite;
const ids: Record<string, string> = {};

async function as(user: string | null, run: () => Promise<unknown>): Promise<unknown> {
  await db.exec("reset role");
  if (user) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await db.exec("set role authenticated");
  } else {
    await db.exec("set role anon");
  }
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}

async function rows(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  return (await db.query<Record<string, unknown>>(sql, params)).rows;
}

/** Superuser view of a table, bypassing RLS, for checking what really happened. */
async function truth(table: string, where: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  await db.exec("reset role");
  return rows(`select * from public.${table} where ${where}`, params);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(`${root}tests/support/supabase-shim.sql`, "utf8"));
  const migrations = readdirSync(`${root}supabase/migrations`).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) await db.exec(readFileSync(`${root}supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users (id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')", [A, B]);

  await as(A, async () => {
    ids.profile = String((await rows("insert into public.style_profiles (name, provenance, spec) values ('A profile', '{\"kind\":\"hand-built\"}', '{}') returning id"))[0]?.id);
    ids.file = String((await rows("insert into public.files (kind, filename, mime, bytes, sha256) values ('audio', 'a.wav', 'audio/wav', 10, $1) returning id", [SHA("a")]))[0]?.id);
    ids.tag = String((await rows("insert into public.tags (label, colour) values ('dark', '#112233') returning id"))[0]?.id);
    await rows("insert into public.style_profile_genres (profile_id, genre_id) values ($1, 'drill')", [ids.profile]);
    await rows("insert into public.style_profile_tags (profile_id, tag_id) values ($1, $2)", [ids.profile, ids.tag]);
    await rows("insert into public.file_genres (file_id, genre_id) values ($1, 'drill')", [ids.file]);
    await rows("insert into public.file_tags (file_id, tag_id) values ($1, $2)", [ids.file, ids.tag]);
  });
});

afterAll(async () => {
  await db.close();
});

/** How to address, change and forge a row in each user-scoped table. */
const TABLES: Record<(typeof USER_SCOPED_TABLES)[number], { key: () => [string, unknown[]]; update?: string; forge: () => [string, unknown[]] }> = {
  style_profiles: {
    key: () => ["id = $1", [ids.profile]],
    update: "name = 'stolen'",
    forge: () => ["insert into public.style_profiles (owner_id, name, provenance) values ($1, 'forged', '{\"kind\":\"hand-built\"}')", [A]],
  },
  files: {
    key: () => ["id = $1", [ids.file]],
    update: "filename = 'stolen.wav'",
    forge: () => ["insert into public.files (owner_id, kind, filename, mime, bytes, sha256) values ($1, 'audio', 'f.wav', 'audio/wav', 1, $2)", [A, SHA("f")]],
  },
  tags: {
    key: () => ["id = $1", [ids.tag]],
    update: "label = 'stolen'",
    forge: () => ["insert into public.tags (owner_id, label) values ($1, 'forged')", [A]],
  },
  style_profile_genres: {
    key: () => ["profile_id = $1", [ids.profile]],
    forge: () => ["insert into public.style_profile_genres (owner_id, profile_id, genre_id) values ($1, $2, 'atlanta-trap')", [A, ids.profile]],
  },
  style_profile_tags: {
    key: () => ["profile_id = $1", [ids.profile]],
    forge: () => ["insert into public.style_profile_tags (owner_id, profile_id, tag_id) values ($1, $2, $3)", [A, ids.profile, ids.tag]],
  },
  file_genres: {
    key: () => ["file_id = $1", [ids.file]],
    forge: () => ["insert into public.file_genres (owner_id, file_id, genre_id) values ($1, $2, 'atlanta-trap')", [A, ids.file]],
  },
  file_tags: {
    key: () => ["file_id = $1", [ids.file]],
    forge: () => ["insert into public.file_tags (owner_id, file_id, tag_id) values ($1, $2, $3)", [A, ids.file, ids.tag]],
  },
};

describe("library RLS: user B against user A's rows", () => {
  it("covers every user-scoped table", () => {
    expect(Object.keys(TABLES).sort()).toEqual([...USER_SCOPED_TABLES].sort());
  });

  describe.each(USER_SCOPED_TABLES)("%s", (table) => {
    const t = TABLES[table];

    it("A can read the row (positive control)", async () => {
      const [where, params] = t.key();
      expect(await as(A, () => rows(`select * from public.${table} where ${where}`, params))).toHaveLength(1);
    });

    it("B cannot read it", async () => {
      const [where, params] = t.key();
      expect(await as(B, () => rows(`select * from public.${table} where ${where}`, params))).toEqual([]);
      expect(await as(B, () => rows(`select * from public.${table}`))).toEqual([]);
    });

    it("B cannot update it", async () => {
      const [where, params] = t.key();
      const before = await truth(table, where, params);
      if (t.update) {
        expect(await as(B, () => rows(`update public.${table} set ${t.update} where ${where} returning *`, params))).toEqual([]);
      } else {
        await expect(as(B, () => rows(`update public.${table} set owner_id = owner_id where ${where}`, params))).rejects.toThrow(/permission denied/);
      }
      expect(await truth(table, where, params)).toEqual(before);
    });

    it("B cannot delete it", async () => {
      const [where, params] = t.key();
      expect(await as(B, () => rows(`delete from public.${table} where ${where} returning *`, params))).toEqual([]);
      expect(await truth(table, where, params)).toHaveLength(1);
    });

    it("B cannot insert a row owned by A", async () => {
      const [sql, params] = t.forge();
      await expect(as(B, () => rows(sql, params))).rejects.toThrow(/row-level security/);
    });
  });

  it("B cannot link A's profile or file, even as the link's owner", async () => {
    await as(B, () => rows("insert into public.tags (label) values ('b-tag')"));
    const [bTag] = await truth("tags", "owner_id = $1", [B]);
    await expect(as(B, () => rows("insert into public.style_profile_genres (profile_id, genre_id) values ($1, 'atlanta-trap')", [ids.profile]))).rejects.toThrow(/row-level security/);
    await expect(as(B, () => rows("insert into public.file_tags (file_id, tag_id) values ($1, $2)", [ids.file, bTag?.id]))).rejects.toThrow(/row-level security/);
  });

  it("B cannot move a row to A by updating its owner", async () => {
    const [mine] = (await as(B, () => rows("insert into public.tags (label) values ('b-move') returning id"))) as { id: string }[];
    await expect(as(B, () => rows("update public.tags set owner_id = $1 where id = $2", [A, mine?.id]))).rejects.toThrow(/row-level security/);
  });
});

describe("library access for other roles and tables", () => {
  it("anon can read and write nothing", async () => {
    for (const table of [...USER_SCOPED_TABLES, "genres"]) {
      await expect(as(null, () => rows(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("signed-in users read the curated genres but cannot change them", async () => {
    expect(((await as(B, () => rows("select id from public.genres order by id"))) as { id: string }[]).map((g) => g.id)).toEqual(["atlanta-trap", "cinematic-hybrid", "drill", "egyptian-trap"]);
    await expect(as(B, () => rows("insert into public.genres (id, name, record) values ('x', 'X', '{}')"))).rejects.toThrow(/permission denied/);
    await expect(as(B, () => rows("update public.genres set name = 'X'"))).rejects.toThrow(/permission denied/);
    await expect(as(B, () => rows("delete from public.genres"))).rejects.toThrow(/permission denied/);
  });

  it("keeps blobs on the device: a file row cannot claim local_only = false", async () => {
    await expect(as(A, () => rows("insert into public.files (kind, filename, mime, bytes, sha256, local_only) values ('audio', 'x.wav', 'audio/wav', 1, $1, false)", [SHA("b")]))).rejects.toThrow(/check constraint/);
  });

  it("dedupes a re-import per owner, as saveImport's upsert relies on", async () => {
    // The statement PostgREST runs for saveImport's upsert with on_conflict=owner_id,sha256.
    const upsert =
      "insert into public.files (kind, filename, mime, bytes, sha256) values ('audio', $1, 'audio/wav', 10, $2) on conflict (owner_id, sha256) do update set filename = excluded.filename, mime = excluded.mime, bytes = excluded.bytes returning id";
    const first = (await as(A, () => rows(upsert, ["loop.wav", SHA("c")]))) as { id: string }[];
    const again = (await as(A, () => rows(upsert, ["loop-renamed.wav", SHA("c")]))) as { id: string }[];
    expect(again[0]?.id).toBe(first[0]?.id);
    const other = (await as(B, () => rows(upsert, ["loop.wav", SHA("c")]))) as { id: string }[];
    expect(other[0]?.id).not.toBe(first[0]?.id);
    const stored = await truth("files", "sha256 = $1 order by owner_id", [SHA("c")]);
    expect(stored.map((r) => [r.owner_id, r.filename])).toEqual([
      [A, "loop-renamed.wav"],
      [B, "loop.wav"],
    ]);
  });

  it("keeps a repeated profile save to one row, and never lets another owner reuse the id", async () => {
    // The statement PostgREST runs for saveImport's profile upsert with on_conflict=id.
    const id = "5f0c6a52-2f7e-4d4b-9a51-0b8e6d3c1a27";
    const upsert =
      "insert into public.style_profiles (id, name, provenance, spec) values ($1, $2, '{\"kind\":\"audio-analysis\"}', '{}') on conflict (id) do update set name = excluded.name returning id";
    await as(A, () => rows(upsert, [id, "Desert loop"]));
    await as(A, () => rows(upsert, [id, "Desert loop"]));
    expect(await truth("style_profiles", "id = $1", [id])).toHaveLength(1);
    await expect(as(B, () => rows(upsert, [id, "stolen"]))).rejects.toThrow(/row-level security/);
    const [row] = await truth("style_profiles", "id = $1", [id]);
    expect([row?.owner_id, row?.name]).toEqual([A, "Desert loop"]);
  });

  it("stamps updated_at when an owner edits a profile", async () => {
    const [before] = await truth("style_profiles", "id = $1", [ids.profile]);
    await as(A, () => rows("update public.style_profiles set name = 'A profile, renamed' where id = $1", [ids.profile]));
    const [after] = await truth("style_profiles", "id = $1", [ids.profile]);
    expect(after?.name).toBe("A profile, renamed");
    expect(after?.updated_at).not.toEqual(before?.updated_at);
  });

  it("matches the columns the app's types declare", async () => {
    for (const [table, columns] of Object.entries(LIBRARY_COLUMNS)) {
      const found = await rows("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position", [table]);
      expect({ table, columns: found.map((c) => c.column_name) }).toEqual({ table, columns: [...columns] });
    }
  });
});
