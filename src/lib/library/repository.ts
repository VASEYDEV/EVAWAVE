/**
 * Library reads and writes (docs/SPEC.md §1.6, §3 S4). Every call runs as the signed-in
 * user through the Supabase API, so row level security, not this code, decides what a user
 * may see or change. Owners are never sent: the database fills `owner_id` from auth.uid().
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AudioFeatures, MusicSpec, Provenance, ReferenceAsset, StyleProfile, Tag } from "@/core/musicspec/ir/types";

import { toReferenceAsset, toStyleProfile, toTag, type Database } from "./schema";

export type LibraryClient = SupabaseClient<Database>;

export interface GenreSummary {
  id: string;
  name: string;
}

export interface FileEntry {
  asset: ReferenceAsset;
  genreIds: string[];
  tagIds: string[];
}

export interface LibraryData {
  profiles: StyleProfile[];
  files: FileEntry[];
  tags: Tag[];
  genres: GenreSummary[];
}

/** Thrown with the database's message when a library call fails. */
export class LibraryError extends Error {
  override name = "LibraryError";
}

function check<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error) throw new LibraryError(`${what}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) throw new LibraryError(`${what}: no data`);
  return result.data;
}

function groupBy<R, K extends keyof R>(rows: readonly R[], key: K, value: keyof R): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const k = String(row[key]);
    map.set(k, [...(map.get(k) ?? []), String(row[value])]);
  }
  return map;
}

export async function loadLibrary(client: LibraryClient): Promise<LibraryData> {
  const [profiles, files, tags, genres, pg, pt, fg, ft] = await Promise.all([
    client.from("style_profiles").select("*").order("updated_at", { ascending: false }),
    client.from("files").select("*").order("created_at", { ascending: false }),
    client.from("tags").select("*").order("label"),
    client.from("genres").select("id, name").order("name"),
    client.from("style_profile_genres").select("*"),
    client.from("style_profile_tags").select("*"),
    client.from("file_genres").select("*"),
    client.from("file_tags").select("*"),
  ]);
  const profileGenres = groupBy(check(pg, "profile genres"), "profile_id", "genre_id");
  const profileTags = groupBy(check(pt, "profile tags"), "profile_id", "tag_id");
  const fileGenres = groupBy(check(fg, "file genres"), "file_id", "genre_id");
  const fileTags = groupBy(check(ft, "file tags"), "file_id", "tag_id");
  return {
    profiles: check(profiles, "style profiles").map((row) =>
      toStyleProfile(row, { genreIds: profileGenres.get(row.id) ?? [], tagIds: profileTags.get(row.id) ?? [] }),
    ),
    files: check(files, "files").map((row) => ({
      asset: toReferenceAsset(row),
      genreIds: [...(fileGenres.get(row.id) ?? [])].sort(),
      tagIds: [...(fileTags.get(row.id) ?? [])].sort(),
    })),
    tags: check(tags, "tags").map(toTag),
    genres: check(genres, "genres"),
  };
}

/** The StyleProfile slice of a spec: no structure (D7) and no output intent (D10), per §1.6. */
export function profileSpecFrom(spec: MusicSpec): StyleProfile["spec"] {
  return { D1: spec.D1, D2: spec.D2, D3: spec.D3, D4: spec.D4, D5: spec.D5, D6: spec.D6, D8: spec.D8, D9: spec.D9 };
}

export async function createStyleProfile(client: LibraryClient, name: string, spec: StyleProfile["spec"], provenance: Provenance): Promise<void> {
  check(await client.from("style_profiles").insert({ name, spec, provenance }).select("id"), "create style profile");
}

export async function deleteStyleProfile(client: LibraryClient, id: string): Promise<void> {
  check(await client.from("style_profiles").delete().eq("id", id).select("id"), "delete style profile");
}

export async function createTag(client: LibraryClient, label: string, colour: string | null): Promise<void> {
  check(await client.from("tags").insert({ label, colour }).select("id"), "create tag");
}

export async function deleteTag(client: LibraryClient, id: string): Promise<void> {
  check(await client.from("tags").delete().eq("id", id).select("id"), "delete tag");
}

export async function deleteFile(client: LibraryClient, id: string): Promise<void> {
  check(await client.from("files").delete().eq("id", id).select("id"), "delete file");
}

type LinkTable = "style_profile_genres" | "style_profile_tags" | "file_genres" | "file_tags";
const LINK_KEYS: Record<LinkTable, [string, string]> = {
  style_profile_genres: ["profile_id", "genre_id"],
  style_profile_tags: ["profile_id", "tag_id"],
  file_genres: ["file_id", "genre_id"],
  file_tags: ["file_id", "tag_id"],
};

/** Adds or removes one genre or tag link. */
export async function setLink(client: LibraryClient, table: LinkTable, ownerKey: string, otherKey: string, on: boolean): Promise<void> {
  const [a, b] = LINK_KEYS[table];
  if (on) {
    // `table` is a union, so supabase-js cannot pick one Insert type; the row is built from
    // LINK_KEYS for exactly this table, which the RLS test's column check pins to the SQL.
    const row = { [a]: ownerKey, [b]: otherKey } as never;
    check(await client.from(table).insert(row).select(), `link ${table}`);
  } else {
    check(await client.from(table).delete().eq(a, ownerKey).eq(b, otherKey).select(), `unlink ${table}`);
  }
}

/** File metadata and an audio-analysis profile from an import (docs/SPEC.md §1.7). Never the audio. */
export interface ImportRecord {
  file: { filename: string; mime: string; bytes: number; sha256: string; features: AudioFeatures };
  profile: { name: string; spec: StyleProfile["spec"]; analysedOn: string; model: string };
}

/**
 * Saves an import: the file's metadata (upserted by sha256, so a re-import reuses the row),
 * then the style profile that cites it. Only these JSON rows are sent; the blob stays on the
 * device (A6).
 */
export async function saveImport(client: LibraryClient, record: ImportRecord): Promise<{ fileId: string; profileId: string }> {
  const file = check(
    await client
      .from("files")
      .upsert({ kind: "audio", ...record.file }, { onConflict: "owner_id,sha256" })
      .select("id")
      .single(),
    "save file metadata",
  );
  const provenance: Provenance = { kind: "audio-analysis", sourceRef: file.id, analysedOn: record.profile.analysedOn, model: record.profile.model };
  const profile = check(
    await client
      .from("style_profiles")
      .insert({ name: record.profile.name, spec: record.profile.spec, provenance, features: record.file.features })
      .select("id")
      .single(),
    "save style profile",
  );
  return { fileId: file.id, profileId: profile.id };
}
