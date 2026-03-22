-- Seed default runtime config for static web and app masks
-- Keeps static-web guard in code, but provides live DB-backed defaults for runtime consumption.

with static_defaults as (
  select jsonb_build_object(
    '/',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/login',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/registrieren',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/passwort-vergessen',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/offline',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/kontakt',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/datenschutz',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/nutzungsbedingungen',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/impressum',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/avv',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/docs',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', true, 'brand', 'fcp'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/anglerheim-ottenheim',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/downloads',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/fischereipruefung',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/mitglied-werden',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/termine',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/vdan-jugend',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/veranstaltungen',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      ),
    '/vereinsshop',
      jsonb_build_object(
        'fcp', jsonb_build_object('visible', false, 'brand', 'vdan'),
        'vdan', jsonb_build_object('visible', true, 'brand', 'vdan')
      )
  ) as payload
),
app_mask_defaults as (
  select jsonb_build_object(
    '/app/', 'fcp_tactical',
    '/app/admin-panel/', 'fcp_tactical',
    '/app/arbeitseinsaetze/', 'fcp_tactical',
    '/app/arbeitseinsaetze/cockpit', 'fcp_tactical',
    '/app/ausweis/', 'fcp_tactical',
    '/app/ausweis/verifizieren', 'fcp_tactical',
    '/app/bewerbungen/', 'fcp_tactical',
    '/app/component-library/', 'fcp_tactical',
    '/app/dokumente/', 'fcp_tactical',
    '/app/einstellungen/', 'fcp_tactical',
    '/app/eventplaner/', 'fcp_tactical',
    '/app/eventplaner/mitmachen/', 'fcp_tactical',
    '/app/feedback/', 'fcp_tactical',
    '/app/feedback/cockpit', 'fcp_tactical',
    '/app/fangliste/', 'fcp_tactical',
    '/app/fangliste/cockpit', 'fcp_tactical',
    '/app/gewaesserkarte/', 'fcp_tactical',
    '/app/kontrollboard/', 'fcp_tactical',
    '/app/lizenzen/', 'fcp_tactical',
    '/app/mitglieder/', 'fcp_tactical',
    '/app/mitgliederverwaltung/', 'fcp_tactical',
    '/app/notes/', 'fcp_tactical',
    '/app/passwort-aendern/', 'fcp_tactical',
    '/app/rechtliches-bestaetigen/', 'fcp_tactical',
    '/app/sitzungen/', 'fcp_tactical',
    '/app/template-studio/', 'fcp_tactical',
    '/app/termine/cockpit', 'fcp_tactical',
    '/app/ui-neumorph-demo/', 'fcp_tactical',
    '/app/vereine/', 'fcp_tactical',
    '/app/zugang-pruefen/', 'fcp_tactical',
    '/app/zustaendigkeiten/', 'fcp_tactical'
  ) as payload
),
seed_rows as (
  select
    'site_mode'::text as scope_type,
    'fcp'::text as scope_key,
    'branding.static_web_matrix'::text as config_key,
    (select payload from static_defaults) as config_value
  union all
  select
    'site_mode',
    'vdan',
    'branding.static_web_matrix',
    (select payload from static_defaults)
  union all
  select
    'site_mode',
    'fcp',
    'branding.app_mask_matrix',
    (select payload from app_mask_defaults)
  union all
  select
    'site_mode',
    'vdan',
    'branding.app_mask_matrix',
    (select payload from app_mask_defaults)
)
insert into public.app_runtime_configs (
  scope_type,
  scope_key,
  config_key,
  config_value,
  status,
  version,
  created_at,
  updated_at,
  published_at,
  is_active
)
select
  scope_type,
  scope_key,
  config_key,
  config_value,
  'published',
  1,
  now(),
  now(),
  now(),
  true
from seed_rows
on conflict (scope_type, scope_key, config_key, version) do update
set
  config_value = excluded.config_value,
  status = excluded.status,
  updated_at = now(),
  published_at = excluded.published_at,
  is_active = excluded.is_active;
