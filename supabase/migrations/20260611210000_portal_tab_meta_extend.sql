-- portal_tab_meta — Erweiterung: mitgliederverwaltung (10 Tabs) + admin_board (4 Tabs)
-- mitgliederverwaltung: ADM_MITGLIEDERVERWALTUNG (ehem. ADM_CLUB_SETTINGS_ONBOARDING)
-- admin_board: Sub-Tabs des Modul-Bereichs im Admin Board

INSERT INTO public.portal_tab_meta
  (module_id, tab_id, is_visible, is_deprecated, is_superadmin_only, note)
VALUES
  ('mitgliederverwaltung', 'nav_club_settings_club_data',  TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_invites',    TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_members',    TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_roles',      TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_waters',     TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_rules',      TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_cards',      TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_work',       TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_approvals',  TRUE, FALSE, FALSE, ''),
  ('mitgliederverwaltung', 'nav_club_settings_settings',   TRUE, FALSE, FALSE, ''),
  ('admin_board',          'nav_ab_sichtbarkeit',          TRUE, FALSE, FALSE, ''),
  ('admin_board',          'nav_ab_portal',                TRUE, FALSE, FALSE, ''),
  ('admin_board',          'nav_ab_katalog',               TRUE, FALSE, TRUE,  'Superadmin'),
  ('admin_board',          'nav_ab_rollenrechte',          TRUE, FALSE, TRUE,  'Superadmin')
ON CONFLICT (module_id, tab_id) DO NOTHING;
