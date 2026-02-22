-- VDAN Template — Fangliste: multiple entries per day + editable trip/catch mapping
-- Run this after:
-- 36_feed_members_only_category.sql

begin;

-- =========================================
-- 1) Allow multiple catch trips per day/water, but keep no_catch unique
-- =========================================
drop index if exists public.uq_fishing_trips_user_date_water;

create unique index if not exists uq_fishing_trips_user_date_water_no_catch
  on public.fishing_trips(user_id, trip_date, water_body_id)
  where entry_type = 'no_catch';

-- =========================================
-- 2) Link catches directly to trip rows for reliable editing/detail views
-- =========================================
alter table if exists public.catch_entries
  add column if not exists fishing_trip_id uuid references public.fishing_trips(id) on delete set null;

create index if not exists idx_catch_entries_trip_id
  on public.catch_entries(fishing_trip_id);

-- Backfill relation for existing catch rows (best-match by user/date/water).
with matched as (
  select
    ce.id as catch_id,
    (
      select ft.id
      from public.fishing_trips ft
      where ft.user_id = ce.user_id
        and ft.trip_date = ce.caught_on
        and ft.water_body_id = ce.water_body_id
        and ft.entry_type = 'catch'
      order by ft.created_at asc, ft.id asc
      limit 1
    ) as trip_id
  from public.catch_entries ce
  where ce.fishing_trip_id is null
), created_trips as (
  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
  select ce.user_id, ce.water_body_id, ce.caught_on, 'catch'
  from public.catch_entries ce
  where ce.fishing_trip_id is null
    and not exists (
      select 1
      from public.fishing_trips ft
      where ft.user_id = ce.user_id
        and ft.trip_date = ce.caught_on
        and ft.water_body_id = ce.water_body_id
        and ft.entry_type = 'catch'
    )
  returning id, user_id, water_body_id, trip_date
), rematched as (
  select
    ce.id as catch_id,
    coalesce(m.trip_id,
      (
        select ft.id
        from public.fishing_trips ft
        where ft.user_id = ce.user_id
          and ft.trip_date = ce.caught_on
          and ft.water_body_id = ce.water_body_id
          and ft.entry_type = 'catch'
        order by ft.created_at asc, ft.id asc
        limit 1
      )
    ) as trip_id
  from public.catch_entries ce
  left join matched m on m.catch_id = ce.id
  where ce.fishing_trip_id is null
)
update public.catch_entries ce
set fishing_trip_id = r.trip_id
from rematched r
where ce.id = r.catch_id
  and ce.fishing_trip_id is null
  and r.trip_id is not null;

-- =========================================
-- 3) Keep trip relation in sync when catch rows are inserted/updated
-- =========================================
create or replace function public.sync_fishing_trip_from_catch_entry()
returns trigger
language plpgsql
as $$
declare
  v_trip_id uuid;
begin
  if new.user_id is null or new.caught_on is null or new.water_body_id is null then
    return new;
  end if;

  if new.fishing_trip_id is not null then
    update public.fishing_trips
      set user_id = new.user_id,
          water_body_id = new.water_body_id,
          trip_date = new.caught_on,
          entry_type = 'catch',
          updated_at = now()
    where id = new.fishing_trip_id;

    return new;
  end if;

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
  values (new.user_id, new.water_body_id, new.caught_on, 'catch')
  returning id into v_trip_id;

  new.fishing_trip_id := v_trip_id;
  return new;
end;
$$;

-- =========================================
-- 4) Quick no-catch insert/update without depending on old full unique index
-- =========================================
create or replace function public.catch_trip_quick_no_catch(
  p_trip_date date,
  p_water_body_id uuid,
  p_note text default null
)
returns public.fishing_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fishing_trips;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_trip_date is null then
    raise exception 'trip_date is required';
  end if;

  if p_water_body_id is null then
    raise exception 'water_body_id is required';
  end if;

  select *
    into v_row
  from public.fishing_trips ft
  where ft.user_id = v_uid
    and ft.trip_date = p_trip_date
    and ft.water_body_id = p_water_body_id
    and ft.entry_type = 'no_catch'
  order by ft.created_at desc
  limit 1;

  if v_row.id is not null then
    update public.fishing_trips
      set note = coalesce(nullif(trim(p_note), ''), note),
          updated_at = now()
    where id = v_row.id
    returning * into v_row;

    return v_row;
  end if;

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type, note)
  values (v_uid, p_water_body_id, p_trip_date, 'no_catch', nullif(trim(p_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;

commit;

-- Verification
-- select indexname from pg_indexes where schemaname='public' and tablename='fishing_trips' and indexname in ('uq_fishing_trips_user_date_water','uq_fishing_trips_user_date_water_no_catch');
-- select column_name from information_schema.columns where table_schema='public' and table_name='catch_entries' and column_name='fishing_trip_id';
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sync_fishing_trip_from_catch_entry','catch_trip_quick_no_catch');
