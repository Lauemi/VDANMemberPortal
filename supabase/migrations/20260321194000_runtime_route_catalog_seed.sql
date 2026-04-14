-- Canonical route catalog seed for runtime config / template binding

insert into public.app_route_catalog (
  route_key,
  route_path,
  route_type,
  guard_class,
  is_template_bindable,
  is_brand_override_allowed
)
values
  ('home', '/', 'static_web', 'deploy_guard', false, false),
  ('login', '/login', 'static_web', 'shared_public', false, false),
  ('register', '/registrieren', 'static_web', 'shared_public', false, false),
  ('legal_privacy', '/datenschutz.html', 'legal_core', 'legal_core', false, false),
  ('legal_terms', '/nutzungsbedingungen.html', 'legal_core', 'legal_core', false, false),
  ('legal_imprint', '/impressum.html', 'legal_core', 'legal_core', false, false),
  ('members_registry', '/app/mitgliederverwaltung', 'app_mask', 'authenticated_admin', true, true),
  ('clubs_board', '/app/vereine', 'app_mask', 'authenticated_admin', true, true),
  ('admin_panel', '/app/admin-panel', 'app_mask', 'authenticated_admin', true, true),
  ('portal_home', '/app', 'app_mask', 'authenticated', true, true)
on conflict (route_key) do update
set
  route_path = excluded.route_path,
  route_type = excluded.route_type,
  guard_class = excluded.guard_class,
  is_template_bindable = excluded.is_template_bindable,
  is_brand_override_allowed = excluded.is_brand_override_allowed,
  updated_at = now();
