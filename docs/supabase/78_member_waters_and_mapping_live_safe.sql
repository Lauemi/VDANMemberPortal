-- VDAN/FCP - Live-safe rollout: member waters + mapping foundation
-- Run after:
--   77_fish_rules_mvp_bw.sql
--
-- Goals:
--   1) Keep official club waters untouched
--   2) Add separate member-managed free waters
--   3) Make catch storage source-aware (official vs member)
--   4) Enable controlled mapping from member waters -> official waters
--
-- Notes for live operation:
--   - Additive/idempotent where possible
--   - Existing official-water flow keeps working
--   - No auto-merge into official master data

begin;

-- -------------------------------------------------------------------
-- 0) Helper: normalize water name for matching/dedup
-- -------------------------------------------------------------------
create or replace function public.normalize_water_name(p_text text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      lower(
        translate(
          coalesce(p_text, ''),
          'ÄÖÜäöüß',
          'AOUaouss'
        )
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  )
$$;

-- -------------------------------------------------------------------
-- 1) Member/free waters (separate from official public.water_bodies)
-- -------------------------------------------------------------------
create table if not exists public.member_waters (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_norm text generated always as (public.normalize_water_name(name)) stored,
  location_text text,
  description text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  usage_count integer not null default 1 check (usage_count >= 1),
  first_used_on date,
  last_used_on date,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(name)) >= 2),
  check (latitude is null or (latitude >= -90 and latitude <= 90)),
  check (longitude is null or (longitude >= -180 and longitude <= 180))
);

create index if not exists idx_member_waters_club_user on public.member_waters(club_id, user_id);
create index if not exists idx_member_waters_club_name_norm on public.member_waters(club_id, name_norm);
create index if not exists idx_member_waters_status on public.member_waters(status);

create unique index if not exists uq_member_waters_owner_norm_location
  on public.member_waters (
    club_id,
    user_id,
    name_norm,
    coalesce(public.normalize_water_name(location_text), '')
  );

alter table public.member_waters enable row level security;
grant select, insert, update, delete on public.member_waters to authenticated;

drop trigger if exists trg_member_waters_touch on public.member_waters;
create trigger trg_member_waters_touch
before update on public.member_waters
for each row execute function public.touch_updated_at();

drop trigger if exists trg_member_waters_ensure_club_id on public.member_waters;
create trigger trg_member_waters_ensure_club_id
before insert on public.member_waters
for each row execute function public.ensure_row_club_id();

drop policy if exists "member_waters_select_same_club" on public.member_waters;
create policy "member_waters_select_same_club"
on public.member_waters for select
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

drop policy if exists "member_waters_insert_same_club" on public.member_waters;
create policy "member_waters_insert_same_club"
on public.member_waters for insert
to authenticated
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

drop policy if exists "member_waters_update_same_club" on public.member_waters;
create policy "member_waters_update_same_club"
on public.member_waters for update
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
)
with check (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

drop policy if exists "member_waters_delete_same_club" on public.member_waters;
create policy "member_waters_delete_same_club"
on public.member_waters for delete
to authenticated
using (
  public.is_same_club(club_id)
  and (auth.uid() = user_id or public.is_admin_or_vorstand())
);

-- -------------------------------------------------------------------
-- 2) Mapping layer (explicit, reviewable, non-destructive)
-- -------------------------------------------------------------------
create table if not exists public.member_water_mappings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  member_water_id uuid not null references public.member_waters(id) on delete cascade,
  water_body_id uuid not null references public.water_bodies(id) on delete restrict,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  reason text,
  proposed_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_water_id, water_body_id)
);

create index if not exists idx_member_water_mappings_club_status
  on public.member_water_mappings(club_id, status, created_at desc);

create index if not exists idx_member_water_mappings_member_water
  on public.member_water_mappings(member_water_id);

alter table public.member_water_mappings enable row level security;
grant select, insert, update, delete on public.member_water_mappings to authenticated;

drop trigger if exists trg_member_water_mappings_touch on public.member_water_mappings;
create trigger trg_member_water_mappings_touch
before update on public.member_water_mappings
for each row execute function public.touch_updated_at();

drop trigger if exists trg_member_water_mappings_ensure_club_id on public.member_water_mappings;
create trigger trg_member_water_mappings_ensure_club_id
before insert on public.member_water_mappings
for each row execute function public.ensure_row_club_id();

drop policy if exists "member_water_mappings_select_same_club" on public.member_water_mappings;
create policy "member_water_mappings_select_same_club"
on public.member_water_mappings for select
to authenticated
using (
  public.is_same_club(club_id)
  and (public.is_admin_or_vorstand() or proposed_by = auth.uid())
);

drop policy if exists "member_water_mappings_insert_same_club" on public.member_water_mappings;
create policy "member_water_mappings_insert_same_club"
on public.member_water_mappings for insert
to authenticated
with check (
  public.is_same_club(club_id)
  and (public.is_admin_or_vorstand() or proposed_by = auth.uid())
);

drop policy if exists "member_water_mappings_update_manager_same_club" on public.member_water_mappings;
create policy "member_water_mappings_update_manager_same_club"
on public.member_water_mappings for update
to authenticated
using (
  public.is_same_club(club_id)
  and public.is_admin_or_vorstand()
)
with check (
  public.is_same_club(club_id)
  and public.is_admin_or_vorstand()
);

drop policy if exists "member_water_mappings_delete_manager_same_club" on public.member_water_mappings;
create policy "member_water_mappings_delete_manager_same_club"
on public.member_water_mappings for delete
to authenticated
using (
  public.is_same_club(club_id)
  and public.is_admin_or_vorstand()
);

-- -------------------------------------------------------------------
-- 3) Extend existing catch tables for source-aware water context
-- -------------------------------------------------------------------
alter table if exists public.fishing_trips
  add column if not exists member_water_id uuid references public.member_waters(id) on delete set null,
  add column if not exists water_source text not null default 'official',
  add column if not exists mapped_water_body_id uuid references public.water_bodies(id) on delete set null,
  add column if not exists water_name_raw text,
  add column if not exists mapping_status text not null default 'unmapped';

alter table if exists public.catch_entries
  add column if not exists member_water_id uuid references public.member_waters(id) on delete set null,
  add column if not exists water_source text not null default 'official',
  add column if not exists mapped_water_body_id uuid references public.water_bodies(id) on delete set null,
  add column if not exists water_name_raw text,
  add column if not exists mapping_status text not null default 'unmapped';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fishing_trips_water_source_ck'
      and conrelid = 'public.fishing_trips'::regclass
  ) then
    alter table public.fishing_trips
      add constraint fishing_trips_water_source_ck
      check (water_source in ('official','member')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fishing_trips_mapping_status_ck'
      and conrelid = 'public.fishing_trips'::regclass
  ) then
    alter table public.fishing_trips
      add constraint fishing_trips_mapping_status_ck
      check (mapping_status in ('unmapped','suggested','mapped','rejected')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fishing_trips_water_context_ck'
      and conrelid = 'public.fishing_trips'::regclass
  ) then
    alter table public.fishing_trips
      add constraint fishing_trips_water_context_ck
      check (
        (water_source = 'official' and water_body_id is not null and member_water_id is null)
        or
        (water_source = 'member' and member_water_id is not null and water_body_id is null)
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catch_entries_water_source_ck'
      and conrelid = 'public.catch_entries'::regclass
  ) then
    alter table public.catch_entries
      add constraint catch_entries_water_source_ck
      check (water_source in ('official','member')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catch_entries_mapping_status_ck'
      and conrelid = 'public.catch_entries'::regclass
  ) then
    alter table public.catch_entries
      add constraint catch_entries_mapping_status_ck
      check (mapping_status in ('unmapped','suggested','mapped','rejected')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'catch_entries_water_context_ck'
      and conrelid = 'public.catch_entries'::regclass
  ) then
    alter table public.catch_entries
      add constraint catch_entries_water_context_ck
      check (
        (water_source = 'official' and water_body_id is not null and member_water_id is null)
        or
        (water_source = 'member' and member_water_id is not null and water_body_id is null)
      ) not valid;
  end if;
end $$;

-- Required for member-source rows.
alter table if exists public.fishing_trips alter column water_body_id drop not null;
alter table if exists public.catch_entries alter column water_body_id drop not null;

create index if not exists idx_fishing_trips_member_water_id on public.fishing_trips(member_water_id);
create index if not exists idx_catch_entries_member_water_id on public.catch_entries(member_water_id);
create index if not exists idx_fishing_trips_water_source on public.fishing_trips(water_source);
create index if not exists idx_catch_entries_water_source on public.catch_entries(water_source);

-- Rebuild no-catch unique indexes to support both sources.
drop index if exists public.uq_fishing_trips_user_date_water_no_catch;

create unique index if not exists uq_fishing_trips_user_date_official_no_catch
  on public.fishing_trips(user_id, trip_date, water_body_id)
  where entry_type = 'no_catch' and water_source = 'official' and water_body_id is not null;

create unique index if not exists uq_fishing_trips_user_date_member_no_catch
  on public.fishing_trips(user_id, trip_date, member_water_id)
  where entry_type = 'no_catch' and water_source = 'member' and member_water_id is not null;

-- -------------------------------------------------------------------
-- 4) Keep club_id inference compatible for member_water_id insert paths
-- -------------------------------------------------------------------
create or replace function public.ensure_row_club_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_new jsonb;
  v_uid uuid;
  v_club uuid;
  v_txt text;
begin
  v_new := to_jsonb(new);

  if new.club_id is not null then
    return new;
  end if;

  v_uid := null;
  for v_txt in
    select value
    from jsonb_each_text(v_new)
    where key in ('user_id','auth_uid','author_id','created_by')
      and value is not null
  loop
    begin
      v_uid := v_txt::uuid;
      exit;
    exception when others then
      -- continue
    end;
  end loop;

  if v_uid is not null then
    select p.club_id into v_club
    from public.profiles p
    where p.id = v_uid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'post_id') and nullif(v_new->>'post_id','') is not null then
    select fp.club_id into v_club
    from public.feed_posts fp
    where fp.id = (v_new->>'post_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'event_id') and nullif(v_new->>'event_id','') is not null then
    select we.club_id into v_club
    from public.work_events we
    where we.id = (v_new->>'event_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'work_event_id') and nullif(v_new->>'work_event_id','') is not null then
    select we.club_id into v_club
    from public.work_events we
    where we.id = (v_new->>'work_event_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'session_id') and nullif(v_new->>'session_id','') is not null then
    select ms.club_id into v_club
    from public.meeting_sessions ms
    where ms.id = (v_new->>'session_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'task_id') and nullif(v_new->>'task_id','') is not null then
    select mt.club_id into v_club
    from public.meeting_tasks mt
    where mt.id = (v_new->>'task_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'member_id') and nullif(v_new->>'member_id','') is not null then
    select m.club_id into v_club
    from public.members m
    where m.id = (v_new->>'member_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'application_id') and nullif(v_new->>'application_id','') is not null then
    select ma.club_id into v_club
    from public.membership_applications ma
    where ma.id = (v_new->>'application_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'water_body_id') and nullif(v_new->>'water_body_id','') is not null then
    select wb.club_id into v_club
    from public.water_bodies wb
    where wb.id = (v_new->>'water_body_id')::uuid
    limit 1;
  end if;

  if v_club is null and (v_new ? 'member_water_id') and nullif(v_new->>'member_water_id','') is not null then
    select mw.club_id into v_club
    from public.member_waters mw
    where mw.id = (v_new->>'member_water_id')::uuid
    limit 1;
  end if;

  if v_club is null then
    v_club := public.public_active_club_id();
  end if;

  new.club_id := v_club;
  return new;
end;
$$;

-- -------------------------------------------------------------------
-- 5) Sync function: catch_entries -> fishing_trips for both water sources
-- -------------------------------------------------------------------
create or replace function public.sync_fishing_trip_from_catch_entry()
returns trigger
language plpgsql
as $$
declare
  v_trip_id uuid;
  v_source text;
begin
  v_source := coalesce(new.water_source, case when new.member_water_id is not null then 'member' else 'official' end);
  new.water_source := v_source;

  if new.user_id is null or new.caught_on is null then
    return new;
  end if;

  if v_source = 'member' and new.member_water_id is null then
    return new;
  end if;

  if v_source = 'official' and new.water_body_id is null then
    return new;
  end if;

  if new.fishing_trip_id is not null then
    update public.fishing_trips
      set user_id = new.user_id,
          water_body_id = case when v_source = 'official' then new.water_body_id else null end,
          member_water_id = case when v_source = 'member' then new.member_water_id else null end,
          trip_date = new.caught_on,
          entry_type = 'catch',
          water_source = v_source,
          water_name_raw = coalesce(new.water_name_raw, water_name_raw),
          mapping_status = coalesce(new.mapping_status, mapping_status),
          updated_at = now()
    where id = new.fishing_trip_id;
    return new;
  end if;

  insert into public.fishing_trips (
    user_id,
    water_body_id,
    member_water_id,
    trip_date,
    entry_type,
    water_source,
    water_name_raw,
    mapping_status
  )
  values (
    new.user_id,
    case when v_source = 'official' then new.water_body_id else null end,
    case when v_source = 'member' then new.member_water_id else null end,
    new.caught_on,
    'catch',
    v_source,
    new.water_name_raw,
    coalesce(new.mapping_status, 'unmapped')
  )
  returning id into v_trip_id;

  new.fishing_trip_id := v_trip_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_fishing_trip_from_catch_entry on public.catch_entries;
create trigger trg_sync_fishing_trip_from_catch_entry
before insert or update of user_id, caught_on, water_body_id, member_water_id, water_source on public.catch_entries
for each row
execute function public.sync_fishing_trip_from_catch_entry();

-- -------------------------------------------------------------------
-- 6) RPC: upsert member water + no-catch for member water source
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

  v_club_id := public.current_user_club_id();
  if v_club_id is null then
    raise exception 'club_id missing for current user';
  end if;

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
    club_id, user_id, name_norm, coalesce(public.normalize_water_name(location_text), '')
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

create or replace function public.catch_trip_quick_no_catch_member(
  p_trip_date date,
  p_member_water_name text,
  p_location_text text default null,
  p_note text default null
)
returns public.fishing_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_member_water public.member_waters;
  v_row public.fishing_trips;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_trip_date is null then
    raise exception 'trip_date is required';
  end if;

  v_member_water := public.member_water_upsert(
    p_name := p_member_water_name,
    p_location_text := p_location_text,
    p_description := null,
    p_latitude := null,
    p_longitude := null,
    p_used_on := p_trip_date
  );

  insert into public.fishing_trips (
    user_id,
    water_body_id,
    member_water_id,
    trip_date,
    entry_type,
    note,
    water_source,
    water_name_raw,
    mapping_status
  )
  values (
    v_uid,
    null,
    v_member_water.id,
    p_trip_date,
    'no_catch',
    nullif(trim(p_note), ''),
    'member',
    v_member_water.name,
    'unmapped'
  )
  on conflict (user_id, trip_date, member_water_id)
  where entry_type = 'no_catch' and water_source = 'member'
  do update
    set note = coalesce(nullif(trim(excluded.note), ''), public.fishing_trips.note),
        water_name_raw = coalesce(public.fishing_trips.water_name_raw, excluded.water_name_raw),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.catch_trip_quick_no_catch_member(date, text, text, text) to authenticated;

-- -------------------------------------------------------------------
-- 7) Candidate suggestions (controlled matching, no auto-merge)
-- -------------------------------------------------------------------
create or replace function public.member_water_match_candidates(
  p_member_water_id uuid,
  p_limit integer default 10
)
returns table (
  water_body_id uuid,
  water_name text,
  score numeric,
  reason text
)
language sql
stable
as $$
  with mw as (
    select
      id,
      club_id,
      name,
      public.normalize_water_name(name) as n
    from public.member_waters
    where id = p_member_water_id
  ),
  wb as (
    select
      id,
      name,
      club_id,
      public.normalize_water_name(name) as n
    from public.water_bodies
  )
  select
    wb.id as water_body_id,
    wb.name as water_name,
    case
      when wb.n = mw.n then 1.0
      when wb.n like mw.n || '%' or mw.n like wb.n || '%' then 0.86
      when wb.n like '%' || mw.n || '%' or mw.n like '%' || wb.n || '%' then 0.72
      else 0.35
    end::numeric as score,
    case
      when wb.n = mw.n then 'exact_name_match'
      when wb.n like mw.n || '%' or mw.n like wb.n || '%' then 'prefix_name_match'
      when wb.n like '%' || mw.n || '%' or mw.n like '%' || wb.n || '%' then 'contains_name_match'
      else 'weak_name_match'
    end::text as reason
  from mw
  join wb
    on wb.club_id = mw.club_id
  where mw.n <> ''
  order by score desc, wb.name asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

grant execute on function public.member_water_match_candidates(uuid, integer) to authenticated;

commit;

-- Verification hints:
-- select to_regclass('public.member_waters');
-- select to_regclass('public.member_water_mappings');
-- select column_name from information_schema.columns where table_schema='public' and table_name='fishing_trips' and column_name in ('member_water_id','water_source','mapping_status');
-- select column_name from information_schema.columns where table_schema='public' and table_name='catch_entries' and column_name in ('member_water_id','water_source','mapping_status');
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('member_water_upsert','catch_trip_quick_no_catch_member','member_water_match_candidates');
