begin;
create or replace function public.event_planner_block_invalid_base_window_changes()
returns trigger
language plpgsql
set search_path = public, auth, pg_catalog
as $$
declare
  v_has_outside_slots boolean;
begin
  if new.starts_at is not distinct from old.starts_at
     and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;

  select exists (
    select 1
    from public.event_planner_configs c
    join public.event_planner_slots s
      on s.planner_config_id = c.id
    where (
      (tg_table_name = 'club_events' and c.base_kind = 'club_event' and c.base_club_event_id = new.id)
      or
      (tg_table_name = 'work_events' and c.base_kind = 'work_event' and c.base_work_event_id = new.id)
    )
      and (s.starts_at < new.starts_at or s.ends_at > new.ends_at)
  ) into v_has_outside_slots;

  if v_has_outside_slots then
    raise exception 'Base event time range cannot be changed while planner slots would fall outside the new range';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_club_events_block_invalid_planner_window on public.club_events;
create trigger trg_club_events_block_invalid_planner_window
before update of starts_at, ends_at on public.club_events
for each row execute function public.event_planner_block_invalid_base_window_changes();
drop trigger if exists trg_work_events_block_invalid_planner_window on public.work_events;
create trigger trg_work_events_block_invalid_planner_window
before update of starts_at, ends_at on public.work_events
for each row execute function public.event_planner_block_invalid_base_window_changes();
revoke insert, update, delete on public.event_planner_registrations from authenticated;
drop policy if exists "event_planner_registrations_manager_all" on public.event_planner_registrations;
comment on function public.event_planner_block_invalid_base_window_changes()
is 'Blocks starts_at/ends_at changes on club_events/work_events when existing planner slots would lie outside the new base window.';
commit;
