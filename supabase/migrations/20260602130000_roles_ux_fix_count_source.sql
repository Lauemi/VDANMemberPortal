-- Migration: admin_club_roles_read — member_count aus club_member_role_assignments
-- Vorher: count(distinct cur.user_id) aus club_user_roles → widersprüchlich
--         zu admin_club_role_members_read (liest aus club_member_role_assignments).
-- Jetzt:  count(distinct cmra.club_member_id) aus club_member_role_assignments
--         → Header-Zahl und Akkordeon-Inhalt immer konsistent.
-- Deployed via Supabase-MCP 2026-06-02, hier repo-wahr gespiegelt.

begin;

drop function if exists public.admin_club_roles_read(uuid);

create or replace function public.admin_club_roles_read(p_club_id uuid)
returns table(
  role_key      text,
  role_label    text,
  is_core       boolean,
  is_active     boolean,
  module_count  bigint,
  member_count  bigint
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select
    cr.role_key,
    cr.label                                    as role_label,
    cr.is_core,
    cr.is_active,
    count(distinct crp.module_key)              as module_count,
    count(distinct cmra.club_member_id)         as member_count
  from public.club_roles cr
  left join public.club_role_permissions crp
    on  crp.club_id  = cr.club_id
    and crp.role_key = cr.role_key
  left join public.club_member_role_assignments cmra
    on  cmra.club_id  = cr.club_id
    and cmra.role_key = cr.role_key
  where cr.club_id = (
    select p_club_id
    from (select 1) _guard
    where (
      current_user in ('postgres', 'service_role')
      or public.is_admin_in_any_club()
      or public.is_admin_or_vorstand_in_club(p_club_id)
    )
  )
  group by cr.club_id, cr.role_key, cr.label, cr.is_core, cr.is_active
  order by cr.is_core desc, cr.role_key;
$$;

revoke all on function public.admin_club_roles_read(uuid) from public, anon;
grant execute on function public.admin_club_roles_read(uuid) to authenticated;
grant execute on function public.admin_club_roles_read(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
