-- S5: save an audio import atomically (docs/SPEC.md §3 S5). The file's metadata and the
-- style profile that cites it are written in one transaction, so a failure part-way leaves
-- neither row. The function runs as the caller (security invoker), so row level security
-- applies exactly as it does to direct writes: another owner's profile id is refused.

create function public.save_import(file jsonb, profile jsonb)
returns table (file_id uuid, profile_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_file uuid;
  saved_profile uuid;
begin
  -- Upserted by (owner_id, sha256), so a re-import reuses the owner's row.
  insert into public.files (kind, filename, mime, bytes, sha256, features)
  values ('audio', file ->> 'filename', file ->> 'mime', (file ->> 'bytes')::bigint, file ->> 'sha256', file -> 'features')
  on conflict (owner_id, sha256) do update
    set filename = excluded.filename, mime = excluded.mime, bytes = excluded.bytes, features = excluded.features
  returning id into saved_file;

  -- Upserted by the id made on the device, so saving the same profile twice writes one row.
  -- The provenance cites the file row just written.
  insert into public.style_profiles (id, name, spec, provenance, features)
  values (
    (profile ->> 'id')::uuid,
    profile ->> 'name',
    profile -> 'spec',
    jsonb_build_object('kind', 'audio-analysis', 'sourceRef', saved_file, 'analysedOn', profile ->> 'analysedOn', 'model', profile ->> 'model'),
    file -> 'features'
  )
  on conflict (id) do update
    set name = excluded.name, spec = excluded.spec, provenance = excluded.provenance, features = excluded.features
  returning id into saved_profile;

  return query select saved_file, saved_profile;
end;
$$;

comment on function public.save_import(jsonb, jsonb) is 'Saves an audio import (file metadata and its style profile) in one transaction, under RLS.';

revoke execute on function public.save_import(jsonb, jsonb) from public, anon;
grant execute on function public.save_import(jsonb, jsonb) to authenticated;
