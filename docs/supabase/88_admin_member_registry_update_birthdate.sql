-- VDAN/FCP - Admin member registry: allow birthdate updates via admin_member_registry_update
-- Date: 2026-03-09
-- Run after:
--   66_admin_member_registry.sql
--
-- Context:
--   P0 member master-data maintenance requires editable birthdate in admin registry.
--   Existing function updates address/phone/SEPA/IBAN but not birthdate.

begin;

drop function if exists public.admin_member_registry_update(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, text
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
  p_iban text default null,
  p_birthdate date default null
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
    birthdate = coalesce(p_birthdate, m.birthdate),
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
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, date
) to authenticated;

commit;
