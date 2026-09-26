/**
 * The library tables (supabase/migrations/20260926000000_library.sql, and for songs and
 * variants 20260926000400_songs.sql) as TypeScript: the column lists, the row shapes, and
 * the mappers to the IR library types (docs/SPEC.md §2.2).
 * tests/integration/library-rls.test.ts checks LIBRARY_COLUMNS against the migrated
 * database, so this file cannot drift from the SQL.
 */
import type { AudioFeatures, DriftKind, FieldDiff, MusicSpec, PaletteSwatch, Provenance, ReferenceAsset, StyleProfile, Tag, Take, TargetOverride, Variant } from "@/core/musicspec/ir/types";

export const LIBRARY_COLUMNS = {
  genres: ["id", "name", "record", "updated_at"],
  style_profiles: ["id", "owner_id", "name", "provenance", "spec", "features", "created_at", "updated_at"],
  files: ["id", "owner_id", "kind", "filename", "mime", "bytes", "sha256", "local_only", "features", "palette", "created_at"],
  tags: ["id", "owner_id", "label", "colour", "created_at"],
  style_profile_genres: ["profile_id", "genre_id", "owner_id"],
  style_profile_tags: ["profile_id", "tag_id", "owner_id"],
  file_genres: ["file_id", "genre_id", "owner_id"],
  file_tags: ["file_id", "tag_id", "owner_id"],
  songs: ["id", "owner_id", "title", "brand", "spec", "overrides", "base_variant_id", "revision", "created_at", "updated_at"],
  variants: ["id", "owner_id", "song_id", "seq", "label", "parent_variant_id", "spec_snapshot", "diff", "overrides", "coverage", "created_at"],
  takes: ["id", "owner_id", "variant_id", "engine", "engine_version", "render_ref", "verdict", "drifted", "words_blamed", "notes", "created_at"],
} as const;

/**
 * Every table whose rows belong to one user; RLS limits each to its owner. A new
 * user-scoped table joins this list, and tests/integration/library-rls.test.ts covers it
 * (AGENTS.md).
 */
export const USER_SCOPED_TABLES = ["style_profiles", "files", "tags", "style_profile_genres", "style_profile_tags", "file_genres", "file_tags", "songs", "variants", "takes"] as const;

export type StyleProfileRow = {
  id: string;
  owner_id: string;
  name: string;
  provenance: Provenance;
  spec: StyleProfile["spec"];
  features: AudioFeatures | null;
  created_at: string;
  updated_at: string;
};

export type FileRow = {
  id: string;
  owner_id: string;
  kind: "audio" | "image";
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  local_only: true;
  features: AudioFeatures | null;
  palette: PaletteSwatch[] | null;
  created_at: string;
};

export type TagRow = {
  id: string;
  owner_id: string;
  label: string;
  colour: string | null;
  created_at: string;
};

export type GenreRow = {
  id: string;
  name: string;
  record: Record<string, unknown>;
  updated_at: string;
};

/** Links read back with a profile or file: genre ids and tag ids. */
export interface Links {
  genreIds: string[];
  tagIds: string[];
}

export function toStyleProfile(row: StyleProfileRow, links: Links): StyleProfile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    provenance: row.provenance,
    spec: row.spec,
    ...(row.features ? { features: row.features } : {}),
    genreIds: [...links.genreIds].sort(),
    tags: [...links.tagIds].sort(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toReferenceAsset(row: FileRow): ReferenceAsset {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    filename: row.filename,
    mime: row.mime,
    bytes: row.bytes,
    sha256: row.sha256,
    localOnly: true,
    ...(row.features ? { features: row.features } : {}),
    ...(row.palette ? { palette: row.palette } : {}),
    createdAt: row.created_at,
  };
}

export function toTag(row: TagRow): Tag {
  return { id: row.id, ownerId: row.owner_id, label: row.label, ...(row.colour ? { colour: row.colour } : {}) };
}

/** `style_profiles.name` holds 1–200 characters (the check in the library migration). */
export const PROFILE_NAME_MAX = 200;

/**
 * A profile name the library accepts: the typed name, else the fallback, else "audio", cut
 * to the limit in code points, as Postgres counts them, so no emoji is split into a lone
 * surrogate.
 */
export function profileName(typed: string, fallback: string): string {
  return Array.from(typed.trim() || fallback.trim() || "audio")
    .slice(0, PROFILE_NAME_MAX)
    .join("")
    .trim();
}

/**
 * A profile name as a text field may hold it while it is typed: cut to PROFILE_NAME_MAX code
 * points, the unit Postgres counts, and otherwise untouched. A native `maxLength` counts
 * UTF-16 code units instead, which halves the cap for emoji and refuses names the library
 * accepts, so the inputs clamp through this rather than the attribute.
 */
export function clampProfileName(typed: string): string {
  const points = Array.from(typed);
  return points.length > PROFILE_NAME_MAX ? points.slice(0, PROFILE_NAME_MAX).join("") : typed;
}

/** `files.filename` holds 1–255 characters (the check in the library migration). */
export const FILENAME_MAX = 255;

/**
 * A filename the library accepts: cut to FILENAME_MAX characters, counted as code points the
 * way Postgres counts them (so no emoji is split), keeping a short extension; "audio" when the
 * name is empty.
 */
export function recordFilename(name: string): string {
  const chars = Array.from(name);
  if (!chars.length) return "audio";
  if (chars.length <= FILENAME_MAX) return name;
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? Array.from(name.slice(dot)) : [];
  const kept = extension.length <= 16 ? extension : [];
  return [...chars.slice(0, FILENAME_MAX - kept.length), ...kept].join("");
}

/** `files.mime` holds 1–120 characters (the check in the library migration). */
export const MIME_MAX = 120;

/** A MIME type the library accepts: the file's own when it fits, else the generic binary type. */
export function recordMime(type: string): string {
  const trimmed = type.trim();
  return trimmed && Array.from(trimmed).length <= MIME_MAX ? trimmed : "application/octet-stream";
}

/** The insert payload for a new style profile. The owner comes from the session (auth.uid()). */
export function styleProfileInsert(profile: Pick<StyleProfile, "name" | "provenance" | "spec" | "features">): Pick<StyleProfileRow, "name" | "provenance" | "spec"> & { features?: AudioFeatures } {
  return { name: profile.name, provenance: profile.provenance, spec: profile.spec, ...(profile.features ? { features: profile.features } : {}) };
}

/**
 * Arguments of `public.save_import` (supabase/migrations/20260926000200_save_import.sql): file
 * metadata and the profile that cites it, never the audio. The profile `id` is made on the
 * device when the profile is created, so saving it twice writes one row.
 */
export type SaveImportArgs = {
  file: { filename: string; mime: string; bytes: number; sha256: string; features: AudioFeatures };
  profile: { id: string; name: string; spec: StyleProfile["spec"]; analysedOn: string; model: string };
};

export type SongRow = {
  id: string;
  owner_id: string;
  title: string;
  brand: "VASEY.AUDIO";
  spec: MusicSpec;
  overrides: TargetOverride[];
  base_variant_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type VariantRow = {
  id: string;
  owner_id: string;
  song_id: string;
  seq: number;
  label: string;
  parent_variant_id: string | null;
  spec_snapshot: MusicSpec;
  diff: FieldDiff[];
  overrides: TargetOverride[];
  coverage: Variant["coverage"];
  created_at: string;
};

export type TakeRow = {
  id: string;
  owner_id: string;
  variant_id: string;
  engine: Take["engine"];
  engine_version: string;
  render_ref: string | null;
  verdict: Take["verdict"];
  drifted: DriftKind[];
  words_blamed: string[];
  notes: string;
  created_at: string;
};

/**
 * Arguments of `public.freeze_variant`. Every key is sent, `p_parent_variant_id` as `null`
 * for a first variant: supabase-js drops `undefined` keys, and PostgREST then finds no
 * function with that signature.
 */
export type FreezeVariantArgs = {
  p_song_id: string;
  p_expected_revision: number;
  p_title: string;
  p_spec: MusicSpec;
  p_overrides: TargetOverride[];
  p_parent_variant_id: string | null;
  p_diff: FieldDiff[];
  p_coverage: Variant["coverage"];
};

type LinkRow<K extends string> = { [P in K]: string } & { owner_id: string };
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };

/**
 * The public schema for the typed Supabase client, written from the migration. The RLS
 * test's column check keeps it honest; regenerate with the Supabase CLI once a project
 * exists (`supabase gen types typescript`).
 */
export type Database = {
  public: {
    Tables: {
      genres: Table<GenreRow, never>;
      style_profiles: Table<StyleProfileRow, { id?: string; name: string; provenance: Provenance; spec?: StyleProfile["spec"]; features?: AudioFeatures | null }>;
      files: Table<FileRow, { kind: FileRow["kind"]; filename: string; mime: string; bytes: number; sha256: string; features?: AudioFeatures | null; palette?: PaletteSwatch[] | null }>;
      tags: Table<TagRow, { label: string; colour?: string | null }>;
      style_profile_genres: Table<LinkRow<"profile_id" | "genre_id">, { profile_id: string; genre_id: string }>;
      style_profile_tags: Table<LinkRow<"profile_id" | "tag_id">, { profile_id: string; tag_id: string }>;
      file_genres: Table<LinkRow<"file_id" | "genre_id">, { file_id: string; genre_id: string }>;
      file_tags: Table<LinkRow<"file_id" | "tag_id">, { file_id: string; tag_id: string }>;
      songs: Table<SongRow, { id?: string; title: string; spec: MusicSpec; overrides?: TargetOverride[]; base_variant_id?: string | null }>;
      variants: Table<VariantRow, never>;
      takes: Table<TakeRow, Omit<TakeRow, "id" | "owner_id" | "created_at">>;
    };
    Views: { [_ in never]: never };
    Functions: {
      save_import: { Args: SaveImportArgs; Returns: { file_id: string; profile_id: string; owner: string }[] };
      file_record: { Args: { sha256: string }; Returns: { present: boolean; owner: string }[] };
      freeze_variant: { Args: FreezeVariantArgs; Returns: { variant_id: string; variant_label: string; song_revision: number; owner: string }[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
