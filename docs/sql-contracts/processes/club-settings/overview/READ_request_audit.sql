-- ZWECK
-- Vereinsanfrage- und Auditstatus fuer den aktuellen Benutzer lesen.
--
-- ERWARTETE SPALTEN
-- request_id
-- status
-- created_at
-- updated_at
-- rejection_reason
--
-- VERWENDET IN ADM:
-- club_settings_request_audit
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read laeuft bereits ueber RPC.

select
  request_id,
  status,
  created_at,
  updated_at,
  rejection_reason
from public.club_request_gate_state();

