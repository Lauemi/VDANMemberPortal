begin;

alter table if exists public.members
  add column if not exists email text;

create index if not exists idx_members_club_id_email
  on public.members (club_id, lower(email))
  where email is not null;

drop function if exists public.admin_member_registry();

create or replace function public.admin_member_registry()
returns table(
  club_id uuid,
  club_code text,
  member_no text,
  first_name text,
  last_name text,
  status text,
  fishing_card_type text,
  has_login boolean,
  last_sign_in_at timestamptz,
  profile_user_id uuid,
  street text,
  email text,
  zip text,
  city text,
  phone text,
  mobile text,
  birthdate date,
  sepa_approved boolean,
  iban_last4 text,
  guardian_member_no text
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  if not (public.is_admin_in_any_club() or current_user in ('postgres', 'service_role')) then
    raise exception 'Only admin can read member registry';
  end if;

  return query
  select
    cm.club_id,
    cm.club_code,
    cm.member_no,
    cm.first_name,
    cm.last_name,
    cm.status,
    cm.fishing_card_type,
    (u.last_sign_in_at is not null) as has_login,
    u.last_sign_in_at,
    cmi.user_id as profile_user_id,
    m.street,
    coalesce(nullif(trim(m.email), ''), nullif(trim(p.email), ''), nullif(trim(u.email), '')) as email,
    m.zip,
    m.city,
    m.phone,
    m.mobile,
    m.birthdate,
    m.sepa_approved,
    mb.iban_last4,
    m.guardian_member_no
  from public.club_members cm
  left join public.club_member_identities cmi
    on cmi.club_id = cm.club_id
   and cmi.member_no = cm.member_no
  left join auth.users u
    on u.id = cmi.user_id
  left join public.profiles p
    on p.id = cmi.user_id
  left join public.members m
    on m.membership_number = cm.member_no
   and (m.club_id is null or m.club_id = cm.club_id)
  left join public.member_bank_data mb
    on mb.member_id = m.id
  order by cm.club_code asc, cm.member_no asc;
end;
$$;

grant execute on function public.admin_member_registry() to authenticated;

drop function if exists public.admin_member_registry_create(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date
);

drop function if exists public.admin_member_registry_create(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date, text
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
  p_birthdate date default null,
  p_email text default null
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
  v_email text;
  v_sepa boolean;
  v_iban_norm text;
  v_iban_last4 text;
  v_key text;
begin
  if not (public.is_admin_or_vorstand_in_club(p_club_id) or public.is_admin_in_any_club())
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Only club admin or vorstand can create member registry rows';
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
  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));

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
    p_club_id,
    v_status,
    v_member_no,
    v_first_name,
    v_last_name,
    v_birthdate,
    v_street,
    v_email,
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
    email = excluded.email,
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
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date, text
) to authenticated;

drop function if exists public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, boolean, text, date
);

drop function if exists public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, boolean, text, date
);

drop function if exists public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date
);

create or replace function public.admin_member_registry_update(
  p_member_no text,
  p_first_name text default null,
  p_last_name text default null,
  p_status text default null,
  p_fishing_card_type text default null,
  p_street text default null,
  p_email text default null,
  p_zip text default null,
  p_city text default null,
  p_phone text default null,
  p_mobile text default null,
  p_guardian_member_no text default null,
  p_sepa_approved boolean default true,
  p_iban text default null,
  p_birthdate date default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_member public.club_members%rowtype;
  v_member_row public.members%rowtype;
  v_status text;
  v_email text;
  v_key text;
  v_iban_norm text;
  v_iban_last4 text;
begin
  if p_member_no is null or trim(p_member_no) = '' then
    raise exception 'member_no is required';
  end if;

  select *
    into v_member
  from public.club_members cm
  where cm.member_no = trim(p_member_no)
  limit 1;

  if v_member.club_id is null then
    raise exception 'member_not_found';
  end if;

  if not (public.is_admin_or_vorstand_in_club(v_member.club_id) or public.is_admin_in_any_club())
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Only club admin or vorstand can update member registry rows';
  end if;

  v_status := case
    when lower(trim(coalesce(p_status, v_member.status, 'active'))) in ('active', 'aktiv') then 'active'
    when lower(trim(coalesce(p_status, v_member.status, 'active'))) in ('inactive', 'inaktiv', 'passiv', 'passive') then 'inactive'
    else coalesce(v_member.status, 'active')
  end;
  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));

  update public.club_members
  set
    first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
    last_name = coalesce(nullif(trim(p_last_name), ''), last_name),
    status = case when v_status = 'active' then 'active' else 'inactive' end,
    fishing_card_type = coalesce(nullif(trim(p_fishing_card_type), ''), fishing_card_type)
  where member_no = trim(p_member_no)
    and club_id = v_member.club_id;

  insert into public.members (
    club_id,
    status,
    membership_number,
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
    v_member.club_id,
    v_status,
    trim(p_member_no),
    coalesce(nullif(trim(p_first_name), ''), v_member.first_name, 'Vorname'),
    coalesce(nullif(trim(p_last_name), ''), v_member.last_name, 'Nachname'),
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
    coalesce(nullif(trim(p_fishing_card_type), ''), v_member.fishing_card_type, '-'),
    coalesce(p_sepa_approved, true),
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
    email = excluded.email,
    zip = excluded.zip,
    city = excluded.city,
    phone = excluded.phone,
    mobile = excluded.mobile,
    guardian_member_no = excluded.guardian_member_no,
    fishing_card_type = excluded.fishing_card_type,
    sepa_approved = excluded.sepa_approved,
    updated_at = now()
  returning * into v_member_row;

  if p_iban is not null and trim(p_iban) <> '' and v_member_row.id is not null then
    v_key := public.membership_get_encryption_key();
    v_iban_norm := public.membership_normalize_iban(p_iban);
    v_iban_last4 := public.membership_iban_last4(v_iban_norm);

    insert into public.member_bank_data (member_id, source_application_id, club_id, iban_encrypted, iban_last4)
    values (
      v_member_row.id,
      null,
      v_member.club_id,
      extensions.pgp_sym_encrypt(v_iban_norm, v_key, 'cipher-algo=aes256'),
      v_iban_last4
    )
    on conflict (member_id) do update
      set iban_encrypted = excluded.iban_encrypted,
          iban_last4 = excluded.iban_last4,
          club_id = excluded.club_id;
  end if;
end;
$$;

grant execute on function public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date
) to authenticated;

commit;
