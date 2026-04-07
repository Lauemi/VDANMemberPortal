begin;

-- Hardening patch for work_* functions.
-- Source basis:
-- - live DB function bodies pulled on 2026-04-04
-- Goal:
-- - keep behavior minimal and stable
-- - replace global is_admin_or_vorstand() checks with club-scoped guards
-- - ensure work_event_create writes club_id explicitly

create or replace function public.work_approve(
  p_participation_id uuid,
  p_minutes_approved integer default null::integer
)
returns work_participations
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.work_participations;
  v_minutes integer;
  v_club_id uuid;
begin
  select *
    into v_row
  from public.work_participations
  where id = p_participation_id;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  select we.club_id
    into v_club_id
  from public.work_events we
  where we.id = v_row.event_id
  limit 1;

  if v_club_id is null then
    raise exception 'club_context_required';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_club_id) then
    raise exception 'Only vorstand/admin in club can approve';
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
$function$;

create or replace function public.work_reject(
  p_participation_id uuid,
  p_note_admin text default null::text
)
returns work_participations
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.work_participations;
  v_club_id uuid;
begin
  select *
    into v_row
  from public.work_participations
  where id = p_participation_id;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  select we.club_id
    into v_club_id
  from public.work_events we
  where we.id = v_row.event_id
  limit 1;

  if v_club_id is null then
    raise exception 'club_context_required';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_club_id) then
    raise exception 'Only vorstand/admin in club can reject';
  end if;

  update public.work_participations
  set status = 'rejected',
      note_admin = nullif(trim(coalesce(p_note_admin, '')), ''),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.work_participation_admin_update(
  p_participation_id uuid,
  p_checkin_at timestamp with time zone default null::timestamp with time zone,
  p_checkout_at timestamp with time zone default null::timestamp with time zone,
  p_note_admin text default null::text
)
returns work_participations
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.work_participations;
  v_club_id uuid;
begin
  select *
    into v_row
  from public.work_participations
  where id = p_participation_id;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  select we.club_id
    into v_club_id
  from public.work_events we
  where we.id = v_row.event_id
  limit 1;

  if v_club_id is null then
    raise exception 'club_context_required';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_club_id) then
    raise exception 'Only vorstand/admin in club can update participation times';
  end if;

  update public.work_participations
  set checkin_at = coalesce(p_checkin_at, checkin_at),
      checkout_at = coalesce(p_checkout_at, checkout_at),
      note_admin = coalesce(p_note_admin, note_admin),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.work_event_publish(p_event_id uuid)
returns work_events
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.work_events;
begin
  select *
    into v_row
  from public.work_events
  where id = p_event_id;

  if v_row.id is null then
    raise exception 'Event not found';
  end if;

  if v_row.club_id is null then
    raise exception 'club_context_required';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_row.club_id) then
    raise exception 'Only vorstand/admin in club can publish work events';
  end if;

  update public.work_events
  set status = 'published',
      updated_at = now()
  where id = p_event_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.work_event_create(
  p_title text,
  p_description text default null::text,
  p_location text default null::text,
  p_starts_at timestamp with time zone default null::timestamp with time zone,
  p_ends_at timestamp with time zone default null::timestamp with time zone,
  p_max_participants integer default null::integer
)
returns work_events
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.work_events;
  v_club_id uuid;
begin
  v_club_id := public.current_user_club_id();

  if v_club_id is null then
    raise exception 'club_context_required';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_club_id) then
    raise exception 'Only vorstand/admin in club can create work events';
  end if;

  insert into public.work_events (
    club_id,
    title,
    description,
    location,
    starts_at,
    ends_at,
    max_participants,
    status,
    created_by
  )
  values (
    v_club_id,
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
$function$;

create or replace function public.work_event_create(
  p_title text,
  p_description text default null::text,
  p_location text default null::text,
  p_starts_at timestamp with time zone default null::timestamp with time zone,
  p_ends_at timestamp with time zone default null::timestamp with time zone,
  p_max_participants integer default null::integer,
  p_is_youth boolean default false
)
returns work_events
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.work_events;
  v_club_id uuid;
begin
  v_club_id := public.current_user_club_id();

  if v_club_id is null then
    raise exception 'club_context_required';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_club_id) then
    raise exception 'Only vorstand/admin in club can create work events';
  end if;

  insert into public.work_events (
    club_id,
    title,
    description,
    location,
    starts_at,
    ends_at,
    max_participants,
    is_youth,
    status,
    created_by
  )
  values (
    v_club_id,
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
$function$;

commit;
