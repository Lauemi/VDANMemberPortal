-- Migration: Admin Work Overview RPC
-- Zweck: Club-scoped Read-Vertrag fuer ClubSettings Helfer-/Einsatzübersicht.
-- Quellen: public.work_events + public.event_planner_configs
--          + public.event_planner_slots + public.event_planner_registrations
-- Zugriff: nur admin / vorstand / superadmin im angefragten Club.
-- Liefert eine Zeile pro work_event mit naechstem Slot-Titel und Helfer-Anzahl.

begin;

drop function if exists public.admin_work_overview(uuid);

create or replace function public.admin_work_overview(p_club_id uuid)
returns table(
  event_title   text,
  slot_label    text,
  helper_count  bigint,
  approval_mode text,
  status        text,
  starts_at     timestamptz
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select
    we.title                                          as event_title,
    min(eps.title)                                    as slot_label,
    count(distinct epr.id)                            as helper_count,
    coalesce(epc.approval_mode::text, 'manual')       as approval_mode,
    we.status::text,
    coalesce(min(eps.starts_at), we.starts_at)        as starts_at
  from public.work_events we
  left join public.event_planner_configs epc
    on  epc.base_work_event_id = we.id
  left join public.event_planner_slots eps
    on  eps.planner_config_id  = epc.id
    and eps.club_id             = p_club_id
  left join public.event_planner_registrations epr
    on  epr.slot_id = eps.id
    and epr.status  in ('pending', 'approved')
  where we.club_id = (
    select p_club_id
    from (select 1) _guard
    where (
      current_user in ('postgres', 'service_role')
      or public.is_admin_in_any_club()
      or public.is_admin_or_vorstand_in_club(p_club_id)
    )
  )
  group by we.id, we.title, we.status, we.starts_at, epc.approval_mode
  order by coalesce(min(eps.starts_at), we.starts_at) desc nulls last;
$$;

revoke all on function public.admin_work_overview(uuid) from public, anon;
grant execute on function public.admin_work_overview(uuid) to authenticated;
grant execute on function public.admin_work_overview(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
