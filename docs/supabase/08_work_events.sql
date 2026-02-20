-- VDAN Template — work events (Arbeitseinsaetze)
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql

begin;

-- =========================
-- 1) Enums
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'work_event_status') then
    create type public.work_event_status as enum ('draft', 'published', 'cancelled', 'archived');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'work_participation_status') then
    create type public.work_participation_status as enum ('registered', 'checked_in', 'submitted', 'approved', 'rejected', 'no_show');
  end if;
end $$;

-- =========================
-- 2) Tables
-- =========================
create table if not exists public.work_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid,
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_participants integer check (max_participants is null or max_participants > 0),
  status public.work_event_status not null default 'draft',
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_work_events_status_start on public.work_events(status, starts_at);
create index if not exists idx_work_events_start on public.work_events(starts_at);

drop trigger if exists trg_work_events_touch on public.work_events;
create trigger trg_work_events_touch
before update on public.work_events
for each row execute function public.touch_updated_at();

create table if not exists public.work_participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.work_events(id) on delete cascade,
  auth_uid uuid not null references auth.users(id) on delete cascade,
  status public.work_participation_status not null default 'registered',
  minutes_reported integer check (minutes_reported is null or minutes_reported >= 0),
  minutes_approved integer check (minutes_approved is null or minutes_approved >= 0),
  checkin_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  note_member text,
  note_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, auth_uid)
);

create index if not exists idx_work_participations_event on public.work_participations(event_id);
create index if not exists idx_work_participations_uid on public.work_participations(auth_uid);
create index if not exists idx_work_participations_status on public.work_participations(status);

drop trigger if exists trg_work_participations_touch on public.work_participations;
create trigger trg_work_participations_touch
before update on public.work_participations
for each row execute function public.touch_updated_at();

-- Optional audit table
create table if not exists public.work_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.work_events(id) on delete cascade,
  auth_uid uuid not null references auth.users(id) on delete cascade,
  checkin_at timestamptz not null default now(),
  method text not null check (method in ('qr', 'manual'))
);

create index if not exists idx_work_checkins_event_uid on public.work_checkins(event_id, auth_uid);

-- =========================
-- 3) Privileges + RLS
-- =========================
alter table public.work_events enable row level security;
alter table public.work_participations enable row level security;
alter table public.work_checkins enable row level security;

grant select on public.work_events to anon, authenticated;
grant select, insert, update, delete on public.work_events to authenticated;
grant select on public.work_participations to authenticated;
grant select, insert, update, delete on public.work_participations to authenticated;
grant select on public.work_checkins to authenticated;
grant insert on public.work_checkins to authenticated;

drop policy if exists "work_events_member_select_published" on public.work_events;
create policy "work_events_member_select_published"
on public.work_events for select
using (status = 'published' or public.is_admin_or_vorstand());

drop policy if exists "work_events_manager_all" on public.work_events;
create policy "work_events_manager_all"
on public.work_events for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "work_participations_member_select_own_or_manager" on public.work_participations;
create policy "work_participations_member_select_own_or_manager"
on public.work_participations for select
using (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_participations_member_insert_own_published" on public.work_participations;
create policy "work_participations_member_insert_own_published"
on public.work_participations for insert
with check (
  (
    auth_uid = auth.uid()
    and exists (
      select 1
      from public.work_events e
      where e.id = event_id
        and e.status = 'published'
    )
  )
  or public.is_admin_or_vorstand()
);

drop policy if exists "work_participations_member_update_own_or_manager" on public.work_participations;
create policy "work_participations_member_update_own_or_manager"
on public.work_participations for update
using (auth_uid = auth.uid() or public.is_admin_or_vorstand())
with check (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_participations_manager_delete" on public.work_participations;
create policy "work_participations_manager_delete"
on public.work_participations for delete
using (public.is_admin_or_vorstand());

drop policy if exists "work_checkins_select_own_or_manager" on public.work_checkins;
create policy "work_checkins_select_own_or_manager"
on public.work_checkins for select
using (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_checkins_insert_own_or_manager" on public.work_checkins;
create policy "work_checkins_insert_own_or_manager"
on public.work_checkins for insert
with check (auth_uid = auth.uid() or public.is_admin_or_vorstand());

-- Guard member updates so they cannot change status/admin fields directly.
create or replace function public.enforce_work_participation_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin_or_vorstand() then
    return new;
  end if;

  if old.auth_uid <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if old.status in ('approved', 'rejected', 'no_show') then
    raise exception 'Finalized participations can only be changed by vorstand/admin';
  end if;

  if new.event_id <> old.event_id
     or new.auth_uid <> old.auth_uid
     or new.status <> old.status
     or coalesce(new.minutes_approved, -1) <> coalesce(old.minutes_approved, -1)
     or coalesce(new.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(old.approved_by, '00000000-0000-0000-0000-000000000000'::uuid)
     or coalesce(new.approved_at, 'epoch'::timestamptz) <> coalesce(old.approved_at, 'epoch'::timestamptz)
     or coalesce(new.note_admin, '') <> coalesce(old.note_admin, '')
     or coalesce(new.checkin_at, 'epoch'::timestamptz) <> coalesce(old.checkin_at, 'epoch'::timestamptz)
  then
    raise exception 'Members may only edit minutes_reported and note_member';
  end if;

  if coalesce(new.minutes_reported, -1) <> coalesce(old.minutes_reported, -1)
     or coalesce(new.note_member, '') <> coalesce(old.note_member, '')
  then
    new.status := 'submitted';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_work_participations_member_guard on public.work_participations;
create trigger trg_work_participations_member_guard
before update on public.work_participations
for each row execute function public.enforce_work_participation_update();

-- =========================
-- 4) RPCs
-- =========================
create or replace function public.work_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_max_participants integer default null
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
    title, description, location, starts_at, ends_at, max_participants, status, created_by
  )
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    p_max_participants,
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.work_event_publish(p_event_id uuid)
returns public.work_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can publish work events';
  end if;

  update public.work_events
  set status = 'published',
      updated_at = now()
  where id = p_event_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Event not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_register(p_event_id uuid)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.work_events;
  v_row public.work_participations;
  v_now_berlin timestamp := (now() at time zone 'Europe/Berlin');
  v_start_berlin timestamp;
  v_end_berlin timestamp;
begin
  select * into v_event from public.work_events where id = p_event_id;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if v_event.status <> 'published' then
    raise exception 'Event is not published';
  end if;

  v_start_berlin := (v_event.starts_at at time zone 'Europe/Berlin');
  v_end_berlin := (v_event.ends_at at time zone 'Europe/Berlin');

  if v_now_berlin < (v_start_berlin - interval '10 minutes') then
    raise exception 'Registration opens 10 minutes before event start';
  end if;

  if v_now_berlin > v_end_berlin then
    raise exception 'Registration closed (event already ended)';
  end if;

  if v_event.max_participants is not null and (
    select count(*) from public.work_participations wp where wp.event_id = v_event.id
  ) >= v_event.max_participants then
    raise exception 'Event is full';
  end if;

  insert into public.work_participations (event_id, auth_uid, status)
  values (v_event.id, auth.uid(), 'registered')
  on conflict (event_id, auth_uid) do update
  set status = case
        when public.work_participations.status in ('approved', 'rejected', 'no_show') then public.work_participations.status
        else 'registered'
      end,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.work_checkin(p_public_token text)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.work_events;
  v_row public.work_participations;
  v_now timestamptz := now();
  v_today date := timezone('Europe/Berlin', now())::date;
  v_event_day date;
begin
  select * into v_event
  from public.work_events
  where public_token = p_public_token
  limit 1;

  if v_event.id is null then
    raise exception 'Event not found';
  end if;

  if v_event.status <> 'published' then
    raise exception 'Event is not published';
  end if;

  v_event_day := timezone('Europe/Berlin', v_event.starts_at)::date;
  if v_event_day <> v_today then
    raise exception 'Check-in is only possible on event day';
  end if;

  if not (
    v_now >= (v_event.starts_at - interval '2 hours')
    and v_now <= (v_event.ends_at + interval '2 hours')
  ) then
    raise exception 'Check-in window is closed';
  end if;

  insert into public.work_participations (event_id, auth_uid, status, checkin_at)
  values (v_event.id, auth.uid(), 'checked_in', v_now)
  on conflict (event_id, auth_uid) do update
  set status = case
        when public.work_participations.status = 'approved' then 'approved'
        else 'checked_in'
      end,
      checkin_at = v_now,
      updated_at = now()
  returning * into v_row;

  insert into public.work_checkins(event_id, auth_uid, checkin_at, method)
  values (v_event.id, auth.uid(), v_now, 'qr');

  return v_row;
end;
$$;

create or replace function public.work_approve(p_participation_id uuid, p_minutes_approved integer)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can approve';
  end if;

  update public.work_participations
  set status = 'approved',
      minutes_approved = greatest(coalesce(p_minutes_approved, 0), 0),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_reject(p_participation_id uuid, p_note_admin text default null)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can reject';
  end if;

  update public.work_participations
  set status = 'rejected',
      note_admin = nullif(trim(coalesce(p_note_admin, '')), ''),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.work_event_create(text, text, text, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.work_event_publish(uuid) to authenticated;
grant execute on function public.work_register(uuid) to authenticated;
grant execute on function public.work_checkin(text) to authenticated;
grant execute on function public.work_approve(uuid, integer) to authenticated;
grant execute on function public.work_reject(uuid, text) to authenticated;

commit;
