-- ZWECK
-- Ziel-Readvertrag fuer Helfer und Arbeitseinsaetze im ClubSettings-Workspace dokumentieren.
--
-- ERWARTETE SPALTEN
-- event_title
-- slot_label
-- helper_count
-- approval_mode
-- status
-- starts_at
--
-- VERWENDET IN ADM:
-- club_settings_work_helpers_table
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Kombinierter Reader ist noch offen. Platzhalter beschreibt den erwarteten ClubSettings-Output.

select
  null::text as event_title,
  null::text as slot_label,
  null::bigint as helper_count,
  null::text as approval_mode,
  null::text as status,
  null::timestamptz as starts_at
where false;

