-- 103 Admin Member Registry Create/Delete Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311190000_admin_member_registry_create_delete.sql
--
-- Purpose:
-- - Verify create/delete RPCs exist and are executable for authenticated
-- - Verify signatures include club scope

-- A) Function existence + search_path
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_member_registry_create', 'admin_member_registry_delete')
order by p.proname;

-- B) Execute grants
select
  routine_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in ('admin_member_registry_create', 'admin_member_registry_delete')
order by routine_name, grantee;

-- C) Signature check (identity args)
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_member_registry_create', 'admin_member_registry_delete')
order by p.proname;
