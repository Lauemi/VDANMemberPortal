-- ZWECK
-- Prozesskontext fuer den ClubSettings-Einstieg dokumentieren.
--
-- ERWARTETE SPALTEN
-- process_status
-- current_step_id
-- billing_status
-- setup_state
-- approved_club_id
--
-- VERWENDET IN ADM:
-- club_settings_process_context
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Fachlicher Vertrag ist in der Maske bereits benannt.
-- Aktuell wird der Panelblock bewusst nur als Vorschau gezeigt.

select
  process_status,
  current_step_id,
  billing_status,
  setup_state,
  approved_club_id
from public.get_onboarding_process_state();

