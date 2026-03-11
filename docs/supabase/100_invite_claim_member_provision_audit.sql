-- 100 Invite Claim Member Provision Audit SQL
-- Purpose:
-- - Verify invite-claim now creates club_members rows for empty club directories
-- - Detect clubs where role users exceed member-directory rows (possible provisioning gap)
-- - Inspect newly auto-generated member numbers per club
--
-- Optional usage:
-- - Replace TARGET_CLUB_ID for focused checks in section C.

-- A) Per-club: role users vs member directory rows
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
)
select
  coalesce(r.club_id, m.club_id) as club_id,
  coalesce(r.role_users_core, 0) as role_users_core,
  coalesce(m.club_member_rows, 0) as club_member_rows,
  case
    when coalesce(m.club_member_rows, 0) >= coalesce(r.role_users_core, 0) then 'OK'
    else 'PROVISION_GAP'
  end as provisioning_status
from role_users r
full join member_rows m on m.club_id = r.club_id
order by club_id;

-- B) Auto-generated style member numbers (CODE-0001) by club
select
  cm.club_id,
  cm.club_code,
  cm.member_no,
  cm.first_name,
  cm.last_name,
  cm.created_at
from public.club_members cm
where cm.member_no ~ '^[A-Z]{2}[0-9]{2}-[0-9]{4}$'
order by cm.club_id, cm.member_no;

-- C) Focused club snapshot (safe placeholder)
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
  cm.club_id,
  cm.club_code,
  cm.member_no,
  cm.first_name,
  cm.last_name,
  cm.status,
  cm.created_at
from public.club_members cm
where cm.club_id = (select club_id from target)
order by cm.created_at desc, cm.member_no
limit 100;
