-- Member-Claim STEP 5: member_invite_preview (anon-lesbar, vor Login).
-- Token → Mitglieds-/Vereinskontext für die Claim-Maske. Token = Geheimnis.
-- Deployed via Supabase-MCP 2026-06-03, repo-wahr gespiegelt.

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

  select first_name, last_name, email into v_mem
  from public.club_members where id = v_inv.club_member_id;

  select coalesce(
    (select (s.setting_value::jsonb ->> 'club_name')
     from public.app_secure_settings s
     where s.setting_key like 'club_code_map:%'
       and (s.setting_value::jsonb ->> 'club_id') = v_inv.club_id::text
     limit 1),
    'deinem Verein'
  ) into v_club;

  return query select true, 'ok'::text, v_club,
    v_mem.first_name, v_mem.email,
    (v_mem.email is not null and length(trim(v_mem.email)) > 0);
end;
$$;

revoke all on function public.member_invite_preview(text) from public;
grant execute on function public.member_invite_preview(text) to anon;
grant execute on function public.member_invite_preview(text) to authenticated;
grant execute on function public.member_invite_preview(text) to service_role;

notify pgrst, 'reload schema';
