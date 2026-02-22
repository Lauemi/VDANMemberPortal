-- VDAN Template — catch whitefish daily limit
-- Run this after:
-- 28_contact_requests.sql

begin;

-- Extend existing fish master data to classify whitefish species.
alter table if exists public.fish_species
  add column if not exists is_whitefish boolean not null default false;

-- Baseline classification for existing seed species.
update public.fish_species
set is_whitefish = true
where lower(name) in ('brasse', 'rotauge')
  and coalesce(is_whitefish, false) = false;

-- Guard: max 25 whitefish per user per day.
create or replace function public.enforce_whitefish_daily_limit()
returns trigger
language plpgsql
as $$
declare
  is_target_whitefish boolean;
  current_total integer;
begin
  -- No-op when required columns are missing in incoming row.
  if new.user_id is null or new.fish_species_id is null or new.caught_on is null or new.quantity is null then
    return new;
  end if;

  select coalesce(fs.is_whitefish, false)
    into is_target_whitefish
  from public.fish_species fs
  where fs.id = new.fish_species_id;

  -- Rule applies only to whitefish rows.
  if not coalesce(is_target_whitefish, false) then
    return new;
  end if;

  select coalesce(sum(ce.quantity), 0)
    into current_total
  from public.catch_entries ce
  join public.fish_species fs on fs.id = ce.fish_species_id
  where ce.user_id = new.user_id
    and ce.caught_on = new.caught_on
    and coalesce(fs.is_whitefish, false) = true
    and (tg_op <> 'UPDATE' or ce.id <> new.id);

  if current_total + new.quantity > 25 then
    raise exception 'Taegliches Limit fuer Weissfische ueberschritten (max 25). Aktuell: %, Neu: %', current_total, new.quantity
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_whitefish_daily_limit on public.catch_entries;
create trigger trg_enforce_whitefish_daily_limit
before insert or update on public.catch_entries
for each row
execute function public.enforce_whitefish_daily_limit();

commit;

-- Verification
-- select column_name, data_type from information_schema.columns where table_schema='public' and table_name='fish_species' and column_name='is_whitefish';
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='enforce_whitefish_daily_limit';
-- select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='catch_entries' and t.tgname='trg_enforce_whitefish_daily_limit';
