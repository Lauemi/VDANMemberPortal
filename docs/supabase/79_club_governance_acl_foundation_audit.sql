-- 79 Club Governance ACL Foundation - Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311113000_club_governance_acl_foundation.sql
--
-- Purpose:
-- - Verify objects exist
-- - Verify constraints/triggers are present
-- - Verify core-role backfill happened
-- - Verify legacy user_roles data remains untouched in structure

-- A) Objects exist
select to_regclass('public.club_roles') as club_roles;
select to_regclass('public.club_role_permissions') as club_role_permissions;
select to_regclass('public.club_user_roles') as club_user_roles;

-- B) Core constraints (PK/UNIQUE) exist
select conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in ('club_roles', 'club_role_permissions', 'club_user_roles')
order by t.relname, conname;

-- C) Required triggers exist
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('club_roles', 'club_role_permissions')
order by event_object_table, trigger_name;

-- D) Core roles per known club
with known_clubs as (
  select distinct club_id
  from public.user_roles
  where club_id is not null
),
core_roles as (
  select k.club_id, r.role_key
  from known_clubs k
  cross join (values ('member'), ('vorstand'), ('admin')) as r(role_key)
)
select
  c.club_id,
  c.role_key,
  case when cr.role_key is null then 'MISSING' else 'OK' end as status
from core_roles c
left join public.club_roles cr
  on cr.club_id = c.club_id
 and cr.role_key = c.role_key
order by c.club_id, c.role_key;

-- E) Backfill summary from user_roles -> club_user_roles
select
  (select count(*) from public.user_roles ur where ur.club_id is not null and lower(ur.role) in ('member','vorstand','admin')) as source_rows,
  (select count(*) from public.club_user_roles) as mapped_rows;

-- F) Duplicate guard check on target key
select user_id, club_id, role_key, count(*) as n
from public.club_user_roles
group by user_id, club_id, role_key
having count(*) > 1;

-- G) Core-role protection smoke test (transaction rolled back)
-- Expected:
-- - delete core role should fail
-- - rename core role_key should fail
-- This block is optional. Keep commented for production audits.
--
-- begin;
-- do $$
-- declare
--   v_club uuid;
-- begin
--   select club_id into v_club from public.club_roles where is_core = true limit 1;
--   if v_club is null then
--     raise notice 'No core role rows found; skip smoke test.';
--     return;
--   end if;
--
--   begin
--     delete from public.club_roles where club_id = v_club and role_key = 'member' and is_core = true;
--     raise exception 'Expected delete protection, but delete succeeded.';
--   exception when others then
--     raise notice 'Delete protection OK: %', sqlerrm;
--   end;
--
--   begin
--     update public.club_roles
--        set role_key = 'member_x'
--      where club_id = v_club and role_key = 'member' and is_core = true;
--     raise exception 'Expected rename protection, but update succeeded.';
--   exception when others then
--     raise notice 'Rename protection OK: %', sqlerrm;
--   end;
-- end$$;
-- rollback;

-- H) Existing user_roles table still accessible (structure sanity)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_roles'
order by ordinal_position;
