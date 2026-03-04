-- VDAN/FCP - Admin member registry (table + editable detail + login indicator)
-- Run after:
-- 16_wiso_members_import.sql
-- 26_membership_applications.sql
-- 65_admin_user_last_signin.sql

begin;

-- 1) Extend members with operational contact/guardian fields
alter table if exists public.members
  add column if not exists phone text,
  add column if not exists mobile text,
  add column if not exists guardian_member_no text;

create index if not exists idx_members_guardian_member_no
  on public.members(guardian_member_no);

-- 1b) Human-friendly club identifier (e.g. VD01) in addition to technical club_id.
alter table if exists public.club_members
  add column if not exists club_code text;

update public.club_members
   set club_code = 'VD01'
 where club_code is null
    or trim(club_code) = '';

alter table if exists public.club_members
  drop constraint if exists club_members_club_code_format;

alter table if exists public.club_members
  add constraint club_members_club_code_format
  check (club_code ~ '^[A-Z]{2}[0-9]{2}$');

create index if not exists idx_club_members_club_code
  on public.club_members(club_code);

-- 2) Admin registry read RPC
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
  if not public.is_admin() then
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
    p.id as profile_user_id,
    m.street,
    m.zip,
    m.city,
    m.phone,
    m.mobile,
    m.birthdate,
    m.sepa_approved,
    mb.iban_last4,
    m.guardian_member_no
  from public.club_members cm
  left join public.profiles p
    on p.member_no = cm.member_no
  left join auth.users u
    on u.id = p.id
  left join public.members m
    on m.membership_number = cm.member_no
  left join public.member_bank_data mb
    on mb.member_id = m.id
  order by cm.member_no asc;
end;
$$;

grant execute on function public.admin_member_registry() to authenticated;

-- 3) Admin update RPC for member registry
drop function if exists public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, boolean, text
);

create or replace function public.admin_member_registry_update(
  p_member_no text,
  p_first_name text default null,
  p_last_name text default null,
  p_status text default null,
  p_fishing_card_type text default null,
  p_club_code text default null,
  p_street text default null,
  p_zip text default null,
  p_city text default null,
  p_phone text default null,
  p_mobile text default null,
  p_guardian_member_no text default null,
  p_sepa_approved boolean default null,
  p_iban text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_member_id uuid;
  v_iban_norm text;
  v_iban_last4 text;
  v_key text;
begin
  if not public.is_admin() then
    raise exception 'Only admin can update member registry';
  end if;

  if p_member_no is null or trim(p_member_no) = '' then
    raise exception 'member_no is required';
  end if;

  if p_club_code is not null
     and nullif(trim(p_club_code), '') is not null
     and upper(trim(p_club_code)) !~ '^[A-Z]{2}[0-9]{2}$' then
    raise exception 'club_code must match format AA00';
  end if;

  update public.club_members cm
  set
    first_name = coalesce(nullif(trim(p_first_name), ''), cm.first_name),
    last_name = coalesce(nullif(trim(p_last_name), ''), cm.last_name),
    status = coalesce(nullif(trim(p_status), ''), cm.status),
    fishing_card_type = coalesce(nullif(trim(p_fishing_card_type), ''), cm.fishing_card_type),
    club_code = coalesce(upper(nullif(trim(p_club_code), '')), cm.club_code),
    updated_at = now()
  where cm.member_no = p_member_no;

  update public.members m
  set
    first_name = coalesce(nullif(trim(p_first_name), ''), m.first_name),
    last_name = coalesce(nullif(trim(p_last_name), ''), m.last_name),
    status = case
      when p_status is null then m.status
      when lower(trim(p_status)) in ('aktiv', 'active') then 'active'
      when lower(trim(p_status)) in ('passiv', 'passive', 'inaktiv', 'inactive') then 'inactive'
      else m.status
    end,
    fishing_card_type = coalesce(nullif(trim(p_fishing_card_type), ''), m.fishing_card_type),
    street = coalesce(nullif(trim(p_street), ''), m.street),
    zip = coalesce(nullif(trim(p_zip), ''), m.zip),
    city = coalesce(nullif(trim(p_city), ''), m.city),
    phone = case when p_phone is null then m.phone else nullif(trim(p_phone), '') end,
    mobile = case when p_mobile is null then m.mobile else nullif(trim(p_mobile), '') end,
    guardian_member_no = case when p_guardian_member_no is null then m.guardian_member_no else nullif(trim(p_guardian_member_no), '') end,
    sepa_approved = coalesce(p_sepa_approved, m.sepa_approved),
    updated_at = now()
  where m.membership_number = p_member_no
  returning m.id into v_member_id;

  if p_iban is not null and trim(p_iban) <> '' and v_member_id is not null then
    v_key := public.membership_get_encryption_key();
    v_iban_norm := public.membership_normalize_iban(p_iban);
    v_iban_last4 := public.membership_iban_last4(v_iban_norm);

    insert into public.member_bank_data (member_id, source_application_id, iban_encrypted, iban_last4)
    values (
      v_member_id,
      null,
      extensions.pgp_sym_encrypt(v_iban_norm, v_key, 'cipher-algo=aes256'),
      v_iban_last4
    )
    on conflict (member_id) do update
      set iban_encrypted = excluded.iban_encrypted,
          iban_last4 = excluded.iban_last4;
  end if;
end;
$$;

grant execute on function public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, text
) to authenticated;

commit;
