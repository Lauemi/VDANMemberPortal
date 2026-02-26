-- VDAN Patch — membership crypto/schema/search_path hardening
-- Run this AFTER 26_membership_applications.sql

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_secure_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secure_settings enable row level security;

revoke all on public.app_secure_settings from public, anon, authenticated;

-- Set/rotate encryption key here (replace value with your secret)
insert into public.app_secure_settings (setting_key, setting_value)
values ('membership_encryption_key', 'REPLACE_WITH_RANDOM_SECRET_MIN_16')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

create or replace function public.membership_get_encryption_key()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text;
begin
  select nullif(trim(setting_value), '')
    into v_key
  from public.app_secure_settings
  where setting_key = 'membership_encryption_key'
  limit 1;

  if v_key is null then
    v_key := nullif(trim(current_setting('app.settings.encryption_key', true)), '');
  end if;

  if v_key is null or length(v_key) < 16 then
    raise exception 'Encryption key missing. Set app_secure_settings.membership_encryption_key (min. 16 chars).';
  end if;
  return v_key;
end;
$$;

create or replace function public.submit_membership_application(
  p_first_name text,
  p_last_name text,
  p_birthdate date,
  p_street text,
  p_zip text,
  p_city text,
  p_is_local boolean,
  p_iban text,
  p_sepa_approved boolean,
  p_fishing_card_type text,
  p_known_member text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app_id uuid;
  v_key text;
  v_iban_norm text;
  v_iban_last4 text;
begin
  if coalesce(p_sepa_approved, false) is distinct from true then
    raise exception 'SEPA approval is required';
  end if;

  v_key := public.membership_get_encryption_key();
  v_iban_norm := public.membership_normalize_iban(p_iban);
  v_iban_last4 := public.membership_iban_last4(v_iban_norm);

  insert into public.membership_applications (
    first_name,
    last_name,
    birthdate,
    street,
    zip,
    city,
    is_local,
    known_member,
    fishing_card_type,
    iban_last4,
    sepa_approved,
    status
  ) values (
    trim(p_first_name),
    trim(p_last_name),
    p_birthdate,
    trim(p_street),
    trim(p_zip),
    trim(p_city),
    coalesce(p_is_local, false),
    nullif(trim(p_known_member), ''),
    trim(p_fishing_card_type),
    v_iban_last4,
    true,
    'pending'
  )
  returning id into v_app_id;

  insert into public.membership_application_bank_data (application_id, iban_encrypted)
  values (
    v_app_id,
    extensions.pgp_sym_encrypt(v_iban_norm, v_key, 'cipher-algo=aes256')
  );

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app_id,
    'submitted',
    auth.uid(),
    jsonb_build_object('is_local', coalesce(p_is_local, false), 'fishing_card_type', trim(p_fishing_card_type))
  );

  return v_app_id;
end;
$$;

alter function public.membership_set_internal_questionnaire(uuid, jsonb)
  set search_path = pg_catalog, public;

alter function public.approve_membership(uuid, text)
  set search_path = pg_catalog, public;

alter function public.reject_membership(uuid, text)
  set search_path = pg_catalog, public;

revoke execute on function public.membership_get_encryption_key() from public, anon, authenticated;
revoke execute on function public.membership_normalize_iban(text) from public, anon, authenticated;
revoke execute on function public.membership_iban_last4(text) from public, anon, authenticated;
revoke execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) from public;
revoke execute on function public.membership_set_internal_questionnaire(uuid, jsonb) from public, anon;
revoke execute on function public.approve_membership(uuid, text) from public, anon;
revoke execute on function public.reject_membership(uuid, text) from public, anon;

grant execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) to anon, authenticated;
grant execute on function public.membership_set_internal_questionnaire(uuid, jsonb) to authenticated;
grant execute on function public.approve_membership(uuid, text) to authenticated;
grant execute on function public.reject_membership(uuid, text) to authenticated;

commit;
