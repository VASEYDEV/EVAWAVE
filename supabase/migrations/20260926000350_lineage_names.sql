-- The lineage names (src/data/lineage/names.json) for LN-1 in the database (docs/SPEC.md
-- §2.4; ADR 0006). The app lints a spec before it freezes it, but a caller can skip the app,
-- and a variant can never be edited, so `freeze_variant` checks these names too.
-- tests/integration/songs-rls.test.ts holds this table equal to names.json: a name added
-- there needs a migration that adds it here.
--
-- No API role can read or write it; only `freeze_variant`, as its owner, reads it.

create table public.lineage_names (
  name text primary key check (btrim(name) <> ''),
  -- A case-insensitive whole-word matcher, as `termPattern` builds one: the name, escaped,
  -- never inside a longer word. (`[` is not first in the bracket: `[.` would open a
  -- collating element.)
  pattern text generated always as ('(?<![[:alnum:]])' || regexp_replace(name, '([].*+?^${}()|[\\])', '\\\1', 'g') || '(?![[:alnum:]])') stored
);

comment on table public.lineage_names is 'Artist and producer names LN-1 refuses in a frozen variant; mirrors src/data/lineage/names.json.';

alter table public.lineage_names enable row level security;
revoke all on public.lineage_names from anon, authenticated;

insert into public.lineage_names (name) values
  ('Mannie Fresh'),
  ('Trackboyz'),
  ('Trackboy'),
  ('Hans Zimmer'),
  ('Zimmer'),
  ('Metro Boomin'),
  ('Carl Orff'),
  ('UGK'),
  ('Eazy-E'),
  ('Ebony Eyez'),
  ('J-Kwon'),
  ('YoungBloodZ'),
  ('Frankie J'),
  ('Chamillionaire'),
  ('T.I.');
