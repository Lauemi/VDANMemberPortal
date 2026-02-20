-- VDAN Template — work time tracking + audit actor fields
-- Run this after:
-- 08_work_events.sql
-- 09_terms_core.sql

begin;

-- =========================
-- 1) Audit columns
-- =========================
alter table if exists public.work_events
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table if exists public.work_participations
  add column if not exists checkout_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table if exists public.club_events
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table if exists public.feed_posts
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.work_events set updated_by = created_by where updated_by is null;
update public.club_events set updated_by = created_by where updated_by is null;
update public.feed_posts set updated_by = author_id where updated_by is null;

-- Vorstand/Admin darf Namen aufloesen (Cockpit-Teilnehmerlisten).
drop policy if exists "profiles_select_manager" on public.profiles;
create policy "profiles_select_manager"
on public.profiles for select
using (public.is_admin_or_vorstand());

-- actor tracking trigger
create or replace function public.touch_updated_by()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_events_updated_by on public.work_events;
create trigger trg_work_events_updated_by
before insert or update on public.work_events
for each row execute function public.touch_updated_by();

drop trigger if exists trg_work_participations_updated_by on public.work_participations;
create trigger trg_work_participations_updated_by
before insert or update on public.work_participations
for each row execute function public.touch_updated_by();

drop trigger if exists trg_club_events_updated_by on public.club_events;
create trigger trg_club_events_updated_by
before insert or update on public.club_events
for each row execute function public.touch_updated_by();

drop trigger if exists trg_feed_posts_updated_by on public.feed_posts;
create trigger trg_feed_posts_updated_by
before insert or update on public.feed_posts
for each row execute function public.touch_updated_by();

-- =========================
-- 2) Participation rules
-- =========================
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
  then
    raise exception 'Members may only edit own time and note';
  end if;

  if coalesce(new.checkin_at, 'epoch'::timestamptz) <> coalesce(old.checkin_at, 'epoch'::timestamptz)
     or coalesce(new.checkout_at, 'epoch'::timestamptz) <> coalesce(old.checkout_at, 'epoch'::timestamptz)
     or coalesce(new.note_member, '') <> coalesce(old.note_member, '')
  then
    new.status := 'submitted';
  end if;

  return new;
end;
$$;

-- =========================
-- 3) RPCs
-- =========================
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

  insert into public.work_participations (event_id, auth_uid, status, checkin_at)
  values (v_event.id, auth.uid(), 'checked_in', now())
  on conflict (event_id, auth_uid) do update
  set status = case
        when public.work_participations.status in ('approved', 'rejected', 'no_show') then public.work_participations.status
        else 'checked_in'
      end,
      checkin_at = coalesce(public.work_participations.checkin_at, now()),
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
  select * into v_event from public.work_events where public_token = p_public_token limit 1;
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

  if not (v_now >= (v_event.starts_at - interval '2 hours') and v_now <= (v_event.ends_at + interval '2 hours')) then
    raise exception 'Check-in window is closed';
  end if;

  insert into public.work_participations (event_id, auth_uid, status, checkin_at)
  values (v_event.id, auth.uid(), 'checked_in', v_now)
  on conflict (event_id, auth_uid) do update
  set status = case when public.work_participations.status = 'approved' then 'approved' else 'checked_in' end,
      checkin_at = coalesce(public.work_participations.checkin_at, v_now),
      updated_at = now()
  returning * into v_row;

  insert into public.work_checkins(event_id, auth_uid, checkin_at, method)
  values (v_event.id, auth.uid(), v_now, 'qr');

  return v_row;
end;
$$;

create or replace function public.work_checkout(p_event_id uuid)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  update public.work_participations
  set checkout_at = now(),
      status = case when status = 'approved' then 'approved' else 'submitted' end,
      updated_at = now()
  where event_id = p_event_id
    and auth_uid = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_participation_admin_update(
  p_participation_id uuid,
  p_checkin_at timestamptz default null,
  p_checkout_at timestamptz default null,
  p_note_admin text default null
)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can update participation times';
  end if;

  update public.work_participations
  set checkin_at = coalesce(p_checkin_at, checkin_at),
      checkout_at = coalesce(p_checkout_at, checkout_at),
      note_admin = coalesce(p_note_admin, note_admin),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_approve(p_participation_id uuid, p_minutes_approved integer default null)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
  v_minutes integer;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can approve';
  end if;

  select * into v_row from public.work_participations where id = p_participation_id;
  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  v_minutes := p_minutes_approved;
  if v_minutes is null and v_row.checkin_at is not null and v_row.checkout_at is not null then
    v_minutes := greatest(0, floor(extract(epoch from (v_row.checkout_at - v_row.checkin_at)) / 60)::integer);
  end if;

  update public.work_participations
  set status = 'approved',
      minutes_approved = greatest(coalesce(v_minutes, 0), 0),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.work_register(uuid) to authenticated;
grant execute on function public.work_checkin(text) to authenticated;
grant execute on function public.work_checkout(uuid) to authenticated;
grant execute on function public.work_participation_admin_update(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.work_approve(uuid, integer) to authenticated;

commit;
