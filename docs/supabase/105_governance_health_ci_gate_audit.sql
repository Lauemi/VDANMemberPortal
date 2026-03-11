-- 105 Governance Health CI Gate Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311194000_governance_health_ci_gate.sql
--
-- Purpose:
-- - Verify CI gate function exists and is hardened
-- - Verify execute grants are restricted
-- - Provide direct pass/fail checks for pipelines

-- A) Function exists + security definer + search_path
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'governance_health_ci_gate';

-- B) Execute grants
select
  grantee,
  privilege_type
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name = 'governance_health_ci_gate'
order by grantee, privilege_type;

-- C) CI gate: fail only on red
select *
from public.governance_health_ci_gate(false);

-- D) CI gate: fail on red and yellow
select *
from public.governance_health_ci_gate(true);
