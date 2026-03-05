-- VDAN/FCP - Safe tenant key hardening (low operational risk)
-- Run after:
--   75_dsgvo_ops_helpers.sql
--
-- Purpose:
--   1) Remove global-role coupling in user_roles primary key.
--   2) Add tenant-safe uniqueness guard for club_members.
--   3) Keep behavior backward-compatible for current production usage.
--
-- Notes:
--   - This migration is intentionally conservative.
--   - It does NOT introduce cross-table data rewrites.
--   - It should be executed in a controlled release window.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- -------------------------------------------------------------------
-- 1) user_roles: make PK tenant-aware
--    Old PK: (user_id, role) prevented same role in multiple clubs.
--    New PK: (user_id, club_id, role)
-- -------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'user_roles'
      and c.contype = 'p'
      and pg_get_constraintdef(c.oid) ilike 'PRIMARY KEY (user_id, club_id, role)%'
  ) then
    alter table public.user_roles
      drop constraint if exists user_roles_pkey;

    alter table public.user_roles
      add constraint user_roles_pkey primary key (user_id, club_id, role);
  end if;
end $$;

-- -------------------------------------------------------------------
-- 2) club_members: add explicit tenant uniqueness guard
--    Current PK is member_no (global). We keep it for compatibility.
--    This additional unique constraint documents and enforces
--    tenant-scoped identity semantics for future migrations.
-- -------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'club_members'
      and c.conname = 'club_members_club_id_member_no_key'
  ) then
    alter table public.club_members
      add constraint club_members_club_id_member_no_key unique (club_id, member_no);
  end if;
end $$;

commit;

-- -------------------------------------------------------------------
-- Verification (manual)
-- -------------------------------------------------------------------
-- 1) user_roles PK columns:
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.user_roles'::regclass
--   and contype = 'p';
--
-- 2) club_members tenant unique exists:
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.club_members'::regclass
--   and contype in ('p', 'u')
-- order by conname;
