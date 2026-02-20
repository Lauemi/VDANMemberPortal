-- VDAN Template — water areas map source for member portal
-- Run this after:
-- 19_member_card_validity.sql

begin;

create table if not exists public.water_areas (
  id uuid primary key default gen_random_uuid(),
  water_body_id uuid references public.water_bodies(id) on delete set null,
  name text not null,
  area_kind text not null check (area_kind in ('vereins_gemeinschaftsgewaesser','rheinlos39')),
  geojson jsonb not null,
  source text default 'google_my_maps',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_water_areas_kind_active
on public.water_areas(area_kind, is_active);

drop trigger if exists trg_water_areas_touch on public.water_areas;
create trigger trg_water_areas_touch
before update on public.water_areas
for each row execute function public.touch_updated_at();

alter table public.water_areas enable row level security;

grant select on public.water_areas to authenticated;
grant insert, update, delete on public.water_areas to authenticated;

drop policy if exists "water_areas_select_authenticated" on public.water_areas;
create policy "water_areas_select_authenticated"
on public.water_areas for select
using (auth.uid() is not null);

drop policy if exists "water_areas_write_manager" on public.water_areas;
create policy "water_areas_write_manager"
on public.water_areas for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

commit;

