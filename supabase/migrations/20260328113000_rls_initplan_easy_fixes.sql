begin;
-- Safe first-wave fixes for Supabase linter warnings:
-- Replace direct auth.uid() calls in row filters with (select auth.uid())
-- so Postgres can initialize once per statement instead of re-evaluating
-- the auth helper for every row.

drop policy if exists "club_registration_requests_select_own_or_admin" on public.club_registration_requests;
create policy "club_registration_requests_select_own_or_admin"
on public.club_registration_requests
for select
to authenticated
using (
  requester_user_id = (select auth.uid())
  or (select public.is_admin_in_any_club())
);
drop policy if exists "club_member_identities_select_self_or_admin" on public.club_member_identities;
create policy "club_member_identities_select_self_or_admin"
on public.club_member_identities
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin_in_club(club_id)
  or (select public.is_admin_in_any_club())
);
drop policy if exists "event_planner_registrations_select_own_or_manager" on public.event_planner_registrations;
create policy "event_planner_registrations_select_own_or_manager"
on public.event_planner_registrations
for select
to authenticated
using (
  auth_uid = (select auth.uid())
  or public.is_admin_or_vorstand_in_club(club_id)
);
drop policy if exists "member_notifications_select_own" on public.member_notifications;
create policy "member_notifications_select_own"
on public.member_notifications
for select
to authenticated
using (user_id = (select auth.uid()));
drop policy if exists "legal_acceptance_events_self_or_club_select" on public.legal_acceptance_events;
create policy "legal_acceptance_events_self_or_club_select"
on public.legal_acceptance_events
for select
to authenticated
using (
  accepted_by_user_id = (select auth.uid())
  or (club_id is not null and public.is_admin_or_vorstand_in_club(club_id))
);
commit;
