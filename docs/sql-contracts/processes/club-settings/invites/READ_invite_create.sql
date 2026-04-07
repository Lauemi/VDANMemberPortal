-- ZWECK
-- Einladungsprozess und Rueckgabefelder fuer ClubSettings referenzieren.
--
-- ERWARTETE SPALTEN
-- club_name
-- club_code
-- max_uses
-- expires_in_days
-- invite_token
-- invite_register_url
-- invite_qr_url
-- invite_expires_at
--
-- VERWENDET IN ADM:
-- club_settings_invite_create
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Write laeuft ueber Edge `club-invite-create`.
-- Ein vollstaendiger Read-/History-Vertrag fehlt noch.

select
  :club_name::text as club_name,
  :club_code::text as club_code,
  25::integer as max_uses,
  14::integer as expires_in_days,
  null::text as invite_token,
  null::text as invite_register_url,
  null::text as invite_qr_url,
  null::text as invite_expires_at;

