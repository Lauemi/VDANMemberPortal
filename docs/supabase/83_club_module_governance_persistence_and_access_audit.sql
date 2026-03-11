-- 83 Club Module Governance Persistence + Access - Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311143000_club_module_governance_persistence_and_access.sql
--
-- Purpose:
-- - Verify governance tables exist and are seeded
-- - Verify RLS and policies for new tables exist
-- - Verify club-scoped module assignment exists per club/usecase
-- - Verify helper functions exist and are callable

-- A) Objects exist
select to_regclass('public.module_catalog') as module_catalog;
select to_regclass('public.module_usecases') as module_usecases;
select to_regclass('public.club_module_usecases') as club_module_usecases;

-- B) RLS enabled
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('module_catalog', 'module_usecases', 'club_module_usecases')
order by c.relname;

-- C) Policies exist
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('module_catalog', 'module_usecases', 'club_module_usecases')
order by tablename, policyname;

-- D) Seed snapshot
select count(*) as modules_total, sum(case when is_active then 1 else 0 end) as modules_active
from public.module_catalog;

select count(*) as usecases_total, sum(case when is_active then 1 else 0 end) as usecases_active
from public.module_usecases;

-- E) Completeness: each known club has a row per active usecase
with known_clubs as (
  select distinct club_id from public.club_roles
),
active_usecases as (
  select mu.module_key, mu.usecase_key
  from public.module_usecases mu
  join public.module_catalog mc on mc.module_key = mu.module_key
  where mu.is_active = true and mc.is_active = true
),
expected as (
  select c.club_id, a.module_key, a.usecase_key
  from known_clubs c
  cross join active_usecases a
)
select
  e.club_id,
  e.module_key,
  e.usecase_key,
  case when cmu.club_id is null then 'MISSING' else 'OK' end as status
from expected e
left join public.club_module_usecases cmu
  on cmu.club_id = e.club_id
 and cmu.module_key = e.module_key
 and cmu.usecase_key = e.usecase_key
where cmu.club_id is null
order by e.club_id, e.module_key, e.usecase_key;

-- F) ACL rows for usecases (core roles)
select
  club_id,
  role_key,
  count(*) as usecase_acl_rows
from public.club_role_permissions
where role_key in ('member','vorstand','admin')
  and module_key in (select usecase_key from public.module_usecases)
group by club_id, role_key
order by club_id, role_key;

-- G) Helper function definitions
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin_in_any_club', 'has_usecase_access')
order by p.proname;

-- H) Optional smoke-call with concrete values (replace before run)
-- select public.has_usecase_access(
--   '736c6406-e90f-46cd-b0d8-f14a4323a177'::uuid,
--   'fangliste',
--   'view'
-- ) as can_view_fangliste;
