-- VDAN/FCP - Hotfix: official rows must not stay unmapped
-- Run after:
--   78_member_waters_and_mapping_live_safe.sql
--
-- Purpose:
--   - Backfill existing official rows to mapping_status='mapped'
--   - Enforce stable defaults for future inserts/updates
--   - Keep live system backward compatible

begin;

-- -------------------------------------------------------------------
-- 1) Backfill inconsistent historic rows
-- -------------------------------------------------------------------
update public.fishing_trips
   set mapping_status = 'mapped',
       water_name_raw = null
 where water_source = 'official'
   and water_body_id is not null
   and (mapping_status is null or mapping_status <> 'mapped' or water_name_raw is not null);

update public.catch_entries
   set mapping_status = 'mapped',
       water_name_raw = null
 where water_source = 'official'
   and water_body_id is not null
   and (mapping_status is null or mapping_status <> 'mapped' or water_name_raw is not null);

update public.fishing_trips
   set mapping_status = 'unmapped'
 where water_source = 'member'
   and member_water_id is not null
   and mapping_status is null;

update public.catch_entries
   set mapping_status = 'unmapped'
 where water_source = 'member'
   and member_water_id is not null
   and mapping_status is null;

-- -------------------------------------------------------------------
-- 2) Guard function for consistent source/mapping defaults
-- -------------------------------------------------------------------
create or replace function public.enforce_water_context_defaults()
returns trigger
language plpgsql
as $$
declare
  v_source text;
begin
  v_source := coalesce(new.water_source, case when new.member_water_id is not null then 'member' else 'official' end);
  new.water_source := v_source;

  if v_source = 'official' then
    new.member_water_id := null;
    new.water_name_raw := null;
    new.mapping_status := 'mapped';
    return new;
  end if;

  -- member source
  new.water_body_id := null;
  if new.mapping_status is null then
    new.mapping_status := 'unmapped';
  end if;
  if new.water_name_raw is null and new.member_water_id is not null then
    select mw.name into new.water_name_raw
    from public.member_waters mw
    where mw.id = new.member_water_id
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fishing_trips_enforce_water_context_defaults on public.fishing_trips;
create trigger trg_fishing_trips_enforce_water_context_defaults
before insert or update of water_source, water_body_id, member_water_id, mapping_status, water_name_raw
on public.fishing_trips
for each row execute function public.enforce_water_context_defaults();

drop trigger if exists trg_catch_entries_enforce_water_context_defaults on public.catch_entries;
create trigger trg_catch_entries_enforce_water_context_defaults
before insert or update of water_source, water_body_id, member_water_id, mapping_status, water_name_raw
on public.catch_entries
for each row execute function public.enforce_water_context_defaults();

commit;

-- Verification:
-- select water_source, mapping_status, count(*) from public.fishing_trips group by 1,2 order by 1,2;
-- select water_source, mapping_status, count(*) from public.catch_entries group by 1,2 order by 1,2;
