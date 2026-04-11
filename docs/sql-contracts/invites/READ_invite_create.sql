-- ZWECK
-- Letzten aktiven Club-Invite fuer ClubSettings lesen.
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
-- Der Read laeuft ueber die club-gescopte RPC `public.club_invite_create_state`.

select
  club_name,
  club_code,
  max_uses,
  expires_in_days,
  invite_token,
  invite_register_url,
  invite_qr_url,
  invite_expires_at
from public.club_invite_create_state(:p_club_id::uuid);
