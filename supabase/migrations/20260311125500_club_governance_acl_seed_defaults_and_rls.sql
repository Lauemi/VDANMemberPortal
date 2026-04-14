-- 81 Club Governance ACL - seed defaults + RLS
-- Status: DRAFT PREPARED (not executed by Codex)
-- Date: 2026-03-11
--
-- Goal:
-- - Seed default ACL rows for core roles per club
-- - Enforce club-scoped RLS on ACL tables
--
-- Mandatory follow-up:
-- - Run companion audit SQL:
--   docs/supabase/81_club_governance_acl_seed_defaults_and_rls_audit.sql

begin;
-- -------------------------------------------------------------------
-- 1) Seed defaults for core roles
-- -------------------------------------------------------------------
with module_defaults as (
  select * from (
    values
      -- member defaults
      ('member','club_data',       true,  true,  false, false, false),
      ('member','members',         true,  true,  false, false, false),
      ('member','roles_acl',       false, false, false, false, false),
      ('member','waters',          false, false, false, false, false),
      ('member','rules',           false, false, false, false, false),
      ('member','cards',           false, false, false, false, false),
      ('member','work_events',     false, false, false, false, false),
      ('member','catch_approvals', false, false, false, false, false),
      ('member','settings',        false, false, false, false, false),

      -- vorstand defaults
      ('vorstand','club_data',       true, true,  true,  true,  false),
      ('vorstand','members',         true, true,  true,  true,  false),
      ('vorstand','roles_acl',       true, true,  false, false, false),
      ('vorstand','waters',          true, true,  true,  true,  false),
      ('vorstand','rules',           true, true,  true,  true,  false),
      ('vorstand','cards',           true, true,  true,  true,  false),
      ('vorstand','work_events',     true, true,  true,  true,  false),
      ('vorstand','catch_approvals', true, true,  true,  true,  false),
      ('vorstand','settings',        true, true,  true,  true,  false),

      -- admin defaults
      ('admin','club_data',       true, true, true, true, true),
      ('admin','members',         true, true, true, true, true),
      ('admin','roles_acl',       true, true, true, true, true),
      ('admin','waters',          true, true, true, true, true),
      ('admin','rules',           true, true, true, true, true),
      ('admin','cards',           true, true, true, true, true),
      ('admin','work_events',     true, true, true, true, true),
      ('admin','catch_approvals', true, true, true, true, true),
      ('admin','settings',        true, true, true, true, true)
  ) as t(role_key, module_key, can_view, can_read, can_write, can_update, can_delete)
)
insert into public.club_role_permissions (
  club_id, role_key, module_key, can_view, can_read, can_write, can_update, can_delete
)
select
  cr.club_id,
  md.role_key,
  md.module_key,
  md.can_view,
  md.can_read,
  md.can_write,
  md.can_update,
  md.can_delete
from public.club_roles cr
join module_defaults md
  on md.role_key = cr.role_key
where cr.role_key in ('member','vorstand','admin')
on conflict (club_id, role_key, module_key) do nothing;
-- -------------------------------------------------------------------
-- 2) RLS enablement
-- -------------------------------------------------------------------
alter table public.club_roles enable row level security;
alter table public.club_role_permissions enable row level security;
alter table public.club_user_roles enable row level security;
-- -------------------------------------------------------------------
-- 3) Policies - club_roles
-- -------------------------------------------------------------------
drop policy if exists "club_roles_select_same_club" on public.club_roles;
create policy "club_roles_select_same_club"
on public.club_roles
for select
to authenticated
using (public.is_same_club(club_id));
drop policy if exists "club_roles_admin_same_club_all" on public.club_roles;
create policy "club_roles_admin_same_club_all"
on public.club_roles
for all
to authenticated
using (public.is_admin_in_club(club_id))
with check (public.is_admin_in_club(club_id));
-- -------------------------------------------------------------------
-- 4) Policies - club_role_permissions
-- -------------------------------------------------------------------
drop policy if exists "club_role_permissions_select_same_club" on public.club_role_permissions;
create policy "club_role_permissions_select_same_club"
on public.club_role_permissions
for select
to authenticated
using (public.is_same_club(club_id));
drop policy if exists "club_role_permissions_admin_same_club_all" on public.club_role_permissions;
create policy "club_role_permissions_admin_same_club_all"
on public.club_role_permissions
for all
to authenticated
using (public.is_admin_in_club(club_id))
with check (public.is_admin_in_club(club_id));
-- -------------------------------------------------------------------
-- 5) Policies - club_user_roles
-- -------------------------------------------------------------------
drop policy if exists "club_user_roles_manager_same_club_select" on public.club_user_roles;
create policy "club_user_roles_manager_same_club_select"
on public.club_user_roles
for select
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id));
drop policy if exists "club_user_roles_admin_same_club_all" on public.club_user_roles;
create policy "club_user_roles_admin_same_club_all"
on public.club_user_roles
for all
to authenticated
using (public.is_admin_in_club(club_id))
with check (public.is_admin_in_club(club_id));
commit;
