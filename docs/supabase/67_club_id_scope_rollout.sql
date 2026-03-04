-- VDAN/FCP - Rollout club_id to all club-relevant tables
-- Goal:
--   - club_id exists in every club/business relevant table
--   - backfill from existing relations wherever possible
--   - keep migration safe/idempotent (no destructive drops)
--
-- Run after:
--   66_admin_member_registry.sql

begin;

-- -------------------------------------------------------------------
-- 0) Guard: we need at least one known club_id from existing club_members
-- -------------------------------------------------------------------
do $$
declare
  v_default_club_id uuid;
begin
  select cm.club_id into v_default_club_id
  from public.club_members cm
  where cm.club_id is not null
  limit 1;

  if v_default_club_id is null then
    raise exception 'No default club_id found in public.club_members. Fill club_members.club_id first.';
  end if;
end $$;

-- -------------------------------------------------------------------
-- 1) Add club_id columns where missing
-- -------------------------------------------------------------------
alter table if exists public.user_roles add column if not exists club_id uuid;
alter table if exists public.app_notes add column if not exists club_id uuid;
alter table if exists public.feed_posts add column if not exists club_id uuid;
alter table if exists public.feed_post_media add column if not exists club_id uuid;
alter table if exists public.water_bodies add column if not exists club_id uuid;
alter table if exists public.catch_entries add column if not exists club_id uuid;
alter table if exists public.fishing_trips add column if not exists club_id uuid;
alter table if exists public.work_participations add column if not exists club_id uuid;
alter table if exists public.work_checkins add column if not exists club_id uuid;
alter table if exists public.club_events add column if not exists club_id uuid;
alter table if exists public.documents add column if not exists club_id uuid;
alter table if exists public.meeting_tasks add column if not exists club_id uuid;
alter table if exists public.task_assignees add column if not exists club_id uuid;
alter table if exists public.work_event_leads add column if not exists club_id uuid;
alter table if exists public.water_areas add column if not exists club_id uuid;
alter table if exists public.contact_requests add column if not exists club_id uuid;
alter table if exists public.membership_applications add column if not exists club_id uuid;
alter table if exists public.membership_application_bank_data add column if not exists club_id uuid;
alter table if exists public.members add column if not exists club_id uuid;
alter table if exists public.member_bank_data add column if not exists club_id uuid;
alter table if exists public.membership_application_audit add column if not exists club_id uuid;
alter table if exists public.meeting_sessions add column if not exists club_id uuid;
alter table if exists public.meeting_session_attendees add column if not exists club_id uuid;
alter table if exists public.meeting_agenda_items add column if not exists club_id uuid;

-- work_events already has club_id from 08_work_events.sql (kept for safety)
alter table if exists public.work_events add column if not exists club_id uuid;

-- -------------------------------------------------------------------
-- 2) Backfill club_id by strongest available relation first
-- -------------------------------------------------------------------

-- profiles already has club_id from older migration.
-- user_roles / app_notes -> via profiles(user_id/id)
update public.user_roles ur
   set club_id = p.club_id
  from public.profiles p
 where ur.club_id is null
   and p.id = ur.user_id
   and p.club_id is not null;

update public.app_notes n
   set club_id = p.club_id
  from public.profiles p
 where n.club_id is null
   and p.id = n.user_id
   and p.club_id is not null;

-- feed -> via author profile
update public.feed_posts fp
   set club_id = p.club_id
  from public.profiles p
 where fp.club_id is null
   and p.id = fp.author_id
   and p.club_id is not null;

update public.feed_post_media fm
   set club_id = fp.club_id
  from public.feed_posts fp
 where fm.club_id is null
   and fp.id = fm.post_id
   and fp.club_id is not null;

-- water / catch / trips chain
update public.water_bodies wb
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where wb.club_id is null;

update public.catch_entries ce
   set club_id = coalesce(
     p.club_id,
     (select wb.club_id from public.water_bodies wb where wb.id = ce.water_body_id limit 1),
     (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
   )
  from public.profiles p
 where ce.club_id is null
   and p.id = ce.user_id;

update public.fishing_trips ft
   set club_id = coalesce(
     p.club_id,
     (select wb.club_id from public.water_bodies wb where wb.id = ft.water_body_id limit 1),
     (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
   )
  from public.profiles p
 where ft.club_id is null
   and p.id = ft.user_id;

update public.water_areas wa
   set club_id = coalesce(wb.club_id, (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1))
  from public.water_bodies wb
 where wa.club_id is null
   and wb.id = wa.water_body_id;

-- work chain
update public.work_events we
   set club_id = coalesce(p.club_id, (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1))
  from public.profiles p
 where we.club_id is null
   and p.id = we.created_by;

update public.work_participations wp
   set club_id = we.club_id
  from public.work_events we
 where wp.club_id is null
   and we.id = wp.event_id
   and we.club_id is not null;

update public.work_checkins wc
   set club_id = we.club_id
  from public.work_events we
 where wc.club_id is null
   and we.id = wc.event_id
   and we.club_id is not null;

update public.work_event_leads wl
   set club_id = we.club_id
  from public.work_events we
 where wl.club_id is null
   and we.id = wl.work_event_id
   and we.club_id is not null;

-- events / meetings chain
update public.club_events ce
   set club_id = coalesce(p.club_id, (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1))
  from public.profiles p
 where ce.club_id is null
   and p.id = ce.created_by;

update public.meeting_sessions ms
   set club_id = coalesce(p.club_id, (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1))
  from public.profiles p
 where ms.club_id is null
   and p.id = ms.created_by;

update public.meeting_agenda_items mai
   set club_id = ms.club_id
  from public.meeting_sessions ms
 where mai.club_id is null
   and ms.id = mai.session_id
   and ms.club_id is not null;

update public.meeting_session_attendees msa
   set club_id = ms.club_id
  from public.meeting_sessions ms
 where msa.club_id is null
   and ms.id = msa.session_id
   and ms.club_id is not null;

update public.meeting_tasks mt
   set club_id = coalesce(
     (select ms.club_id from public.meeting_sessions ms where ms.id = mt.meeting_session_id limit 1),
     (select ce.club_id from public.club_events ce where ce.id = mt.club_event_id limit 1),
     p.club_id,
     (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
   )
  from public.profiles p
 where mt.club_id is null
   and p.id = mt.created_by;

update public.task_assignees ta
   set club_id = mt.club_id
  from public.meeting_tasks mt
 where ta.club_id is null
   and mt.id = ta.task_id
   and mt.club_id is not null;

-- public/business tables
update public.documents d
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where d.club_id is null;

update public.contact_requests cr
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where cr.club_id is null;

-- membership chain
update public.membership_applications ma
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where ma.club_id is null;

update public.membership_application_bank_data mab
   set club_id = ma.club_id
  from public.membership_applications ma
 where mab.club_id is null
   and ma.id = mab.application_id
   and ma.club_id is not null;

update public.members m
   set club_id = coalesce(
     ma.club_id,
     (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
   )
  from public.membership_applications ma
 where m.club_id is null
   and ma.id = m.source_application_id;

update public.members m
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where m.club_id is null;

update public.member_bank_data mb
   set club_id = m.club_id
  from public.members m
 where mb.club_id is null
   and m.id = mb.member_id
   and m.club_id is not null;

update public.membership_application_audit maa
   set club_id = ma.club_id
  from public.membership_applications ma
 where maa.club_id is null
   and ma.id = maa.application_id
   and ma.club_id is not null;

-- -------------------------------------------------------------------
-- 2b) Null clean-up for rows without resolvable relation chain
-- -------------------------------------------------------------------
update public.feed_posts fp
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where fp.club_id is null;

update public.feed_post_media fm
   set club_id = coalesce(
     (select fp.club_id from public.feed_posts fp where fp.id = fm.post_id limit 1),
     (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
   )
 where fm.club_id is null;

update public.user_roles ur
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where ur.club_id is null;

update public.water_areas wa
   set club_id = (select cm.club_id from public.club_members cm where cm.club_id is not null limit 1)
 where wa.club_id is null;

-- -------------------------------------------------------------------
-- 3) Helpful indexes for club scoping
-- -------------------------------------------------------------------
create index if not exists idx_user_roles_club_id on public.user_roles(club_id);
create index if not exists idx_app_notes_club_id on public.app_notes(club_id);
create index if not exists idx_feed_posts_club_id on public.feed_posts(club_id);
create index if not exists idx_feed_post_media_club_id on public.feed_post_media(club_id);
create index if not exists idx_water_bodies_club_id on public.water_bodies(club_id);
create index if not exists idx_catch_entries_club_id on public.catch_entries(club_id);
create index if not exists idx_fishing_trips_club_id on public.fishing_trips(club_id);
create index if not exists idx_work_events_club_id on public.work_events(club_id);
create index if not exists idx_work_participations_club_id on public.work_participations(club_id);
create index if not exists idx_work_checkins_club_id on public.work_checkins(club_id);
create index if not exists idx_club_events_club_id on public.club_events(club_id);
create index if not exists idx_documents_club_id on public.documents(club_id);
create index if not exists idx_meeting_tasks_club_id on public.meeting_tasks(club_id);
create index if not exists idx_task_assignees_club_id on public.task_assignees(club_id);
create index if not exists idx_work_event_leads_club_id on public.work_event_leads(club_id);
create index if not exists idx_water_areas_club_id on public.water_areas(club_id);
create index if not exists idx_contact_requests_club_id on public.contact_requests(club_id);
create index if not exists idx_membership_applications_club_id on public.membership_applications(club_id);
create index if not exists idx_membership_application_bank_data_club_id on public.membership_application_bank_data(club_id);
create index if not exists idx_members_club_id on public.members(club_id);
create index if not exists idx_member_bank_data_club_id on public.member_bank_data(club_id);
create index if not exists idx_membership_application_audit_club_id on public.membership_application_audit(club_id);
create index if not exists idx_meeting_sessions_club_id on public.meeting_sessions(club_id);
create index if not exists idx_meeting_session_attendees_club_id on public.meeting_session_attendees(club_id);
create index if not exists idx_meeting_agenda_items_club_id on public.meeting_agenda_items(club_id);

commit;

-- -------------------------------------------------------------------
-- Verification (run manually after migration)
-- -------------------------------------------------------------------
-- select 'feed_posts' as table_name, count(*) filter (where club_id is null) as null_rows from public.feed_posts
-- union all select 'feed_post_media', count(*) filter (where club_id is null) from public.feed_post_media
-- union all select 'water_bodies', count(*) filter (where club_id is null) from public.water_bodies
-- union all select 'catch_entries', count(*) filter (where club_id is null) from public.catch_entries
-- union all select 'fishing_trips', count(*) filter (where club_id is null) from public.fishing_trips
-- union all select 'work_events', count(*) filter (where club_id is null) from public.work_events
-- union all select 'work_participations', count(*) filter (where club_id is null) from public.work_participations
-- union all select 'work_checkins', count(*) filter (where club_id is null) from public.work_checkins
-- union all select 'club_events', count(*) filter (where club_id is null) from public.club_events
-- union all select 'documents', count(*) filter (where club_id is null) from public.documents
-- union all select 'meeting_sessions', count(*) filter (where club_id is null) from public.meeting_sessions
-- union all select 'meeting_session_attendees', count(*) filter (where club_id is null) from public.meeting_session_attendees
-- union all select 'meeting_agenda_items', count(*) filter (where club_id is null) from public.meeting_agenda_items
-- union all select 'meeting_tasks', count(*) filter (where club_id is null) from public.meeting_tasks
-- union all select 'task_assignees', count(*) filter (where club_id is null) from public.task_assignees
-- union all select 'work_event_leads', count(*) filter (where club_id is null) from public.work_event_leads
-- union all select 'water_areas', count(*) filter (where club_id is null) from public.water_areas
-- union all select 'contact_requests', count(*) filter (where club_id is null) from public.contact_requests
-- union all select 'membership_applications', count(*) filter (where club_id is null) from public.membership_applications
-- union all select 'membership_application_bank_data', count(*) filter (where club_id is null) from public.membership_application_bank_data
-- union all select 'members', count(*) filter (where club_id is null) from public.members
-- union all select 'member_bank_data', count(*) filter (where club_id is null) from public.member_bank_data
-- union all select 'membership_application_audit', count(*) filter (where club_id is null) from public.membership_application_audit
-- union all select 'user_roles', count(*) filter (where club_id is null) from public.user_roles
-- union all select 'app_notes', count(*) filter (where club_id is null) from public.app_notes
-- order by table_name;
