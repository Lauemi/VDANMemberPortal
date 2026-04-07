-- ZWECK
-- Setup-/Billing-Snapshot fuer den freigegebenen Club-Kontext beschreiben.
--
-- ERWARTETE SPALTEN
-- club_id
-- billing_state
-- portal_state
-- club_data_complete
-- waters_complete
-- member_directory_count
-- manager_count
-- setup_ready
--
-- VERWENDET IN ADM:
-- club_settings_onboarding_snapshot
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Live-Read ist noch nicht final stabil. Platzhalter zeigt die erwarteten Alias-Namen.

select
  :club_id::uuid as club_id,
  null::text as billing_state,
  null::text as portal_state,
  null::boolean as club_data_complete,
  null::boolean as waters_complete,
  null::bigint as member_directory_count,
  null::bigint as manager_count,
  null::boolean as setup_ready;

