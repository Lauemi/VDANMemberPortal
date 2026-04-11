-- ZWECK
-- QuickOnboarding-Formular fuer die direkte Mitgliederanlage beschreiben.
--
-- ERWARTETE SPALTEN
-- auto_assign_hint
-- first_name
-- last_name
-- status
-- is_youth
-- membership_kind
-- city
-- phone
-- birthdate
--
-- VERWENDET IN ADM:
-- club_settings_members_quick_add
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read laeuft ueber die Edge Function `club-onboarding-workspace`.
-- Das Panel liest die Felder aus `record.workspace.member_draft.*`.

select
  null::text as auto_assign_hint,
  null::text as first_name,
  null::text as last_name,
  null::text as status,
  null::boolean as is_youth,
  null::text as membership_kind,
  null::text as city,
  null::text as phone,
  null::date as birthdate;
