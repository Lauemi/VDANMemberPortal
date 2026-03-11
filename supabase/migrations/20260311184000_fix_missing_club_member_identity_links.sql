begin;

-- Repair pass: link core role users to club_members rows when identity mapping is missing.
-- Strategy:
-- - per club, take users from club_user_roles (member/vorstand/admin) without identity row
-- - pair with club_members rows in same club that currently have no identity row
-- - deterministic pairing by row_number (user_id asc <-> member_no asc)

with missing_users as (
  select
    cur.club_id,
    cur.user_id,
    row_number() over (partition by cur.club_id order by cur.user_id) as rn
  from (
    select distinct club_id, user_id
    from public.club_user_roles
    where role_key in ('member', 'vorstand', 'admin')
  ) cur
  left join public.club_member_identities cmi
    on cmi.club_id = cur.club_id
   and cmi.user_id = cur.user_id
  where cmi.user_id is null
),
missing_members as (
  select
    cm.club_id,
    cm.member_no,
    row_number() over (partition by cm.club_id order by cm.member_no) as rn
  from public.club_members cm
  left join public.club_member_identities cmi
    on cmi.club_id = cm.club_id
   and cmi.member_no = cm.member_no
  where cmi.member_no is null
),
paired as (
  select
    u.club_id,
    u.user_id,
    m.member_no
  from missing_users u
  join missing_members m
    on m.club_id = u.club_id
   and m.rn = u.rn
)
insert into public.club_member_identities (club_id, user_id, member_no)
select
  p.club_id,
  p.user_id,
  p.member_no
from paired p
on conflict do nothing;

commit;
