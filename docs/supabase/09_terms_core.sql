-- VDAN Template — regular club events (Termine) for shared calendar/feed
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql
-- 08_work_events.sql

begin;

create table if not exists public.club_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.work_event_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_club_events_status_start on public.club_events(status, starts_at);

drop trigger if exists trg_club_events_touch on public.club_events;
create trigger trg_club_events_touch
before update on public.club_events
for each row execute function public.touch_updated_at();

alter table public.club_events enable row level security;

grant select on public.club_events to anon, authenticated;
grant insert, update, delete on public.club_events to authenticated;

drop policy if exists "club_events_select_published_or_manager" on public.club_events;
create policy "club_events_select_published_or_manager"
on public.club_events for select
using (status = 'published' or public.is_admin_or_vorstand());

drop policy if exists "club_events_manager_all" on public.club_events;
create policy "club_events_manager_all"
on public.club_events for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

create or replace function public.term_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
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

  insert into public.club_events(title, description, location, starts_at, ends_at, status, created_by)
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.term_event_publish(p_event_id uuid)
returns public.club_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can publish terms';
  end if;

  update public.club_events
  set status = 'published',
      updated_at = now()
  where id = p_event_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Term event not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.term_event_create(text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.term_event_publish(uuid) to authenticated;

commit;
