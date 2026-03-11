-- 98 Club Setup Flow - Audit SQL
-- Purpose:
-- - Verify a newly created club is consistent across core governance objects
-- - Detect common setup gaps (especially role-only clubs without member master data)
--
-- Usage:
-- - Replace TARGET_CLUB_ID with the created club UUID.
--
-- Safety:
-- - If TARGET_CLUB_ID is not replaced, this script will NOT fail anymore.
--   It returns no data rows and the preflight block shows status INVALID_TARGET_CLUB_ID.

-- 0) Preflight (must show VALID_UUID before interpreting further sections)
with input as (
  select 'TARGET_CLUB_ID'::text as raw_club_id
)
select
  raw_club_id,
  case
    when raw_club_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then 'VALID_UUID'
    else 'INVALID_TARGET_CLUB_ID'
  end as target_status
from input;

-- A) Core identity settings exist
with input as (
  select 'TARGET_CLUB_ID'::text as raw_club_id
),
target as (
  select
    case
      when raw_club_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw_club_id::uuid
      else null
    end as club_id
  from input
),
code_map as (
  select
    replace(s.setting_key, 'club_code_map:', '') as club_code,
    s.setting_value::uuid as club_id
  from public.app_secure_settings s
  where s.setting_key like 'club_code_map:%'
),
name_map as (
  select
    replace(s.setting_key, 'club_name:', '')::uuid as club_id,
    s.setting_value::text as club_name
  from public.app_secure_settings s
  where s.setting_key like 'club_name:%'
)
select
  t.club_id,
  cm.club_code,
  nm.club_name,
  case when cm.club_code is null then 'MISSING_CODE_MAP' else 'OK' end as code_map_status,
  case when nm.club_name is null or trim(nm.club_name) = '' then 'MISSING_CLUB_NAME' else 'OK' end as club_name_status
from target t
left join code_map cm on cm.club_id = t.club_id
left join name_map nm on nm.club_id = t.club_id;

-- B) Core role templates exist for club
with input as (
  select 'TARGET_CLUB_ID'::text as raw_club_id
),
target as (
  select
    case
      when raw_club_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw_club_id::uuid
      else null
    end as club_id
  from input
)
select
  role_key,
  is_core,
  created_at
from public.club_roles
where club_id = (select club_id from target)
order by role_key;

-- C) Creator/admin assignment parity: legacy vs ACL
-- (informational; adjust user_id filter if needed)
with input as (
  select 'TARGET_CLUB_ID'::text as raw_club_id
),
target as (
  select
    case
      when raw_club_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw_club_id::uuid
      else null
    end as club_id
  from input
)
select
  ur.user_id,
  ur.club_id,
  ur.role as legacy_role,
  case when cur.user_id is null then 'MISSING_IN_ACL' else 'OK' end as acl_status
from public.user_roles ur
left join public.club_user_roles cur
  on cur.user_id = ur.user_id
 and cur.club_id = ur.club_id
 and cur.role_key = ur.role
where ur.club_id = (select club_id from target)
  and lower(ur.role) in ('member','vorstand','admin')
order by ur.user_id, ur.role;

-- D) Module setup completeness for active usecases
with input as (
  select 'TARGET_CLUB_ID'::text as raw_club_id
),
target as (
  select
    case
      when raw_club_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw_club_id::uuid
      else null
    end as club_id
  from input
),
active_usecases as (
  select mu.module_key, mu.usecase_key
  from public.module_usecases mu
  join public.module_catalog mc on mc.module_key = mu.module_key
  where mu.is_active = true
    and mc.is_active = true
)
select
  a.module_key,
  a.usecase_key,
  case when cmu.club_id is null then 'MISSING' else 'OK' end as assignment_status
from active_usecases a
left join public.club_module_usecases cmu
  on cmu.club_id = (select club_id from target)
 and cmu.module_key = a.module_key
 and cmu.usecase_key = a.usecase_key
order by a.module_key, a.usecase_key;

-- E) Setup warning: role users without member master row
-- This is expected in current architecture if club directory was not seeded yet.
with input as (
  select 'TARGET_CLUB_ID'::text as raw_club_id
),
target as (
  select
    case
      when raw_club_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw_club_id::uuid
      else null
    end as club_id
  from input
),
role_users as (
  select distinct cur.user_id, cur.club_id
  from public.club_user_roles cur
  where cur.club_id = (select club_id from target)
),
mapped as (
  select
    ru.club_id,
    ru.user_id,
    p.member_no
  from role_users ru
  left join public.profiles p on p.id = ru.user_id
)
select
  m.club_id,
  m.user_id,
  m.member_no,
  case
    when m.member_no is null then 'NO_PROFILE_MEMBER_NO'
    when cm.member_no is null then 'NO_CLUB_MEMBER_RECORD'
    else 'OK'
  end as member_link_status
from mapped m
left join public.club_members cm
  on cm.club_id = m.club_id
 and cm.member_no = m.member_no
where m.member_no is null
   or cm.member_no is null
order by m.user_id;
