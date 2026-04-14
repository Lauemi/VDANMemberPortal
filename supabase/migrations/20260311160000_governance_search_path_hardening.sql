-- 97 Governance - Search Path Hardening
-- Date: 2026-03-11
--
-- Purpose:
-- - Fix Supabase linter warning: function_search_path_mutable
-- - Harden trigger/helper functions by pinning search_path
--
-- Scope:
-- - public.tg_set_updated_at()
-- - public.tg_protect_core_roles()
-- - public.tg_club_role_permissions_sanitize()
--
-- Note:
-- - auth_leaked_password_protection is NOT configurable via SQL migration.
--   See runbook for manual Supabase Auth setting step.

begin;
do $$
declare
  fn record;
begin
  for fn in
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
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, auth, pg_catalog',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end $$;
commit;
