create or replace view public.admin_member_cards_overview_v
with (security_invoker = true) as
select
  cm.canonical_membership_id as membership_id,
  coalesce(cm.tenant_id, p.tenant_id) as tenant_id,
  cm.club_id,
  cm.member_no,
  coalesce(nullif(trim(cm.club_member_no), ''), cm.member_no) as club_member_no,
  nullif(trim(concat_ws(' ', cm.first_name, cm.last_name)), '') as member_name,
  cm.first_name,
  cm.last_name,
  cm.status as member_status,
  cm.fishing_card_type,
  cm.role as member_role,
  cm.membership_kind,
  cm.is_youth,
  p.id as profile_user_id,
  p.display_name,
  p.email,
  p.member_card_valid,
  p.member_card_valid_from,
  p.member_card_valid_until,
  p.member_card_id,
  p.member_card_key,
  case
    when p.member_card_valid is false then 'inaktiv'
    when p.member_card_valid_until is not null and p.member_card_valid_until < current_date then 'abgelaufen'
    when p.member_card_valid is true then 'aktiv'
    else 'offen'
  end as status,
  case
    when p.member_card_valid_from is not null and p.member_card_valid_until is not null
      then to_char(p.member_card_valid_from, 'DD.MM.YYYY') || ' - ' || to_char(p.member_card_valid_until, 'DD.MM.YYYY')
    when p.member_card_valid_from is not null
      then 'ab ' || to_char(p.member_card_valid_from, 'DD.MM.YYYY')
    when p.member_card_valid_until is not null
      then 'bis ' || to_char(p.member_card_valid_until, 'DD.MM.YYYY')
    else null
  end as validity_label,
  false::boolean as requires_approval,
  greatest(
    coalesce(cm.updated_at, cm.created_at, p.updated_at, p.created_at, now()),
    coalesce(p.updated_at, p.created_at, cm.updated_at, cm.created_at, now())
  ) as updated_at
from public.club_members cm
left join public.profiles p
  on p.canonical_membership_id = cm.canonical_membership_id
 and (
      p.tenant_id = cm.tenant_id
      or (p.tenant_id is null and p.club_id = cm.club_id)
 )
where cm.club_id is not null;

create or replace function public.admin_member_cards_overview(
  p_club_id uuid default null
)
returns table(
  membership_id uuid,
  tenant_id uuid,
  club_id uuid,
  member_no text,
  club_member_no text,
  member_name text,
  first_name text,
  last_name text,
  member_status text,
  fishing_card_type text,
  member_role text,
  membership_kind text,
  is_youth boolean,
  profile_user_id uuid,
  display_name text,
  email text,
  member_card_valid boolean,
  member_card_valid_from date,
  member_card_valid_until date,
  member_card_id text,
  member_card_key text,
  status text,
  validity_label text,
  requires_approval boolean,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (
    public.is_admin_in_any_club()
    or public.is_admin_or_vorstand_in_club(p_club_id)
  ) then
    raise exception 'Only club admin or vorstand can read member cards overview';
  end if;

  return query
  select
    v.membership_id,
    v.tenant_id,
    v.club_id,
    v.member_no,
    v.club_member_no,
    v.member_name,
    v.first_name,
    v.last_name,
    v.member_status,
    v.fishing_card_type,
    v.member_role,
    v.membership_kind,
    v.is_youth,
    v.profile_user_id,
    v.display_name,
    v.email,
    v.member_card_valid,
    v.member_card_valid_from,
    v.member_card_valid_until,
    v.member_card_id,
    v.member_card_key,
    v.status,
    v.validity_label,
    v.requires_approval,
    v.updated_at
  from public.admin_member_cards_overview_v v
  where v.club_id = p_club_id
  order by v.club_id asc, v.club_member_no asc, v.member_no asc;
end;
$$;

grant select on public.admin_member_cards_overview_v to authenticated;
grant execute on function public.admin_member_cards_overview(uuid) to authenticated;

create or replace function public.admin_member_cards_overview_v2(
  p_club_id uuid default null
)
returns table(
  membership_id uuid,
  tenant_id uuid,
  club_id uuid,
  member_no text,
  club_member_no text,
  member_name text,
  first_name text,
  last_name text,
  member_status text,
  fishing_card_type text,
  member_role text,
  membership_kind text,
  is_youth boolean,
  profile_user_id uuid,
  display_name text,
  email text,
  member_card_valid boolean,
  member_card_valid_from date,
  member_card_valid_until date,
  member_card_id text,
  member_card_key text,
  status text,
  validity_label text,
  requires_approval boolean,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  return query
  select *
  from public.admin_member_cards_overview(p_club_id);
end;
$$;

grant execute on function public.admin_member_cards_overview_v2(uuid) to authenticated;
