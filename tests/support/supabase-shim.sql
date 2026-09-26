-- Test shim for the parts of the Supabase platform the migrations depend on, so the real
-- migration SQL runs under RLS in PGlite (tests/integration/library-rls.test.ts).
-- It mirrors Supabase's definitions: the API roles, auth.users, and auth.uid(), which
-- reads the JWT subject the API sets for each request. It is never deployed.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text
);

create function auth.uid() returns uuid
  language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase's default privileges grant the API roles everything on new public tables;
-- the migrations must revoke what they do not want, so the shim reproduces the default.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
