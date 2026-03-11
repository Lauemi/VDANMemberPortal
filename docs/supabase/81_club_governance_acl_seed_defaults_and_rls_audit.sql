-- 81 Club Governance ACL - Seed Defaults + RLS Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311125500_club_governance_acl_seed_defaults_and_rls.sql
--
-- Purpose:
-- - Verify seeded rows exist
-- - Verify RLS is enabled on ACL tables
-- - Verify expected policies exist
-- - Verify no cross-club null-key anomalies

-- A) Seed summary
select
  count(*) as total_acl_rows,
  count(distinct club_id) as clubs_with_acl,
  count(distinct role_key) as roles_with_acl,
  count(distinct module_key) as modules_with_acl
from public.club_role_permissions;

-- B) Core expected rows per club (member/vorstand/admin x 9 modules = 27)
with clubs as (
  select distinct club_id from public.club_roles where role_key in ('member','vorstand','admin')
),
expected as (
  select c.club_id, 27 as expected_rows
  from clubs c
),
actual as (
  select club_id, count(*) as actual_rows
  from public.club_role_permissions
  where role_key in ('member','vorstand','admin')
  group by club_id
)
select e.club_id, e.expected_rows, coalesce(a.actual_rows, 0) as actual_rows,
       case when coalesce(a.actual_rows, 0) >= e.expected_rows then 'OK' else 'LOW' end as status
from expected e
left join actual a using (club_id)
order by e.club_id;

-- C) RLS enabled?
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('club_roles','club_role_permissions','club_user_roles')
order by c.relname;

-- D) Policies present?
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('club_roles','club_role_permissions','club_user_roles')
order by tablename, policyname;

-- E) club_id/key sanity
select *
from public.club_role_permissions
where club_id is null
   or role_key is null
   or module_key is null;

-- F) can_view consistency (must return 0 rows)
select *
from public.club_role_permissions p
where
  (p.can_view = false and (p.can_read or p.can_write or p.can_update or p.can_delete))
  or
  (p.can_view = true and p.can_read = false);
