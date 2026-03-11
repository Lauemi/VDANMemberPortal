-- 82 ACL helper cutover to club_user_roles - Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311133000_acl_helper_cutover_to_club_user_roles.sql
--
-- Purpose:
-- - Verify helper functions now reference public.club_user_roles
-- - Verify policies still call same helper names
-- - Provide rollback SQL block (manual, optional)

-- A) Function definitions should reference club_user_roles
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin_in_club', 'is_admin_or_vorstand_in_club')
order by p.proname;

-- B) Policies that rely on helper names (sanity)
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (coalesce(qual,'') ilike '%is_admin_in_club(%'
       or coalesce(qual,'') ilike '%is_admin_or_vorstand_in_club(%'
       or coalesce(with_check,'') ilike '%is_admin_in_club(%'
       or coalesce(with_check,'') ilike '%is_admin_or_vorstand_in_club(%')
order by tablename, policyname;

-- C) Optional data parity spot-check count
select
  (select count(*) from public.user_roles where club_id is not null and lower(role) in ('member','vorstand','admin')) as user_roles_core_rows,
  (select count(*) from public.club_user_roles where role_key in ('member','vorstand','admin')) as acl_roles_core_rows;

-- -------------------------------------------------------------------
-- Rollback block (manual; run only if cutover must be reverted)
-- -------------------------------------------------------------------
-- begin;
-- create or replace function public.is_admin_in_club(p_club_id uuid)
-- returns boolean
-- language sql
-- security definer
-- stable
-- set search_path = public, auth, pg_catalog
-- as $$
--   select exists (
--     select 1
--     from public.user_roles ur
--     where ur.user_id = auth.uid()
--       and ur.club_id = p_club_id
--       and ur.role = 'admin'
--   )
-- $$;
--
-- create or replace function public.is_admin_or_vorstand_in_club(p_club_id uuid)
-- returns boolean
-- language sql
-- security definer
-- stable
-- set search_path = public, auth, pg_catalog
-- as $$
--   select exists (
--     select 1
--     from public.user_roles ur
--     where ur.user_id = auth.uid()
--       and ur.club_id = p_club_id
--       and ur.role in ('admin','vorstand')
--   )
-- $$;
-- commit;
