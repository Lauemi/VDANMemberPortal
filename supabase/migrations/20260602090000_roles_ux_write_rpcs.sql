-- Migration: Rollen/Rechte UX — Write-RPCs (Zuweisung + Entzug)
-- Propagiert club_member_role_assignments → club_user_roles (Zugriffs-Gate).
-- Deployed via Supabase-MCP 2026-06-02, hier repo-wahr gespiegelt.

begin;

-- ============================================================
-- 1. admin_club_role_member_assign
--    Weist einem Mitglied eine Rolle zu.
--    Insert in club_member_role_assignments (idempotent).
--    Propagation → club_user_roles wenn Mitglied auth_user_id hat.
-- ============================================================

drop function if exists public.admin_club_role_member_assign(uuid, uuid, text);

create or replace function public.admin_club_role_member_assign(
  p_club_id        uuid,
  p_club_member_id uuid,
  p_role_key       text
)
returns table(ok boolean, message text)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_auth_user_id uuid;
begin
  if not (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text;
    return;
  end if;

  insert into public.club_member_role_assignments
    (club_id, club_member_id, role_key, assigned_by)
  values
    (p_club_id, p_club_member_id, p_role_key, auth.uid())
  on conflict (club_member_id, role_key) do nothing;

  select auth_user_id into v_auth_user_id
  from public.club_members
  where id = p_club_member_id and club_id = p_club_id;

  if v_auth_user_id is not null then
    insert into public.club_user_roles
      (user_id, club_id, role_key, canonical_membership_id, source, version)
    values
      (v_auth_user_id, p_club_id, p_role_key, p_club_member_id, 'role_ui', 1)
    on conflict (user_id, club_id, role_key) do update
      set source = 'role_ui', version = club_user_roles.version + 1;
  end if;

  return query select true, 'Rolle zugewiesen.'::text;
end;
$$;

revoke all on function public.admin_club_role_member_assign(uuid, uuid, text) from public, anon;
grant execute on function public.admin_club_role_member_assign(uuid, uuid, text) to authenticated;
grant execute on function public.admin_club_role_member_assign(uuid, uuid, text) to service_role;

-- ============================================================
-- 2. admin_club_role_member_remove
--    Entzieht einem Mitglied eine Rolle.
--    Delete aus club_member_role_assignments + club_user_roles.
-- ============================================================

drop function if exists public.admin_club_role_member_remove(uuid, uuid, text);

create or replace function public.admin_club_role_member_remove(
  p_club_id        uuid,
  p_club_member_id uuid,
  p_role_key       text
)
returns table(ok boolean, message text)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_auth_user_id uuid;
begin
  if not (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text;
    return;
  end if;

  select auth_user_id into v_auth_user_id
  from public.club_members
  where id = p_club_member_id and club_id = p_club_id;

  delete from public.club_member_role_assignments
  where club_member_id = p_club_member_id
    and club_id        = p_club_id
    and role_key       = p_role_key;

  if v_auth_user_id is not null then
    delete from public.club_user_roles
    where user_id  = v_auth_user_id
      and club_id  = p_club_id
      and role_key = p_role_key;
  end if;

  return query select true, 'Rolle entzogen.'::text;
end;
$$;

revoke all on function public.admin_club_role_member_remove(uuid, uuid, text) from public, anon;
grant execute on function public.admin_club_role_member_remove(uuid, uuid, text) to authenticated;
grant execute on function public.admin_club_role_member_remove(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';

commit;
