/**
 * Library reads and writes (docs/SPEC.md §1.6, §3 S4). Every call runs as the signed-in
 * user through the Supabase API, so row level security, not this code, decides what a user
 * may see or change. Owners are never sent: the database fills `owner_id` from auth.uid().
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MusicSpec, Provenance, ReferenceAsset, StyleProfile, Tag } from "@/core/musicspec/ir/types";

import { toReferenceAsset, toStyleProfile, toTag, type Database, type SaveImportArgs } from "./schema";

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

/**
 * Deletes one of the caller's style profiles. RLS hides another account's row, so PostgREST
 * answers such a delete with no rows and no error; that is a failure here, not a success, as
 * after an account change in another tab.
 */
export async function deleteStyleProfile(client: LibraryClient, id: string): Promise<void> {
  const deleted = check(await client.from("style_profiles").delete().eq("id", id).select("id"), "delete style profile");
  if (deleted.length !== 1) throw new LibraryError("delete style profile: no such profile for this account; reload the library");
}

export async function createTag(client: LibraryClient, label: string, colour: string | null): Promise<void> {
  check(await client.from("tags").insert({ label, colour }).select("id"), "create tag");
}

/** Deletes one of the caller's tags; a delete that removes no row fails, as for a profile. */
export async function deleteTag(client: LibraryClient, id: string): Promise<void> {
  const deleted = check(await client.from("tags").delete().eq("id", id).select("id"), "delete tag");
  if (deleted.length !== 1) throw new LibraryError("delete tag: no such tag for this account; reload the library");
}

/**
 * True unless `ownerId` definitely has no file record for `sha256`. The check runs through
 * `public.file_record`, which answers under RLS for whoever the call runs as and says who that
 * was: when another tab has switched accounts, it is not `ownerId`, the answer says nothing
 * about `ownerId`'s records, and this returns true so the caller keeps the copy.
 */
export async function hasFileRecord(client: LibraryClient, ownerId: string, sha256: string): Promise<boolean> {
  const { present, owner } = check(await client.rpc("file_record", { sha256 }).single(), "check file record");
  return present || owner !== ownerId;
}

/**
 * Deletes one file record, and rejects unless exactly that row went. RLS hides other owners'
 * rows, so after the signed-in account changes, a delete of a row loaded earlier succeeds
 * with no rows; the caller must see that as a failure, to keep (or restore) the local audio.
 */
export async function deleteFile(client: LibraryClient, id: string): Promise<void> {
  const deleted = check(await client.from("files").delete().eq("id", id).select("id"), "delete file");
  if (deleted.length !== 1) throw new LibraryError("delete file: no such record for this account; reload the library");
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
export type ImportRecord = SaveImportArgs;

/**
 * Saves an import in one transaction through `public.save_import`: the file's metadata
 * (upserted by sha256, so a re-import reuses the row) and the style profile that cites it
 * (upserted by its device-made id, so a repeated save writes one row). A failure part-way
 * leaves neither row, and RLS keeps another owner's id from being reused. Only this JSON is
 * sent; the blob stays on the device (A6).
 */
export async function saveImport(client: LibraryClient, record: ImportRecord): Promise<{ fileId: string; profileId: string; ownerId: string }> {
  const saved = check(await client.rpc("save_import", record).single(), "save import");
  return { fileId: saved.file_id, profileId: saved.profile_id, ownerId: saved.owner };
}

/**
 * Saves an import, then keeps its audio on the device with `store`. The saved file row is the
 * durable reference the local copy needs (and /library's delete removes both), so nothing is
 * stored when the save fails. `store` gets the owner the rows were written for, which is the
 * account the call ran as, not the one read before it. Resolves to where the audio went.
 */
export async function saveImportAndKeepAudio<Where>(client: LibraryClient, record: ImportRecord, audio: Blob, store: (saved: { ownerId: string; sha256: string }, blob: Blob) => Promise<Where>): Promise<Where> {
  const { ownerId } = await saveImport(client, record);
  return store({ ownerId, sha256: record.file.sha256 }, audio);
}
