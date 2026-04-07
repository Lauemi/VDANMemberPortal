-- ZWECK
-- Dokumentiert den Routing-/Resume-Vertrag rund um den ClubSettings-Einstieg.
--
-- ERWARTETE SPALTEN
-- resume_route
-- adm_entry_route
--
-- VERWENDET IN ADM:
-- club_settings_route_contract
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Aktuell kein produktiver SQL-Read. Diese Datei dient als Referenzvertrag fuer die JSON-Vorschau.

select
  '/verein-anfragen/'::text as resume_route,
  '/app/mitgliederverwaltung/'::text as adm_entry_route;

