-- member_invite_preview: first_name-Ambiguitaet (Alias cm.) + JSON-sichere club_name-Suche.
-- Deployed via Supabase-MCP 2026-06-04, repo-wahr.

drop function if exists public.member_invite_preview(text);

create or replace function public.member_invite_preview(p_token text)
returns table(
  ok boolean, message text, club_name text,
  first_name text, member_email text, has_email boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_inv  record;
  v_mem  record;
  v_club text;
begin
  select * into v_inv from public.club_member_invites where token = p_token;
  if not found then
    return query select false, 'Einladung ungültig.'::text, null::text, null::text, null::text, false; return;
  end if;
  if v_inv.status <> 'active' then
    return query select false, 'Diese Einladung wurde bereits verwendet oder zurückgezogen.'::text, null::text, null::text, null::text, false; return;
  end if;
  if v_inv.expires_at < now() then
    return query select false, 'Diese Einladung ist abgelaufen.'::text, null::text, null::text, null::text, false; return;
  end if;

  select cm.first_name, cm.last_name, cm.email into v_mem
  from public.club_members cm where cm.id = v_inv.club_member_id;

  select coalesce(
    (select (vj.v ->> 'club_name')
     from (
       select s.setting_value::jsonb as v
       from public.app_secure_settings s
       where s.setting_key like 'club_code_map:%'
         and s.setting_value ~ '^\s*\{'
     ) vj
     where (vj.v ->> 'club_id') = v_inv.club_id::text
     limit 1),
    'deinem Verein'
  ) into v_club;

  return query select true, 'ok'::text, v_club,
    v_mem.first_name, v_mem.email,
    (v_mem.email is not null and length(trim(v_mem.email)) > 0);
end;
$$;

revoke all on function public.member_invite_preview(text) from public;
grant execute on function public.member_invite_preview(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
