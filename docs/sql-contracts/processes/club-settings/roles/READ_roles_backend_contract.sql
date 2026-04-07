-- ZWECK
-- Rollen-/Rechtevertrag fuer ClubSettings dokumentieren.
--
-- ERWARTETE SPALTEN
-- backend_relation
-- legacy_acl_state
-- allowed_roles
--
-- VERWENDET IN ADM:
-- club_settings_roles_backend_contract
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Aktuell Vorschau-/Dokumentationsblock. Finaler Read-/Write-Vertrag ist noch offen.

select
  'public.club_user_roles'::text as backend_relation,
  'Nur LocalStorage-Pilot. Kein belastbarer Write-Vertrag fuer die alte ACL-Matrix.'::text as legacy_acl_state,
  'admin, vorstand, superadmin'::text as allowed_roles;

