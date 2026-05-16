-- Fix: VDAN Termine-Seite für nicht-eingeloggte Besucher
-- Ticket: VDAN-Bug / Termine 401 permission denied
--
-- Problem 1: public_active_club_id() hat kein EXECUTE-Grant für anon.
--   can_access_club_content() ruft diese Funktion für auth.uid()=NULL auf
--   → "permission denied for function public_active_club_id" + HTTP 401
--
-- Problem 2: work_events SELECT-Policy nutzte is_same_club() statt
--   can_access_club_content(). is_same_club() liefert für anon immer false
--   → published Arbeitseinsätze wurden für Gäste nie angezeigt.

begin;

-- Fix 1: Grant anon execute auf public_active_club_id
grant execute on function public.public_active_club_id() to anon;

-- Fix 2: work_events SELECT-Policy auf can_access_club_content umstellen
drop policy if exists work_events_select_same_club on public.work_events;

create policy work_events_select_published_or_manager
  on public.work_events
  for select
  using (
    can_access_club_content(club_id)
    and (
      status = 'published'::work_event_status
      or (
        (select auth.uid()) is not null
        and is_admin_or_vorstand_in_club(club_id)
      )
    )
  );

commit;
