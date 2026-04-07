-- ZWECK
-- Ziel-Readvertrag fuer Regelwerke im ClubSettings-Workspace dokumentieren.
--
-- ERWARTETE SPALTEN
-- rule_name
-- rule_scope
-- version_label
-- status
-- updated_at
--
-- VERWENDET IN ADM:
-- club_settings_rules_table
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Live-Datenquelle ist noch offen. Platzhalter beschreibt nur den benoetigten Output.

select
  null::text as rule_name,
  null::text as rule_scope,
  null::text as version_label,
  null::text as status,
  null::timestamptz as updated_at
where false;

