-- VDAN Template — PAKET_1_CATCHES
-- Run this after:
-- 29_catch_whitefish_daily_limit.sql

begin;

-- =========================================
-- 1) Angeltage (Trips/Sessions)
-- =========================================
create table if not exists public.fishing_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  water_body_id uuid not null references public.water_bodies(id),
  trip_date date not null,
  entry_type text not null default 'catch',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_type in ('catch', 'no_catch'))
);

create unique index if not exists uq_fishing_trips_user_date_water
  on public.fishing_trips(user_id, trip_date, water_body_id);

create index if not exists idx_fishing_trips_user_trip_date
  on public.fishing_trips(user_id, trip_date desc);

create index if not exists idx_fishing_trips_trip_date
  on public.fishing_trips(trip_date desc);

alter table public.fishing_trips enable row level security;
grant select, insert, update, delete on public.fishing_trips to authenticated;

drop trigger if exists trg_fishing_trips_touch on public.fishing_trips;
create trigger trg_fishing_trips_touch
before update on public.fishing_trips
for each row execute function public.touch_updated_at();

drop policy if exists "fishing_trips_select_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_select_own_or_manager"
on public.fishing_trips for select
using (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "fishing_trips_insert_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_insert_own_or_manager"
on public.fishing_trips for insert
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "fishing_trips_update_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_update_own_or_manager"
on public.fishing_trips for update
using (auth.uid() = user_id or public.is_admin_or_vorstand())
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "fishing_trips_delete_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_delete_own_or_manager"
on public.fishing_trips for delete
using (auth.uid() = user_id or public.is_admin_or_vorstand());

-- =========================================
-- 2) Sync catch_entries -> fishing_trips
-- =========================================
create or replace function public.sync_fishing_trip_from_catch_entry()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null or new.caught_on is null or new.water_body_id is null then
    return new;
  end if;

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
  values (new.user_id, new.water_body_id, new.caught_on, 'catch')
  on conflict (user_id, trip_date, water_body_id)
  do update
    set entry_type = 'catch',
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_fishing_trip_from_catch_entry on public.catch_entries;
create trigger trg_sync_fishing_trip_from_catch_entry
before insert or update of user_id, caught_on, water_body_id on public.catch_entries
for each row
execute function public.sync_fishing_trip_from_catch_entry();

-- Backfill existing catches into trips.
insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
select ce.user_id, ce.water_body_id, ce.caught_on, 'catch'
from public.catch_entries ce
on conflict (user_id, trip_date, water_body_id) do update
set entry_type = 'catch',
    updated_at = now();

-- =========================================
-- 3) Quick insert path for "Kein Fang"
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

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type, note)
  values (v_uid, p_water_body_id, p_trip_date, 'no_catch', nullif(trim(p_note), ''))
  on conflict (user_id, trip_date, water_body_id)
  do update
    set note = coalesce(nullif(trim(excluded.note), ''), public.fishing_trips.note),
        updated_at = now()
  where public.fishing_trips.entry_type = 'no_catch'
  returning * into v_row;

  if v_row.id is null then
    select *
      into v_row
    from public.fishing_trips
    where user_id = v_uid
      and trip_date = p_trip_date
      and water_body_id = p_water_body_id
    limit 1;
  end if;

  return v_row;
end;
$$;

grant execute on function public.catch_trip_quick_no_catch(date, uuid, text) to authenticated;

-- =========================================
-- 4) Admin-Kennzahlen pro Mitglied
-- =========================================
create or replace function public.admin_catch_member_stats()
returns table (
  user_id uuid,
  member_no text,
  display_name text,
  angeltage_count bigint,
  no_catch_count bigint,
  catches_total_qty bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can access catch stats';
  end if;

  return query
  with base_users as (
    select distinct ft.user_id
    from public.fishing_trips ft
    union
    select distinct ce.user_id
    from public.catch_entries ce
  ),
  trip_stats as (
    select
      ft.user_id,
      count(distinct ft.trip_date)::bigint as angeltage_count,
      count(*) filter (where ft.entry_type = 'no_catch')::bigint as no_catch_count
    from public.fishing_trips ft
    group by ft.user_id
  ),
  catch_stats as (
    select
      ce.user_id,
      coalesce(sum(ce.quantity), 0)::bigint as catches_total_qty
    from public.catch_entries ce
    group by ce.user_id
  )
  select
    bu.user_id,
    p.member_no,
    p.display_name,
    coalesce(ts.angeltage_count, 0)::bigint,
    coalesce(ts.no_catch_count, 0)::bigint,
    coalesce(cs.catches_total_qty, 0)::bigint
  from base_users bu
  left join public.profiles p on p.id = bu.user_id
  left join trip_stats ts on ts.user_id = bu.user_id
  left join catch_stats cs on cs.user_id = bu.user_id
  order by p.member_no nulls last, p.display_name nulls last, bu.user_id;
end;
$$;

grant execute on function public.admin_catch_member_stats() to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='fishing_trips';
-- select count(*) from public.fishing_trips;
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('catch_trip_quick_no_catch','admin_catch_member_stats','sync_fishing_trip_from_catch_entry');
-- select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='catch_entries' and t.tgname='trg_sync_fishing_trip_from_catch_entry';
