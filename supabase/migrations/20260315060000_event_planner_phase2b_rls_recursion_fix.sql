begin;

drop policy if exists "event_planner_slots_select_same_club_or_manager" on public.event_planner_slots;
drop policy if exists "event_planner_configs_select_same_club_or_manager" on public.event_planner_configs;

drop function if exists public.event_planner_config_is_published(uuid);

create or replace function public.event_planner_config_is_published(
  p_base_kind public.event_planner_base_kind,
  p_base_club_event_id uuid default null,
  p_base_work_event_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
  select case
    when p_base_kind = 'club_event' then exists (
      select 1
      from public.club_events ce
      where ce.id = p_base_club_event_id
        and ce.status = 'published'
    )
    when p_base_kind = 'work_event' then exists (
      select 1
      from public.work_events we
      where we.id = p_base_work_event_id
        and we.status = 'published'
    )
    else false
  end
$$;

create policy "event_planner_configs_select_same_club_or_manager"
on public.event_planner_configs
for select
to authenticated
using (
  (
    public.can_access_club_content(club_id)
    and public.event_planner_config_is_published(base_kind, base_club_event_id, base_work_event_id)
  )
  or public.is_admin_or_vorstand_in_club(club_id)
);

create policy "event_planner_slots_select_same_club_or_manager"
on public.event_planner_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.event_planner_configs c
    where c.id = planner_config_id
      and (
        (
          public.can_access_club_content(c.club_id)
          and public.event_planner_config_is_published(c.base_kind, c.base_club_event_id, c.base_work_event_id)
        )
        or public.is_admin_or_vorstand_in_club(c.club_id)
      )
  )
);

revoke execute on function public.event_planner_config_is_published(public.event_planner_base_kind, uuid, uuid) from public, anon;
grant execute on function public.event_planner_config_is_published(public.event_planner_base_kind, uuid, uuid) to authenticated;

comment on function public.event_planner_config_is_published(public.event_planner_base_kind, uuid, uuid)
is 'Security definer helper for planner select policies. Avoids recursive RLS by evaluating published state directly from club_events/work_events.';

commit;
