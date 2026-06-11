-- Portal Tab Meta — ADM mask tab visibility control
-- Global source of truth for tab-level visibility within ADM masks.
-- Written by superadmin via admin-board.js accordion, read by admin-panel-mask.js at render time.
-- Scope: instance-global (same pattern as portal_module_meta).
--
-- Flags:
--   is_visible        → hides tab from ADM nav (all users incl. superadmin)
--   is_deprecated     → hidden for regular users; superadmin still sees it
--   is_superadmin_only → only superadmin sees this tab
--
-- NOT built here: club-specific tab visibility, route-level protection.

CREATE TABLE IF NOT EXISTS public.portal_tab_meta (
  module_id          TEXT        NOT NULL,
  tab_id             TEXT        NOT NULL,
  is_visible         BOOLEAN     NOT NULL DEFAULT TRUE,
  is_deprecated      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_superadmin_only BOOLEAN     NOT NULL DEFAULT FALSE,
  note               TEXT        NOT NULL DEFAULT '',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (module_id, tab_id),
  CHECK (module_id ~ '^[a-z0-9_]{2,60}$'),
  CHECK (tab_id ~ '^[a-z0-9_]{2,60}$')
);

DROP TRIGGER IF EXISTS trg_portal_tab_meta_updated_at ON public.portal_tab_meta;
CREATE TRIGGER trg_portal_tab_meta_updated_at
  BEFORE UPDATE ON public.portal_tab_meta
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.portal_tab_meta ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read tab config
DROP POLICY IF EXISTS "portal_tab_meta_select_authenticated" ON public.portal_tab_meta;
CREATE POLICY "portal_tab_meta_select_authenticated"
  ON public.portal_tab_meta FOR SELECT
  USING (auth.role() = 'authenticated');

-- Writes only for superadmin — server-side check via fcp_is_superadmin() (SECURITY DEFINER).
DROP POLICY IF EXISTS "portal_tab_meta_write_superadmin" ON public.portal_tab_meta;
CREATE POLICY "portal_tab_meta_write_superadmin"
  ON public.portal_tab_meta FOR ALL
  USING (public.fcp_is_superadmin())
  WITH CHECK (public.fcp_is_superadmin());

-- ─── Seed defaults ───────────────────────────────────────────────────────────
-- 3 tabs: natur_gewaesser  |  4 tabs: mitgliederabrechnung
INSERT INTO public.portal_tab_meta
  (module_id, tab_id, is_visible, is_deprecated, is_superadmin_only, note)
VALUES
  ('natur_gewaesser',      'nav_ng_gewaesser',           TRUE, FALSE, FALSE, ''),
  ('natur_gewaesser',      'nav_ng_fangstatistik',        TRUE, FALSE, FALSE, ''),
  ('natur_gewaesser',      'nav_ng_nacherfassung',         TRUE, FALSE, FALSE, ''),
  ('mitgliederabrechnung', 'nav_ma_beitragsarten',         TRUE, FALSE, FALSE, ''),
  ('mitgliederabrechnung', 'nav_ma_pflichtstunden',         TRUE, FALSE, FALSE, ''),
  ('mitgliederabrechnung', 'nav_ma_kassierer',             TRUE, FALSE, FALSE, ''),
  ('mitgliederabrechnung', 'nav_ma_sepa_einstellungen',    TRUE, FALSE, FALSE, '')
ON CONFLICT (module_id, tab_id) DO NOTHING;
