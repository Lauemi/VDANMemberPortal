begin;

-- =========================================================
-- FIX: public.club_members RLS sauber aufsetzen
-- =========================================================
-- Ist-Stand laut Dashboard:
--   Eine Policy "club_members_superadmin_read" mit hardgecodeter UUID.
--   Das ist fachlich falsch und wird hier ersetzt.
--
-- Modell:
--   SELECT:          nur admin / vorstand im selben Club
--                    via is_admin_or_vorstand_in_club(club_id)
--                    (identisches Muster zu club_user_roles, club_onboarding_state)
--   INSERT/UPDATE/DELETE: nur service_role
--                    Alle Writes laufen über RPCs (admin_member_registry_create etc.)
--                    und Edge Functions (club-onboarding-workspace).
--                    Kein authenticated-Write-Pfad nötig.
--
-- Bewusst NICHT is_same_club():
--   is_same_club() prüft nur current_user_club_id() — single-club.
--   Für club_members brauchen wir club-scoped Manager-Check, nicht current-club-Annahme.
-- =========================================================

alter table public.club_members enable row level security;

-- Fehlerhafte bestehende Policy entfernen.
drop policy if exists "club_members_superadmin_read" on public.club_members;

-- SELECT: manager (admin / vorstand) im selben Club.
drop policy if exists "club_members_select_manager_same_club" on public.club_members;
create policy "club_members_select_manager_same_club"
on public.club_members
for select
to authenticated
using (
  public.is_admin_or_vorstand_in_club(club_id)
  or public.is_admin_in_any_club()
);

-- INSERT / UPDATE / DELETE: nur service_role.
-- Writes laufen ausschließlich über RPCs / Edge Functions mit security definer.
drop policy if exists "club_members_write_service_role_only" on public.club_members;
create policy "club_members_write_service_role_only"
on public.club_members
for all
to service_role
using (true)
with check (true);

commit;
