-- ZWECK
-- Ziel-Readvertrag fuer Vereinseinstellungen im ClubSettings-QFM dokumentieren.
--
-- ERWARTETE SPALTEN
-- club_visibility_mode
-- default_approval_mode
-- helper_mode
-- settings_notes
--
-- VERWENDET IN ADM:
-- club_settings_settings_qfm
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Finaler serverseitiger Read-/Write-Vertrag fehlt noch. Platzhalter beschreibt die benoetigten Felder.

select
  'club_only'::text as club_visibility_mode,
  'manual'::text as default_approval_mode,
  'structured'::text as helper_mode,
  null::text as settings_notes;
