-- VDAN/FCP - Security + DSGVO baseline hardening (platform vs. club content split)
-- Run after:
--   73_hotfix_auth_roles_and_feed_access.sql
--
-- Goals:
--   1) Remove overly broad anon table privileges (least privilege).
--   2) Keep public website behavior intact (public feed/events/docs/waters read).
--   3) Keep membership application RPC path for public users.

begin;

-- -------------------------------------------------------------------
-- 0) Optional schema hardening (safe/idempotent)
-- -------------------------------------------------------------------
revoke create on schema public from public;

-- -------------------------------------------------------------------
-- 1) Revoke broad anon DML/truncate privileges on app/business tables
--    We only revoke write-like privileges from anon.
--    RLS alone is not enough; table grants should be minimal.
-- -------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'user_roles',
    'app_notes',
    'profiles',
    'feed_posts',
    'feed_post_media',
    'water_bodies',
    'water_areas',
    'catch_entries',
    'fishing_trips',
    'work_events',
    'work_participations',
    'work_checkins',
    'work_event_leads',
    'club_events',
    'documents',
    'meeting_sessions',
    'meeting_session_attendees',
    'meeting_agenda_items',
    'meeting_tasks',
    'task_assignees',
    'contact_requests',
    'membership_applications',
    'membership_application_bank_data',
    'membership_application_audit',
    'members',
    'member_bank_data'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'revoke insert, update, delete, truncate, references, trigger on table public.%I from anon',
        t
      );
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------------
-- 2) Public read grants for explicitly public content tables
--    (RLS still decides which rows are visible)
-- -------------------------------------------------------------------
grant select on table public.feed_posts to anon;
grant select on table public.feed_post_media to anon;
grant select on table public.club_events to anon;
grant select on table public.work_events to anon;
grant select on table public.documents to anon;
grant select on table public.water_bodies to anon;
grant select on table public.water_areas to anon;

-- -------------------------------------------------------------------
-- 3) Keep public application entrypoint (membership application RPC)
-- -------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_membership_application'
  ) then
    grant execute on function public.submit_membership_application(
      text, text, date, text, text, text, boolean, text, boolean, text, text
    ) to anon;
  end if;
end $$;

commit;

-- -------------------------------------------------------------------
-- Verification (manual)
-- -------------------------------------------------------------------
-- 1) Check remaining anon write-like grants:
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public'
--   and grantee='anon'
--   and privilege_type in ('INSERT','UPDATE','DELETE','TRIGGER','TRUNCATE')
-- order by table_name, privilege_type;
--
-- 2) Public feed visibility still works:
-- select count(*) as visible_for_public
-- from public.feed_posts
-- where public.can_access_club_content(club_id)
--   and coalesce(category,'') <> 'nur_mitglieder';
--
-- 3) Public docs/events/waters still visible for active club:
-- select
--   (select count(*) from public.documents d where d.is_active and public.can_access_club_content(d.club_id)) as docs_public,
--   (select count(*) from public.club_events e where e.status='published' and public.can_access_club_content(e.club_id)) as events_public,
--   (select count(*) from public.water_bodies w where w.is_active and public.can_access_club_content(w.club_id)) as waters_public;
