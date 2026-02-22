-- VDAN Template — work events youth flag (Jugend vs Default)
-- Run this after:
-- 32_paket_3_assignments.sql

begin;

alter table if exists public.work_events
  add column if not exists is_youth boolean not null default false;

create index if not exists idx_work_events_is_youth_start
  on public.work_events(is_youth, starts_at);

create or replace function public.work_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_max_participants integer default null,
  p_is_youth boolean default false
)
returns public.work_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can create work events';
  end if;

  insert into public.work_events (
    title, description, location, starts_at, ends_at, max_participants, is_youth, status, created_by
  )
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    p_max_participants,
    coalesce(p_is_youth, false),
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.work_event_create(text, text, text, timestamptz, timestamptz, integer, boolean) to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='work_events' and column_name='is_youth';
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='work_event_create';
