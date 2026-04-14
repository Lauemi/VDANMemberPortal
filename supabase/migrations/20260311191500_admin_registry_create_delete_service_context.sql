begin;
-- Allow SQL-editor/service-context execution while keeping app-level admin gate.
-- App traffic (authenticated role) still requires public.is_admin().

drop function if exists public.admin_member_registry_create(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date
);
create or replace function public.admin_member_registry_create(
  p_club_id uuid,
  p_club_code text,
  p_member_no text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_status text default 'active',
  p_fishing_card_type text default '-',
  p_street text default null,
  p_zip text default null,
  p_city text default null,
  p_phone text default null,
  p_mobile text default null,
  p_guardian_member_no text default null,
  p_sepa_approved boolean default true,
  p_iban text default null,
  p_birthdate date default null
)
returns table(member_no text)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_club_code text;
  v_member_no text;
  v_max_suffix integer;
  v_member_id uuid;
  v_status text;
  v_first_name text;
  v_last_name text;
  v_birthdate date;
  v_street text;
  v_zip text;
  v_city text;
  v_sepa boolean;
  v_iban_norm text;
  v_iban_last4 text;
  v_key text;
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'Only admin can create member registry rows';
  end if;

  if p_club_id is null then
    raise exception 'club_id is required';
  end if;

  v_club_code := upper(trim(coalesce(p_club_code, '')));
  if v_club_code = '' or v_club_code !~ '^[A-Z]{2}[0-9]{2}$' then
    raise exception 'club_code must match format AA00';
  end if;

  v_first_name := coalesce(nullif(trim(p_first_name), ''), 'Vorname');
  v_last_name := coalesce(nullif(trim(p_last_name), ''), 'Nachname');
  v_status := case
    when lower(trim(coalesce(p_status, 'active'))) in ('active', 'aktiv') then 'active'
    when lower(trim(coalesce(p_status, 'active'))) in ('inactive', 'inaktiv', 'passiv', 'passive') then 'inactive'
    else 'active'
  end;

  v_member_no := upper(trim(coalesce(p_member_no, '')));
  if v_member_no = '' then
    select coalesce(
      max((regexp_match(cm.member_no, '^' || v_club_code || '-([0-9]+)$'))[1]::int),
      0
    )
      into v_max_suffix
      from public.club_members cm
     where cm.club_id = p_club_id
       and cm.member_no ~ ('^' || v_club_code || '-[0-9]+$');

    v_member_no := v_club_code || '-' || lpad((coalesce(v_max_suffix, 0) + 1)::text, 4, '0');
  end if;

  if exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.member_no = v_member_no
  ) then
    raise exception 'member_no already exists in club';
  end if;

  insert into public.club_members (
    club_id,
    club_code,
    member_no,
    first_name,
    last_name,
    status,
    membership_kind,
    fishing_card_type,
    role,
    wiso_roles
  ) values (
    p_club_id,
    v_club_code,
    v_member_no,
    v_first_name,
    v_last_name,
    case when v_status = 'active' then 'active' else 'inactive' end,
    'Mitglied',
    coalesce(nullif(trim(p_fishing_card_type), ''), '-'),
    'member',
    null
  );

  v_birthdate := coalesce(p_birthdate, date '1900-01-01');
  v_street := coalesce(nullif(trim(p_street), ''), '-');
  v_zip := coalesce(nullif(trim(p_zip), ''), '-');
  v_city := coalesce(nullif(trim(p_city), ''), '-');
  v_sepa := case when coalesce(p_sepa_approved, true) then true else true end;

  insert into public.members (
    club_id,
    status,
    membership_number,
    first_name,
    last_name,
    birthdate,
    street,
    zip,
    city,
    phone,
    mobile,
    guardian_member_no,
    is_local,
    known_member,
    fishing_card_type,
    sepa_approved,
    source_application_id
  ) values (
    p_club_id,
    v_status,
    v_member_no,
    v_first_name,
    v_last_name,
    v_birthdate,
    v_street,
    v_zip,
    v_city,
    nullif(trim(p_phone), ''),
    nullif(trim(p_mobile), ''),
    nullif(trim(p_guardian_member_no), ''),
    false,
    null,
    coalesce(nullif(trim(p_fishing_card_type), ''), '-'),
    v_sepa,
    null
  )
  on conflict (membership_number) do update
  set
    club_id = excluded.club_id,
    status = excluded.status,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    birthdate = excluded.birthdate,
    street = excluded.street,
    zip = excluded.zip,
    city = excluded.city,
    phone = excluded.phone,
    mobile = excluded.mobile,
    guardian_member_no = excluded.guardian_member_no,
    fishing_card_type = excluded.fishing_card_type,
    updated_at = now()
  returning id into v_member_id;

  if p_iban is not null and trim(p_iban) <> '' and v_member_id is not null then
    v_key := public.membership_get_encryption_key();
    v_iban_norm := public.membership_normalize_iban(p_iban);
    v_iban_last4 := public.membership_iban_last4(v_iban_norm);

    insert into public.member_bank_data (member_id, source_application_id, club_id, iban_encrypted, iban_last4)
    values (
      v_member_id,
      null,
      p_club_id,
      extensions.pgp_sym_encrypt(v_iban_norm, v_key, 'cipher-algo=aes256'),
      v_iban_last4
    )
    on conflict (member_id) do update
      set iban_encrypted = excluded.iban_encrypted,
          iban_last4 = excluded.iban_last4,
          club_id = excluded.club_id;
  end if;

  return query select v_member_no;
end;
$$;
grant execute on function public.admin_member_registry_create(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date
) to authenticated;
drop function if exists public.admin_member_registry_delete(uuid, text);
create or replace function public.admin_member_registry_delete(
  p_club_id uuid,
  p_member_no text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'Only admin can delete member registry rows';
  end if;

  if p_club_id is null then
    raise exception 'club_id is required';
  end if;

  if p_member_no is null or trim(p_member_no) = '' then
    raise exception 'member_no is required';
  end if;

  delete from public.club_member_identities cmi
   where cmi.club_id = p_club_id
     and cmi.member_no = p_member_no;

  delete from public.club_members cm
   where cm.club_id = p_club_id
     and cm.member_no = p_member_no;

  delete from public.members m
   where m.club_id = p_club_id
     and m.membership_number = p_member_no;
end;
$$;
grant execute on function public.admin_member_registry_delete(uuid, text) to authenticated;
commit;
