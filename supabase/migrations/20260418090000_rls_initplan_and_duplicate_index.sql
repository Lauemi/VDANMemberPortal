-- =============================================================
-- Performance: auth_rls_initplan (13 Policies) + duplicate_index (1)
-- =============================================================
-- Advisor-Warnungen:
--   auth_rls_initplan  — auth.uid() wird pro Zeile neu ausgewertet
--   duplicate_index    — club_billing_subscriptions hat zwei
--                        identische btree(club_id)-Unique-Indizes
--
-- ÄNDERUNGEN:
--   Nur mechanische Substitution: auth.uid() → (select auth.uid())
--   Keine Fachlogik, keine Policy-Namen, keine Rollen geändert.
--   Policy-Inhalt: exakt wie in DB gelesen, nur auth.uid() ersetzt.
--
-- NICHT ANGEFASST:
--   multiple_permissive_policies (separater Schritt)
--   alle anderen Policies auf diesen Tabellen
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. app_notes: notes_insert_own_same_club
--    WAS:  (is_same_club(club_id) AND ((auth.uid() = user_id) OR is_admin()))
-- -------------------------------------------------------------
drop policy if exists "notes_insert_own_same_club" on public.app_notes;
create policy "notes_insert_own_same_club"
  on public.app_notes
  for insert
  to authenticated
  with check (
    is_same_club(club_id)
    and ((select auth.uid()) = user_id or is_admin())
  );

-- -------------------------------------------------------------
-- 2. applications: applications_club_scoped
--    ALL | public
--    WAS USING: club_id IN (SELECT ... WHERE auth_user_id = auth.uid() ...)
-- -------------------------------------------------------------
drop policy if exists "applications_club_scoped" on public.applications;
create policy "applications_club_scoped"
  on public.applications
  for all
  to public
  using (
    club_id in (
      select club_members.club_id
      from public.club_members
      where club_members.auth_user_id = (select auth.uid())
        and club_members.role = any(array['admin'::text, 'vorstand'::text])
    )
  );

-- -------------------------------------------------------------
-- 3. bug_reports: bug_reports_insert_own
--    WAS:  (auth.uid() = reporter_user_id)
-- -------------------------------------------------------------
drop policy if exists "bug_reports_insert_own" on public.bug_reports;
create policy "bug_reports_insert_own"
  on public.bug_reports
  for insert
  to public
  with check (
    (select auth.uid()) = reporter_user_id
  );

-- -------------------------------------------------------------
-- 4. catch_entries: catch_insert_same_club
--    WAS:  (is_same_club(club_id) AND ((auth.uid() = user_id) OR is_admin_or_vorstand_in_club(club_id)))
-- -------------------------------------------------------------
drop policy if exists "catch_insert_same_club" on public.catch_entries;
create policy "catch_insert_same_club"
  on public.catch_entries
  for insert
  to authenticated
  with check (
    is_same_club(club_id)
    and ((select auth.uid()) = user_id or is_admin_or_vorstand_in_club(club_id))
  );

-- -------------------------------------------------------------
-- 5. feed_post_media: feed_media_insert_manager_same_club
--    WAS:  (is_admin_or_vorstand_in_club(club_id) AND (auth.uid() = created_by) AND is_same_club(club_id))
-- -------------------------------------------------------------
drop policy if exists "feed_media_insert_manager_same_club" on public.feed_post_media;
create policy "feed_media_insert_manager_same_club"
  on public.feed_post_media
  for insert
  to authenticated
  with check (
    is_admin_or_vorstand_in_club(club_id)
    and (select auth.uid()) = created_by
    and is_same_club(club_id)
  );

-- -------------------------------------------------------------
-- 6. feed_posts: feed_insert_manager_same_club
--    WAS:  (is_admin_or_vorstand_in_club(club_id) AND (auth.uid() = author_id) AND is_same_club(club_id))
-- -------------------------------------------------------------
drop policy if exists "feed_insert_manager_same_club" on public.feed_posts;
create policy "feed_insert_manager_same_club"
  on public.feed_posts
  for insert
  to authenticated
  with check (
    is_admin_or_vorstand_in_club(club_id)
    and (select auth.uid()) = author_id
    and is_same_club(club_id)
  );

-- -------------------------------------------------------------
-- 7. fishing_trips: fishing_trips_insert_same_club
--    WAS:  (is_same_club(club_id) AND ((auth.uid() = user_id) OR is_admin_or_vorstand_in_club(club_id)))
-- -------------------------------------------------------------
drop policy if exists "fishing_trips_insert_same_club" on public.fishing_trips;
create policy "fishing_trips_insert_same_club"
  on public.fishing_trips
  for insert
  to authenticated
  with check (
    is_same_club(club_id)
    and ((select auth.uid()) = user_id or is_admin_or_vorstand_in_club(club_id))
  );

-- -------------------------------------------------------------
-- 8. member_water_mappings: member_water_mappings_insert_scoped
--    WAS:  ((proposed_by = auth.uid()) OR (is_admin_or_vorstand_in_club(club_id) AND ...))
-- -------------------------------------------------------------
drop policy if exists "member_water_mappings_insert_scoped" on public.member_water_mappings;
create policy "member_water_mappings_insert_scoped"
  on public.member_water_mappings
  for insert
  to authenticated
  with check (
    proposed_by = (select auth.uid())
    or (
      is_admin_or_vorstand_in_club(club_id)
      and club_id is not null
      and is_same_club(club_id)
    )
  );

-- -------------------------------------------------------------
-- 9. member_waters: member_waters_insert_user_or_manager_same_club
--    WAS:  ((auth.uid() = user_id) OR (is_admin_or_vorstand_in_club(club_id) AND ...))
-- -------------------------------------------------------------
drop policy if exists "member_waters_insert_user_or_manager_same_club" on public.member_waters;
create policy "member_waters_insert_user_or_manager_same_club"
  on public.member_waters
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    or (
      is_admin_or_vorstand_in_club(club_id)
      and club_id is not null
      and is_same_club(club_id)
    )
  );

-- -------------------------------------------------------------
-- 10. push_subscriptions: push_subscriptions_own_insert
--     WAS:  (auth.uid() = user_id)
-- -------------------------------------------------------------
drop policy if exists "push_subscriptions_own_insert" on public.push_subscriptions;
create policy "push_subscriptions_own_insert"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
  );

-- -------------------------------------------------------------
-- 11. user_settings: user_settings_insert_own
--     WAS:  (auth.uid() = user_id)
-- -------------------------------------------------------------
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  to public
  with check (
    (select auth.uid()) = user_id
  );

-- -------------------------------------------------------------
-- 12. work_checkins: work_checkins_insert_same_club
--     WAS:  (is_same_club(club_id) AND ((auth_uid = auth.uid()) OR ...))
--     HINWEIS: auth_uid ist Spaltenname, nicht auth.uid()
-- -------------------------------------------------------------
drop policy if exists "work_checkins_insert_same_club" on public.work_checkins;
create policy "work_checkins_insert_same_club"
  on public.work_checkins
  for insert
  to authenticated
  with check (
    is_same_club(club_id)
    and (auth_uid = (select auth.uid()) or is_admin_or_vorstand_in_club(club_id))
  );

-- -------------------------------------------------------------
-- 13. work_participations: work_participations_insert_same_club
--     WAS:  (is_same_club(club_id) AND ((auth_uid = auth.uid()) OR ...))
--     HINWEIS: auth_uid ist Spaltenname, nicht auth.uid()
-- -------------------------------------------------------------
drop policy if exists "work_participations_insert_same_club" on public.work_participations;
create policy "work_participations_insert_same_club"
  on public.work_participations
  for insert
  to authenticated
  with check (
    is_same_club(club_id)
    and (auth_uid = (select auth.uid()) or is_admin_or_vorstand_in_club(club_id))
  );

-- =============================================================
-- DUPLICATE INDEX: club_billing_subscriptions
-- =============================================================
-- club_billing_subscriptions_pkey        PRIMARY KEY btree (club_id)
-- club_billing_subscriptions_club_id_unique  UNIQUE    btree (club_id)
-- Beide identisch. PK bleibt. Redundanter Unique-Index wird gedroppt.
-- =============================================================
drop index if exists public.club_billing_subscriptions_club_id_unique;

commit;
