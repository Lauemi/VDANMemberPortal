-- 82 ACL helper cutover to club_user_roles
-- Status: DRAFT PREPARED (not executed by Codex)
-- Date: 2026-03-11
--
-- Goal:
-- - Switch helper functions from public.user_roles to public.club_user_roles
-- - Keep function signatures stable for policy compatibility
--
-- Mandatory follow-up:
-- - Run companion audit SQL:
--   docs/supabase/82_acl_helper_cutover_to_club_user_roles_audit.sql

begin;

create or replace function public.is_admin_in_club(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.club_user_roles ur
    where ur.user_id = auth.uid()
      and ur.club_id = p_club_id
      and ur.role_key = 'admin'
  )
$$;

create or replace function public.is_admin_or_vorstand_in_club(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.club_user_roles ur
    where ur.user_id = auth.uid()
      and ur.club_id = p_club_id
      and ur.role_key in ('admin','vorstand')
  )
$$;

commit;
