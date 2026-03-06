-- VDAN Patch 84 (Emergency Recovery)
-- Purpose:
--   Restore visibility of own catch list rows if tenant-club helpers/policies
--   currently block authenticated users.
--
-- Scope:
--   Read-only recovery for own data (no cross-user exposure).

begin;

-- 1) Keep helper resilient for authenticated context (profile fallback).
create or replace function public.current_user_club_id()
returns uuid
language sql
stable
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select p.club_id from public.profiles p where p.id = auth.uid() limit 1),
    (select public.public_active_club_id() where auth.uid() is not null)
  )
$$;

create or replace function public.is_same_club(p_club_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select p_club_id is not null and p_club_id = public.current_user_club_id()
$$;

-- 2) Emergency own-read policies (OR with existing policies).
drop policy if exists "fishing_trips_select_own_recovery" on public.fishing_trips;
create policy "fishing_trips_select_own_recovery"
on public.fishing_trips
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "catch_entries_select_own_recovery" on public.catch_entries;
create policy "catch_entries_select_own_recovery"
on public.catch_entries
for select
to authenticated
using (auth.uid() = user_id);

commit;

