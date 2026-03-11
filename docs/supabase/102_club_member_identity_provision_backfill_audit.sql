-- 102 Club Member Identity Provision Backfill Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311182000_club_member_identity_provision_backfill.sql
--
-- Purpose:
-- - Verify per-club identity mappings cover all core role users
-- - Verify each mapped identity has a club_members row
-- - Verify admin_member_registry can resolve profile_user_id per club member

-- A) Core role users vs identity mappings
with role_users as (
  select distinct cur.club_id, cur.user_id
  from public.club_user_roles cur
  where cur.role_key in ('member', 'vorstand', 'admin')
),
identity_users as (
  select distinct cmi.club_id, cmi.user_id
  from public.club_member_identities cmi
)
select
  ru.club_id,
  count(*) as role_users_core,
  count(iu.user_id) as identity_users_core,
  case
    when count(iu.user_id) = count(*) then 'OK'
    else 'MISSING_IDENTITY'
  end as identity_status
from role_users ru
left join identity_users iu
  on iu.club_id = ru.club_id
 and iu.user_id = ru.user_id
group by ru.club_id
order by ru.club_id;

-- B) Identity rows without backing club_members row
select
  cmi.club_id,
  cmi.user_id,
  cmi.member_no,
  case when cm.member_no is null then 'MISSING_CLUB_MEMBER' else 'OK' end as member_row_status
from public.club_member_identities cmi
left join public.club_members cm
  on cm.club_id = cmi.club_id
 and cm.member_no = cmi.member_no
where cm.member_no is null
order by cmi.club_id, cmi.user_id;

-- C) Provisioning parity snapshot (updated logic from audit 100)
with role_users as (
  select
    cur.club_id,
    count(distinct cur.user_id) filter (where cur.role_key in ('member','vorstand','admin')) as role_users_core
  from public.club_user_roles cur
  group by cur.club_id
),
member_rows as (
  select
    cm.club_id,
    count(*) as club_member_rows
  from public.club_members cm
  group by cm.club_id
),
identity_rows as (
  select
    cmi.club_id,
    count(*) as identity_rows
  from public.club_member_identities cmi
  group by cmi.club_id
)
select
  coalesce(r.club_id, m.club_id, i.club_id) as club_id,
  coalesce(r.role_users_core, 0) as role_users_core,
  coalesce(m.club_member_rows, 0) as club_member_rows,
  coalesce(i.identity_rows, 0) as identity_rows,
  case
    when coalesce(m.club_member_rows, 0) >= coalesce(r.role_users_core, 0)
     and coalesce(i.identity_rows, 0) >= coalesce(r.role_users_core, 0)
      then 'OK'
    else 'PROVISION_GAP'
  end as provisioning_status
from role_users r
full join member_rows m on m.club_id = r.club_id
full join identity_rows i on i.club_id = coalesce(r.club_id, m.club_id)
order by club_id;

-- D) Registry-smoke ohne admin_member_registry() Gate:
-- unresolved profile_user_id rows, äquivalent zur Join-Logik der Funktion
select
  cm.club_id,
  cm.member_no,
  cm.first_name,
  cm.last_name,
  cmi.user_id as profile_user_id
from public.club_members cm
left join public.club_member_identities cmi
  on cmi.club_id = cm.club_id
 and cmi.member_no = cm.member_no
where cmi.user_id is null
order by cm.club_id, cm.member_no
limit 200;
