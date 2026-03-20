begin;

insert into public.app_secure_settings (setting_key, setting_value)
values
  ('club_creation_admin_emails', 'm.lauenroth@lauemi.de')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

create or replace function public.email_in_csv_list(p_email text, p_csv text)
returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from unnest(string_to_array(coalesce(p_csv, ''), ',')) as value
    where lower(trim(value)) = lower(trim(coalesce(p_email, '')))
      and trim(value) <> ''
  );
$$;

create or replace function public.enforce_auth_signup_guard()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_mode text := lower(trim(coalesce(new.raw_user_meta_data ->> 'registration_mode', '')));
  v_email text := lower(trim(coalesce(new.email, '')));
  v_invite_token text := trim(coalesce(new.raw_user_meta_data ->> 'invite_token', ''));
  v_member_no text := upper(trim(coalesce(new.raw_user_meta_data ->> 'member_no', '')));
  v_club_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'club_code', '')));
  v_club_name text := trim(coalesce(new.raw_user_meta_data ->> 'club_name', ''));
  v_club_address text := trim(coalesce(new.raw_user_meta_data ->> 'club_address', ''));
  v_responsible_name text := trim(coalesce(new.raw_user_meta_data ->> 'responsible_name', ''));
  v_responsible_email text := lower(trim(coalesce(new.raw_user_meta_data ->> 'responsible_email', '')));
  v_club_size text := trim(coalesce(new.raw_user_meta_data ->> 'club_size', ''));
  v_allowed_create_emails text := '';
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if v_mode = 'join_club' then
    if v_invite_token = '' then
      raise exception 'signup_guard_invite_token_required';
    end if;
    if v_member_no = '' then
      raise exception 'signup_guard_member_no_required';
    end if;
    if v_club_code = '' then
      raise exception 'signup_guard_club_code_required';
    end if;
    return new;
  end if;

  if v_mode = 'create_club_pending' then
    select coalesce(s.setting_value, '')
      into v_allowed_create_emails
    from public.app_secure_settings s
    where s.setting_key = 'club_creation_admin_emails'
    limit 1;

    if not public.email_in_csv_list(v_email, v_allowed_create_emails) then
      raise exception 'signup_guard_club_create_not_allowed';
    end if;
    if v_club_name = '' then
      raise exception 'signup_guard_club_name_required';
    end if;
    if v_club_address = '' then
      raise exception 'signup_guard_club_address_required';
    end if;
    if v_responsible_name = '' then
      raise exception 'signup_guard_responsible_name_required';
    end if;
    if v_responsible_email = '' or position('@' in v_responsible_email) = 0 then
      raise exception 'signup_guard_responsible_email_required';
    end if;
    if v_club_size = '' then
      raise exception 'signup_guard_club_size_required';
    end if;
    return new;
  end if;

  raise exception 'signup_guard_registration_mode_required';
end;
$$;

drop trigger if exists trg_auth_signup_guard on auth.users;
create trigger trg_auth_signup_guard
before insert on auth.users
for each row
execute function public.enforce_auth_signup_guard();

commit;
