-- VDAN/FCP - Legal acceptance gate (Terms + Privacy)
-- Date: 2026-03-10
-- Goal:
--   - Persist per-user acceptance of current legal versions
--   - Enforce portal gate via RPC-readable acceptance state

begin;

create table if not exists public.user_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_key text not null check (policy_key in ('terms', 'privacy')),
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, policy_key, policy_version)
);

create index if not exists idx_user_policy_acceptances_user_id
  on public.user_policy_acceptances(user_id);

insert into public.app_secure_settings(setting_key, setting_value)
values
  ('terms_version', '2026-03-10'),
  ('privacy_version', '2026-03-10')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

drop function if exists public.legal_acceptance_state();

create or replace function public.legal_acceptance_state()
returns table(
  terms_version text,
  privacy_version text,
  terms_accepted boolean,
  privacy_accepted boolean,
  needs_acceptance boolean
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_terms_version text := '2026-03-10';
  v_privacy_version text := '2026-03-10';
  v_terms_accepted boolean := false;
  v_privacy_accepted boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(s.setting_value, '2026-03-10') into v_terms_version
  from public.app_secure_settings s
  where s.setting_key = 'terms_version'
  limit 1;

  select coalesce(s.setting_value, '2026-03-10') into v_privacy_version
  from public.app_secure_settings s
  where s.setting_key = 'privacy_version'
  limit 1;

  select exists(
    select 1
    from public.user_policy_acceptances a
    where a.user_id = v_uid
      and a.policy_key = 'terms'
      and a.policy_version = v_terms_version
  ) into v_terms_accepted;

  select exists(
    select 1
    from public.user_policy_acceptances a
    where a.user_id = v_uid
      and a.policy_key = 'privacy'
      and a.policy_version = v_privacy_version
  ) into v_privacy_accepted;

  terms_version := v_terms_version;
  privacy_version := v_privacy_version;
  terms_accepted := v_terms_accepted;
  privacy_accepted := v_privacy_accepted;
  needs_acceptance := not (v_terms_accepted and v_privacy_accepted);
  return next;
end;
$$;

grant execute on function public.legal_acceptance_state() to authenticated;

drop function if exists public.accept_current_legal(boolean, boolean, text);

create or replace function public.accept_current_legal(
  p_terms boolean default false,
  p_privacy boolean default false,
  p_user_agent text default null
)
returns table(
  ok boolean,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_terms_version text := '2026-03-10';
  v_privacy_version text := '2026-03-10';
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(p_terms, false) or not coalesce(p_privacy, false) then
    raise exception 'Both terms and privacy must be accepted';
  end if;

  select coalesce(s.setting_value, '2026-03-10') into v_terms_version
  from public.app_secure_settings s
  where s.setting_key = 'terms_version'
  limit 1;

  select coalesce(s.setting_value, '2026-03-10') into v_privacy_version
  from public.app_secure_settings s
  where s.setting_key = 'privacy_version'
  limit 1;

  insert into public.user_policy_acceptances(user_id, policy_key, policy_version, accepted_at, user_agent)
  values (v_uid, 'terms', v_terms_version, v_now, nullif(trim(coalesce(p_user_agent, '')), ''))
  on conflict (user_id, policy_key, policy_version) do nothing;

  insert into public.user_policy_acceptances(user_id, policy_key, policy_version, accepted_at, user_agent)
  values (v_uid, 'privacy', v_privacy_version, v_now, nullif(trim(coalesce(p_user_agent, '')), ''))
  on conflict (user_id, policy_key, policy_version) do nothing;

  ok := true;
  accepted_at := v_now;
  return next;
end;
$$;

grant execute on function public.accept_current_legal(boolean, boolean, text) to authenticated;

commit;
