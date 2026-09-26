-- S5: whether the caller has a file record for a hash, and who the caller is (docs/SPEC.md
-- §3 S5). /library removes a device's local copy whose record was deleted elsewhere, but
-- only on a definite "no record" for the account whose copies it scanned. Row level
-- security answers for whoever the call runs as, so the call also returns auth.uid(): if
-- another tab switched accounts, the app sees a different owner and keeps the copy.

create function public.file_record(sha256 text)
returns table (present boolean, owner uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.files f where f.sha256 = file_record.sha256), auth.uid();
$$;

comment on function public.file_record(text) is 'Whether the caller has a file record for a hash, with the caller''s id, under RLS.';

revoke execute on function public.file_record(text) from public, anon;
grant execute on function public.file_record(text) to authenticated;
