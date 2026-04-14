begin;
create table if not exists public.club_onboarding_state (
  club_id uuid primary key,
  setup_state text not null default 'pending_setup'
    check (setup_state in ('pending_setup', 'pending_payment', 'complete')),
  billing_state text not null default 'none'
    check (billing_state in ('none', 'checkout_open', 'active', 'past_due', 'canceled', 'suspended')),
  portal_state text not null default 'draft'
    check (portal_state in ('draft', 'active', 'suspended')),
  club_data_complete boolean not null default false,
  waters_complete boolean not null default false,
  cards_complete boolean not null default false,
  members_mode text not null default 'pending'
    check (members_mode in ('pending', 'imported', 'confirmed_empty')),
  setup_completed_at timestamptz,
  billing_activated_at timestamptz,
  suspended_at timestamptz,
  notes jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.club_onboarding_audit (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  event_key text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (event_key ~ '^[a-z0-9_\\.:-]{3,80}$')
);
create index if not exists idx_club_onboarding_audit_club_created
  on public.club_onboarding_audit (club_id, created_at desc);
create table if not exists public.club_billing_subscriptions (
  club_id uuid primary key,
  provider text not null default 'stripe'
    check (provider in ('stripe')),
  billing_state text not null default 'none'
    check (billing_state in ('none', 'checkout_open', 'active', 'past_due', 'canceled', 'suspended')),
  checkout_state text not null default 'none'
    check (checkout_state in ('none', 'open', 'completed', 'expired', 'abandoned')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  last_event_id text,
  last_event_type text,
  current_period_end timestamptz,
  canceled_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, stripe_subscription_id),
  unique (provider, stripe_checkout_session_id)
);
create index if not exists idx_club_billing_subscriptions_state
  on public.club_billing_subscriptions (billing_state, updated_at desc);
create table if not exists public.club_billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe'
    check (provider in ('stripe')),
  event_id text not null,
  event_type text not null,
  club_id uuid,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique (provider, event_id)
);
create index if not exists idx_club_billing_webhook_events_club
  on public.club_billing_webhook_events (club_id, processed_at desc);
drop trigger if exists trg_club_onboarding_state_updated_at on public.club_onboarding_state;
create trigger trg_club_onboarding_state_updated_at
before update on public.club_onboarding_state
for each row execute function public.tg_set_updated_at();
drop trigger if exists trg_club_billing_subscriptions_updated_at on public.club_billing_subscriptions;
create trigger trg_club_billing_subscriptions_updated_at
before update on public.club_billing_subscriptions
for each row execute function public.tg_set_updated_at();
alter table public.club_onboarding_state enable row level security;
alter table public.club_onboarding_audit enable row level security;
alter table public.club_billing_subscriptions enable row level security;
alter table public.club_billing_webhook_events enable row level security;
drop policy if exists "club_onboarding_state_select_manager_same_club" on public.club_onboarding_state;
create policy "club_onboarding_state_select_manager_same_club"
on public.club_onboarding_state
for select
to authenticated
using (
  public.is_admin_or_vorstand_in_club(club_id)
  or public.is_admin_in_any_club()
);
drop policy if exists "club_onboarding_state_manage_manager_same_club" on public.club_onboarding_state;
create policy "club_onboarding_state_manage_manager_same_club"
on public.club_onboarding_state
for all
to authenticated
using (
  public.is_admin_or_vorstand_in_club(club_id)
  or public.is_admin_in_any_club()
)
with check (
  public.is_admin_or_vorstand_in_club(club_id)
  or public.is_admin_in_any_club()
);
drop policy if exists "club_onboarding_audit_select_manager_same_club" on public.club_onboarding_audit;
create policy "club_onboarding_audit_select_manager_same_club"
on public.club_onboarding_audit
for select
to authenticated
using (
  public.is_admin_or_vorstand_in_club(club_id)
  or public.is_admin_in_any_club()
);
drop policy if exists "club_onboarding_audit_insert_manager_same_club" on public.club_onboarding_audit;
create policy "club_onboarding_audit_insert_manager_same_club"
on public.club_onboarding_audit
for insert
to authenticated
with check (
  public.is_admin_or_vorstand_in_club(club_id)
  or public.is_admin_in_any_club()
);
drop policy if exists "club_billing_subscriptions_select_manager_same_club" on public.club_billing_subscriptions;
create policy "club_billing_subscriptions_select_manager_same_club"
on public.club_billing_subscriptions
for select
to authenticated
using (
  public.is_admin_or_vorstand_in_club(club_id)
  or public.is_admin_in_any_club()
);
drop policy if exists "club_billing_subscriptions_admin_any_club_all" on public.club_billing_subscriptions;
create policy "club_billing_subscriptions_admin_any_club_all"
on public.club_billing_subscriptions
for all
to authenticated
using (public.is_admin_in_any_club())
with check (public.is_admin_in_any_club());
drop policy if exists "club_billing_webhook_events_select_manager_same_club" on public.club_billing_webhook_events;
create policy "club_billing_webhook_events_select_manager_same_club"
on public.club_billing_webhook_events
for select
to authenticated
using (
  (club_id is not null and public.is_admin_or_vorstand_in_club(club_id))
  or public.is_admin_in_any_club()
);
drop policy if exists "club_billing_webhook_events_admin_any_club_all" on public.club_billing_webhook_events;
create policy "club_billing_webhook_events_admin_any_club_all"
on public.club_billing_webhook_events
for all
to authenticated
using (public.is_admin_in_any_club())
with check (public.is_admin_in_any_club());
create or replace function public.is_service_role_request()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
$$;
create or replace function public.ensure_club_onboarding_state(p_club_id uuid)
returns public.club_onboarding_state
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.club_onboarding_state;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (public.is_service_role_request() or public.is_admin_or_vorstand_in_club(p_club_id) or public.is_admin_in_any_club()) then
    raise exception 'forbidden_club_scope';
  end if;

  insert into public.club_onboarding_state (club_id, created_by, updated_by)
  values (p_club_id, auth.uid(), auth.uid())
  on conflict (club_id) do nothing;

  select *
    into v_row
  from public.club_onboarding_state
  where club_id = p_club_id
  limit 1;

  return v_row;
end;
$$;
create or replace function public.club_onboarding_requirements(p_club_id uuid)
returns table(
  club_id uuid,
  club_name text,
  club_code text,
  has_club_name boolean,
  has_club_code boolean,
  has_core_roles boolean,
  has_module_usecases boolean,
  has_water_bodies boolean,
  has_default_card boolean,
  member_directory_count bigint,
  member_identity_count bigint,
  manager_count bigint
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with base as (
    select p_club_id as club_id
  ),
  club_name_src as (
    select nullif(trim(s.setting_value), '') as club_name
    from public.app_secure_settings s
    where s.setting_key = 'club_name:' || p_club_id::text
    limit 1
  ),
  club_code_src as (
    select nullif(trim(replace(s.setting_key, 'club_code_map:', '')), '') as club_code
    from public.app_secure_settings s
    where s.setting_key like 'club_code_map:%'
      and s.setting_value = p_club_id::text
    limit 1
  ),
  card_src as (
    select nullif(trim(s.setting_value), '') as cards_raw
    from public.app_secure_settings s
    where s.setting_key = 'club_cards:' || p_club_id::text
    limit 1
  ),
  role_src as (
    select count(*) filter (where role_key in ('member', 'vorstand', 'admin') and is_core = true) as core_role_count
    from public.club_roles
    where club_id = p_club_id
  ),
  module_src as (
    select count(*) filter (where is_enabled = true) as enabled_usecase_count
    from public.club_module_usecases
    where club_id = p_club_id
  ),
  water_src as (
    select count(*) filter (where coalesce(is_active, true)) as water_count
    from public.water_bodies
    where club_id = p_club_id
  ),
  member_src as (
    select count(*) as member_count
    from public.club_members
    where club_id = p_club_id
  ),
  identity_src as (
    select count(*) as identity_count
    from public.club_member_identities
    where club_id = p_club_id
  ),
  manager_src as (
    select count(*) filter (where role_key in ('admin', 'vorstand')) as manager_count
    from public.club_user_roles
    where club_id = p_club_id
  )
  select
    b.club_id,
    cns.club_name,
    ccs.club_code,
    (cns.club_name is not null) as has_club_name,
    (ccs.club_code is not null) as has_club_code,
    (coalesce(rs.core_role_count, 0) >= 3) as has_core_roles,
    (coalesce(ms.enabled_usecase_count, 0) > 0) as has_module_usecases,
    (coalesce(ws.water_count, 0) > 0) as has_water_bodies,
    (
      cds.cards_raw is not null
      and cds.cards_raw <> '[]'
      and cds.cards_raw <> '{}'
    ) as has_default_card,
    coalesce(mes.member_count, 0) as member_directory_count,
    coalesce(ids.identity_count, 0) as member_identity_count,
    coalesce(mgs.manager_count, 0) as manager_count
  from base b
  left join club_name_src cns on true
  left join club_code_src ccs on true
  left join card_src cds on true
  left join role_src rs on true
  left join module_src ms on true
  left join water_src ws on true
  left join member_src mes on true
  left join identity_src ids on true
  left join manager_src mgs on true;
$$;
create or replace function public.club_onboarding_snapshot(p_club_id uuid)
returns table(
  club_id uuid,
  setup_state text,
  billing_state text,
  portal_state text,
  club_data_complete boolean,
  waters_complete boolean,
  cards_complete boolean,
  members_mode text,
  has_club_name boolean,
  has_club_code boolean,
  has_core_roles boolean,
  has_module_usecases boolean,
  has_water_bodies boolean,
  has_default_card boolean,
  member_directory_count bigint,
  member_identity_count bigint,
  manager_count bigint,
  setup_ready boolean
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with state_src as (
    select *
    from public.club_onboarding_state
    where club_id = p_club_id
  ),
  req as (
    select *
    from public.club_onboarding_requirements(p_club_id)
  )
  select
    p_club_id as club_id,
    coalesce(ss.setup_state, 'pending_setup') as setup_state,
    coalesce(ss.billing_state, 'none') as billing_state,
    coalesce(ss.portal_state, 'draft') as portal_state,
    coalesce(ss.club_data_complete, false) as club_data_complete,
    coalesce(ss.waters_complete, false) as waters_complete,
    coalesce(ss.cards_complete, false) as cards_complete,
    coalesce(ss.members_mode, 'pending') as members_mode,
    coalesce(req.has_club_name, false) as has_club_name,
    coalesce(req.has_club_code, false) as has_club_code,
    coalesce(req.has_core_roles, false) as has_core_roles,
    coalesce(req.has_module_usecases, false) as has_module_usecases,
    coalesce(req.has_water_bodies, false) as has_water_bodies,
    coalesce(req.has_default_card, false) as has_default_card,
    coalesce(req.member_directory_count, 0) as member_directory_count,
    coalesce(req.member_identity_count, 0) as member_identity_count,
    coalesce(req.manager_count, 0) as manager_count,
    (
      coalesce(ss.club_data_complete, false)
      and coalesce(ss.waters_complete, false)
      and coalesce(ss.cards_complete, false)
      and coalesce(ss.members_mode, 'pending') in ('imported', 'confirmed_empty')
      and coalesce(req.has_club_name, false)
      and coalesce(req.has_club_code, false)
      and coalesce(req.has_core_roles, false)
      and coalesce(req.has_module_usecases, false)
      and coalesce(req.has_water_bodies, false)
      and coalesce(req.has_default_card, false)
      and (
        coalesce(req.member_directory_count, 0) > 0
        or coalesce(ss.members_mode, 'pending') = 'confirmed_empty'
      )
    ) as setup_ready
  from req
  left join state_src ss on true;
$$;
create or replace function public.upsert_club_onboarding_progress(
  p_club_id uuid,
  p_club_data_complete boolean default null,
  p_waters_complete boolean default null,
  p_cards_complete boolean default null,
  p_members_mode text default null,
  p_notes jsonb default null
)
returns public.club_onboarding_state
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_existing public.club_onboarding_state;
  v_snapshot record;
  v_row public.club_onboarding_state;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (public.is_service_role_request() or public.is_admin_or_vorstand_in_club(p_club_id) or public.is_admin_in_any_club()) then
    raise exception 'forbidden_club_scope';
  end if;

  if p_members_mode is not null and p_members_mode not in ('pending', 'imported', 'confirmed_empty') then
    raise exception 'members_mode_invalid';
  end if;

  insert into public.club_onboarding_state (club_id, created_by, updated_by)
  values (p_club_id, auth.uid(), auth.uid())
  on conflict (club_id) do nothing;

  select *
    into v_existing
  from public.club_onboarding_state
  where club_id = p_club_id
  limit 1;

  update public.club_onboarding_state
     set club_data_complete = coalesce(p_club_data_complete, v_existing.club_data_complete),
         waters_complete = coalesce(p_waters_complete, v_existing.waters_complete),
         cards_complete = coalesce(p_cards_complete, v_existing.cards_complete),
         members_mode = coalesce(p_members_mode, v_existing.members_mode),
         notes = case
           when p_notes is null then v_existing.notes
           else coalesce(v_existing.notes, '{}'::jsonb) || p_notes
         end,
         updated_by = auth.uid()
   where club_id = p_club_id;

  select *
    into v_snapshot
  from public.club_onboarding_snapshot(p_club_id)
  limit 1;

  update public.club_onboarding_state
     set setup_state = case
           when coalesce(v_snapshot.setup_ready, false) then 'pending_payment'
           else 'pending_setup'
         end,
         setup_completed_at = case
           when coalesce(v_snapshot.setup_ready, false) and setup_completed_at is null then now()
           when not coalesce(v_snapshot.setup_ready, false) then null
           else setup_completed_at
         end,
         updated_by = auth.uid()
   where club_id = p_club_id;

  insert into public.club_onboarding_audit (club_id, event_key, actor_user_id, payload)
  values (
    p_club_id,
    'onboarding.progress_updated',
    auth.uid(),
    jsonb_build_object(
      'club_data_complete', p_club_data_complete,
      'waters_complete', p_waters_complete,
      'cards_complete', p_cards_complete,
      'members_mode', p_members_mode,
      'notes', p_notes
    )
  );

  select *
    into v_row
  from public.club_onboarding_state
  where club_id = p_club_id
  limit 1;

  return v_row;
end;
$$;
create or replace function public.set_club_billing_state(
  p_club_id uuid,
  p_billing_state text,
  p_checkout_state text default null,
  p_provider text default 'stripe',
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_stripe_checkout_session_id text default null,
  p_event_id text default null,
  p_event_type text default null,
  p_payload jsonb default null,
  p_current_period_end timestamptz default null,
  p_canceled_at timestamptz default null
)
returns public.club_billing_subscriptions
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.club_billing_subscriptions;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if p_billing_state not in ('none', 'checkout_open', 'active', 'past_due', 'canceled', 'suspended') then
    raise exception 'billing_state_invalid';
  end if;

  if p_checkout_state is not null and p_checkout_state not in ('none', 'open', 'completed', 'expired', 'abandoned') then
    raise exception 'checkout_state_invalid';
  end if;

  if p_provider is null or p_provider <> 'stripe' then
    raise exception 'provider_invalid';
  end if;

  if not (public.is_service_role_request() or public.is_admin_in_any_club()) then
    raise exception 'forbidden_billing_admin_only';
  end if;

  if p_event_id is not null then
    insert into public.club_billing_webhook_events (provider, event_id, event_type, club_id, payload)
    values (
      p_provider,
      p_event_id,
      coalesce(nullif(trim(p_event_type), ''), 'unknown'),
      p_club_id,
      coalesce(p_payload, '{}'::jsonb)
    )
    on conflict (provider, event_id) do nothing;
  end if;

  insert into public.club_billing_subscriptions (
    club_id,
    provider,
    billing_state,
    checkout_state,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_checkout_session_id,
    last_event_id,
    last_event_type,
    current_period_end,
    canceled_at,
    payload
  )
  values (
    p_club_id,
    p_provider,
    p_billing_state,
    coalesce(p_checkout_state, 'none'),
    nullif(trim(p_stripe_customer_id), ''),
    nullif(trim(p_stripe_subscription_id), ''),
    nullif(trim(p_stripe_checkout_session_id), ''),
    nullif(trim(p_event_id), ''),
    nullif(trim(p_event_type), ''),
    p_current_period_end,
    p_canceled_at,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (club_id) do update
     set billing_state = excluded.billing_state,
         checkout_state = coalesce(excluded.checkout_state, public.club_billing_subscriptions.checkout_state),
         stripe_customer_id = coalesce(excluded.stripe_customer_id, public.club_billing_subscriptions.stripe_customer_id),
         stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.club_billing_subscriptions.stripe_subscription_id),
         stripe_checkout_session_id = coalesce(excluded.stripe_checkout_session_id, public.club_billing_subscriptions.stripe_checkout_session_id),
         last_event_id = coalesce(excluded.last_event_id, public.club_billing_subscriptions.last_event_id),
         last_event_type = coalesce(excluded.last_event_type, public.club_billing_subscriptions.last_event_type),
         current_period_end = coalesce(excluded.current_period_end, public.club_billing_subscriptions.current_period_end),
         canceled_at = coalesce(excluded.canceled_at, public.club_billing_subscriptions.canceled_at),
         payload = case
           when excluded.payload = '{}'::jsonb then public.club_billing_subscriptions.payload
           else public.club_billing_subscriptions.payload || excluded.payload
         end;

  insert into public.club_onboarding_state (club_id, created_by, updated_by)
  values (p_club_id, v_actor, v_actor)
  on conflict (club_id) do nothing;

  update public.club_onboarding_state
     set billing_state = p_billing_state,
         portal_state = case
           when p_billing_state = 'active' then 'active'
           when p_billing_state in ('past_due', 'suspended', 'canceled') then 'suspended'
           else portal_state
         end,
         billing_activated_at = case
           when p_billing_state = 'active' and billing_activated_at is null then now()
           when p_billing_state <> 'active' then billing_activated_at
           else billing_activated_at
         end,
         suspended_at = case
           when p_billing_state in ('past_due', 'suspended', 'canceled') then now()
           else suspended_at
         end,
         updated_by = v_actor
   where club_id = p_club_id;

  insert into public.club_onboarding_audit (club_id, event_key, actor_user_id, payload)
  values (
    p_club_id,
    'billing.state_updated',
    v_actor,
    jsonb_build_object(
      'provider', p_provider,
      'billing_state', p_billing_state,
      'checkout_state', p_checkout_state,
      'event_id', p_event_id,
      'event_type', p_event_type
    )
  );

  select *
    into v_row
  from public.club_billing_subscriptions
  where club_id = p_club_id
  limit 1;

  return v_row;
end;
$$;
grant execute on function public.ensure_club_onboarding_state(uuid) to authenticated;
grant execute on function public.club_onboarding_requirements(uuid) to authenticated;
grant execute on function public.club_onboarding_snapshot(uuid) to authenticated;
grant execute on function public.upsert_club_onboarding_progress(uuid, boolean, boolean, boolean, text, jsonb) to authenticated;
grant execute on function public.set_club_billing_state(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz, timestamptz) to authenticated;
commit;
