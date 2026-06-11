-- Portal Module Meta — Phase 2
-- Global source of truth for portal nav module visibility and classification.
-- Scope: instance-global (all clubs on this FCP deployment share one config).
-- Written by superadmin via admin-board.js, read by portal-quick.js at login.
--
-- Phase 2 flags with runtime effect in portal-quick.js:
--   is_visible        → hides module from portal menu (all users)
--   is_deprecated     → treated as is_visible=false (hidden)
--   is_superadmin_only → overrides access: only superadmin sees it
--   vdan_only         → hidden on fcp-mode sites (replaces hardcoded FCP_ONLY check)
--   fcp_only          → hidden on vdan-mode sites (replaces hardcoded isModuleAllowedBySiteMode)
--
-- NOT built in Phase 2 (out of scope, clearly documented):
--   Route-level access protection — routes remain reachable by direct URL.
--   Club-specific visibility — use club_module_usecases for that.

CREATE TABLE IF NOT EXISTS public.portal_module_meta (
  module_id          TEXT        PRIMARY KEY,
  is_visible         BOOLEAN     NOT NULL DEFAULT TRUE,
  is_deprecated      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_superadmin_only BOOLEAN     NOT NULL DEFAULT FALSE,
  vdan_only          BOOLEAN     NOT NULL DEFAULT FALSE,
  fcp_only           BOOLEAN     NOT NULL DEFAULT FALSE,
  note               TEXT        NOT NULL DEFAULT '',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (module_id ~ '^[a-z0-9_]{2,60}$')
);

DROP TRIGGER IF EXISTS trg_portal_module_meta_updated_at ON public.portal_module_meta;
CREATE TRIGGER trg_portal_module_meta_updated_at
  BEFORE UPDATE ON public.portal_module_meta
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.portal_module_meta ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read module config
DROP POLICY IF EXISTS "portal_module_meta_select_authenticated" ON public.portal_module_meta;
CREATE POLICY "portal_module_meta_select_authenticated"
  ON public.portal_module_meta FOR SELECT
  USING (auth.role() = 'authenticated');

-- Superadmin writes go through admin-board.js with auth token.
-- Superadmin identity is verified at the UI layer (data-superadmin-user-ids).
-- Same pattern as module_catalog table.
DROP POLICY IF EXISTS "portal_module_meta_write_authenticated" ON public.portal_module_meta;
CREATE POLICY "portal_module_meta_write_authenticated"
  ON public.portal_module_meta FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Seed defaults ───────────────────────────────────────────────────────────
-- is_visible=TRUE unless deprecated. eventplaner is off by default (replaced by v2).
-- vdan_only / fcp_only mirror the existing hardcoded isModuleAllowedBySiteMode logic.
INSERT INTO public.portal_module_meta
  (module_id, is_visible, is_deprecated, is_superadmin_only, vdan_only, fcp_only, note)
VALUES
  ('fangliste',            TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('arbeitseinsaetze',     TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('ausweis',              TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('gewaesserkarte',       TRUE,  FALSE, FALSE, TRUE,  FALSE, 'Nur VDAN-Modus'),
  ('zustaendigkeiten',     TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('einstellungen',        TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('scanner',              TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('eventplaner',          FALSE, TRUE,  FALSE, FALSE, FALSE, 'Veraltet — Ersatz: eventplaner_v2'),
  ('eventplaner_v2',       TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('feedback',             TRUE,  FALSE, FALSE, FALSE, TRUE,  'FCP only'),
  ('sitzungen',            TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('dokumente',            TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('feedback_cockpit',     TRUE,  FALSE, FALSE, FALSE, TRUE,  'FCP only'),
  ('mitgliederabrechnung', TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('natur_gewaesser',      TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('admin_board',          TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('kontrollboard',        TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('masterboard',          TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('component_library',    TRUE,  FALSE, FALSE, FALSE, FALSE, ''),
  ('template_studio',      TRUE,  FALSE, FALSE, FALSE, FALSE, '')
ON CONFLICT (module_id) DO NOTHING;
