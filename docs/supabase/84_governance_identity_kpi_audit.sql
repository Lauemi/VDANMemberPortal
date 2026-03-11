-- 84 Governance Identity + KPI Audit SQL
-- Date: 2026-03-11
--
-- Purpose:
-- - Validate club identity quality (club_code + club_name)
-- - Validate person count vs role-assignment count semantics
-- - Detect clubs currently rendered with UUID fallback-like names
-- - Detect multi-role users per club (informational)

-- A) Club identity via app_secure_settings
with code_map as (
  select
    replace(setting_key, 'club_code_map:', '') as club_code,
    setting_value::text as club_id
  from public.app_secure_settings
  where setting_key like 'club_code_map:%'
),
name_map as (
  select
    replace(setting_key, 'club_name:', '') as club_id,
    setting_value::text as club_name
  from public.app_secure_settings
  where setting_key like 'club_name:%'
),
clubs as (
  select distinct club_id from public.club_roles
)
select
  c.club_id,
  cm.club_code,
  nm.club_name,
  case
    when cm.club_code is null or cm.club_code = '' then 'MISSING_CODE'
    when cm.club_code !~ '^[A-Z]{2}[0-9]{2}$' then 'INVALID_CODE_FORMAT'
    else 'OK'
  end as code_status,
  case
    when nm.club_name is null or trim(nm.club_name) = '' then 'MISSING_NAME'
    else 'OK'
  end as name_status
from clubs c
left join code_map cm on cm.club_id = c.club_id::text
left join name_map nm on nm.club_id = c.club_id::text
order by c.club_id;

-- B) UUID-fallback-like display names (should be empty in mature state)
-- Pattern example: "Club 4a825929"
with name_map as (
  select
    replace(setting_key, 'club_name:', '') as club_id,
    setting_value::text as club_name
  from public.app_secure_settings
  where setting_key like 'club_name:%'
)
select
  club_id,
  club_name
from name_map
where club_name ~* '^club\\s+[0-9a-f]{6,}$'
order by club_id;

-- C) KPI semantics per club
-- members_persons = distinct users in club_user_roles
-- role_assignments = all role rows in club_user_roles
select
  cur.club_id,
  count(distinct cur.user_id) as members_persons,
  count(*) as role_assignments,
  (count(*) - count(distinct cur.user_id)) as role_overhang
from public.club_user_roles cur
group by cur.club_id
order by cur.club_id;

-- D) Multi-role users per club (informational)
select
  cur.club_id,
  cur.user_id,
  count(*) as roles_per_user,
  string_agg(cur.role_key, ', ' order by cur.role_key) as roles
from public.club_user_roles cur
group by cur.club_id, cur.user_id
having count(*) > 1
order by cur.club_id, cur.user_id;

-- E) Legacy vs ACL parity (core roles only)
with legacy as (
  select distinct user_id, club_id, lower(role) as role_key
  from public.user_roles
  where club_id is not null
    and lower(role) in ('member','vorstand','admin')
),
acl as (
  select distinct user_id, club_id, role_key
  from public.club_user_roles
  where role_key in ('member','vorstand','admin')
)
select
  l.user_id,
  l.club_id,
  l.role_key,
  case when a.user_id is null then 'MISSING_IN_ACL' else 'OK' end as acl_status
from legacy l
left join acl a
  on a.user_id = l.user_id
 and a.club_id = l.club_id
 and a.role_key = l.role_key
order by l.club_id, l.user_id, l.role_key;
