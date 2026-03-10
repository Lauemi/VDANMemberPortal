-- VDAN/FCP - Identity dialog club resolution fix (deterministic)
-- Date: 2026-03-09
-- Goal:
--   - Remove non-deterministic club lookup via member_no-only joins
--   - Resolve club_code only within the active profile club context (profiles.club_id)

begin;

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

  -- Deterministic club resolution:
  -- club_code is only resolved from the profile's active club_id context.
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
    on cm.club_id = p.club_id
   and cm.member_no = p.member_no
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

commit;

