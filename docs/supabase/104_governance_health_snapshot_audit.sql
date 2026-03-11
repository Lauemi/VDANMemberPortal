-- 104 Governance Health Snapshot Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311193000_governance_health_snapshot.sql
--
-- Purpose:
-- - Verify governance snapshot RPCs exist, are hardened, and executable
-- - Verify ampel logic output for all clubs
-- - Provide drilldown over failing rules

-- A) Function exists + security definer + search_path
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('governance_health_snapshot', 'governance_health_issues')
order by p.proname;

-- B) Execute grants
select
  routine_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in ('governance_health_snapshot', 'governance_health_issues')
order by routine_name, grantee, privilege_type;

-- C) Snapshot (ampel summary)
select
  club_id,
  club_code,
  club_name,
  identity_gaps,
  roles_without_membership,
  duplicate_identities,
  members_without_identity_link,
  club_name_or_code_missing,
  total_issues,
  health_status
from public.governance_health_snapshot()
order by
  case health_status
    when 'red' then 1
    when 'yellow' then 2
    else 3
  end,
  club_code nulls last,
  club_id;

-- D) Global counts by ampel
select
  health_status,
  count(*) as clubs_count,
  sum(total_issues) as total_issues
from public.governance_health_snapshot()
group by health_status
order by
  case health_status
    when 'red' then 1
    when 'yellow' then 2
    else 3
  end;

-- E) Drilldown: all open issues
select
  rule_key,
  club_id,
  club_code,
  club_name,
  ref_1,
  ref_2,
  detail
from public.governance_health_issues(null)
order by club_id, rule_key, ref_1 nulls last, ref_2 nulls last
limit 500;

-- F) Optional focused drilldown
-- select *
-- from public.governance_health_issues('TARGET_CLUB_ID'::uuid)
-- order by rule_key, ref_1 nulls last, ref_2 nulls last;
