-- STEP 09 D3: mitglieder_registry → members (Entscheidung 2026-06-07).
-- mitglieder_registry ist kein eigener Teilkontext, sondern Backoffice-/Stammdatenbereich
-- innerhalb von members. members-Zeilen existieren bereits in allen Clubs (durch 20260606150000).
-- Kein Rechte-Transfer nötig: members hat bereits volle Vorstand/Admin-Rechte.
-- Kein Frontend-Gate prüft mitglieder_registry außerhalb von admin-board.js (gegrept, kein Treffer).
-- Verifiziert: mitglieder_registry 0 in allen drei Tabellen, members Gate-Join intakt.

DELETE FROM public.club_role_permissions  WHERE module_key   = 'mitglieder_registry';
DELETE FROM public.club_module_usecases   WHERE usecase_key  = 'mitglieder_registry';
DELETE FROM public.module_usecases        WHERE usecase_key  = 'mitglieder_registry';

NOTIFY pgrst, 'reload schema';
