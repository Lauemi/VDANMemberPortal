begin;
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
  if not (
    current_user in ('postgres', 'service_role')
    or exists (
      select 1
      from public.club_user_roles cur
      where cur.user_id = auth.uid()
        and cur.role_key in ('admin', 'vorstand')
      limit 1
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'vorstand')
      limit 1
    )
    or public.is_admin_in_any_club()
  ) then
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
notify pgrst, 'reload schema';
commit;
