-- S6: songs and their immutable variants (docs/SPEC.md §1.6, §3 S6; ADR 0006).
--
-- A song is the working copy of a MusicSpec. A variant is a frozen snapshot of it, with
-- its parent and the target overrides it carried. Variants are immutable: users get no
-- UPDATE or DELETE on them, and they leave only with their song. They are created only by
-- `freeze_variant`, never by a direct insert. Saving a song is optimistic: every update
-- bumps `revision`, and the app updates only the revision it read, so a stale tab cannot
-- overwrite newer work.
--
-- Nothing derived is stored. A variant's field diff follows from its parent's snapshot and
-- its own, and its coverage from compiling its snapshot, so the app derives both when it
-- reads (docs/SPEC.md §2.4). A stored copy could only be what the client sent, and a
-- variant keeps whatever it is frozen with.
--
-- Ownership is structural as well as RLS: composite foreign keys tie a variant to a song
-- of the same owner, and a variant's parent (and a song's base variant) to the same song.
-- Policies compare against `(select auth.uid())` so Postgres evaluates it once per
-- statement rather than once per row.

-- ─── Songs ────────────────────────────────────────────────────────────────────────────

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  -- The output brand this song's data serves. A label on the data only; the app (a VASEY/AI
  -- tool) never renders it.
  brand text not null default 'VASEY.AUDIO' check (brand = 'VASEY.AUDIO'),
  spec jsonb not null check (jsonb_typeof(spec) = 'object' and spec ? 'irVersion' and octet_length(spec::text) <= 1000000),
  overrides jsonb not null default '[]'::jsonb check (jsonb_typeof(overrides) = 'array' and octet_length(overrides::text) <= 1000000),
  base_variant_id uuid,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

comment on table public.songs is 'Song: the working copy of a MusicSpec, saved explicitly. revision rises on every update.';

create index songs_owner_idx on public.songs (owner_id);

-- ─── Variants (immutable) ─────────────────────────────────────────────────────────────

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_id uuid not null,
  -- Assigned by a trigger: one past the song's highest. The label follows from it, so
  -- labels never collide and v1.10 sorts after v1.9 by seq.
  seq integer not null check (seq >= 1),
  label text generated always as ('v1.' || (seq - 1)::text) stored,
  parent_variant_id uuid,
  spec_snapshot jsonb not null check (jsonb_typeof(spec_snapshot) = 'object' and spec_snapshot ? 'irVersion' and octet_length(spec_snapshot::text) <= 1000000),
  -- Copied from the song by `freeze_variant`, never sent by the client.
  overrides jsonb not null default '[]'::jsonb check (jsonb_typeof(overrides) = 'array' and octet_length(overrides::text) <= 1000000),
  created_at timestamptz not null default now(),
  unique (song_id, seq),
  unique (song_id, id),
  unique (id, owner_id),
  -- A variant belongs to a song of the same owner, and goes with it.
  foreign key (song_id, owner_id) references public.songs (id, owner_id) on delete cascade,
  -- A parent is a variant of the same song. NO ACTION, so a song's cascade can remove a
  -- parent and its children in one statement.
  foreign key (song_id, parent_variant_id) references public.variants (song_id, id)
);

comment on table public.variants is 'Variant: an immutable snapshot of a song, with its parent and target overrides. Its diff and coverage are derived on read.';

create index variants_owner_idx on public.variants (owner_id);
create index variants_song_idx on public.variants (song_id);

-- A song's base variant (what its working copy descends from) is one of its own variants.
alter table public.songs
  add constraint songs_base_variant_fkey foreign key (id, base_variant_id) references public.variants (song_id, id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────────────

create function public.songs_bump_revision() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger songs_bump_revision before update on public.songs
  for each row execute function public.songs_bump_revision();

-- One past the song's highest sequence number. It runs inside `freeze_variant`, which
-- holds the song's row lock, so two freezes of one song cannot compute the same number.
create function public.variants_assign_seq() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  select coalesce(max(v.seq), 0) + 1 into new.seq from public.variants v where v.song_id = new.song_id;
  return new;
end;
$$;

create trigger variants_assign_seq before insert on public.variants
  for each row execute function public.variants_assign_seq();

-- ─── Row level security: owners only ──────────────────────────────────────────────────

alter table public.songs enable row level security;
alter table public.variants enable row level security;

create policy "Owners read their songs" on public.songs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners create their songs" on public.songs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their songs" on public.songs
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their songs" on public.songs
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their variants" on public.variants
  for select to authenticated using (owner_id = (select auth.uid()));
-- No insert policy and no insert grant: a variant is made only by `freeze_variant`.

-- ─── Privileges: least privilege for API roles ────────────────────────────────────────
-- Columns are granted one by one: a user can never write an owner, the brand, the revision
-- or any timestamp. Variants get no INSERT, UPDATE or DELETE at all: a direct insert would
-- skip the revision check and the song's lock, and could never be taken back.
--
-- Target overrides are not writable either. Nothing edits them yet (SPEC §1.4 item 3), and
-- a freeze copies them into a variant that can never change, so they wait for a write path
-- that lints them (LN-1) before they are stored. Until then every song's overrides are `[]`.

revoke all on public.songs, public.variants from anon, authenticated;

grant select, delete on public.songs to authenticated;
grant insert (id, title, spec) on public.songs to authenticated;
grant update (title, spec, base_variant_id) on public.songs to authenticated;
grant select on public.variants to authenticated;

revoke execute on function public.songs_bump_revision() from public, anon, authenticated;
revoke execute on function public.variants_assign_seq() from public, anon, authenticated;

-- ─── Freeze: save the working copy and snapshot it, in one transaction ────────────────

-- Security definer, because users may not insert variants themselves. It therefore checks
-- ownership explicitly (RLS does not apply to its owner): the song must be the caller's, at
-- the revision the caller read. The variant's owner is the caller, and the composite keys
-- still hold the parent to the same song. `search_path` is empty and every name qualified.
--
-- It takes from the caller only what a plain save takes (the title and the spec, the
-- caller's own content) and the parent, which must be a variant of the same song. The
-- overrides come from the song row; the diff and coverage are not stored at all. It refuses
-- a spec that names an artist or producer (LN-1, against `public.lineage_names`), as the
-- app does before calling it: a caller can skip the app, and a variant never changes.
create function public.freeze_variant(
  p_song_id uuid,
  p_expected_revision integer,
  p_title text,
  p_spec jsonb,
  p_parent_variant_id uuid
)
returns table (variant_id uuid, variant_label text, song_revision integer, owner uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_overrides jsonb;
  v_variant uuid;
  v_label text;
  v_revision integer;
begin
  if v_caller is null then
    raise exception 'freeze: sign in first';
  end if;
  -- Only the caller's song, only at the revision the caller read. The row lock also makes
  -- two freezes of one song run one after the other, so their sequence numbers cannot
  -- collide.
  select s.owner_id, s.overrides into v_owner, v_overrides
    from public.songs s
   where s.id = p_song_id and s.owner_id = v_caller and s.revision = p_expected_revision
     for update;
  if not found then
    raise exception 'freeze: the song changed elsewhere or is not yours; reload it';
  end if;

  -- Every string in the spec counts, except the references, which are never sent to an
  -- engine and hold no prose: a superset of the spec fields the app's LN-1 reads (the prose
  -- fields, the lyrics and patch values).
  if exists (
    select 1
      from jsonb_path_query(p_spec - 'references', 'strict $.**') as t (v)
      join public.lineage_names n on (t.v #>> '{}') ~* n.pattern
     where jsonb_typeof(t.v) = 'string'
  ) then
    raise exception 'freeze: the spec names an artist or producer (LN-1); describe the sound instead';
  end if;

  insert into public.variants (owner_id, song_id, parent_variant_id, spec_snapshot, overrides)
  values (v_caller, p_song_id, p_parent_variant_id, p_spec, v_overrides)
  returning variants.id, variants.label into v_variant, v_label;

  -- The working copy now equals the snapshot and descends from it.
  update public.songs s
     set title = p_title, spec = p_spec, base_variant_id = v_variant
   where s.id = p_song_id
  returning s.revision into v_revision;

  return query select v_variant, v_label, v_revision, v_owner;
end;
$$;

comment on function public.freeze_variant(uuid, integer, text, jsonb, uuid) is
  'The only way to create a variant: saves the caller''s song and freezes it as the next variant in one transaction, if the song is still at the expected revision.';

revoke execute on function public.freeze_variant(uuid, integer, text, jsonb, uuid) from public, anon;
grant execute on function public.freeze_variant(uuid, integer, text, jsonb, uuid) to authenticated;
