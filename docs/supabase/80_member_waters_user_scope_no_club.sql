-- VDAN/FCP - Member waters: user-bound scope, club optional
-- Run after:
--   79_water_source_mapping_status_hotfix.sql
--
-- Purpose:
--   - Free/member waters are primarily bound to user_id
--   - Works even when user has no club_id
--   - Keep manager visibility only for same-club rows (if club exists)

begin;

-- -------------------------------------------------------------------
-- 1) Relax club requirement for free-water tables
-- -------------------------------------------------------------------
alter table if exists public.member_waters
  alter column club_id drop not null;

alter table if exists public.member_water_mappings
  alter column club_id drop not null;

-- Use user-based dedupe for free waters.
drop index if exists public.uq_member_waters_owner_norm_location;
create unique index if not exists uq_member_waters_owner_norm_location_user
  on public.member_waters (
    user_id,
    name_norm,
    coalesce(public.normalize_water_name(location_text), '')
  );

-- -------------------------------------------------------------------
-- 2) Dedicated trigger helper for member_waters (no forced fallback club)
-- -------------------------------------------------------------------
create or replace function public.ensure_member_water_user_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_club uuid;
begin
  v_uid := coalesce(new.user_id, auth.uid());
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  new.user_id := v_uid;

  if new.club_id is null then
    select p.club_id into v_club
    from public.profiles p
    where p.id = v_uid
    limit 1;
    new.club_id := v_club; -- may stay null by design
  end if;

  return new;
end;
$$;

drop trigger if exists trg_member_waters_ensure_club_id on public.member_waters;
drop trigger if exists trg_member_waters_user_scope_defaults on public.member_waters;
create trigger trg_member_waters_user_scope_defaults
before insert or update of user_id, club_id
on public.member_waters
for each row execute function public.ensure_member_water_user_scope_defaults();

-- -------------------------------------------------------------------
-- 3) RLS: user-bound first, optional same-club manager visibility
-- -------------------------------------------------------------------
drop policy if exists "member_waters_select_same_club" on public.member_waters;
drop policy if exists "member_waters_insert_same_club" on public.member_waters;
drop policy if exists "member_waters_update_same_club" on public.member_waters;
drop policy if exists "member_waters_delete_same_club" on public.member_waters;

create policy "member_waters_select_user_or_manager_same_club"
on public.member_waters for select
to authenticated
using (
  auth.uid() = user_id
  or (
    public.is_admin_or_vorstand()
    and club_id is not null
    and public.is_same_club(club_id)
  )
);

create policy "member_waters_insert_user_or_manager_same_club"
on public.member_waters for insert
to authenticated
with check (
  auth.uid() = user_id
  or (
    public.is_admin_or_vorstand()
    and club_id is not null
    and public.is_same_club(club_id)
  )
);

create policy "member_waters_update_user_or_manager_same_club"
on public.member_waters for update
to authenticated
using (
  auth.uid() = user_id
  or (
    public.is_admin_or_vorstand()
    and club_id is not null
    and public.is_same_club(club_id)
  )
)
with check (
  auth.uid() = user_id
  or (
    public.is_admin_or_vorstand()
    and club_id is not null
    and public.is_same_club(club_id)
  )
);

create policy "member_waters_delete_user_or_manager_same_club"
on public.member_waters for delete
to authenticated
using (
  auth.uid() = user_id
  or (
    public.is_admin_or_vorstand()
    and club_id is not null
    and public.is_same_club(club_id)
  )
);

-- Mapping table remains manager-controlled, but do not require non-null club.
drop policy if exists "member_water_mappings_select_same_club" on public.member_water_mappings;
drop policy if exists "member_water_mappings_insert_same_club" on public.member_water_mappings;
drop policy if exists "member_water_mappings_update_manager_same_club" on public.member_water_mappings;
drop policy if exists "member_water_mappings_delete_manager_same_club" on public.member_water_mappings;

create policy "member_water_mappings_select_scoped"
on public.member_water_mappings for select
to authenticated
using (
  proposed_by = auth.uid()
  or (
    public.is_admin_or_vorstand()
    and club_id is not null
    and public.is_same_club(club_id)
  )
);

create policy "member_water_mappings_insert_scoped"
on public.member_water_mappings for insert
to authenticated
with check (
  proposed_by = auth.uid()
  or (
    public.is_admin_or_vorstand()
    and club_id is not null
    and public.is_same_club(club_id)
  )
);

create policy "member_water_mappings_update_manager_scoped"
on public.member_water_mappings for update
to authenticated
using (
  public.is_admin_or_vorstand()
  and club_id is not null
  and public.is_same_club(club_id)
)
with check (
  public.is_admin_or_vorstand()
  and club_id is not null
  and public.is_same_club(club_id)
);

create policy "member_water_mappings_delete_manager_scoped"
on public.member_water_mappings for delete
to authenticated
using (
  public.is_admin_or_vorstand()
  and club_id is not null
  and public.is_same_club(club_id)
);

-- -------------------------------------------------------------------
-- 4) Upsert RPC without mandatory club
-- -------------------------------------------------------------------
create or replace function public.member_water_upsert(
  p_name text,
  p_location_text text default null,
  p_description text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_used_on date default null
)
returns public.member_waters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_club_id uuid;
  v_row public.member_waters;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'member water name is required';
  end if;

  select p.club_id into v_club_id
  from public.profiles p
  where p.id = v_uid
  limit 1;

  insert into public.member_waters (
    club_id, user_id, name, location_text, description, latitude, longitude,
    usage_count, first_used_on, last_used_on, status
  )
  values (
    v_club_id, v_uid, trim(p_name), nullif(trim(p_location_text), ''), nullif(trim(p_description), ''),
    p_latitude, p_longitude,
    1, p_used_on, p_used_on, 'active'
  )
  on conflict (
    user_id, name_norm, coalesce(public.normalize_water_name(location_text), '')
  )
  do update
    set usage_count = public.member_waters.usage_count + 1,
        last_used_on = coalesce(excluded.last_used_on, public.member_waters.last_used_on),
        description = coalesce(excluded.description, public.member_waters.description),
        latitude = coalesce(excluded.latitude, public.member_waters.latitude),
        longitude = coalesce(excluded.longitude, public.member_waters.longitude),
        status = 'active',
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.member_water_upsert(text, text, text, numeric, numeric, date) to authenticated;

commit;

-- Verification:
-- select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='member_waters' and column_name='club_id';
-- select policyname from pg_policies where schemaname='public' and tablename='member_waters';
