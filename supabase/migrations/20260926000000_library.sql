-- EVAWAVE library (docs/SPEC.md §1.6, §3 S4).
--
-- Style profiles, reference-file metadata, tags and curated genres, plus the genre and
-- tag links for profiles and files. Row level security is on for every table from this
-- first migration (CLAUDE.md §5): a signed-in user reads and writes only rows they own,
-- and the curated genres are read-only for users. Audio and image blobs never reach this
-- database; they stay on the device (A6), so `files` holds metadata only.
--
-- Policies compare against `(select auth.uid())` so Postgres evaluates it once per
-- statement rather than once per row.

-- ─── Curated genres (read-only for users) ─────────────────────────────────────────────

create table public.genres (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  updated_at timestamptz not null default now()
);

comment on table public.genres is 'Curated Genre records from src/data/taxonomy/genres.json. Users read; only the service role writes.';

alter table public.genres enable row level security;

create policy "Signed-in users read genres"
  on public.genres for select
  to authenticated
  using (true);

-- ─── Style profiles ───────────────────────────────────────────────────────────────────

create table public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object' and provenance ? 'kind'),
  spec jsonb not null default '{}'::jsonb check (jsonb_typeof(spec) = 'object'),
  features jsonb check (features is null or jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.style_profiles is 'StyleProfile: a reusable partial MusicSpec (D1–D6, D8, D9) with provenance.';

create index style_profiles_owner_idx on public.style_profiles (owner_id);

-- ─── Reference files (metadata only; blobs stay on the device, A6) ────────────────────

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('audio', 'image')),
  filename text not null check (char_length(filename) between 1 and 255),
  mime text not null check (char_length(mime) between 1 and 120),
  bytes bigint not null check (bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  local_only boolean not null default true check (local_only),
  features jsonb check (features is null or jsonb_typeof(features) = 'object'),
  palette jsonb check (palette is null or jsonb_typeof(palette) = 'array'),
  created_at timestamptz not null default now(),
  unique (owner_id, sha256)
);

comment on table public.files is 'ReferenceAsset metadata. local_only is always true in v1: the blob never leaves the device (A6).';

create index files_owner_idx on public.files (owner_id);

-- ─── Tags ─────────────────────────────────────────────────────────────────────────────

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  colour text check (colour is null or colour ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (owner_id, label)
);

create index tags_owner_idx on public.tags (owner_id);

-- ─── Genre and tag links ──────────────────────────────────────────────────────────────
-- Each link row carries its owner, and a link may only join rows that owner owns.

create table public.style_profile_genres (
  profile_id uuid not null references public.style_profiles (id) on delete cascade,
  genre_id text not null references public.genres (id) on delete restrict,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (profile_id, genre_id)
);

create table public.style_profile_tags (
  profile_id uuid not null references public.style_profiles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (profile_id, tag_id)
);

create table public.file_genres (
  file_id uuid not null references public.files (id) on delete cascade,
  genre_id text not null references public.genres (id) on delete restrict,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (file_id, genre_id)
);

create table public.file_tags (
  file_id uuid not null references public.files (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (file_id, tag_id)
);

create index style_profile_genres_owner_idx on public.style_profile_genres (owner_id);
create index style_profile_tags_owner_idx on public.style_profile_tags (owner_id);
create index file_genres_owner_idx on public.file_genres (owner_id);
create index file_tags_owner_idx on public.file_tags (owner_id);

-- ─── updated_at ───────────────────────────────────────────────────────────────────────

create function public.touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger style_profiles_touch before update on public.style_profiles
  for each row execute function public.touch_updated_at();

-- ─── Row level security: owners only ──────────────────────────────────────────────────

alter table public.style_profiles enable row level security;
alter table public.files enable row level security;
alter table public.tags enable row level security;
alter table public.style_profile_genres enable row level security;
alter table public.style_profile_tags enable row level security;
alter table public.file_genres enable row level security;
alter table public.file_tags enable row level security;

create policy "Owners read their style profiles" on public.style_profiles
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners create their style profiles" on public.style_profiles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their style profiles" on public.style_profiles
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their style profiles" on public.style_profiles
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their files" on public.files
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners create their files" on public.files
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their files" on public.files
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their files" on public.files
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their tags" on public.tags
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners create their tags" on public.tags
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their tags" on public.tags
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their tags" on public.tags
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their profile genres" on public.style_profile_genres
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners link genres to their profiles" on public.style_profile_genres
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.style_profiles p where p.id = profile_id and p.owner_id = (select auth.uid()))
  );
create policy "Owners unlink genres from their profiles" on public.style_profile_genres
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their profile tags" on public.style_profile_tags
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners tag their profiles" on public.style_profile_tags
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.style_profiles p where p.id = profile_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.owner_id = (select auth.uid()))
  );
create policy "Owners untag their profiles" on public.style_profile_tags
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their file genres" on public.file_genres
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners link genres to their files" on public.file_genres
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.files f where f.id = file_id and f.owner_id = (select auth.uid()))
  );
create policy "Owners unlink genres from their files" on public.file_genres
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their file tags" on public.file_tags
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners tag their files" on public.file_tags
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.files f where f.id = file_id and f.owner_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.owner_id = (select auth.uid()))
  );
create policy "Owners untag their files" on public.file_tags
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ─── Privileges: least privilege for API roles ────────────────────────────────────────
-- Supabase's default privileges grant every API role everything on new public tables.
-- Take that back, then grant signed-in users only what the policies above allow.
-- `anon` gets nothing: the library needs a session.

revoke all on public.genres, public.style_profiles, public.files, public.tags,
  public.style_profile_genres, public.style_profile_tags, public.file_genres, public.file_tags
  from anon, authenticated;

grant select on public.genres to authenticated;
grant select, insert, update, delete on public.style_profiles, public.files, public.tags to authenticated;
grant select, insert, delete on public.style_profile_genres, public.style_profile_tags, public.file_genres, public.file_tags to authenticated;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;
