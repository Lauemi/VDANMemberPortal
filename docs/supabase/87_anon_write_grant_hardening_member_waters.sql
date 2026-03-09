-- VDAN/FCP - Hardening: remove unnecessary anon write grants on member water tables
-- Date: 2026-03-09
-- Safe to run multiple times.

begin;

revoke insert, update, delete, truncate, references, trigger on table public.member_waters from anon;
revoke insert, update, delete, truncate, references, trigger on table public.member_water_mappings from anon;

commit;

-- Optional verification:
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee = 'anon'
--   and table_name in ('member_waters', 'member_water_mappings')
-- order by table_name, privilege_type;
