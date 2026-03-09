-- VDAN Patch 86 (Consolidation)
-- Purpose:
--   Consolidate temporary catchlist recovery rules into a stable final policy set.
--
-- What this patch does:
--   1) Keeps explicit SELECT grants for authenticated users.
--   2) Removes temporary recovery SELECT policies from patches 84/85.
--   3) Recreates canonical SELECT policies with robust owner-read behavior:
--      - Own rows are always readable (auth.uid() = user_id)
--      - Admin/Vorstand can read same-club rows
--
-- Notes:
--   - Write policies (insert/update/delete) from tenant baseline remain unchanged.
--   - This avoids long-term policy stacking from emergency fixes.

begin;

-- Ensure base table read grants are explicit.
grant select on table public.fishing_trips to authenticated;
grant select on table public.catch_entries to authenticated;

-- Remove temporary recovery policies (if present).
drop policy if exists "fishing_trips_select_own_recovery" on public.fishing_trips;
drop policy if exists "catch_entries_select_own_recovery" on public.catch_entries;

-- Replace canonical SELECT policies with robust final definitions.
drop policy if exists "fishing_trips_select_same_club" on public.fishing_trips;
create policy "fishing_trips_select_same_club"
on public.fishing_trips
for select
to authenticated
using (
  auth.uid() = user_id
  or (
    public.is_admin_or_vorstand()
    and public.is_same_club(club_id)
  )
);

drop policy if exists "catch_select_same_club" on public.catch_entries;
create policy "catch_select_same_club"
on public.catch_entries
for select
to authenticated
using (
  auth.uid() = user_id
  or (
    public.is_admin_or_vorstand()
    and public.is_same_club(club_id)
  )
);

commit;

