begin;

-- Reconcile pass for clubs where club_members rows exist without identity-link.
-- For affected clubs, rebuild identity mapping for core-role users deterministically
-- (user_id asc <-> member_no asc).

with affected_clubs as (
  select distinct cm.club_id
  from public.club_members cm
  left join public.club_member_identities cmi
    on cmi.club_id = cm.club_id
   and cmi.member_no = cm.member_no
  where cmi.user_id is null
),
core_users as (
  select distinct cur.club_id, cur.user_id
  from public.club_user_roles cur
  join affected_clubs ac on ac.club_id = cur.club_id
  where cur.role_key in ('member', 'vorstand', 'admin')
),
ranked_users as (
  select
    cu.club_id,
    cu.user_id,
    row_number() over (partition by cu.club_id order by cu.user_id) as rn
  from core_users cu
),
ranked_members as (
  select
    cm.club_id,
    cm.member_no,
    row_number() over (partition by cm.club_id order by cm.member_no) as rn
  from public.club_members cm
  join affected_clubs ac on ac.club_id = cm.club_id
),
paired as (
  select
    u.club_id,
    u.user_id,
    m.member_no
  from ranked_users u
  join ranked_members m
    on m.club_id = u.club_id
   and m.rn = u.rn
)
-- remove old mappings for affected core users
, deleted as (
  delete from public.club_member_identities cmi
  using core_users cu
  where cmi.club_id = cu.club_id
    and cmi.user_id = cu.user_id
  returning cmi.club_id
)
insert into public.club_member_identities (club_id, user_id, member_no)
select
  p.club_id,
  p.user_id,
  p.member_no
from paired p
on conflict (club_id, user_id)
do update set
  member_no = excluded.member_no,
  updated_at = now();

commit;
