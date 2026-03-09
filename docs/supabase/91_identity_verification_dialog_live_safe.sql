-- VDAN/FCP - Identity verification dialog (preview + force) - live safe
-- Date: 2026-03-09
-- Goal:
--   - Preview the verification dialog before forcing it
--   - Force selected users to verify profile + auth email status before portal access
--
-- Defaults are non-disruptive:
--   identity_dialog_enabled=false
--   identity_dialog_force=false

begin;

-- ------------------------------------------------------------------
-- 1) Profile flags (idempotent)
-- ------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists must_verify_identity boolean not null default false,
  add column if not exists identity_verified_at timestamptz;

create index if not exists idx_profiles_must_verify_identity
  on public.profiles(must_verify_identity)
  where must_verify_identity = true;

-- ------------------------------------------------------------------
-- 2) Runtime switches in app_secure_settings
-- ------------------------------------------------------------------
insert into public.app_secure_settings(setting_key, setting_value)
values
  ('identity_dialog_enabled', 'false'),
  ('identity_dialog_force', 'false'),
  ('identity_dialog_preview_user_ids', '')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

-- ------------------------------------------------------------------
-- 3) Read-only gate state RPC for authenticated users
-- ------------------------------------------------------------------
drop function if exists public.identity_dialog_gate_state();

create or replace function public.identity_dialog_gate_state()
returns table(
  dialog_enabled boolean,
  force_enabled boolean,
  preview_enabled boolean,
  must_verify_identity boolean,
  member_no text,
  club_code text,
  first_name text,
  last_name text,
  profile_email text,
  access_name text
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_dialog_raw text := 'false';
  v_force_raw text := 'false';
  v_preview_ids_raw text := '';
  v_member_no text := '';
  v_club_code text := '';
  v_first_name text := '';
  v_last_name text := '';
  v_profile_email text := '';
  v_must_verify boolean := false;
  v_access_name text := '';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(s.setting_value, 'false') into v_dialog_raw
  from public.app_secure_settings s
  where s.setting_key = 'identity_dialog_enabled'
  limit 1;

  select coalesce(s.setting_value, 'false') into v_force_raw
  from public.app_secure_settings s
  where s.setting_key = 'identity_dialog_force'
  limit 1;

  select coalesce(s.setting_value, '') into v_preview_ids_raw
  from public.app_secure_settings s
  where s.setting_key = 'identity_dialog_preview_user_ids'
  limit 1;

  select
    coalesce(nullif(trim(p.member_no), ''), ''),
    coalesce(nullif(trim(cm.club_code), ''), ''),
    coalesce(nullif(trim(p.first_name), ''), ''),
    coalesce(nullif(trim(p.last_name), ''), ''),
    coalesce(nullif(trim(p.email), ''), ''),
    coalesce(p.must_verify_identity, false)
  into
    v_member_no,
    v_club_code,
    v_first_name,
    v_last_name,
    v_profile_email,
    v_must_verify
  from public.profiles p
  left join public.club_members cm
    on cm.member_no = p.member_no
   and (p.club_id is null or cm.club_id = p.club_id)
  where p.id = v_uid
  limit 1;

  if v_club_code <> '' and v_member_no <> '' then
    v_access_name := upper(v_club_code) || upper(v_member_no);
  else
    v_access_name := upper(v_member_no);
  end if;

  dialog_enabled := lower(trim(v_dialog_raw)) in ('1', 'true', 'yes', 'on');
  force_enabled := lower(trim(v_force_raw)) in ('1', 'true', 'yes', 'on');

  preview_enabled := false;
  if nullif(trim(v_preview_ids_raw), '') is not null then
    preview_enabled := (v_uid::text = any(regexp_split_to_array(replace(v_preview_ids_raw, ' ', ''), ',')));
  end if;

  must_verify_identity := v_must_verify;
  member_no := v_member_no;
  club_code := v_club_code;
  first_name := v_first_name;
  last_name := v_last_name;
  profile_email := v_profile_email;
  access_name := v_access_name;

  return next;
end;
$$;

grant execute on function public.identity_dialog_gate_state() to authenticated;

-- ------------------------------------------------------------------
-- 4) Complete verification RPC (email-confirmed check is done in app)
-- ------------------------------------------------------------------
drop function if exists public.self_identity_verification_complete(boolean);

create or replace function public.self_identity_verification_complete(
  p_confirmed boolean default false
)
returns table(
  ok boolean,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_verified_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(p_confirmed, false) then
    raise exception 'Confirmation required';
  end if;

  update public.profiles p
     set must_verify_identity = false,
         identity_verified_at = now(),
         updated_at = now()
   where p.id = v_uid
   returning p.identity_verified_at
    into v_verified_at;

  ok := v_verified_at is not null;
  verified_at := v_verified_at;
  return next;
end;
$$;

grant execute on function public.self_identity_verification_complete(boolean) to authenticated;

commit;
