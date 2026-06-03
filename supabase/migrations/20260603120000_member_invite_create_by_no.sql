-- Member-Claim STEP 4 (Backend-Teil): admin_member_invite_create_by_no
-- Frontend-freundlich: löst per club_code + member_no auf (beide in admin_member_registry-Row).
-- Deployed via Supabase-MCP 2026-06-03, repo-wahr gespiegelt.

drop function if exists public.admin_member_invite_create_by_no(text, text);

create or replace function public.admin_member_invite_create_by_no(
  p_club_code text,
  p_member_no text
)
returns table(
  ok boolean, message text, token text,
  first_name text, last_name text, member_email text, expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  v_club_id uuid;
  v_member  record;
  v_token   text;
  v_expires timestamptz := now() + interval '14 days';
  v_cnt     int;
begin
  select gim.club_id into v_club_id
  from public.get_club_identity_map() gim
  where gim.club_code = p_club_code
  limit 1;

  if v_club_id is null then
    return query select false, 'Verein nicht gefunden.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;

  if not (public.is_admin_or_vorstand_in_club(v_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;

  select count(*) into v_cnt from public.club_members
  where club_id = v_club_id and member_no = p_member_no;
  if v_cnt = 0 then
    return query select false, 'Mitglied nicht gefunden.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  elsif v_cnt > 1 then
    return query select false, 'Mitgliedsnummer nicht eindeutig.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;

  select cm.id, cm.first_name, cm.last_name, cm.email, cm.auth_user_id
    into v_member
  from public.club_members cm
  where cm.club_id = v_club_id and cm.member_no = p_member_no;

  if v_member.auth_user_id is not null then
    return query select false, 'Dieses Mitglied hat bereits einen Zugang.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;

  update public.club_member_invites set status='revoked'
    where club_member_id = v_member.id and status='active';

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.club_member_invites
    (club_id, club_member_id, token, status, created_by, expires_at)
  values
    (v_club_id, v_member.id, v_token, 'active', auth.uid(), v_expires);

  return query select true, 'Einladung erstellt.'::text, v_token,
    v_member.first_name, v_member.last_name, v_member.email, v_expires;
end;
$$;

revoke all on function public.admin_member_invite_create_by_no(text, text) from public, anon;
grant execute on function public.admin_member_invite_create_by_no(text, text) to authenticated;
grant execute on function public.admin_member_invite_create_by_no(text, text) to service_role;

notify pgrst, 'reload schema';
