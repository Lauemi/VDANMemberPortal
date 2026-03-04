-- VDAN/FCP - Phase 2: club_id hardening (NOT NULL + tenant RLS baseline)
-- Run after:
--   67_club_id_scope_rollout.sql

begin;

-- -------------------------------------------------------------------
-- 0) Guard: abort if any target table still has null club_id
-- -------------------------------------------------------------------
do $$
declare
  v_missing bigint;
begin
  select
    (select count(*) from public.user_roles where club_id is null) +
    (select count(*) from public.app_notes where club_id is null) +
    (select count(*) from public.feed_posts where club_id is null) +
    (select count(*) from public.feed_post_media where club_id is null) +
    (select count(*) from public.water_bodies where club_id is null) +
    (select count(*) from public.catch_entries where club_id is null) +
    (select count(*) from public.fishing_trips where club_id is null) +
    (select count(*) from public.work_events where club_id is null) +
    (select count(*) from public.work_participations where club_id is null) +
    (select count(*) from public.work_checkins where club_id is null) +
    (select count(*) from public.club_events where club_id is null) +
    (select count(*) from public.documents where club_id is null) +
    (select count(*) from public.meeting_sessions where club_id is null) +
    (select count(*) from public.meeting_session_attendees where club_id is null) +
    (select count(*) from public.meeting_agenda_items where club_id is null) +
    (select count(*) from public.meeting_tasks where club_id is null) +
    (select count(*) from public.task_assignees where club_id is null) +
    (select count(*) from public.work_event_leads where club_id is null) +
    (select count(*) from public.water_areas where club_id is null) +
    (select count(*) from public.contact_requests where club_id is null) +
    (select count(*) from public.membership_applications where club_id is null) +
    (select count(*) from public.membership_application_bank_data where club_id is null) +
    (select count(*) from public.members where club_id is null) +
    (select count(*) from public.member_bank_data where club_id is null) +
    (select count(*) from public.membership_application_audit where club_id is null)
  into v_missing;

  if v_missing > 0 then
    raise exception 'club_id hardening aborted: found % rows with null club_id. Run 67 again and re-check.', v_missing;
  end if;
end $$;

-- -------------------------------------------------------------------
-- 1) Enforce NOT NULL for club_id on club-relevant tables
-- -------------------------------------------------------------------
alter table public.user_roles alter column club_id set not null;
alter table public.app_notes alter column club_id set not null;
alter table public.feed_posts alter column club_id set not null;
alter table public.feed_post_media alter column club_id set not null;
alter table public.water_bodies alter column club_id set not null;
alter table public.catch_entries alter column club_id set not null;
alter table public.fishing_trips alter column club_id set not null;
alter table public.work_events alter column club_id set not null;
alter table public.work_participations alter column club_id set not null;
alter table public.work_checkins alter column club_id set not null;
alter table public.club_events alter column club_id set not null;
alter table public.documents alter column club_id set not null;
alter table public.meeting_sessions alter column club_id set not null;
alter table public.meeting_session_attendees alter column club_id set not null;
alter table public.meeting_agenda_items alter column club_id set not null;
alter table public.meeting_tasks alter column club_id set not null;
alter table public.task_assignees alter column club_id set not null;
alter table public.work_event_leads alter column club_id set not null;
alter table public.water_areas alter column club_id set not null;
alter table public.contact_requests alter column club_id set not null;
alter table public.membership_applications alter column club_id set not null;
alter table public.membership_application_bank_data alter column club_id set not null;
alter table public.members alter column club_id set not null;
alter table public.member_bank_data alter column club_id set not null;
alter table public.membership_application_audit alter column club_id set not null;

-- -------------------------------------------------------------------
-- 2) Tenant helper functions
-- -------------------------------------------------------------------
create or replace function public.current_user_club_id()
returns uuid
language sql
stable
as $$
  select p.club_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_same_club(p_club_id uuid)
returns boolean
language sql
stable
as $$
  select p_club_id is not null and p_club_id = public.current_user_club_id()
$$;

create or replace function public.profile_club_id(p_user_id uuid)
returns uuid
language sql
stable
as $$
  select p.club_id
  from public.profiles p
  where p.id = p_user_id
  limit 1
$$;

-- -------------------------------------------------------------------
-- 3) RLS hardening baseline for authenticated app tables
--    (Public pages/tables remain unchanged here to avoid frontend breakage.)
-- -------------------------------------------------------------------

-- user_roles
drop policy if exists "roles_admin_all" on public.user_roles;
create policy "roles_admin_same_club_all"
on public.user_roles
for all
to authenticated
using (
  public.is_admin()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin()
  and public.is_same_club(club_id)
  and public.profile_club_id(user_id) = club_id
);

-- app_notes
drop policy if exists "notes_select_own" on public.app_notes;
drop policy if exists "notes_insert_own" on public.app_notes;
drop policy if exists "notes_update_own" on public.app_notes;
drop policy if exists "notes_delete_own" on public.app_notes;

create policy "notes_select_own_same_club"
on public.app_notes for select
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin())
);

create policy "notes_insert_own_same_club"
on public.app_notes for insert
to authenticated
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin())
);

create policy "notes_update_own_same_club"
on public.app_notes for update
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin())
)
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin())
);

create policy "notes_delete_own_same_club"
on public.app_notes for delete
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin())
);

-- catch_entries
drop policy if exists "catch_select_own_or_manager" on public.catch_entries;
drop policy if exists "catch_insert_own_or_manager" on public.catch_entries;
drop policy if exists "catch_update_own_or_manager" on public.catch_entries;
drop policy if exists "catch_delete_own_or_manager" on public.catch_entries;

create policy "catch_select_same_club"
on public.catch_entries for select
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

create policy "catch_insert_same_club"
on public.catch_entries for insert
to authenticated
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

create policy "catch_update_same_club"
on public.catch_entries for update
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
)
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

create policy "catch_delete_same_club"
on public.catch_entries for delete
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

-- fishing_trips
drop policy if exists "fishing_trips_select_own_or_manager" on public.fishing_trips;
drop policy if exists "fishing_trips_insert_own_or_manager" on public.fishing_trips;
drop policy if exists "fishing_trips_update_own_or_manager" on public.fishing_trips;
drop policy if exists "fishing_trips_delete_own_or_manager" on public.fishing_trips;

create policy "fishing_trips_select_same_club"
on public.fishing_trips for select
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

create policy "fishing_trips_insert_same_club"
on public.fishing_trips for insert
to authenticated
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

create policy "fishing_trips_update_same_club"
on public.fishing_trips for update
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
)
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

create policy "fishing_trips_delete_same_club"
on public.fishing_trips for delete
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

-- work_events / participations / checkins
drop policy if exists "work_events_member_select_published" on public.work_events;
drop policy if exists "work_events_manager_all" on public.work_events;

create policy "work_events_select_same_club"
on public.work_events for select
to authenticated
using (
  public.is_same_club(club_id)
  and (status = 'published' or public.is_admin_or_vorstand())
);

create policy "work_events_manager_same_club_all"
on public.work_events for all
to authenticated
using (
  public.is_same_club(club_id)
  and public.is_admin_or_vorstand()
)
with check (
  public.is_same_club(club_id)
  and public.is_admin_or_vorstand()
);

drop policy if exists "work_participations_member_select_own_or_manager" on public.work_participations;
drop policy if exists "work_participations_member_insert_own_published" on public.work_participations;
drop policy if exists "work_participations_member_update_own_or_manager" on public.work_participations;
drop policy if exists "work_participations_manager_delete" on public.work_participations;

create policy "work_participations_select_same_club"
on public.work_participations for select
to authenticated
using (
  public.is_same_club(club_id)
  and (auth_uid = auth.uid() or public.is_admin_or_vorstand())
);

create policy "work_participations_insert_same_club"
on public.work_participations for insert
to authenticated
with check (
  public.is_same_club(club_id)
  and (
    auth_uid = auth.uid()
    or public.is_admin_or_vorstand()
  )
);

create policy "work_participations_update_same_club"
on public.work_participations for update
to authenticated
using (
  public.is_same_club(club_id)
  and (auth_uid = auth.uid() or public.is_admin_or_vorstand())
)
with check (
  public.is_same_club(club_id)
  and (auth_uid = auth.uid() or public.is_admin_or_vorstand())
);

create policy "work_participations_delete_same_club"
on public.work_participations for delete
to authenticated
using (
  public.is_same_club(club_id)
  and public.is_admin_or_vorstand()
);

drop policy if exists "work_checkins_select_own_or_manager" on public.work_checkins;
drop policy if exists "work_checkins_insert_own_or_manager" on public.work_checkins;

create policy "work_checkins_select_same_club"
on public.work_checkins for select
to authenticated
using (
  public.is_same_club(club_id)
  and (auth_uid = auth.uid() or public.is_admin_or_vorstand())
);

create policy "work_checkins_insert_same_club"
on public.work_checkins for insert
to authenticated
with check (
  public.is_same_club(club_id)
  and (auth_uid = auth.uid() or public.is_admin_or_vorstand())
);

commit;

-- Verification (run manually):
-- select
--   (select count(*) from public.user_roles where club_id is null) as user_roles_null,
--   (select count(*) from public.app_notes where club_id is null) as app_notes_null,
--   (select count(*) from public.catch_entries where club_id is null) as catch_entries_null,
--   (select count(*) from public.fishing_trips where club_id is null) as fishing_trips_null,
--   (select count(*) from public.work_events where club_id is null) as work_events_null,
--   (select count(*) from public.work_participations where club_id is null) as work_participations_null,
--   (select count(*) from public.work_checkins where club_id is null) as work_checkins_null;
