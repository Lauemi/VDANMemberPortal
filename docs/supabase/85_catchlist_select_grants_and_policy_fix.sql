-- VDAN Patch 85
-- Purpose:
--   Ensure authenticated users can read their own catchlist rows.
--   Adds missing SELECT grants and explicit own-read RLS policies.

begin;

alter table public.fishing_trips enable row level security;
alter table public.catch_entries enable row level security;

grant select on table public.fishing_trips to authenticated;
grant select on table public.catch_entries to authenticated;

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

