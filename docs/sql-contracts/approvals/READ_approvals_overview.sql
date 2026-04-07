-- ZWECK
-- Ziel-Readvertrag fuer Fangfreigaben im ClubSettings-Workspace dokumentieren.
--
-- ERWARTETE SPALTEN
-- water_name
-- member_label
-- trip_date
-- status
-- requires_board_approval
-- updated_at
--
-- VERWENDET IN ADM:
-- club_settings_approvals_table
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Finaler Live-Vertrag ist noch offen. Platzhalter beschreibt nur die benoetigten Alias-Namen.

select
  null::text as water_name,
  null::text as member_label,
  null::date as trip_date,
  null::text as status,
  null::boolean as requires_board_approval,
  null::timestamptz as updated_at
where false;

