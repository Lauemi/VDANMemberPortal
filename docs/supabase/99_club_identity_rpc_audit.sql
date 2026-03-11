-- 99 Club Identity RPC Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311170000_club_identity_rpc_for_admin_ui.sql
--
-- Purpose:
-- - Verify secure RPC exists for club identity read
-- - Verify search_path hardening on function
-- - Verify execute grants are limited to authenticated/service_role
-- - Smoke-test payload consumed by Admin UI

-- A) Function exists + security definer + search_path
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_club_identity_map';

-- B) Execute grants on function
select
  grantee,
  privilege_type
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name = 'get_club_identity_map'
order by grantee, privilege_type;

-- C) Smoke call (as current role)
select *
from public.get_club_identity_map()
order by club_code nulls last, club_id
limit 50;
