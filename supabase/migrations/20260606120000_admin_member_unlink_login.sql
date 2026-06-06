-- STEP 06: Admin-Fallback — Login eines Mitglieds entkoppeln (club-scoped).
-- Loest die auth_user_id-Bindung + Registry-Bruecke + Zugriffsrechte NUR fuer diesen Club
-- (multi-club-sicher; profiles bleibt unangetastet). Danach ist das Mitglied wieder einladbar (STEP 01).
-- Spiegelt das Teardown von self_portal_access_unlink, aber admin-initiiert auf ein Ziel-Mitglied.
-- Deployed via Supabase-MCP 2026-06-06, repo-wahr.

create or replace function public.admin_member_unlink_login(
  p_club_id uuid,
  p_club_member_id uuid
)
returns table(
  ok boolean,
  message text,
  unlinked_member_no text,
  removed_identity_links integer,
  removed_club_user_roles integer
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_mem record;
  v_removed_identity integer := 0;
  v_removed_roles integer := 0;
begin
  if not (
    current_user in ('postgres','service_role')
    or public.is_admin_or_vorstand_in_club(p_club_id)
    or public.fcp_is_superadmin()
  ) then
    return query select false, 'Keine Berechtigung.'::text, null::text, 0, 0; return;
  end if;

  select id, member_no, auth_user_id into v_mem
  from public.club_members
  where id = p_club_member_id and club_id = p_club_id;

  if not found then
    return query select false, 'Mitglied nicht gefunden.'::text, null::text, 0, 0; return;
  end if;
  if v_mem.auth_user_id is null then
    return query select false, 'Mitglied ist nicht mit einem Login verknüpft.'::text, v_mem.member_no, 0, 0; return;
  end if;

  update public.club_members
    set auth_user_id = null, updated_at = now()
  where id = p_club_member_id;

  delete from public.club_member_identities
  where club_id = p_club_id and member_no = v_mem.member_no;
  get diagnostics v_removed_identity = row_count;

  delete from public.club_user_roles
  where user_id = v_mem.auth_user_id and club_id = p_club_id;
  get diagnostics v_removed_roles = row_count;

  delete from public.user_roles
  where user_id = v_mem.auth_user_id and club_id = p_club_id;

  return query select true, 'Login entkoppelt. Mitglied ist wieder einladbar.'::text,
    v_mem.member_no, v_removed_identity, v_removed_roles;
end;
$$;

revoke all on function public.admin_member_unlink_login(uuid, uuid) from public, anon;
grant execute on function public.admin_member_unlink_login(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
