-- 101 Club Member Identity Mapping Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311173000_club_member_identity_mapping_foundation.sql
--
-- Purpose:
-- - Verify new user<->club<->member_no mapping table exists and is constrained
-- - Verify admin_member_registry resolves profile_user_id via mapping
-- - Detect per-club gaps between roles, mapping and member directory

-- A) Objects + constraints
select to_regclass('public.club_member_identities') as club_member_identities;

select
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conrelid = 'public.club_member_identities'::regclass
order by conname;

-- B) RLS + policies
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'club_member_identities';

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'club_member_identities'
order by policyname;

-- C) admin_member_registry function definition should reference club_member_identities
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_member_registry';

-- D) Coverage snapshot per club
with roles as (
  select
    cur.club_id,
    count(distinct cur.user_id) filter (where cur.role_key in ('member','vorstand','admin')) as role_users_core
  from public.club_user_roles cur
  group by cur.club_id
),
mapping as (
  select
    cmi.club_id,
    count(*) as mapped_users,
    count(distinct cmi.member_no) as mapped_member_nos
  from public.club_member_identities cmi
  group by cmi.club_id
),
directory as (
  select
    cm.club_id,
    count(*) as club_member_rows
  from public.club_members cm
  group by cm.club_id
)
select
  coalesce(r.club_id, m.club_id, d.club_id) as club_id,
  coalesce(r.role_users_core, 0) as role_users_core,
  coalesce(m.mapped_users, 0) as mapped_users,
  coalesce(d.club_member_rows, 0) as club_member_rows,
  case
    when coalesce(m.mapped_users, 0) >= coalesce(r.role_users_core, 0)
     and coalesce(d.club_member_rows, 0) >= coalesce(r.role_users_core, 0)
      then 'OK'
    else 'GAP'
  end as mapping_status
from roles r
full join mapping m on m.club_id = r.club_id
full join directory d on d.club_id = coalesce(r.club_id, m.club_id)
order by club_id;

-- E) Rows in directory without identity mapping
select
  cm.club_id,
  cm.club_code,
  cm.member_no,
  cm.first_name,
  cm.last_name
from public.club_members cm
left join public.club_member_identities cmi
  on cmi.club_id = cm.club_id
 and cmi.member_no = cm.member_no
where cmi.user_id is null
order by cm.club_id, cm.member_no
limit 200;
