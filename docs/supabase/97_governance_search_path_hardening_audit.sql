-- 97 Governance - Search Path Hardening Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311160000_governance_search_path_hardening.sql
--
-- Purpose:
-- - Verify affected functions exist
-- - Verify search_path is pinned (proconfig contains search_path=...)
-- - Provide deterministic output for deploy log

-- A) Function existence
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tg_set_updated_at',
    'tg_protect_core_roles',
    'tg_club_role_permissions_sanitize'
  )
order by p.proname;

-- B) search_path pinned check
select
  n.nspname as schema_name,
  p.proname as function_name,
  coalesce(
    (
      select string_agg(cfg, ', ')
      from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg like 'search_path=%'
    ),
    'MISSING'
  ) as search_path_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tg_set_updated_at',
    'tg_protect_core_roles',
    'tg_club_role_permissions_sanitize'
  )
order by p.proname;

-- C) Hard status (must return 0 rows)
select
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tg_set_updated_at',
    'tg_protect_core_roles',
    'tg_club_role_permissions_sanitize'
  )
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, array[]::text[])) cfg
    where cfg like 'search_path=%'
  );

