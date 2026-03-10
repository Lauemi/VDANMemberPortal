-- VDAN/FCP - Multi-tenant readiness audit
-- Date: 2026-03-10
-- Usage:
--   Run as read-only checks in Supabase SQL editor after 94_* hardening.
--   Each query is independent and can be executed separately.

-- -------------------------------------------------------------------
-- A) Helper + fallback status
-- -------------------------------------------------------------------
select
  public.legacy_single_club_fallback_enabled() as legacy_fallback_enabled,
  public.current_user_club_id() as current_user_club_id_runtime;

select
  s.setting_key,
  s.setting_value,
  s.updated_at
from public.app_secure_settings s
where s.setting_key in ('legacy_single_club_fallback_enabled', 'public_active_club_id')
order by s.setting_key;

-- -------------------------------------------------------------------
-- B) Profiles and tenant binding quality
-- -------------------------------------------------------------------
select
  count(*) as profiles_total,
  count(*) filter (where club_id is null) as profiles_without_club_id
from public.profiles;

select
  count(*) as role_users_without_profile_club
from public.profiles p
where p.club_id is null
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p.id
  );

-- Users that already have role assignments in multiple clubs.
-- This is expected in true multi-club scenarios, but must be explicitly handled in UI/API.
select
  ur.user_id,
  count(distinct ur.club_id) as clubs_count
from public.user_roles ur
where ur.club_id is not null
group by ur.user_id
having count(distinct ur.club_id) > 1
order by clubs_count desc, ur.user_id;

-- -------------------------------------------------------------------
-- C) Policy smell check: global role helper without club bind
-- -------------------------------------------------------------------
select
  p.schemaname,
  p.tablename,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
from pg_policies p
where p.schemaname = 'public'
  and exists (
    select 1
    from information_schema.columns c
    where c.table_schema = p.schemaname
      and c.table_name = p.tablename
      and c.column_name = 'club_id'
  )
  and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) ilike '%is_admin_or_vorstand()%'
  and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_same_club(%'
  and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_admin_or_vorstand_in_club(%'
order by p.tablename, p.policyname;

-- -------------------------------------------------------------------
-- D) Function definition smell check: fallback/default-club semantics
-- -------------------------------------------------------------------
select
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ilike '%public_active_club_id%'
  and p.proname not in ('public_active_club_id', 'legacy_single_club_fallback_enabled')
order by function_name;

-- -------------------------------------------------------------------
-- E) High-level readiness indicator (DB-side, conservative)
-- -------------------------------------------------------------------
with
smell_policies as (
  select count(*) as c
  from pg_policies p
  where p.schemaname = 'public'
    and exists (
      select 1
      from information_schema.columns c
      where c.table_schema = p.schemaname
        and c.table_name = p.tablename
        and c.column_name = 'club_id'
    )
    and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) ilike '%is_admin_or_vorstand()%'
    and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_same_club(%'
    and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_admin_or_vorstand_in_club(%'
),
null_binding as (
  select count(*) as c
  from public.profiles p
  where p.club_id is null
    and exists (select 1 from public.user_roles ur where ur.user_id = p.id)
),
fallback_flag as (
  select case when public.legacy_single_club_fallback_enabled() then 1 else 0 end as c
)
select
  case
    when (select c from smell_policies) = 0
     and (select c from null_binding) = 0
     and (select c from fallback_flag) = 0
    then 'multi-tenant-ready-db-baseline'
    else 'not-ready-requires-hardening'
  end as readiness_status,
  (select c from smell_policies) as policy_smells,
  (select c from null_binding) as role_users_without_profile_club,
  (select c from fallback_flag) as legacy_fallback_enabled_flag;
