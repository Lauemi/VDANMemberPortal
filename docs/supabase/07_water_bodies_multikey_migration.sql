-- VDAN Template — migration for existing DBs
-- Enables same water name in multiple keys (e.g. Angelweiher)

begin;

alter table public.water_bodies
  drop constraint if exists water_bodies_name_key;

alter table public.water_bodies
  add constraint water_bodies_name_area_kind_key unique (name, area_kind);

commit;
