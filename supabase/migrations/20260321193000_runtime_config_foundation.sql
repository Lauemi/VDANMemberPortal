-- Runtime config foundation for DB-driven FCP/VDAN control
-- Guard stays in code/policies. DB stores only runtime/template/theme state.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_runtime_configs (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global', 'site_mode', 'club')),
  scope_key text not null,
  config_key text not null check (config_key ~ '^[a-z0-9]+(\.[a-z0-9_]+)+$'),
  config_value jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  draft_of uuid null references public.app_runtime_configs(id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_by uuid null,
  updated_by uuid null,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null,
  is_active boolean not null default false,
  rollback_of uuid null references public.app_runtime_configs(id) on delete set null,
  supersedes_version integer null check (supersedes_version is null or supersedes_version >= 1)
);

create unique index if not exists app_runtime_configs_scope_version_idx
  on public.app_runtime_configs(scope_type, scope_key, config_key, version);

create unique index if not exists app_runtime_configs_one_active_idx
  on public.app_runtime_configs(scope_type, scope_key, config_key)
  where is_active = true and status = 'published';

create index if not exists app_runtime_configs_scope_lookup_idx
  on public.app_runtime_configs(scope_type, scope_key, config_key, is_active, status, version desc);

drop trigger if exists app_runtime_configs_set_updated_at on public.app_runtime_configs;
create trigger app_runtime_configs_set_updated_at
before update on public.app_runtime_configs
for each row execute function public.set_updated_at();

create table if not exists public.app_template_library (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  template_type text not null check (template_type in ('page_shell', 'mask_layout', 'card_stack', 'form_template')),
  brand_scope text not null check (brand_scope in ('vdan', 'fcp', 'shared')),
  schema_version integer not null default 1 check (schema_version >= 1),
  template_json jsonb not null default '{}'::jsonb,
  payload_hash text null,
  created_by uuid null,
  approved_by uuid null,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  version integer not null default 1 check (version >= 1),
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  supersedes_version integer null check (supersedes_version is null or supersedes_version >= 1),
  rollback_of uuid null references public.app_template_library(id) on delete set null
);

create unique index if not exists app_template_library_key_version_idx
  on public.app_template_library(template_key, version);

create index if not exists app_template_library_lookup_idx
  on public.app_template_library(template_key, status, brand_scope, template_type, version desc);

drop trigger if exists app_template_library_set_updated_at on public.app_template_library;
create trigger app_template_library_set_updated_at
before update on public.app_template_library
for each row execute function public.set_updated_at();

create table if not exists public.app_route_catalog (
  route_key text primary key,
  route_path text not null unique,
  route_type text not null check (route_type in ('static_web', 'app_mask', 'legal_core')),
  guard_class text not null,
  is_template_bindable boolean not null default false,
  is_brand_override_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_route_catalog_set_updated_at on public.app_route_catalog;
create trigger app_route_catalog_set_updated_at
before update on public.app_route_catalog
for each row execute function public.set_updated_at();

create table if not exists public.app_template_bindings (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global', 'site_mode', 'club')),
  scope_key text not null,
  route_key text not null references public.app_route_catalog(route_key) on delete cascade,
  route_path text not null,
  template_key text not null,
  variant_key text null,
  is_active boolean not null default true,
  created_by uuid null,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_template_bindings_active_idx
  on public.app_template_bindings(scope_type, scope_key, route_key)
  where is_active = true;

drop trigger if exists app_template_bindings_set_updated_at on public.app_template_bindings;
create trigger app_template_bindings_set_updated_at
before update on public.app_template_bindings
for each row execute function public.set_updated_at();

create table if not exists public.app_theme_tokens (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global', 'site_mode', 'club')),
  scope_key text not null,
  theme_key text not null,
  tokens_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  version integer not null default 1 check (version >= 1),
  created_by uuid null,
  approved_by uuid null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null
);

create unique index if not exists app_theme_tokens_scope_version_idx
  on public.app_theme_tokens(scope_type, scope_key, theme_key, version);

create unique index if not exists app_theme_tokens_one_active_idx
  on public.app_theme_tokens(scope_type, scope_key, theme_key)
  where is_active = true and status = 'published';

drop trigger if exists app_theme_tokens_set_updated_at on public.app_theme_tokens;
create trigger app_theme_tokens_set_updated_at
before update on public.app_theme_tokens
for each row execute function public.set_updated_at();

create table if not exists public.app_runtime_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  scope_type text not null check (scope_type in ('global', 'site_mode', 'club')),
  scope_key text not null,
  release_type text not null,
  payload_hash text null,
  published_by uuid null,
  published_at timestamptz not null default now(),
  notes text null,
  payload_json jsonb not null default '{}'::jsonb
);

create index if not exists app_runtime_releases_scope_idx
  on public.app_runtime_releases(scope_type, scope_key, release_type, published_at desc);

create table if not exists public.app_runtime_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null,
  scope_type text not null check (scope_type in ('global', 'site_mode', 'club')),
  scope_key text not null,
  entity_type text not null,
  entity_key text not null,
  action text not null,
  before_json jsonb null,
  after_json jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists app_runtime_audit_log_scope_idx
  on public.app_runtime_audit_log(scope_type, scope_key, entity_type, created_at desc);

alter table public.app_runtime_configs enable row level security;
alter table public.app_template_library enable row level security;
alter table public.app_route_catalog enable row level security;
alter table public.app_template_bindings enable row level security;
alter table public.app_theme_tokens enable row level security;
alter table public.app_runtime_releases enable row level security;
alter table public.app_runtime_audit_log enable row level security;

revoke all on public.app_runtime_configs from public, anon, authenticated;
revoke all on public.app_template_library from public, anon, authenticated;
revoke all on public.app_route_catalog from public, anon, authenticated;
revoke all on public.app_template_bindings from public, anon, authenticated;
revoke all on public.app_theme_tokens from public, anon, authenticated;
revoke all on public.app_runtime_releases from public, anon, authenticated;
revoke all on public.app_runtime_audit_log from public, anon, authenticated;

drop policy if exists app_runtime_configs_deny_all on public.app_runtime_configs;
create policy app_runtime_configs_deny_all on public.app_runtime_configs for all using (false) with check (false);

drop policy if exists app_template_library_deny_all on public.app_template_library;
create policy app_template_library_deny_all on public.app_template_library for all using (false) with check (false);

drop policy if exists app_route_catalog_deny_all on public.app_route_catalog;
create policy app_route_catalog_deny_all on public.app_route_catalog for all using (false) with check (false);

drop policy if exists app_template_bindings_deny_all on public.app_template_bindings;
create policy app_template_bindings_deny_all on public.app_template_bindings for all using (false) with check (false);

drop policy if exists app_theme_tokens_deny_all on public.app_theme_tokens;
create policy app_theme_tokens_deny_all on public.app_theme_tokens for all using (false) with check (false);

drop policy if exists app_runtime_releases_deny_all on public.app_runtime_releases;
create policy app_runtime_releases_deny_all on public.app_runtime_releases for all using (false) with check (false);

drop policy if exists app_runtime_audit_log_deny_all on public.app_runtime_audit_log;
create policy app_runtime_audit_log_deny_all on public.app_runtime_audit_log for all using (false) with check (false);
