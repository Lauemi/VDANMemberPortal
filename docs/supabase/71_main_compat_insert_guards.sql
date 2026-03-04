-- VDAN/FCP - Main compatibility insert guards (auto-fill club_id)
-- Run after:
--   70_main_compat_fallbacks.sql
--
-- Goal:
--   - Prevent legacy insert paths from failing on NOT NULL club_id
--   - Do not weaken role checks / RLS

begin;

create or replace function public.ensure_row_club_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_new jsonb;
  v_uid uuid;
  v_club uuid;
  v_txt text;
begin
  v_new := to_jsonb(new);

  if new.club_id is not null then
    return new;
  end if;

  -- Try direct user ownership columns first.
  v_uid := null;
  for v_txt in
    select value
    from jsonb_each_text(v_new)
    where key in ('user_id','auth_uid','author_id','created_by')
      and value is not null
  loop
    begin
      v_uid := v_txt::uuid;
      exit;
    exception when others then
      -- continue
    end;
  end loop;

  if v_uid is not null then
    select p.club_id into v_club
    from public.profiles p
    where p.id = v_uid
    limit 1;
  end if;

  -- Relation-based fallback by parent ids.
  if v_club is null and (v_new ? 'post_id') and nullif(v_new->>'post_id','') is not null then
    select fp.club_id into v_club
    from public.feed_posts fp
    where fp.id = (v_new->>'post_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'event_id') and nullif(v_new->>'event_id','') is not null then
    select we.club_id into v_club
    from public.work_events we
    where we.id = (v_new->>'event_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'work_event_id') and nullif(v_new->>'work_event_id','') is not null then
    select we.club_id into v_club
    from public.work_events we
    where we.id = (v_new->>'work_event_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'session_id') and nullif(v_new->>'session_id','') is not null then
    select ms.club_id into v_club
    from public.meeting_sessions ms
    where ms.id = (v_new->>'session_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'task_id') and nullif(v_new->>'task_id','') is not null then
    select mt.club_id into v_club
    from public.meeting_tasks mt
    where mt.id = (v_new->>'task_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'member_id') and nullif(v_new->>'member_id','') is not null then
    select m.club_id into v_club
    from public.members m
    where m.id = (v_new->>'member_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'application_id') and nullif(v_new->>'application_id','') is not null then
    select ma.club_id into v_club
    from public.membership_applications ma
    where ma.id = (v_new->>'application_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'water_body_id') and nullif(v_new->>'water_body_id','') is not null then
    select wb.club_id into v_club
    from public.water_bodies wb
    where wb.id = (v_new->>'water_body_id')::uuid
    limit 1;
  end if;

  if v_club is null then
    v_club := public.public_active_club_id();
  end if;

  new.club_id := v_club;
  return new;
end;
$$;

drop trigger if exists trg_feed_posts_ensure_club_id on public.feed_posts;
create trigger trg_feed_posts_ensure_club_id
before insert on public.feed_posts
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_feed_post_media_ensure_club_id on public.feed_post_media;
create trigger trg_feed_post_media_ensure_club_id
before insert on public.feed_post_media
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_catch_entries_ensure_club_id on public.catch_entries;
create trigger trg_catch_entries_ensure_club_id
before insert on public.catch_entries
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_fishing_trips_ensure_club_id on public.fishing_trips;
create trigger trg_fishing_trips_ensure_club_id
before insert on public.fishing_trips
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_work_events_ensure_club_id on public.work_events;
create trigger trg_work_events_ensure_club_id
before insert on public.work_events
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_work_participations_ensure_club_id on public.work_participations;
create trigger trg_work_participations_ensure_club_id
before insert on public.work_participations
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_work_checkins_ensure_club_id on public.work_checkins;
create trigger trg_work_checkins_ensure_club_id
before insert on public.work_checkins
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_club_events_ensure_club_id on public.club_events;
create trigger trg_club_events_ensure_club_id
before insert on public.club_events
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_documents_ensure_club_id on public.documents;
create trigger trg_documents_ensure_club_id
before insert on public.documents
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_meeting_sessions_ensure_club_id on public.meeting_sessions;
create trigger trg_meeting_sessions_ensure_club_id
before insert on public.meeting_sessions
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_meeting_agenda_items_ensure_club_id on public.meeting_agenda_items;
create trigger trg_meeting_agenda_items_ensure_club_id
before insert on public.meeting_agenda_items
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_meeting_tasks_ensure_club_id on public.meeting_tasks;
create trigger trg_meeting_tasks_ensure_club_id
before insert on public.meeting_tasks
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_task_assignees_ensure_club_id on public.task_assignees;
create trigger trg_task_assignees_ensure_club_id
before insert on public.task_assignees
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_work_event_leads_ensure_club_id on public.work_event_leads;
create trigger trg_work_event_leads_ensure_club_id
before insert on public.work_event_leads
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_water_areas_ensure_club_id on public.water_areas;
create trigger trg_water_areas_ensure_club_id
before insert on public.water_areas
for each row execute function public.ensure_row_club_id();

drop trigger if exists trg_contact_requests_ensure_club_id on public.contact_requests;
create trigger trg_contact_requests_ensure_club_id
before insert on public.contact_requests
for each row execute function public.ensure_row_club_id();

commit;
