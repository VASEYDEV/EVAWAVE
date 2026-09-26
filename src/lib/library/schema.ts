/**
 * The library tables (supabase/migrations/20260926000000_library.sql) as TypeScript: the
 * column lists, the row shapes, and the mappers to the IR library types (docs/SPEC.md §2.2).
 * tests/integration/library-rls.test.ts checks LIBRARY_COLUMNS against the migrated
 * database, so this file cannot drift from the SQL.
 */
import type { AudioFeatures, PaletteSwatch, Provenance, ReferenceAsset, StyleProfile, Tag } from "@/core/musicspec/ir/types";

export const LIBRARY_COLUMNS = {
  genres: ["id", "name", "record", "updated_at"],
  style_profiles: ["id", "owner_id", "name", "provenance", "spec", "features", "created_at", "updated_at"],
  files: ["id", "owner_id", "kind", "filename", "mime", "bytes", "sha256", "local_only", "features", "palette", "created_at"],
  tags: ["id", "owner_id", "label", "colour", "created_at"],
  style_profile_genres: ["profile_id", "genre_id", "owner_id"],
  style_profile_tags: ["profile_id", "tag_id", "owner_id"],
  file_genres: ["file_id", "genre_id", "owner_id"],
  file_tags: ["file_id", "tag_id", "owner_id"],
} as const;

/** Every table whose rows belong to one user; RLS limits each to its owner. */
export const USER_SCOPED_TABLES = ["style_profiles", "files", "tags", "style_profile_genres", "style_profile_tags", "file_genres", "file_tags"] as const;

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

/** A profile name the library accepts: the typed name, else the fallback, cut to the limit. */
export function profileName(typed: string, fallback: string): string {
  return (typed.trim() || fallback.trim()).slice(0, PROFILE_NAME_MAX).trim();
}

/** The insert payload for a new style profile. The owner comes from the session (auth.uid()). */
export function styleProfileInsert(profile: Pick<StyleProfile, "name" | "provenance" | "spec" | "features">): Pick<StyleProfileRow, "name" | "provenance" | "spec"> & { features?: AudioFeatures } {
  return { name: profile.name, provenance: profile.provenance, spec: profile.spec, ...(profile.features ? { features: profile.features } : {}) };
}

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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
