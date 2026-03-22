-- 109 Runtime config foundation audit
-- Date: 2026-03-22
-- Run AFTER:
--   supabase/migrations/20260321193000_runtime_config_foundation.sql
--   supabase/migrations/20260321194000_runtime_route_catalog_seed.sql
--
-- Purpose:
-- - Verify DB-driven runtime foundation objects exist
-- - Verify deny-by-default posture via RLS/policies
-- - Verify canonical route catalog seed exists
-- - Detect duplicate active runtime/theme states
-- - Surface malformed config namespaces and broken bindings
--
-- Usage:
-- - Read-only audit queries for Supabase SQL editor
-- - Each query can be run independently

-- -------------------------------------------------------------------
-- A) Object existence
-- -------------------------------------------------------------------
select to_regclass('public.app_runtime_configs') as app_runtime_configs;
select to_regclass('public.app_template_library') as app_template_library;
select to_regclass('public.app_route_catalog') as app_route_catalog;
select to_regclass('public.app_template_bindings') as app_template_bindings;
select to_regclass('public.app_theme_tokens') as app_theme_tokens;
select to_regclass('public.app_runtime_releases') as app_runtime_releases;
select to_regclass('public.app_runtime_audit_log') as app_runtime_audit_log;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'set_updated_at';

-- -------------------------------------------------------------------
-- B) Table structure sanity
-- -------------------------------------------------------------------
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'app_runtime_configs',
    'app_template_library',
    'app_route_catalog',
    'app_template_bindings',
    'app_theme_tokens',
    'app_runtime_releases',
    'app_runtime_audit_log'
  )
order by table_name, ordinal_position;

select
  t.relname as table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in (
    'app_runtime_configs',
    'app_template_library',
    'app_route_catalog',
    'app_template_bindings',
    'app_theme_tokens',
    'app_runtime_releases',
    'app_runtime_audit_log'
  )
order by t.relname, c.conname;

-- -------------------------------------------------------------------
-- C) Indexes and RLS policies
-- -------------------------------------------------------------------
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'app_runtime_configs',
    'app_template_library',
    'app_route_catalog',
    'app_template_bindings',
    'app_theme_tokens',
    'app_runtime_releases',
    'app_runtime_audit_log'
  )
order by tablename, indexname;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'app_runtime_configs',
    'app_template_library',
    'app_route_catalog',
    'app_template_bindings',
    'app_theme_tokens',
    'app_runtime_releases',
    'app_runtime_audit_log'
  )
order by tablename, policyname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'app_runtime_configs',
    'app_template_library',
    'app_route_catalog',
    'app_template_bindings',
    'app_theme_tokens',
    'app_runtime_releases',
    'app_runtime_audit_log'
  )
order by c.relname;

-- -------------------------------------------------------------------
-- D) Canonical route catalog
-- -------------------------------------------------------------------
select
  route_key,
  route_path,
  route_type,
  guard_class,
  is_template_bindable,
  is_brand_override_allowed
from public.app_route_catalog
order by route_key;

-- Expected: seed rows present
select
  route_key,
  case when exists (
    select 1
    from public.app_route_catalog c
    where c.route_key = expected.route_key
  ) then 'OK' else 'MISSING' end as status
from (
  values
    ('home'),
    ('login'),
    ('register'),
    ('legal_privacy'),
    ('legal_terms'),
    ('legal_imprint'),
    ('members_registry'),
    ('clubs_board'),
    ('admin_panel'),
    ('portal_home')
) as expected(route_key)
order by route_key;

-- Unexpected duplicate route_path
select
  route_path,
  count(*) as n
from public.app_route_catalog
group by route_path
having count(*) > 1
order by route_path;

-- -------------------------------------------------------------------
-- E) Runtime config integrity
-- -------------------------------------------------------------------
select
  scope_type,
  scope_key,
  config_key,
  version,
  status,
  is_active,
  published_at,
  created_at,
  updated_at
from public.app_runtime_configs
order by scope_type, scope_key, config_key, version desc;

-- Namespaced config keys only
select
  id,
  scope_type,
  scope_key,
  config_key
from public.app_runtime_configs
where config_key !~ '^[a-z0-9]+(\.[a-z0-9_]+)+$'
order by created_at desc;

-- At most one active published row per scope/config
select
  scope_type,
  scope_key,
  config_key,
  count(*) as active_rows
from public.app_runtime_configs
where is_active
  and status = 'published'
group by scope_type, scope_key, config_key
having count(*) > 1
order by scope_type, scope_key, config_key;

-- Active rows should have published_at
select
  id,
  scope_type,
  scope_key,
  config_key,
  version
from public.app_runtime_configs
where is_active
  and status = 'published'
  and published_at is null
order by created_at desc;

-- Expected default runtime keys per site_mode
select
  scope_key,
  config_key,
  version,
  status,
  is_active
from public.app_runtime_configs
where scope_type = 'site_mode'
  and scope_key in ('fcp', 'vdan')
  and config_key in ('branding.static_web_matrix', 'branding.app_mask_matrix')
order by scope_key, config_key, version desc;

-- -------------------------------------------------------------------
-- F) Theme token integrity
-- -------------------------------------------------------------------
select
  scope_type,
  scope_key,
  theme_key,
  version,
  status,
  is_active,
  published_at
from public.app_theme_tokens
order by scope_type, scope_key, theme_key, version desc;

select
  scope_type,
  scope_key,
  theme_key,
  count(*) as active_rows
from public.app_theme_tokens
where is_active
  and status = 'published'
group by scope_type, scope_key, theme_key
having count(*) > 1
order by scope_type, scope_key, theme_key;

-- -------------------------------------------------------------------
-- G) Template integrity
-- -------------------------------------------------------------------
select
  template_key,
  template_type,
  brand_scope,
  version,
  status,
  published_at
from public.app_template_library
order by template_key, version desc;

-- Bindings must resolve to an existing route key
select
  b.id,
  b.scope_type,
  b.scope_key,
  b.route_key,
  b.route_path,
  b.template_key
from public.app_template_bindings b
left join public.app_route_catalog c
  on c.route_key = b.route_key
where c.route_key is null
order by b.created_at desc;

-- Active bindings should match canonical route_path
select
  b.id,
  b.route_key,
  b.route_path as binding_path,
  c.route_path as catalog_path
from public.app_template_bindings b
join public.app_route_catalog c
  on c.route_key = b.route_key
where b.is_active
  and b.route_path <> c.route_path
order by b.created_at desc;

-- -------------------------------------------------------------------
-- H) Release and audit trail
-- -------------------------------------------------------------------
select
  release_key,
  scope_type,
  scope_key,
  release_type,
  payload_hash,
  published_by,
  published_at
from public.app_runtime_releases
order by published_at desc;

select
  actor_id,
  scope_type,
  scope_key,
  entity_type,
  entity_key,
  action,
  created_at
from public.app_runtime_audit_log
order by created_at desc;

-- Release rows without payload
select
  release_key,
  scope_type,
  scope_key,
  release_type
from public.app_runtime_releases
where payload_json is null
   or payload_json = '{}'::jsonb
order by published_at desc;

-- -------------------------------------------------------------------
-- I) Final status summary
-- -------------------------------------------------------------------
with checks as (
  select
    (select to_regclass('public.app_runtime_configs') is not null) as has_runtime_configs,
    (select to_regclass('public.app_route_catalog') is not null) as has_route_catalog,
    (select count(*) from public.app_route_catalog where route_key in (
      'home','login','register','legal_privacy','legal_terms','legal_imprint',
      'members_registry','clubs_board','admin_panel','portal_home'
    )) = 10 as has_seed_routes,
    not exists (
      select 1
      from public.app_runtime_configs
      where config_key !~ '^[a-z0-9]+(\.[a-z0-9_]+)+$'
    ) as keys_namespaced,
    not exists (
      select 1
      from public.app_runtime_configs
      where is_active
        and status = 'published'
      group by scope_type, scope_key, config_key
      having count(*) > 1
    ) as runtime_active_unique,
    not exists (
      select 1
      from public.app_theme_tokens
      where is_active
        and status = 'published'
      group by scope_type, scope_key, theme_key
      having count(*) > 1
    ) as theme_active_unique,
    (
      select count(*)
      from public.app_runtime_configs
      where scope_type = 'site_mode'
        and scope_key in ('fcp', 'vdan')
        and config_key in ('branding.static_web_matrix', 'branding.app_mask_matrix')
        and status = 'published'
        and is_active = true
    ) = 4 as has_runtime_default_seed
)
select
  case
    when has_runtime_configs
      and has_route_catalog
      and has_seed_routes
      and keys_namespaced
      and runtime_active_unique
      and theme_active_unique
      and has_runtime_default_seed
    then 'runtime-config-foundation-green'
    else 'runtime-config-foundation-review-required'
  end as audit_status,
  *
from checks;
