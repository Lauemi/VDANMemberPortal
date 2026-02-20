-- VDAN Template — catch list core
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql

begin;

-- 1) Master data: water bodies
create table if not exists public.water_bodies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_kind text not null check (area_kind in ('vereins_gemeinschaftsgewaesser','rheinlos39')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, area_kind)
);

alter table public.water_bodies enable row level security;
grant select on public.water_bodies to anon, authenticated;
grant insert, update, delete on public.water_bodies to authenticated;

drop policy if exists "water_select_all" on public.water_bodies;
create policy "water_select_all"
on public.water_bodies for select
using (true);

drop policy if exists "water_write_manager" on public.water_bodies;
create policy "water_write_manager"
on public.water_bodies for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- 2) Master data: fish species
create table if not exists public.fish_species (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.fish_species enable row level security;
grant select on public.fish_species to anon, authenticated;
grant insert, update, delete on public.fish_species to authenticated;

drop policy if exists "species_select_all" on public.fish_species;
create policy "species_select_all"
on public.fish_species for select
using (true);

drop policy if exists "species_write_manager" on public.fish_species;
create policy "species_write_manager"
on public.fish_species for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- 3) Catch list records
create table if not exists public.catch_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  water_body_id uuid not null references public.water_bodies(id),
  fish_species_id uuid not null references public.fish_species(id),
  caught_on date not null,
  quantity integer not null check (quantity > 0 and quantity <= 200),
  length_cm numeric(5,1),
  weight_g integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length_cm is null or length_cm > 0),
  check (weight_g is null or weight_g > 0)
);

create index if not exists idx_catch_entries_user_date on public.catch_entries(user_id, caught_on desc);
create index if not exists idx_catch_entries_caught_on on public.catch_entries(caught_on desc);

alter table public.catch_entries enable row level security;
grant select, insert, update, delete on public.catch_entries to authenticated;

drop trigger if exists trg_catch_entries_touch on public.catch_entries;
create trigger trg_catch_entries_touch
before update on public.catch_entries
for each row execute function public.touch_updated_at();

-- own entries + manager override

drop policy if exists "catch_select_own_or_manager" on public.catch_entries;
create policy "catch_select_own_or_manager"
on public.catch_entries for select
using (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_insert_own_or_manager" on public.catch_entries;
create policy "catch_insert_own_or_manager"
on public.catch_entries for insert
with check ((auth.uid() = user_id) or public.is_admin_or_vorstand());

drop policy if exists "catch_update_own_or_manager" on public.catch_entries;
create policy "catch_update_own_or_manager"
on public.catch_entries for update
using ((auth.uid() = user_id) or public.is_admin_or_vorstand())
with check ((auth.uid() = user_id) or public.is_admin_or_vorstand());

drop policy if exists "catch_delete_own_or_manager" on public.catch_entries;
create policy "catch_delete_own_or_manager"
on public.catch_entries for delete
using ((auth.uid() = user_id) or public.is_admin_or_vorstand());

commit;
