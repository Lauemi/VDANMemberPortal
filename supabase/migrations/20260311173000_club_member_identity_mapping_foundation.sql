begin;

create table if not exists public.club_member_identities (
  club_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_no text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id),
  unique (club_id, member_no)
);

create index if not exists idx_club_member_identities_user
  on public.club_member_identities (user_id);

create index if not exists idx_club_member_identities_member
  on public.club_member_identities (member_no);

drop trigger if exists trg_club_member_identities_updated_at on public.club_member_identities;
create trigger trg_club_member_identities_updated_at
before update on public.club_member_identities
for each row execute function public.tg_set_updated_at();

alter table public.club_member_identities enable row level security;

drop policy if exists "club_member_identities_select_self_or_admin" on public.club_member_identities;
create policy "club_member_identities_select_self_or_admin"
on public.club_member_identities
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin_in_club(club_id)
  or public.is_admin_in_any_club()
);

drop policy if exists "club_member_identities_admin_manage" on public.club_member_identities;
create policy "club_member_identities_admin_manage"
on public.club_member_identities
for all
to authenticated
using (public.is_admin_in_club(club_id) or public.is_admin_in_any_club())
with check (public.is_admin_in_club(club_id) or public.is_admin_in_any_club());

insert into public.club_member_identities (club_id, user_id, member_no)
select distinct
  cm.club_id,
  p.id as user_id,
  cm.member_no
from public.profiles p
join public.club_members cm
  on cm.member_no = p.member_no
 and (p.club_id is null or p.club_id = cm.club_id)
where p.id is not null
  and cm.club_id is not null
  and nullif(trim(coalesce(cm.member_no, '')), '') is not null
on conflict do nothing;

create temporary table tmp_generated_member_identity (
  club_id uuid not null,
  user_id uuid not null,
  club_code text not null,
  member_no text not null,
  first_name text not null,
  last_name text not null
) on commit drop;

insert into tmp_generated_member_identity (club_id, user_id, club_code, member_no, first_name, last_name)
with code_map as (
  select
    upper(trim(replace(s.setting_key, 'club_code_map:', ''))) as club_code,
    s.setting_value::uuid as club_id
  from public.app_secure_settings s
  where s.setting_key like 'club_code_map:%'
    and upper(trim(replace(s.setting_key, 'club_code_map:', ''))) ~ '^[A-Z]{2}[0-9]{2}$'
),
club_code_fallback as (
  select
    cm.club_id,
    max(nullif(trim(cm.club_code), '')) as club_code
  from public.club_members cm
  group by cm.club_id
),
missing_pairs as (
  select distinct
    cur.club_id,
    cur.user_id
  from public.club_user_roles cur
  left join public.club_member_identities cmi
    on cmi.club_id = cur.club_id
   and cmi.user_id = cur.user_id
  where cur.role_key in ('member', 'vorstand', 'admin')
    and cmi.user_id is null
),
prepared as (
  select
    mp.club_id,
    mp.user_id,
    coalesce(cm.club_code, ccf.club_code) as club_code,
    coalesce(nullif(trim(p.first_name), ''), 'Vorname') as first_name,
    coalesce(nullif(trim(p.last_name), ''), 'Nachname') as last_name
  from missing_pairs mp
  left join code_map cm on cm.club_id = mp.club_id
  left join club_code_fallback ccf on ccf.club_id = mp.club_id
  left join public.profiles p on p.id = mp.user_id
  where coalesce(cm.club_code, ccf.club_code) ~ '^[A-Z]{2}[0-9]{2}$'
),
seed as (
  select distinct p.club_id, p.club_code
  from prepared p
),
existing_max as (
  select
    s.club_id,
    s.club_code,
    coalesce(
      max(
        (regexp_match(cm.member_no, '^' || s.club_code || '-([0-9]+)$'))[1]::int
      ),
      0
    ) as max_suffix
  from seed s
  left join public.club_members cm
    on cm.club_id = s.club_id
   and cm.member_no ~ ('^' || s.club_code || '-[0-9]+$')
  group by s.club_id, s.club_code
),
numbered as (
  select
    p.club_id,
    p.user_id,
    p.club_code,
    p.first_name,
    p.last_name,
    row_number() over (partition by p.club_id, p.club_code order by p.user_id) as rn
  from prepared p
)
select
  n.club_id,
  n.user_id,
  n.club_code,
  n.club_code || '-' || lpad((coalesce(em.max_suffix, 0) + n.rn)::text, 4, '0') as member_no,
  n.first_name,
  n.last_name
from numbered n
left join existing_max em
  on em.club_id = n.club_id
 and em.club_code = n.club_code;

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
)
select
  t.club_id,
  t.club_code,
  t.member_no,
  t.first_name,
  t.last_name,
  'active',
  'Mitglied',
  '-',
  'member',
  null
from tmp_generated_member_identity t
on conflict do nothing;

insert into public.club_member_identities (club_id, user_id, member_no)
select
  t.club_id,
  t.user_id,
  t.member_no
from tmp_generated_member_identity t
on conflict do nothing;

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
    cmi.user_id as profile_user_id,
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
  order by cm.club_code asc, cm.member_no asc;
end;
$$;

grant execute on function public.admin_member_registry() to authenticated;

commit;
