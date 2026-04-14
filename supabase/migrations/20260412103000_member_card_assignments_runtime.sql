begin;

create table if not exists public.member_card_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  member_no text not null,
  card_id text not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid null,
  source text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_member_card_assignments unique (club_id, member_no, card_id)
);

create index if not exists idx_member_card_assignments_member
  on public.member_card_assignments(club_id, member_no);

create index if not exists idx_member_card_assignments_card
  on public.member_card_assignments(club_id, card_id);

create or replace function public.cleanup_member_card_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from public.member_card_assignments
  where club_id = old.club_id
    and member_no = old.member_no;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_member_card_assignments on public.club_members;
create trigger trg_cleanup_member_card_assignments
after delete on public.club_members
for each row execute function public.cleanup_member_card_assignments();

create or replace function public.member_card_assignment_ids_from_legacy(
  p_legacy text
)
returns text[]
language plpgsql
immutable
as $$
declare
  v_raw text := lower(coalesce(p_legacy, ''));
  v_ids text[] := array[]::text[];
begin
  if position('innenwasser' in v_raw) > 0 or position('innewasser' in v_raw) > 0 then
    v_ids := array_append(v_ids, 'innenwasser');
  end if;

  if position('rheinlos' in v_raw) > 0 or position('rhein' in v_raw) > 0 then
    v_ids := array_append(v_ids, 'rheinlos39');
  end if;

  return (
    select coalesce(array_agg(distinct entry order by entry), array[]::text[])
    from unnest(v_ids) as entry
  );
end;
$$;

create or replace function public.member_card_label_from_ids(
  p_card_ids text[]
)
returns text
language sql
immutable
as $$
  with normalized as (
    select array_remove(array_agg(distinct lower(trim(entry)) order by lower(trim(entry))), null) as ids
    from unnest(coalesce(p_card_ids, array[]::text[])) as entry
    where nullif(trim(entry), '') is not null
  )
  select case
    when ids @> array['innenwasser']::text[] and ids @> array['rheinlos39']::text[] then 'Innenwasser + Rheinlos'
    when ids @> array['innenwasser']::text[] then 'Innenwasser'
    when ids @> array['rheinlos39']::text[] then 'Rheinlos'
    else '-'
  end
  from normalized;
$$;

create or replace function public.member_card_assignment_labels_from_ids(
  p_card_ids text[]
)
returns jsonb
language sql
immutable
as $$
  with normalized as (
    select array_remove(array_agg(distinct lower(trim(entry)) order by lower(trim(entry))), null) as ids
    from unnest(coalesce(p_card_ids, array[]::text[])) as entry
    where nullif(trim(entry), '') is not null
  )
  select coalesce(
    jsonb_agg(
      case entry
        when 'innenwasser' then jsonb_build_object('id', entry, 'label', 'Innenwasser')
        when 'rheinlos39' then jsonb_build_object('id', entry, 'label', 'Rheinlos')
        else jsonb_build_object('id', entry, 'label', initcap(entry))
      end
      order by case entry when 'innenwasser' then 1 when 'rheinlos39' then 2 else 99 end
    ),
    '[]'::jsonb
  )
  from normalized,
  lateral unnest(coalesce(ids, array[]::text[])) as entry;
$$;

insert into public.member_card_assignments (
  club_id,
  member_no,
  card_id,
  source
)
select
  cm.club_id,
  cm.member_no,
  card_id,
  'migration'
from public.club_members cm
cross join lateral unnest(public.member_card_assignment_ids_from_legacy(cm.fishing_card_type)) as card_id
where cm.club_id is not null
on conflict (club_id, member_no, card_id) do nothing;

create or replace function public.admin_member_assign_cards(
  p_club_id uuid,
  p_member_no text,
  p_card_ids jsonb default '[]'::jsonb
)
returns table(
  member_no text,
  card_assignments jsonb,
  fishing_card_type text
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_member_no text := nullif(trim(p_member_no), '');
  v_card_ids text[] := array[]::text[];
  v_card_id text;
  v_label text;
  v_membership_id uuid;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if v_member_no is null then
    raise exception 'member_no_required';
  end if;

  if jsonb_typeof(coalesce(p_card_ids, '[]'::jsonb)) <> 'array' then
    raise exception 'card_ids_must_be_array';
  end if;

  if not (
    public.is_service_role_request()
    or public.is_admin_or_vorstand_in_club(p_club_id)
    or public.is_admin_in_any_club()
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  select
    array_remove(array_agg(distinct lower(trim(value)) order by lower(trim(value))), null)
  into v_card_ids
  from jsonb_array_elements_text(coalesce(p_card_ids, '[]'::jsonb)) as value
  where nullif(trim(value), '') is not null;

  if exists (
    select 1
    from unnest(coalesce(v_card_ids, array[]::text[])) as entry
    where entry not in ('innenwasser', 'rheinlos39')
  ) then
    raise exception 'unsupported_card_id';
  end if;

  delete from public.member_card_assignments
  where club_id = p_club_id
    and member_no = v_member_no;

  foreach v_card_id in array coalesce(v_card_ids, array[]::text[])
  loop
    insert into public.member_card_assignments (
      club_id,
      member_no,
      card_id,
      assigned_by,
      source
    ) values (
      p_club_id,
      v_member_no,
      v_card_id,
      auth.uid(),
      'admin_manual'
    )
    on conflict (club_id, member_no, card_id) do update
      set updated_at = now(),
          assigned_at = now(),
          assigned_by = auth.uid(),
          source = excluded.source;
  end loop;

  v_label := public.member_card_label_from_ids(v_card_ids);

  update public.club_members
  set fishing_card_type = v_label
  where club_id = p_club_id
    and member_no = v_member_no
  returning canonical_membership_id into v_membership_id;

  update public.members
  set fishing_card_type = v_label
  where club_id = p_club_id
    and membership_number = v_member_no;

  if v_membership_id is not null then
    update public.profiles
    set fishing_card_type = v_label
    where canonical_membership_id = v_membership_id
      and (tenant_id is not null or club_id = p_club_id);
  end if;

  return query
  select
    v_member_no,
    public.member_card_assignment_labels_from_ids(v_card_ids),
    v_label;
end;
$$;

grant execute on function public.admin_member_assign_cards(uuid, text, jsonb) to authenticated;

update public.club_members cm
set fishing_card_type = public.member_card_label_from_ids(
  coalesce(
    (
      select array_agg(mca.card_id order by mca.card_id)
      from public.member_card_assignments mca
      where mca.club_id = cm.club_id
        and mca.member_no = cm.member_no
    ),
    public.member_card_assignment_ids_from_legacy(cm.fishing_card_type)
  )
);

update public.members m
set fishing_card_type = public.member_card_label_from_ids(
  coalesce(
    (
      select array_agg(mca.card_id order by mca.card_id)
      from public.member_card_assignments mca
      where mca.club_id = m.club_id
        and mca.member_no = m.membership_number
    ),
    public.member_card_assignment_ids_from_legacy(m.fishing_card_type)
  )
);

update public.profiles p
set fishing_card_type = public.member_card_label_from_ids(
  coalesce(
    (
      select array_agg(mca.card_id order by mca.card_id)
      from public.club_members cm
      join public.member_card_assignments mca
        on mca.club_id = cm.club_id
       and mca.member_no = cm.member_no
      where cm.canonical_membership_id = p.canonical_membership_id
    ),
    public.member_card_assignment_ids_from_legacy(p.fishing_card_type)
  )
)
where p.canonical_membership_id is not null;

drop function if exists public.admin_member_registry(uuid);
create or replace function public.admin_member_registry(
  p_club_id uuid default null
)
returns table(
  club_id uuid,
  club_code text,
  member_no text,
  club_member_no text,
  first_name text,
  last_name text,
  role text,
  status text,
  fishing_card_type text,
  card_assignments jsonb,
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
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (
    current_user in ('postgres', 'service_role')
    or public.is_admin_in_any_club()
    or public.is_admin_or_vorstand_in_club(p_club_id)
  ) then
    raise exception 'Only club admin or vorstand can read member registry';
  end if;

  return query
  with assignment_rows as (
    select
      mca.club_id,
      mca.member_no,
      array_agg(mca.card_id order by case mca.card_id when 'innenwasser' then 1 when 'rheinlos39' then 2 else 99 end) as card_ids
    from public.member_card_assignments mca
    where mca.club_id = p_club_id
    group by mca.club_id, mca.member_no
  )
  select
    cm.club_id,
    cm.club_code,
    cm.member_no,
    coalesce(nullif(trim(cm.club_member_no), ''), cm.member_no) as club_member_no,
    cm.first_name,
    cm.last_name,
    coalesce(nullif(trim(cm.role), ''), 'member') as role,
    cm.status,
    public.member_card_label_from_ids(coalesce(ar.card_ids, public.member_card_assignment_ids_from_legacy(cm.fishing_card_type))) as fishing_card_type,
    public.member_card_assignment_labels_from_ids(coalesce(ar.card_ids, public.member_card_assignment_ids_from_legacy(cm.fishing_card_type))) as card_assignments,
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
  left join assignment_rows ar
    on ar.club_id = cm.club_id
   and ar.member_no = cm.member_no
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
  where cm.club_id = p_club_id
  order by coalesce(nullif(trim(cm.club_member_no), ''), cm.member_no) asc, cm.member_no asc;
end;
$$;

grant execute on function public.admin_member_registry(uuid) to authenticated;

create or replace view public.admin_member_cards_overview_v
with (security_invoker = true) as
with assignment_rows as (
  select
    mca.club_id,
    mca.member_no,
    array_agg(mca.card_id order by case mca.card_id when 'innenwasser' then 1 when 'rheinlos39' then 2 else 99 end) as card_ids
  from public.member_card_assignments mca
  group by mca.club_id, mca.member_no
)
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
  public.member_card_label_from_ids(coalesce(ar.card_ids, public.member_card_assignment_ids_from_legacy(cm.fishing_card_type))) as fishing_card_type,
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
left join assignment_rows ar
  on ar.club_id = cm.club_id
 and ar.member_no = cm.member_no
left join public.profiles p
  on p.canonical_membership_id = cm.canonical_membership_id
 and (
      p.tenant_id = cm.tenant_id
      or (p.tenant_id is null and p.club_id = cm.club_id)
 );

notify pgrst, 'reload schema';
commit;
