begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 0) helper note
-- additive only:
-- - creates new canonical / anchor tables
-- - does not alter or drop existing tables
-- - does not enforce legacy club_id foreign keys yet
-- - no triggers, no policies, no sync logic in this step
-- - keeps existing public.memberships view untouched; canonical table uses a new physical name
-- =========================================================


-- =========================================================
-- 1) WAVE 1 - RELATIONSHIP TRUTH
-- identity_core
-- profiles_platform
-- tenant_nodes
-- club_core
-- canonical_roles
-- canonical_memberships
-- membership_roles
-- membership_status_history
-- proxy_profiles
-- =========================================================

create table if not exists public.tenant_nodes (
  tenant_id uuid primary key default gen_random_uuid(),
  tenant_type text not null default 'club',
  tenant_key text unique,
  parent_tenant_id uuid null references public.tenant_nodes(tenant_id),
  legacy_club_id uuid null,
  club_code_snapshot text null,
  status text not null default 'active',
  source text null,
  external_ref text null,
  module_key text null default 'FCP',
  domain_key text null default 'tenant',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_tenant_nodes_parent on public.tenant_nodes(parent_tenant_id);
create index if not exists idx_tenant_nodes_legacy_club_id on public.tenant_nodes(legacy_club_id);
create index if not exists idx_tenant_nodes_status on public.tenant_nodes(status);


create table if not exists public.club_core (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenant_nodes(tenant_id),
  legacy_club_id uuid null unique,
  club_code text null unique,
  legal_name text null,
  display_name text null,
  country_code text null,
  email text null,
  phone text null,
  website_url text null,
  tax_id text null,
  vat_id text null,
  street text null,
  house_no text null,
  postal_code text null,
  city text null,
  status text not null default 'active',
  source text null,
  external_ref text null,
  module_key text null default 'FCP',
  domain_key text null default 'club',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_club_core_legacy_club_id on public.club_core(legacy_club_id);
create index if not exists idx_club_core_status on public.club_core(status);


create table if not exists public.identity_core (
  identity_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null unique references auth.users(id),
  ppuid text null unique,
  identity_type text not null default 'human',
  status text not null default 'active',
  source text null,
  external_ref text null,
  module_key text null default 'FCP',
  domain_key text null default 'identity',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_identity_core_status on public.identity_core(status);


create table if not exists public.profiles_platform (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null unique references public.identity_core(identity_id),
  display_name text null,
  first_name text null,
  last_name text null,
  birthdate date null,
  email text null,
  phone text null,
  avatar_url text null,
  locale text null,
  timezone text null,
  profile_status text not null default 'active',
  source text null,
  external_ref text null,
  module_key text null default 'FCP',
  domain_key text null default 'profile',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_profiles_platform_status on public.profiles_platform(profile_status);


create table if not exists public.proxy_profiles (
  id uuid primary key default gen_random_uuid(),
  managed_identity_id uuid not null references public.identity_core(identity_id),
  guardian_identity_id uuid not null references public.identity_core(identity_id),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  relationship_type text not null default 'guardian',
  proxy_status text not null default 'active',
  can_activate_own_account boolean not null default true,
  source text null,
  external_ref text null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint uq_proxy_profiles unique (managed_identity_id, guardian_identity_id, relationship_type)
);

create index if not exists idx_proxy_profiles_tenant_id on public.proxy_profiles(tenant_id);


create table if not exists public.canonical_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  role_label text not null,
  role_scope text not null default 'tenant',
  is_system_role boolean not null default false,
  is_active boolean not null default true,
  module_key text null default 'FCP',
  domain_key text null default 'role',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);


create table if not exists public.canonical_memberships (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.identity_core(identity_id),
  tenant_id uuid not null references public.tenant_nodes(tenant_id),
  legacy_club_id uuid null,
  membership_no text null,
  membership_type text null,
  status text not null default 'pending',
  valid_from date null,
  valid_until date null,
  joined_at timestamptz null,
  left_at timestamptz null,
  source text null,
  external_ref text null,
  module_key text null default 'FCP',
  domain_key text null default 'membership',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint uq_canonical_memberships_identity_tenant unique (identity_id, tenant_id)
);

create index if not exists idx_canonical_memberships_tenant_id on public.canonical_memberships(tenant_id);
create index if not exists idx_canonical_memberships_status on public.canonical_memberships(status);
create index if not exists idx_canonical_memberships_legacy_club_id on public.canonical_memberships(legacy_club_id);


create table if not exists public.membership_status_history (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.canonical_memberships(id) on delete cascade,
  from_status text null,
  to_status text not null,
  reason text null,
  source text null,
  external_ref text null,
  changed_at timestamptz not null default now(),
  changed_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_membership_status_history_membership_id
  on public.membership_status_history(membership_id);
create index if not exists idx_membership_status_history_changed_at
  on public.membership_status_history(changed_at desc);


create table if not exists public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.canonical_memberships(id) on delete cascade,
  role_id uuid not null references public.canonical_roles(id),
  valid_from timestamptz null,
  valid_until timestamptz null,
  status text not null default 'active',
  reason text null,
  source text null,
  external_ref text null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint uq_membership_roles unique (membership_id, role_id, valid_from)
);

create index if not exists idx_membership_roles_membership_id on public.membership_roles(membership_id);
create index if not exists idx_membership_roles_role_id on public.membership_roles(role_id);
create index if not exists idx_membership_roles_status on public.membership_roles(status);


-- =========================================================
-- 2) WAVE 2 - LEGAL + FINANCE TRUTH
-- legal_document_versions
-- legal_event_log
-- pricing_rules
-- member_claims
-- financial_documents
-- payment_events
-- payment_allocations
-- =========================================================

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null,
  document_type text not null,
  version_label text not null,
  version_no integer null,
  title text null,
  language_code text null default 'de',
  content_hash text null,
  content_snapshot text null,
  effective_from timestamptz null,
  effective_until timestamptz null,
  is_active boolean not null default true,
  source text null,
  external_ref text null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint uq_legal_document_versions unique (document_key, version_label)
);

create index if not exists idx_legal_document_versions_document_key
  on public.legal_document_versions(document_key);


create table if not exists public.legal_event_log (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid null references public.identity_core(identity_id),
  membership_id uuid null references public.canonical_memberships(id),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  document_version_id uuid not null references public.legal_document_versions(id),
  legal_event_type text not null,
  channel text not null,
  accepted_at timestamptz not null default now(),
  actor_id uuid null references auth.users(id),
  ip_address inet null,
  user_agent text null,
  source text null,
  external_ref text null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_legal_event_log_identity_id on public.legal_event_log(identity_id);
create index if not exists idx_legal_event_log_membership_id on public.legal_event_log(membership_id);
create index if not exists idx_legal_event_log_tenant_id on public.legal_event_log(tenant_id);
create index if not exists idx_legal_event_log_document_version_id on public.legal_event_log(document_version_id);


create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique,
  parent_category_id uuid null references public.product_categories(id),
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);


create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  category_id uuid null references public.product_categories(id),
  product_type text not null,
  brand text null,
  model text null,
  title text not null,
  description text null,
  unit_key text null,
  is_active boolean not null default true,
  source text null,
  external_ref text null,
  module_key text null default 'FCP',
  domain_key text null default 'product',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);


create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  product_id uuid not null references public.product_catalog(id),
  rule_key text null,
  member_group_key text null,
  price_type text not null default 'standard',
  currency text not null default 'EUR',
  amount_gross numeric(12,2) not null,
  amount_net numeric(12,2) null,
  tax_rate numeric(6,3) null,
  valid_from timestamptz null,
  valid_until timestamptz null,
  status text not null default 'active',
  source text null,
  external_ref text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_pricing_rules_tenant_id on public.pricing_rules(tenant_id);
create index if not exists idx_pricing_rules_product_id on public.pricing_rules(product_id);
create index if not exists idx_pricing_rules_valid_from_until on public.pricing_rules(valid_from, valid_until);


create table if not exists public.member_claims (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.canonical_memberships(id),
  tenant_id uuid not null references public.tenant_nodes(tenant_id),
  pricing_rule_id uuid null references public.pricing_rules(id),
  product_id uuid null references public.product_catalog(id),
  claim_key text null,
  claim_type text not null default 'charge',
  status text not null default 'open',
  due_at timestamptz null,
  booked_at timestamptz null,
  currency text not null default 'EUR',
  amount_gross numeric(12,2) not null,
  amount_net numeric(12,2) null,
  tax_rate numeric(6,3) null,
  title text null,
  reason text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  source text null,
  external_ref text null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_member_claims_membership_id on public.member_claims(membership_id);
create index if not exists idx_member_claims_tenant_id on public.member_claims(tenant_id);
create index if not exists idx_member_claims_status on public.member_claims(status);


create table if not exists public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant_nodes(tenant_id),
  membership_id uuid null references public.canonical_memberships(id),
  claim_id uuid null references public.member_claims(id),
  document_type text not null,
  document_no text null unique,
  status text not null default 'draft',
  currency text not null default 'EUR',
  amount_gross numeric(12,2) not null,
  amount_net numeric(12,2) null,
  tax_rate numeric(6,3) null,
  issued_at timestamptz null,
  due_at timestamptz null,
  paid_at timestamptz null,
  snapshot_json jsonb not null default '{}'::jsonb,
  source text null,
  external_ref text null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_financial_documents_tenant_id on public.financial_documents(tenant_id);
create index if not exists idx_financial_documents_membership_id on public.financial_documents(membership_id);
create index if not exists idx_financial_documents_claim_id on public.financial_documents(claim_id);


create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  membership_id uuid null references public.canonical_memberships(id),
  provider text not null default 'stripe',
  provider_event_id text null unique,
  provider_object_id text null,
  event_type text not null,
  payment_status text not null default 'received',
  currency text not null default 'EUR',
  amount_gross numeric(12,2) not null default 0,
  event_at timestamptz null,
  source text null,
  external_ref text null,
  payload_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_payment_events_tenant_id on public.payment_events(tenant_id);
create index if not exists idx_payment_events_membership_id on public.payment_events(membership_id);
create index if not exists idx_payment_events_provider_event_id on public.payment_events(provider_event_id);


create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_event_id uuid not null references public.payment_events(id) on delete cascade,
  claim_id uuid null references public.member_claims(id),
  financial_document_id uuid null references public.financial_documents(id),
  currency text not null default 'EUR',
  allocated_amount numeric(12,2) not null,
  allocation_type text not null default 'payment',
  source text null,
  external_ref text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  constraint ck_payment_alloc_target check (
    claim_id is not null or financial_document_id is not null
  )
);

create index if not exists idx_payment_allocations_payment_event_id
  on public.payment_allocations(payment_event_id);
create index if not exists idx_payment_allocations_claim_id
  on public.payment_allocations(claim_id);
create index if not exists idx_payment_allocations_financial_document_id
  on public.payment_allocations(financial_document_id);


-- =========================================================
-- 3) WAVE 3 - MODULE ALIGNMENT
-- permits_cards
-- trip_catch_context
-- event_core
-- participation_core
-- document_links
-- notifications_delivery
-- inventory_equipment
-- =========================================================

create table if not exists public.permit_card_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant_nodes(tenant_id),
  card_type_key text null,
  title text not null,
  card_kind text not null default 'standard',
  member_group_key text null,
  is_active boolean not null default true,
  valid_from timestamptz null,
  valid_until timestamptz null,
  source text null,
  external_ref text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint uq_permit_card_types unique (tenant_id, title)
);

create index if not exists idx_permit_card_types_tenant_id on public.permit_card_types(tenant_id);


create table if not exists public.permit_water_links (
  id uuid primary key default gen_random_uuid(),
  card_type_id uuid not null references public.permit_card_types(id) on delete cascade,
  legacy_water_body_id uuid null,
  valid_from timestamptz null,
  valid_until timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  reason text null
);

create index if not exists idx_permit_water_links_card_type_id on public.permit_water_links(card_type_id);
create index if not exists idx_permit_water_links_legacy_water_body_id on public.permit_water_links(legacy_water_body_id);


create table if not exists public.permit_assignments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.canonical_memberships(id),
  card_type_id uuid not null references public.permit_card_types(id),
  tenant_id uuid not null references public.tenant_nodes(tenant_id),
  status text not null default 'assigned',
  valid_from timestamptz null,
  valid_until timestamptz null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid null references auth.users(id),
  source text null,
  external_ref text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_permit_assignments_membership_id on public.permit_assignments(membership_id);
create index if not exists idx_permit_assignments_card_type_id on public.permit_assignments(card_type_id);
create index if not exists idx_permit_assignments_tenant_id on public.permit_assignments(tenant_id);


create table if not exists public.trip_catch_context (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  membership_id uuid null references public.canonical_memberships(id),
  identity_id uuid null references public.identity_core(identity_id),
  legacy_trip_id uuid null,
  legacy_catch_id uuid null,
  context_type text not null,
  ownership_scope text not null default 'user',
  club_snapshot_json jsonb not null default '{}'::jsonb,
  is_finalized boolean not null default false,
  finalized_at timestamptz null,
  finalized_by uuid null references auth.users(id),
  source text null,
  external_ref text null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_trip_catch_context_tenant_id on public.trip_catch_context(tenant_id);
create index if not exists idx_trip_catch_context_membership_id on public.trip_catch_context(membership_id);
create index if not exists idx_trip_catch_context_identity_id on public.trip_catch_context(identity_id);
create index if not exists idx_trip_catch_context_legacy_trip_id on public.trip_catch_context(legacy_trip_id);
create index if not exists idx_trip_catch_context_legacy_catch_id on public.trip_catch_context(legacy_catch_id);


create table if not exists public.event_core (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant_nodes(tenant_id),
  legacy_event_id uuid null,
  event_type text not null,
  title text not null,
  description text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'draft',
  location_text text null,
  source text null,
  external_ref text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_event_core_tenant_id on public.event_core(tenant_id);
create index if not exists idx_event_core_legacy_event_id on public.event_core(legacy_event_id);
create index if not exists idx_event_core_status on public.event_core(status);


create table if not exists public.participation_core (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_core(id) on delete cascade,
  membership_id uuid null references public.canonical_memberships(id),
  identity_id uuid null references public.identity_core(identity_id),
  participation_role text null,
  status text not null default 'registered',
  attended_at timestamptz null,
  checked_in_at timestamptz null,
  checked_out_at timestamptz null,
  source text null,
  external_ref text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_participation_core_event_id on public.participation_core(event_id);
create index if not exists idx_participation_core_membership_id on public.participation_core(membership_id);
create index if not exists idx_participation_core_identity_id on public.participation_core(identity_id);


create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  legacy_document_id uuid null,
  entity_type text not null,
  entity_id uuid not null,
  link_role text null,
  owner_type text null,
  owner_id uuid null,
  privacy_scope text null,
  source text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_document_links_tenant_id on public.document_links(tenant_id);
create index if not exists idx_document_links_entity on public.document_links(entity_type, entity_id);
create index if not exists idx_document_links_legacy_document_id on public.document_links(legacy_document_id);


create table if not exists public.notification_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  identity_id uuid null references public.identity_core(identity_id),
  membership_id uuid null references public.canonical_memberships(id),
  message_type text not null,
  title text null,
  body text null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  source text null,
  external_ref text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_notification_messages_tenant_id on public.notification_messages(tenant_id);
create index if not exists idx_notification_messages_identity_id on public.notification_messages(identity_id);
create index if not exists idx_notification_messages_membership_id on public.notification_messages(membership_id);


create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.identity_core(identity_id),
  preference_type text not null,
  channel text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint uq_notification_preferences unique (identity_id, preference_type, channel)
);


create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.notification_messages(id) on delete cascade,
  channel text not null,
  attempt_no integer not null default 1,
  delivery_status text not null default 'pending',
  attempted_at timestamptz not null default now(),
  response_payload jsonb not null default '{}'::jsonb,
  error_text text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_notification_delivery_attempts_message_id
  on public.notification_delivery_attempts(message_id);


create table if not exists public.item_instances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product_catalog(id),
  serial_no text null,
  title_override text null,
  condition_status text null,
  purchase_date date null,
  purchase_price numeric(12,2) null,
  currency text null default 'EUR',
  notes text null,
  source text null,
  external_ref text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_item_instances_product_id on public.item_instances(product_id);


create table if not exists public.item_ownership (
  id uuid primary key default gen_random_uuid(),
  item_instance_id uuid not null references public.item_instances(id) on delete cascade,
  owner_type text not null,
  owner_identity_id uuid null references public.identity_core(identity_id),
  owner_tenant_id uuid null references public.tenant_nodes(tenant_id),
  valid_from timestamptz null,
  valid_until timestamptz null,
  status text not null default 'active',
  transfer_reason text null,
  source text null,
  external_ref text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  constraint ck_item_ownership_owner check (
    owner_identity_id is not null or owner_tenant_id is not null
  )
);

create index if not exists idx_item_ownership_item_instance_id on public.item_ownership(item_instance_id);
create index if not exists idx_item_ownership_owner_identity_id on public.item_ownership(owner_identity_id);
create index if not exists idx_item_ownership_owner_tenant_id on public.item_ownership(owner_tenant_id);


create table if not exists public.gear_setups (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid null references public.identity_core(identity_id),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  title text not null,
  setup_scope text not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_gear_setups_identity_id on public.gear_setups(identity_id);
create index if not exists idx_gear_setups_tenant_id on public.gear_setups(tenant_id);


create table if not exists public.gear_setup_items (
  id uuid primary key default gen_random_uuid(),
  setup_id uuid not null references public.gear_setups(id) on delete cascade,
  item_instance_id uuid not null references public.item_instances(id),
  slot_key text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  constraint uq_gear_setup_items unique (setup_id, item_instance_id)
);

create index if not exists idx_gear_setup_items_setup_id on public.gear_setup_items(setup_id);
create index if not exists idx_gear_setup_items_item_instance_id on public.gear_setup_items(item_instance_id);


create table if not exists public.gear_usage (
  id uuid primary key default gen_random_uuid(),
  setup_id uuid not null references public.gear_setups(id),
  legacy_trip_id uuid null,
  legacy_catch_id uuid null,
  usage_type text not null,
  used_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_gear_usage_setup_id on public.gear_usage(setup_id);
create index if not exists idx_gear_usage_legacy_trip_id on public.gear_usage(legacy_trip_id);
create index if not exists idx_gear_usage_legacy_catch_id on public.gear_usage(legacy_catch_id);


-- =========================================================
-- 4) optional generic audit/event anchor
-- helpful cross-cutting anchor without touching existing logic
-- =========================================================

create table if not exists public.audit_event_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenant_nodes(tenant_id),
  actor_id uuid null references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  source text null,
  before_json jsonb null,
  after_json jsonb null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_event_log_tenant_id on public.audit_event_log(tenant_id);
create index if not exists idx_audit_event_log_entity on public.audit_event_log(entity_type, entity_id);
create index if not exists idx_audit_event_log_created_at on public.audit_event_log(created_at desc);


commit;
