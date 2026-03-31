begin;

create unique index if not exists idx_club_members_member_no_unique
  on public.club_members (member_no);

create or replace function public.admin_member_registry_create(
  p_club_id uuid,
  p_club_code text default null,
  p_member_no text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_status text default 'active',
  p_fishing_card_type text default null,
  p_street text default null,
  p_zip text default null,
  p_city text default null,
  p_phone text default null,
  p_mobile text default null,
  p_guardian_member_no text default null,
  p_sepa_approved boolean default true,
  p_iban text default null,
  p_birthdate date default null,
  p_email text default null,
  p_club_member_no text default null
)
returns table(member_no text)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_club_id uuid;
  v_club_code text;
  v_member_no text;
  v_status text;
  v_member_id uuid;
  v_email text;
  v_key text;
  v_iban_norm text;
  v_iban_last4 text;
  v_club_member_no text;
begin
  v_club_id := p_club_id;
  v_club_code := upper(trim(coalesce(p_club_code, '')));
  v_club_member_no := nullif(upper(trim(coalesce(p_club_member_no, ''))), '');

  if v_club_id is null then
    raise exception 'club_id is required';
  end if;

  if v_club_code = '' then
    raise exception 'club_code is required';
  end if;

  if not (public.is_admin_or_vorstand_in_club(v_club_id) or public.is_admin_in_any_club())
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Only club admin or vorstand can create member registry rows';
  end if;

  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));

  v_member_no := upper(trim(coalesce(p_member_no, '')));
  if v_member_no <> '' and current_user not in ('postgres', 'service_role') then
    raise exception 'manual_member_no_not_allowed';
  end if;

  if v_member_no = '' then
    v_member_no := public.generate_internal_member_no();
  end if;

  if exists (
    select 1
    from public.club_members cm
    where cm.member_no = v_member_no
  ) then
    raise exception 'member_no already exists';
  end if;

  if exists (
    select 1
    from public.members m
    where m.membership_number = v_member_no
  ) then
    raise exception 'member_no already exists';
  end if;

  if v_club_member_no is null then
    v_club_member_no := public.next_club_member_no(v_club_id);
  end if;

  if exists (
    select 1
    from public.club_members cm
    where cm.club_id = v_club_id
      and cm.club_member_no = v_club_member_no
  ) then
    raise exception 'club_member_no already exists in club';
  end if;

  v_status := case
    when lower(trim(coalesce(p_status, 'active'))) in ('active', 'aktiv') then 'active'
    when lower(trim(coalesce(p_status, 'active'))) in ('inactive', 'inaktiv', 'passiv', 'passive') then 'inactive'
    else 'active'
  end;

  insert into public.club_members (
    club_id,
    club_code,
    member_no,
    club_member_no,
    first_name,
    last_name,
    status,
    membership_kind,
    fishing_card_type,
    role,
    wiso_roles
  ) values (
    v_club_id,
    v_club_code,
    v_member_no,
    v_club_member_no,
    coalesce(nullif(trim(p_first_name), ''), 'Vorname'),
    coalesce(nullif(trim(p_last_name), ''), 'Nachname'),
    v_status,
    'Mitglied',
    coalesce(nullif(trim(p_fishing_card_type), ''), '-'),
    'member',
    null
  );

  insert into public.members (
    club_id,
    status,
    membership_number,
    club_member_no,
    first_name,
    last_name,
    birthdate,
    street,
    email,
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
    v_club_id,
    v_status,
    v_member_no,
    v_club_member_no,
    coalesce(nullif(trim(p_first_name), ''), 'Vorname'),
    coalesce(nullif(trim(p_last_name), ''), 'Nachname'),
    coalesce(p_birthdate, date '1900-01-01'),
    coalesce(nullif(trim(p_street), ''), '-'),
    v_email,
    coalesce(nullif(trim(p_zip), ''), '-'),
    coalesce(nullif(trim(p_city), ''), '-'),
    nullif(trim(p_phone), ''),
    nullif(trim(p_mobile), ''),
    nullif(trim(p_guardian_member_no), ''),
    false,
    null,
    coalesce(nullif(trim(p_fishing_card_type), ''), '-'),
    coalesce(p_sepa_approved, true),
    null
  )
  on conflict (membership_number) do update
  set
    club_id = excluded.club_id,
    status = excluded.status,
    club_member_no = excluded.club_member_no,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    birthdate = excluded.birthdate,
    street = excluded.street,
    email = excluded.email,
    zip = excluded.zip,
    city = excluded.city,
    phone = excluded.phone,
    mobile = excluded.mobile,
    guardian_member_no = excluded.guardian_member_no,
    fishing_card_type = excluded.fishing_card_type,
    sepa_approved = excluded.sepa_approved,
    updated_at = now()
  returning id into v_member_id;

  if nullif(trim(coalesce(p_iban, '')), '') is not null then
    v_iban_norm := upper(regexp_replace(trim(p_iban), '\s+', '', 'g'));
    v_iban_last4 := right(v_iban_norm, 4);
    v_key := encode(digest(v_iban_norm, 'sha256'), 'hex');

    insert into public.member_bank_data (
      member_id,
      iban_last4,
      iban_hash,
      updated_at
    ) values (
      v_member_id,
      v_iban_last4,
      v_key,
      now()
    )
    on conflict (member_id) do update
    set
      iban_last4 = excluded.iban_last4,
      iban_hash = excluded.iban_hash,
      updated_at = now();
  end if;

  return query select v_member_no;
end;
$$;

grant execute on function public.admin_member_registry_create(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date, text, text
) to authenticated;

commit;
