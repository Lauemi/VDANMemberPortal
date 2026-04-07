-- ZWECK
-- Ausweise-/Kartenuebersicht fuer ClubSettings referenzieren.
--
-- ERWARTETE SPALTEN
-- club_member_no
-- member_name
-- fishing_card_type
-- status
-- validity_label
-- updated_at
--
-- VERWENDET IN ADM:
-- club_settings_cards_table
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read laeuft ueber `public.admin_member_cards_overview_v2(p_club_id)`.

select
  club_member_no,
  member_name,
  fishing_card_type,
  status,
  validity_label,
  updated_at
from public.admin_member_cards_overview_v2(:p_club_id::uuid);

