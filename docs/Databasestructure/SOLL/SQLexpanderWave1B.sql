begin;

-- =========================================================
-- SCRIPT B / WAVE 1
-- additive extension of existing tables
-- no drops
-- no hard not-null migrations
-- no triggers
-- no sync logic
-- =========================================================


-- =========================================================
-- 1) profiles
-- existing profile table gets canonical links
-- =========================================================
alter table public.profiles
  add column if not exists identity_id uuid null references public.identity_core(identity_id),
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists version integer not null default 1;

create index if not exists idx_profiles_identity_id on public.profiles(identity_id);
create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);
create index if not exists idx_profiles_canonical_membership_id on public.profiles(canonical_membership_id);


-- =========================================================
-- 2) club_members
-- old member representation gets canonical bridge hooks
-- =========================================================
alter table public.club_members
  add column if not exists identity_id uuid null references public.identity_core(identity_id),
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists status_changed_at timestamptz null,
  add column if not exists status_changed_by uuid null references auth.users(id),
  add column if not exists version integer not null default 1;

create index if not exists idx_club_members_identity_id on public.club_members(identity_id);
create index if not exists idx_club_members_tenant_id on public.club_members(tenant_id);
create index if not exists idx_club_members_canonical_membership_id on public.club_members(canonical_membership_id);


-- =========================================================
-- 3) club_member_identities
-- critical old relation table gets canonical hooks
-- =========================================================
alter table public.club_member_identities
  add column if not exists identity_id uuid null references public.identity_core(identity_id),
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists version integer not null default 1;

create index if not exists idx_club_member_identities_identity_id
  on public.club_member_identities(identity_id);
create index if not exists idx_club_member_identities_tenant_id
  on public.club_member_identities(tenant_id);
create index if not exists idx_club_member_identities_canonical_membership_id
  on public.club_member_identities(canonical_membership_id);


-- =========================================================
-- 4) club_user_roles
-- old direct user->club role mapping gets canonical membership hook
-- =========================================================
alter table public.club_user_roles
  add column if not exists identity_id uuid null references public.identity_core(identity_id),
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists valid_from timestamptz null,
  add column if not exists valid_until timestamptz null,
  add column if not exists version integer not null default 1;

create index if not exists idx_club_user_roles_identity_id on public.club_user_roles(identity_id);
create index if not exists idx_club_user_roles_tenant_id on public.club_user_roles(tenant_id);
create index if not exists idx_club_user_roles_canonical_membership_id
  on public.club_user_roles(canonical_membership_id);


-- =========================================================
-- 5) user_roles
-- if used as raw-user role path, prepare canonical identity hook
-- =========================================================
alter table public.user_roles
  add column if not exists identity_id uuid null references public.identity_core(identity_id),
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists valid_from timestamptz null,
  add column if not exists valid_until timestamptz null,
  add column if not exists version integer not null default 1;

create index if not exists idx_user_roles_identity_id on public.user_roles(identity_id);
create index if not exists idx_user_roles_tenant_id on public.user_roles(tenant_id);
create index if not exists idx_user_roles_canonical_membership_id
  on public.user_roles(canonical_membership_id);


-- =========================================================
-- 6) catch_entries
-- critical dual-context domain: user-owned + club context
-- =========================================================
alter table public.catch_entries
  add column if not exists identity_id uuid null references public.identity_core(identity_id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists trip_catch_context_id uuid null references public.trip_catch_context(id),
  add column if not exists owner_scope text null,
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists status_changed_at timestamptz null,
  add column if not exists status_changed_by uuid null references auth.users(id),
  add column if not exists version integer not null default 1;

create index if not exists idx_catch_entries_identity_id on public.catch_entries(identity_id);
create index if not exists idx_catch_entries_canonical_membership_id
  on public.catch_entries(canonical_membership_id);
create index if not exists idx_catch_entries_tenant_id on public.catch_entries(tenant_id);
create index if not exists idx_catch_entries_trip_catch_context_id
  on public.catch_entries(trip_catch_context_id);


-- =========================================================
-- 7) fishing_trips
-- trip also needs dual-context canonical hooks
-- =========================================================
alter table public.fishing_trips
  add column if not exists identity_id uuid null references public.identity_core(identity_id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists trip_catch_context_id uuid null references public.trip_catch_context(id),
  add column if not exists owner_scope text null,
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists status_changed_at timestamptz null,
  add column if not exists status_changed_by uuid null references auth.users(id),
  add column if not exists version integer not null default 1;

create index if not exists idx_fishing_trips_identity_id on public.fishing_trips(identity_id);
create index if not exists idx_fishing_trips_canonical_membership_id
  on public.fishing_trips(canonical_membership_id);
create index if not exists idx_fishing_trips_tenant_id on public.fishing_trips(tenant_id);
create index if not exists idx_fishing_trips_trip_catch_context_id
  on public.fishing_trips(trip_catch_context_id);


-- =========================================================
-- 8) club_billing_subscriptions
-- old provider-oriented billing gets canonical tenant hooks
-- =========================================================
alter table public.club_billing_subscriptions
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists club_core_id uuid null references public.club_core(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists version integer not null default 1;

create index if not exists idx_club_billing_subscriptions_tenant_id
  on public.club_billing_subscriptions(tenant_id);
create index if not exists idx_club_billing_subscriptions_club_core_id
  on public.club_billing_subscriptions(club_core_id);


-- =========================================================
-- 9) club_billing_webhook_events
-- old webhook storage gets canonical tenant hooks
-- =========================================================
alter table public.club_billing_webhook_events
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists club_core_id uuid null references public.club_core(id),
  add column if not exists canonical_membership_id uuid null references public.canonical_memberships(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists version integer not null default 1;

create index if not exists idx_club_billing_webhook_events_tenant_id
  on public.club_billing_webhook_events(tenant_id);
create index if not exists idx_club_billing_webhook_events_club_core_id
  on public.club_billing_webhook_events(club_core_id);
create index if not exists idx_club_billing_webhook_events_canonical_membership_id
  on public.club_billing_webhook_events(canonical_membership_id);


-- =========================================================
-- 10) club_events
-- old event table gets canonical tenant/event bridge hooks
-- =========================================================
alter table public.club_events
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists event_core_id uuid null references public.event_core(id),
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists status_changed_at timestamptz null,
  add column if not exists status_changed_by uuid null references auth.users(id),
  add column if not exists version integer not null default 1;

create index if not exists idx_club_events_tenant_id on public.club_events(tenant_id);
create index if not exists idx_club_events_event_core_id on public.club_events(event_core_id);


-- =========================================================
-- 11) documents
-- old document table gets canonical tenant/document bridge hooks
-- =========================================================
alter table public.documents
  add column if not exists tenant_id uuid null references public.tenant_nodes(tenant_id),
  add column if not exists document_link_id uuid null references public.document_links(id),
  add column if not exists owner_type text null,
  add column if not exists owner_id uuid null,
  add column if not exists privacy_scope text null,
  add column if not exists source text null,
  add column if not exists external_ref text null,
  add column if not exists version integer not null default 1;

create index if not exists idx_documents_tenant_id on public.documents(tenant_id);
create index if not exists idx_documents_document_link_id on public.documents(document_link_id);


commit;