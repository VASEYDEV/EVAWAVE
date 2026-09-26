-- S7: the take log (docs/SPEC.md §1.6, §2.2 `Take`, §3 S7).
--
-- A take records what an engine did with one variant: which engine and version, a
-- reference to the render on the engine's side (never the audio, A6), a verdict, the kinds
-- of drift heard, the words blamed for it, and notes. Takes hang off a variant of the same
-- owner (a composite key, as variants hang off songs) and leave with it, so deleting a
-- song removes its variants and their takes. A take is never edited: a mistaken one is
-- deleted and logged again.

create table public.takes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  variant_id uuid not null,
  -- The live engines. Udio is halted (A12), so nothing is rendered there to log.
  engine text not null check (engine in ('suno', 'eleven', 'flow')),
  engine_version text not null check (char_length(engine_version) between 1 and 80),
  -- An engine-side id or link, never the audio: no data: URLs, and short enough that it
  -- cannot carry a clip.
  render_ref text check (render_ref is null or (char_length(render_ref) between 1 and 2048 and render_ref !~* '^\s*data:')),
  verdict text not null check (verdict in ('keep', 'kill', 'extend', 'rerun')),
  drifted text[] not null default '{}' check (
    drifted <@ array['meter', 'tempo', 'key', 'vocals-appeared', 'section-skipped', 'instrument-misread', 'genre-bleed', 'length', 'other']::text[]
  ),
  words_blamed text[] not null default '{}' check (
    cardinality(words_blamed) <= 50
    and array_position(words_blamed, '') is null
    and char_length(array_to_string(words_blamed, '')) <= 4000
  ),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  foreign key (variant_id, owner_id) references public.variants (id, owner_id) on delete cascade
);

comment on table public.takes is 'Take: one render of a variant in an engine, as the owner judged it. Never the audio.';

create index takes_owner_idx on public.takes (owner_id);
create index takes_variant_idx on public.takes (variant_id);

alter table public.takes enable row level security;

create policy "Owners read their takes" on public.takes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners log takes on their variants" on public.takes
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.variants v where v.id = variant_id and v.owner_id = (select auth.uid()))
  );
create policy "Owners delete their takes" on public.takes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Least privilege: no UPDATE at all, and the owner and timestamp are never client-written.
revoke all on public.takes from anon, authenticated;
grant select, delete on public.takes to authenticated;
grant insert (variant_id, engine, engine_version, render_ref, verdict, drifted, words_blamed, notes) on public.takes to authenticated;
