-- ZWECK
-- Ziel-Readvertrag fuer die Pflichtstunden-Konfiguration im ClubSettings-Workspace dokumentieren.
--
-- ERWARTETE SPALTEN
-- enabled
-- default_hours
-- youth_exempt
-- honorary_exempt
-- note
--
-- VERWENDET IN ADM:
-- club_settings_work_hours_config
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Die Werte kommen aktuell aus dem Edge-Workspace club-onboarding-workspace
-- unter record.workspace.work_hours_config.

select
  null::boolean as enabled,
  null::numeric as default_hours,
  null::boolean as youth_exempt,
  null::boolean as honorary_exempt,
  null::text as note
where false;
