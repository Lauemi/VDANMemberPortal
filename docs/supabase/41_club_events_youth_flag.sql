-- VDAN Template — club events youth flag (Jugend vs Default)
-- Run this after:
-- 40_work_events_youth_flag.sql

begin;

alter table if exists public.club_events
  add column if not exists is_youth boolean not null default false;

create index if not exists idx_club_events_is_youth_start
  on public.club_events(is_youth, starts_at);

drop function if exists public.term_event_create(text, text, text, timestamptz, timestamptz);

create or replace function public.term_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_is_youth boolean default false
)
returns public.club_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can create terms';
  end if;

  insert into public.club_events (
    title, description, location, starts_at, ends_at, is_youth, status, created_by
  )
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    coalesce(p_is_youth, false),
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.term_event_create(text, text, text, timestamptz, timestamptz, boolean) to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='club_events' and column_name='is_youth';
-- select proname, oidvectortypes(proargtypes) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='term_event_create';
