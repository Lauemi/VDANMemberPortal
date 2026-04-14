begin;
alter table public.club_members
  add column if not exists club_member_no text;
alter table public.members
  add column if not exists club_member_no text;
update public.club_members
set club_member_no = coalesce(nullif(trim(club_member_no), ''), member_no)
where coalesce(nullif(trim(club_member_no), ''), '') = ''
  and coalesce(nullif(trim(member_no), ''), '') <> '';
update public.members m
set club_member_no = coalesce(
  nullif(trim(m.club_member_no), ''),
  nullif(trim(cm.club_member_no), ''),
  nullif(trim(m.membership_number), '')
)
from public.club_members cm
where cm.member_no = m.membership_number
  and (m.club_id is null or m.club_id = cm.club_id)
  and coalesce(nullif(trim(m.club_member_no), ''), '') = '';
create unique index if not exists idx_club_members_club_member_no_unique
  on public.club_members (club_id, club_member_no)
  where nullif(trim(club_member_no), '') is not null;
create index if not exists idx_members_club_member_no
  on public.members (club_id, club_member_no);
drop function if exists public.admin_member_registry();
create or replace function public.admin_member_registry()
returns table(
  club_id uuid,
  club_code text,
  member_no text,
  club_member_no text,
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
  if not public.is_admin_or_vorstand_in_any_club() then
    raise exception 'Only club admin or vorstand can read member registry';
  end if;

  return query
  select
    cm.club_id,
    cm.club_code,
    cm.member_no,
    coalesce(nullif(trim(cm.club_member_no), ''), cm.member_no) as club_member_no,
    cm.first_name,
    cm.last_name,
    cm.status,
    cm.fishing_card_type,
    (u.last_sign_in_at is not null) as has_login,
    u.last_sign_in_at,
    cmi.user_id as profile_user_id,
    m.street,
    m.email,
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
  left join public.members m
    on m.membership_number = cm.member_no
   and (m.club_id is null or m.club_id = cm.club_id)
  left join public.member_bank_data mb
    on mb.member_id = m.id
  order by cm.club_code asc, coalesce(nullif(trim(cm.club_member_no), ''), cm.member_no) asc, cm.member_no asc;
end;
$$;
grant execute on function public.admin_member_registry() to authenticated;
drop function if exists public.admin_member_registry_create(
  uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date, text
);
drop function if exists public.admin_member_registry_create(
  uuid, text, text, text, text, text, text, text, text, text, text, boolean, text, date, text
);
create or replace function public.admin_member_registry_create(
  p_club_id uuid default null,
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
  v_max_suffix int;
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
  if v_member_no = '' then
    select coalesce(
      max((regexp_match(cm.member_no, '^' || v_club_code || '-([0-9]+)$'))[1]::int),
      0
    )
      into v_max_suffix
    from public.club_members cm
    where cm.club_id = v_club_id
      and cm.member_no ~ ('^' || v_club_code || '-[0-9]+$');

    v_member_no := v_club_code || '-' || lpad((coalesce(v_max_suffix, 0) + 1)::text, 4, '0');
  end if;

  if exists (
    select 1
    from public.club_members cm
    where cm.club_id = v_club_id
      and cm.member_no = v_member_no
  ) then
    raise exception 'member_no already exists in club';
  end if;

  if v_club_member_no is not null and exists (
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
    coalesce(v_club_member_no, v_member_no),
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
    coalesce(v_club_member_no, v_member_no),
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
drop function if exists public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date, text
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
  p_birthdate date default null,
  p_club_member_no text default null
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
  v_club_member_no text;
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
  v_club_member_no := upper(trim(coalesce(p_club_member_no, '')));
  if v_club_member_no = '' then
    v_club_member_no := coalesce(nullif(trim(v_member.club_member_no), ''), trim(p_member_no));
  end if;

  if exists (
    select 1
    from public.club_members cm
    where cm.club_id = v_member.club_id
      and cm.member_no <> trim(p_member_no)
      and cm.club_member_no = v_club_member_no
  ) then
    raise exception 'club_member_no already exists in club';
  end if;

  update public.club_members
  set
    club_member_no = v_club_member_no,
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
    v_member.club_id,
    v_status,
    trim(p_member_no),
    v_club_member_no,
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
  returning * into v_member_row;

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
      v_member_row.id,
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
end;
$$;
grant execute on function public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date, text
) to authenticated;
commit;
