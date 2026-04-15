-- Migration: Admin Club Roles Read RPC
-- Zweck: Echten club-scoped Read-Vertrag fuer ClubSettings Rollen-/Rechteübersicht liefern.
-- Ersetzt den alten Mock-Block (SELECT hardcoded text).
-- Quellen: public.club_roles + public.club_user_roles + public.club_role_permissions
-- Zugriff: nur admin / vorstand / superadmin im angefragten Club.

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
    cr.label                              as role_label,
    cr.is_core,
    cr.is_active,
    count(distinct crp.module_key)        as module_count,
    count(distinct cur.user_id)           as member_count
  from public.club_roles cr
  left join public.club_role_permissions crp
    on  crp.club_id  = cr.club_id
    and crp.role_key = cr.role_key
  left join public.club_user_roles cur
    on  cur.club_id  = cr.club_id
    and cur.role_key = cr.role_key
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
