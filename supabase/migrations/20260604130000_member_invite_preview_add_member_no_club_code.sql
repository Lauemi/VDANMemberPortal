-- member_invite_preview liefert zusaetzlich member_no + club_code, damit der Claim-OTP-Signup
-- die raw_user_meta_data fuer enforce_auth_signup_guard (registration_mode='join_club') fuellen kann.
-- Ohne diese Felder wirft der Guard signup_guard_registration_mode_required -> /otp 500 beim
-- ECHTEN Erst-Signup. Felder werden serverseitig aus dem Token abgeleitet (kein User-Input).
-- Deployed via Supabase-MCP 2026-06-04, repo-wahr.

drop function if exists public.member_invite_preview(text);

create or replace function public.member_invite_preview(p_token text)
returns table(ok boolean, message text, club_name text, first_name text,
              member_email text, has_email boolean, member_no text, club_code text)
language plpgsql security definer set search_path to 'public','auth','pg_catalog'
as $function$
declare
  v_inv record; v_mem record; v_club text; v_code text;
begin
  select * into v_inv from public.club_member_invites where token = p_token;
  if not found then
    return query select false, 'Einladung ungültig.'::text, null::text,null::text,null::text,false,null::text,null::text; return;
  end if;
  if v_inv.status <> 'active' then
    return query select false, 'Diese Einladung wurde bereits verwendet oder zurückgezogen.'::text, null::text,null::text,null::text,false,null::text,null::text; return;
  end if;
  if v_inv.expires_at < now() then
    return query select false, 'Diese Einladung ist abgelaufen.'::text, null::text,null::text,null::text,false,null::text,null::text; return;
  end if;

  select cm.first_name, cm.last_name, cm.email, cm.member_no into v_mem
  from public.club_members cm where cm.id = v_inv.club_member_id;

  select (vj.v ->> 'club_name'), vj.code
  into v_club, v_code
  from (
    select s.setting_value::jsonb as v,
           replace(s.setting_key, 'club_code_map:', '') as code
    from public.app_secure_settings s
    where s.setting_key like 'club_code_map:%'
      and s.setting_value ~ '^\s*\{'
  ) vj
  where (vj.v ->> 'club_id') = v_inv.club_id::text
  limit 1;

  return query select true, 'ok'::text, coalesce(v_club,'deinem Verein'),
    v_mem.first_name, v_mem.email,
    (v_mem.email is not null and length(trim(v_mem.email)) > 0),
    v_mem.member_no, coalesce(v_code, v_inv.club_id::text);
end;
$function$;
revoke all on function public.member_invite_preview(text) from public, anon;
grant execute on function public.member_invite_preview(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
