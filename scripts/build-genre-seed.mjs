#!/usr/bin/env node
/**
 * Writes the curated genres from src/data/taxonomy/genres.json into a Supabase migration
 * (docs/SPEC.md §1.6: genres are curated and read-only for users). Deterministic, and
 * `--check` fails when the committed migration is out of date.
 *
 * Usage: node scripts/build-genre-seed.mjs            write the migration
 *        node scripts/build-genre-seed.mjs --check    exit 1 if it is out of date
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
export const SEED_MIGRATION = "supabase/migrations/20260926000100_seed_genres.sql";

/** A SQL string literal: single quotes doubled, nothing else interpreted. */
function literal(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

export function genreSeedSql() {
  const genres = JSON.parse(readFileSync(`${root}src/data/taxonomy/genres.json`, "utf8"));
  const rows = genres.map((g) => `  (${literal(g.id)}, ${literal(g.name)}, ${literal(JSON.stringify(g))}::jsonb)`);
  return [
    "-- Curated genres (docs/SPEC.md §1.6). Generated from src/data/taxonomy/genres.json by",
    "-- scripts/build-genre-seed.mjs; do not edit by hand. Re-running updates the records.",
    "",
    "insert into public.genres (id, name, record) values",
    `${rows.join(",\n")}`,
    "on conflict (id) do update set name = excluded.name, record = excluded.record, updated_at = now();",
    "",
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sql = genreSeedSql();
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(`${root}${SEED_MIGRATION}`, "utf8");
    } catch {
      // Missing counts as out of date.
    }
    if (current !== sql) {
      console.error(`${SEED_MIGRATION} is out of date: run node scripts/build-genre-seed.mjs`);
      process.exit(1);
    }
    console.log("genre seed matches genres.json");
  } else {
    writeFileSync(`${root}${SEED_MIGRATION}`, sql);
    console.log(`wrote ${SEED_MIGRATION}`);
  }
}
