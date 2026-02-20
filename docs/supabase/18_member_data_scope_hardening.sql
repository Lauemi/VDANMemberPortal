-- VDAN Template — harden member data scope (own data only)
-- Run this after:
-- 15_fix_role_helper_recursion.sql
--
-- Goal:
-- - Members can only read/write their own catch/work rows.
-- - Vorstand/Admin keep cockpit scope.

begin;

-- =========================================
-- Catch entries: own rows for member, full for manager
-- =========================================
drop policy if exists "catch_select_own_or_manager" on public.catch_entries;
create policy "catch_select_own_or_manager"
on public.catch_entries for select
using (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_insert_own_or_manager" on public.catch_entries;
create policy "catch_insert_own_or_manager"
on public.catch_entries for insert
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_update_own_or_manager" on public.catch_entries;
create policy "catch_update_own_or_manager"
on public.catch_entries for update
using (auth.uid() = user_id or public.is_admin_or_vorstand())
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_delete_own_or_manager" on public.catch_entries;
create policy "catch_delete_own_or_manager"
on public.catch_entries for delete
using (auth.uid() = user_id or public.is_admin_or_vorstand());

-- =========================================
-- Work participations: own rows for member, full for manager
-- =========================================
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

-- =========================================
-- Work checkins: own rows for member, full for manager
-- =========================================
drop policy if exists "work_checkins_select_own_or_manager" on public.work_checkins;
create policy "work_checkins_select_own_or_manager"
on public.work_checkins for select
using (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_checkins_insert_own_or_manager" on public.work_checkins;
create policy "work_checkins_insert_own_or_manager"
on public.work_checkins for insert
with check (auth_uid = auth.uid() or public.is_admin_or_vorstand());

commit;

