-- ZWECK
-- Gewaesserliste aus dem Club-Workspace referenzieren.
--
-- ERWARTETE SPALTEN
-- name
-- water_type
-- water_status
-- is_youth_allowed
-- requires_board_approval
-- water_cards
--
-- VERWENDET IN ADM:
-- club_settings_waters_table
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read laeuft ueber Edge `club-onboarding-workspace` und `record.workspace.waters`.

select
  name,
  water_type,
  water_status,
  is_youth_allowed,
  requires_board_approval,
  water_cards
from public.club_waters
where club_id = :club_id::uuid;

