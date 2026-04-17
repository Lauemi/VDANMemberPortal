-- ZWECK
-- Gewässerliste mit aktuell verknüpften Permit-Kartentypen.
-- Ersetzt READ_waters_overview.sql als Lese-Vertrag für club_settings_waters_table.
--
-- ERWARTETE SPALTEN
-- water_body_id
-- name
-- area_kind
-- is_active
-- card_keys
--
-- VERWENDET IN ADM:
-- club_settings_waters_table
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read läuft über `public.admin_water_bodies_with_cards(p_club_id)`.
-- Felder water_type, water_status, is_youth_allowed, requires_board_approval
-- existieren nicht in water_bodies — diese Workspace-Felder sind GAP.

select
  water_body_id,
  name,
  area_kind,
  is_active,
  card_keys
from public.admin_water_bodies_with_cards(:p_club_id::uuid);
