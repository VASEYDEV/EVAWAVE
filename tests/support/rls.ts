import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

/**
 * A PGlite database with every migration applied over the Supabase shim, for RLS tests.
 * Statements run as the `authenticated` role with a JWT subject, exactly as the Supabase API
 * runs a signed-in request, or as `anon` when no user is given. Same harness as
 * tests/integration/library-rls.test.ts, shared for the S6 and later suites.
 */
export interface RlsHarness {
  db: PGlite;
  /** Runs `run` as `user` (a JWT subject), or as `anon` when `user` is null. */
  as<T>(user: string | null, run: () => Promise<T>): Promise<T>;
  rows(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  /** A superuser read that bypasses RLS, for checking what really happened. */
  truth(table: string, where: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

const root = fileURLToPath(new URL("../..", import.meta.url));

export async function openRlsDatabase(users: readonly string[]): Promise<RlsHarness> {
  const db = new PGlite();
  await db.exec(readFileSync(`${root}tests/support/supabase-shim.sql`, "utf8"));
  const migrations = readdirSync(`${root}supabase/migrations`).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) await db.exec(readFileSync(`${root}supabase/migrations/${file}`, "utf8"));
  for (const [i, id] of users.entries()) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `user${i}@example.test`]);

  const rows = async (sql: string, params: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, params)).rows;

  async function as<T>(user: string | null, run: () => Promise<T>): Promise<T> {
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

  async function truth(table: string, where: string, params: unknown[]) {
    await db.exec("reset role");
    return rows(`select * from public.${table} where ${where}`, params);
  }

  return { db, as, rows, truth };
}
