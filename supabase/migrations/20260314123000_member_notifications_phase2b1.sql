begin;

create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null check (char_length(trim(title)) >= 3),
  message text not null check (char_length(trim(message)) >= 3),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  source_kind text,
  source_id uuid,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_notifications_user_created
  on public.member_notifications(user_id, created_at desc);

create index if not exists idx_member_notifications_user_unread
  on public.member_notifications(user_id, is_read, created_at desc);

create index if not exists idx_member_notifications_club_created
  on public.member_notifications(club_id, created_at desc);

drop trigger if exists trg_member_notifications_touch on public.member_notifications;
create trigger trg_member_notifications_touch
before update on public.member_notifications
for each row execute function public.touch_updated_at();

create or replace function public.create_member_notification(
  p_club_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_severity text default 'info',
  p_source_kind text default null,
  p_source_id uuid default null,
  p_action_url text default null
)
returns public.member_notifications
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.member_notifications;
begin
  insert into public.member_notifications (
    club_id,
    user_id,
    type,
    title,
    message,
    severity,
    source_kind,
    source_id,
    action_url
  )
  values (
    p_club_id,
    p_user_id,
    nullif(trim(coalesce(p_type, '')), ''),
    trim(coalesce(p_title, '')),
    trim(coalesce(p_message, '')),
    case
      when trim(coalesce(p_severity, '')) in ('info', 'success', 'warning', 'critical') then trim(coalesce(p_severity, ''))
      else 'info'
    end,
    nullif(trim(coalesce(p_source_kind, '')), ''),
    p_source_id,
    nullif(trim(coalesce(p_action_url, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.member_notification_mark_read(p_notification_id uuid)
returns public.member_notifications
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.member_notifications;
begin
  update public.member_notifications
  set is_read = true,
      read_at = coalesce(read_at, now()),
      updated_at = now()
  where id = p_notification_id
    and user_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Notification not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.member_notification_mark_all_read()
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_count integer := 0;
begin
  update public.member_notifications
  set is_read = true,
      read_at = coalesce(read_at, now()),
      updated_at = now()
  where user_id = auth.uid()
    and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.event_planner_notify_registration_users(
  p_planner_config_id uuid,
  p_slot_id uuid default null,
  p_type text default null,
  p_title text default null,
  p_message text default null,
  p_severity text default 'info',
  p_source_kind text default null,
  p_source_id uuid default null,
  p_action_url text default '/app/eventplaner/mitmachen/'
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_config public.event_planner_configs;
  v_count integer := 0;
begin
  select * into v_config
  from public.event_planner_configs
  where id = p_planner_config_id;

  if v_config.id is null then
    return 0;
  end if;

  insert into public.member_notifications (
    club_id,
    user_id,
    type,
    title,
    message,
    severity,
    source_kind,
    source_id,
    action_url
  )
  select distinct
    v_config.club_id,
    r.auth_uid,
    trim(coalesce(p_type, 'event_update')),
    trim(coalesce(p_title, 'Eventplaner Hinweis')),
    trim(coalesce(p_message, 'Es gibt eine Änderung zu deinem Helfereinsatz.')),
    case
      when trim(coalesce(p_severity, '')) in ('info', 'success', 'warning', 'critical') then trim(coalesce(p_severity, ''))
      else 'info'
    end,
    nullif(trim(coalesce(p_source_kind, '')), ''),
    p_source_id,
    nullif(trim(coalesce(p_action_url, '')), '')
  from public.event_planner_registrations r
  where r.planner_config_id = p_planner_config_id
    and r.status in ('pending', 'approved')
    and (
      p_slot_id is null
      or r.slot_id = p_slot_id
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.event_planner_slot_notification_guard()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_old_range text;
  v_new_range text;
begin
  if tg_op = 'UPDATE' then
    if new.starts_at is not distinct from old.starts_at
       and new.ends_at is not distinct from old.ends_at then
      return new;
    end if;

    v_old_range := to_char(old.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') || ' - ' || to_char(old.ends_at at time zone 'Europe/Berlin', 'HH24:MI');
    v_new_range := to_char(new.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') || ' - ' || to_char(new.ends_at at time zone 'Europe/Berlin', 'HH24:MI');

    perform public.event_planner_notify_registration_users(
      new.planner_config_id,
      new.id,
      'slot_time_changed',
      'Dein Helfer-Slot wurde geändert',
      format('Die Zeit für "%s" wurde von %s auf %s angepasst.', coalesce(new.title, old.title, 'deinen Slot'), v_old_range, v_new_range),
      'warning',
      'event_planner_slot',
      new.id,
      '/app/eventplaner/mitmachen/'
    );

    return new;
  end if;

  perform public.event_planner_notify_registration_users(
    old.planner_config_id,
    old.id,
    'slot_deleted',
    'Dein Helfer-Slot wurde entfernt',
    format('Der Slot "%s" wurde entfernt. Bitte prüfe deine Eventplaner-Hinweise.', coalesce(old.title, 'dein Helfer-Slot')),
    'critical',
    'event_planner_slot',
    old.id,
    '/app/eventplaner/mitmachen/'
  );

  return old;
end;
$$;

drop trigger if exists trg_event_planner_slot_notifications_update on public.event_planner_slots;
create trigger trg_event_planner_slot_notifications_update
after update of starts_at, ends_at on public.event_planner_slots
for each row execute function public.event_planner_slot_notification_guard();

drop trigger if exists trg_event_planner_slot_notifications_delete on public.event_planner_slots;
create trigger trg_event_planner_slot_notifications_delete
before delete on public.event_planner_slots
for each row execute function public.event_planner_slot_notification_guard();

create or replace function public.event_planner_base_event_notification_guard()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_config_id uuid;
  v_event_label text;
  v_old_range text;
  v_new_range text;
begin
  if tg_table_name = 'club_events' then
    select id into v_config_id
    from public.event_planner_configs
    where base_kind = 'club_event'
      and base_club_event_id = new.id;
  else
    select id into v_config_id
    from public.event_planner_configs
    where base_kind = 'work_event'
      and base_work_event_id = new.id;
  end if;

  if v_config_id is null then
    return new;
  end if;

  v_event_label := coalesce(new.title, old.title, 'dein Event');

  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at then
    v_old_range := to_char(old.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') || ' - ' || to_char(old.ends_at at time zone 'Europe/Berlin', 'HH24:MI');
    v_new_range := to_char(new.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') || ' - ' || to_char(new.ends_at at time zone 'Europe/Berlin', 'HH24:MI');

    perform public.event_planner_notify_registration_users(
      v_config_id,
      null,
      'event_time_changed',
      'Dein Event wurde geändert',
      format('Die Zeit für "%s" wurde von %s auf %s angepasst.', v_event_label, v_old_range, v_new_range),
      'warning',
      tg_table_name,
      new.id,
      '/app/eventplaner/mitmachen/'
    );
  end if;

  if new.status is distinct from old.status
     and new.status = 'cancelled' then
    perform public.event_planner_notify_registration_users(
      v_config_id,
      null,
      'event_cancelled',
      'Dein Event wurde abgesagt',
      format('Das Event "%s" wurde abgesagt.', v_event_label),
      'critical',
      tg_table_name,
      new.id,
      '/app/eventplaner/mitmachen/'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_club_events_event_planner_notifications on public.club_events;
create trigger trg_club_events_event_planner_notifications
after update of starts_at, ends_at, status on public.club_events
for each row execute function public.event_planner_base_event_notification_guard();

drop trigger if exists trg_work_events_event_planner_notifications on public.work_events;
create trigger trg_work_events_event_planner_notifications
after update of starts_at, ends_at, status on public.work_events
for each row execute function public.event_planner_base_event_notification_guard();

create or replace function public.event_planner_registration_notification_guard()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_type text;
  v_title text;
  v_message text;
  v_severity text;
begin
  if new.status not in ('approved', 'rejected') then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved' then
    v_type := 'registration_approved';
    v_title := 'Deine Anmeldung wurde bestätigt';
    v_message := 'Deine Anmeldung im Eventplaner wurde bestätigt.';
    v_severity := 'success';
  else
    v_type := 'registration_rejected';
    v_title := 'Deine Anmeldung wurde abgelehnt';
    v_message := 'Deine Anmeldung im Eventplaner wurde abgelehnt.';
    v_severity := 'warning';
  end if;

  perform public.create_member_notification(
    new.club_id,
    new.auth_uid,
    v_type,
    v_title,
    v_message,
    v_severity,
    'event_planner_registration',
    new.id,
    '/app/eventplaner/mitmachen/'
  );

  return new;
end;
$$;

drop trigger if exists trg_event_planner_registration_notifications on public.event_planner_registrations;
create trigger trg_event_planner_registration_notifications
after insert or update of status on public.event_planner_registrations
for each row execute function public.event_planner_registration_notification_guard();

alter table public.member_notifications enable row level security;

grant select on public.member_notifications to authenticated;
revoke insert, update, delete on public.member_notifications from authenticated;
revoke execute on function public.create_member_notification(uuid, uuid, text, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.event_planner_notify_registration_users(uuid, uuid, text, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.event_planner_slot_notification_guard() from public, anon, authenticated;
revoke execute on function public.event_planner_base_event_notification_guard() from public, anon, authenticated;
revoke execute on function public.event_planner_registration_notification_guard() from public, anon, authenticated;
revoke execute on function public.member_notification_mark_read(uuid) from public, anon;
revoke execute on function public.member_notification_mark_all_read() from public, anon;

drop policy if exists "member_notifications_select_own" on public.member_notifications;
create policy "member_notifications_select_own"
on public.member_notifications
for select
to authenticated
using (user_id = auth.uid());

grant execute on function public.member_notification_mark_read(uuid) to authenticated;
grant execute on function public.member_notification_mark_all_read() to authenticated;

commit;
