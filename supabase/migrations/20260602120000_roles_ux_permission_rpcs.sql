-- Migration: Rollen/Rechte UX — Permission-Save + Role-Create RPCs
-- Deployed via Supabase-MCP 2026-06-02, hier repo-wahr gespiegelt.
-- Referenz: SYSTEM/FCP/LAUNCH_CRITERIA/GATE_A_Rollen_Rechte_UX.md

begin;

-- ============================================================
-- 1. admin_club_role_permission_save
--    Schreibt Rechte für eine Rolle×Modul (Radio → DB-Booleans).
--    p_level: 'none' | 'read' | 'write' | 'full'
--    none  → alle false
--    read  → can_view + can_read
--    write → + can_write + can_update
--    full  → + can_delete
-- ============================================================

drop function if exists public.admin_club_role_permission_save(uuid, text, text, text);

create or replace function public.admin_club_role_permission_save(
  p_club_id    uuid,
  p_role_key   text,
  p_module_key text,
  p_level      text
)
returns table(ok boolean, message text)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_can_view   boolean := false;
  v_can_read   boolean := false;
  v_can_write  boolean := false;
  v_can_update boolean := false;
  v_can_delete boolean := false;
begin
  if not (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text;
    return;
  end if;

  case p_level
    when 'read' then
      v_can_view := true; v_can_read := true;
    when 'write' then
      v_can_view := true; v_can_read := true; v_can_write := true; v_can_update := true;
    when 'full' then
      v_can_view := true; v_can_read := true; v_can_write := true; v_can_update := true; v_can_delete := true;
    else
      null; -- 'none' → alle false (bereits initialisiert)
  end case;

  insert into public.club_role_permissions
    (club_id, role_key, module_key, can_view, can_read, can_write, can_update, can_delete)
  values
    (p_club_id, p_role_key, p_module_key,
     v_can_view, v_can_read, v_can_write, v_can_update, v_can_delete)
  on conflict (club_id, role_key, module_key) do update set
    can_view   = excluded.can_view,
    can_read   = excluded.can_read,
    can_write  = excluded.can_write,
    can_update = excluded.can_update,
    can_delete = excluded.can_delete;

  return query select true, 'Berechtigung gespeichert.'::text;
end;
$$;

revoke all on function public.admin_club_role_permission_save(uuid, text, text, text) from public, anon;
grant execute on function public.admin_club_role_permission_save(uuid, text, text, text) to authenticated;
grant execute on function public.admin_club_role_permission_save(uuid, text, text, text) to service_role;

-- ============================================================
-- 2. admin_club_role_create
--    Legt eine neue (nicht-Core) Vereinsrolle an.
--    tg_protect_core_roles schützt bestehende Core-Rollen (DELETE/UPDATE).
--    Extra-Guard hier: core role_keys abweisen.
-- ============================================================

drop function if exists public.admin_club_role_create(uuid, text, text);

create or replace function public.admin_club_role_create(
  p_club_id  uuid,
  p_role_key text,
  p_label    text
)
returns table(ok boolean, message text)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_inserted boolean := false;
begin
  if not (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text;
    return;
  end if;

  if lower(trim(p_role_key)) = any(array['admin','member','vorstand']) then
    return query select false, 'Core-Rollen können nicht neu angelegt werden.'::text;
    return;
  end if;

  insert into public.club_roles (club_id, role_key, label, is_core, is_active)
  values (p_club_id, lower(trim(p_role_key)), trim(p_label), false, true)
  on conflict (club_id, role_key) do nothing
  returning true into v_inserted;

  if v_inserted then
    return query select true, 'Rolle angelegt.'::text;
  else
    return query select false, 'Rolle mit diesem Schlüssel existiert bereits.'::text;
  end if;
end;
$$;

revoke all on function public.admin_club_role_create(uuid, text, text) from public, anon;
grant execute on function public.admin_club_role_create(uuid, text, text) to authenticated;
grant execute on function public.admin_club_role_create(uuid, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
