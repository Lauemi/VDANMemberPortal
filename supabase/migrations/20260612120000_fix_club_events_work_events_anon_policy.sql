-- club_events und work_events SELECT-Policies riefen is_admin_or_vorstand_in_club direkt
-- in der Policy-Expression auf. PostgreSQL prueft EXECUTE-Rechte zur Planzeit fuer alle
-- referenzierten Funktionen — auch wenn die OR-Branch nie erreicht wird (anon).
-- Nach dem Entzug von is_admin_or_vorstand_in_club fuer PUBLIC/anon (20260612100000)
-- fuehrte das zu 401 auf oeffentlichen Reads.
--
-- Zusaetzlich hatten die club_events ALL-Policies kein TO authenticated,
-- was dieselben plan-time-Checks fuer anon-SELECTs ausloeste.
--
-- Fix:
-- 1. SECURITY DEFINER wrapper is_club_content_manager — anon sieht nur diesen,
--    nicht die internen Funktionen. Fuer anon: auth.uid() is null → sofort false.
-- 2. Beide SELECT-Policies verwenden den Wrapper statt direktem Aufruf.
-- 3. club_events ALL-Policies erhalten TO authenticated.

create or replace function public.is_club_content_manager(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and public.is_admin_or_vorstand_in_club(p_club_id)
    and public.is_same_club(p_club_id)
$$;

drop policy if exists "club_events_manager_same_club_all" on public.club_events;
drop policy if exists "club_events_manager_same_club_all_mt" on public.club_events;

create policy "club_events_manager_same_club_all"
on public.club_events for all
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id) and public.is_same_club(club_id));

create policy "club_events_manager_same_club_all_mt"
on public.club_events for all
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id));

drop policy if exists "club_events_select_tenant_published_or_manager" on public.club_events;
create policy "club_events_select_tenant_published_or_manager"
on public.club_events for select
using (
  public.can_access_club_content(club_id)
  and (
    status = 'published'
    or public.is_club_content_manager(club_id)
  )
);

drop policy if exists "work_events_select_published_or_manager" on public.work_events;
create policy "work_events_select_published_or_manager"
on public.work_events for select
using (
  public.can_access_club_content(club_id)
  and (
    status = 'published'
    or public.is_club_content_manager(club_id)
  )
);

notify pgrst, 'reload schema';
