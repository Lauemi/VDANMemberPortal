-- 80 Club Governance ACL - add can_view semantics
-- Status: DRAFT PREPARED (not executed by Codex)
-- Date: 2026-03-11
--
-- Goal:
-- - Add explicit can_view flag to club_role_permissions
-- - Enforce rule:
--   * can_view = false => all rights false
--   * can_view = true  => can_read true
--
-- Mandatory follow-up:
-- - Run companion audit SQL:
--   docs/supabase/80_club_governance_acl_add_can_view_audit.sql

begin;
alter table public.club_role_permissions
  add column if not exists can_view boolean not null default false;
-- Backfill can_view from legacy right set.
update public.club_role_permissions
set can_view = (
  coalesce(can_view, false)
  or coalesce(can_read, false)
  or coalesce(can_write, false)
  or coalesce(can_update, false)
  or coalesce(can_delete, false)
);
-- Normalize existing rows to match new semantics.
update public.club_role_permissions
set
  can_read   = case when can_view then true else false end,
  can_write  = case when can_view then coalesce(can_write, false) else false end,
  can_update = case when can_view then coalesce(can_update, false) else false end,
  can_delete = case when can_view then coalesce(can_delete, false) else false end;
create or replace function public.tg_club_role_permissions_sanitize()
returns trigger
language plpgsql
as $$
begin
  new.can_view := coalesce(new.can_view, false);
  if new.can_view = false then
    new.can_read := false;
    new.can_write := false;
    new.can_update := false;
    new.can_delete := false;
  else
    -- "Anzeigen" implies readable by default.
    new.can_read := true;
    new.can_write := coalesce(new.can_write, false);
    new.can_update := coalesce(new.can_update, false);
    new.can_delete := coalesce(new.can_delete, false);
  end if;
  return new;
end
$$;
drop trigger if exists trg_club_role_permissions_sanitize on public.club_role_permissions;
create trigger trg_club_role_permissions_sanitize
before insert or update on public.club_role_permissions
for each row execute function public.tg_club_role_permissions_sanitize();
alter table public.club_role_permissions
  drop constraint if exists club_role_permissions_view_gate_chk;
alter table public.club_role_permissions
  add constraint club_role_permissions_view_gate_chk
  check (
    (can_view = false and can_read = false and can_write = false and can_update = false and can_delete = false)
    or
    (can_view = true and can_read = true)
  );
commit;
