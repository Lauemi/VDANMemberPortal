-- =============================================================
-- admin_catch_stats_matrix(p_club_id uuid)
-- =============================================================
-- Fangstatistik-Aggregation fuer die Matrix-Ansicht im ADM-Modul
-- Natur / Gewaesser.
--
-- Gibt flache Zeilen zurueck (Fischart x Gewaesser x Mengensumme).
-- Nur Fischarten, fuer die mindestens ein Eintrag in den Gewaessern
-- dieses Clubs existiert. Null-Zellen werden per COALESCE auf 0
-- gesetzt (alle bekannten Gewaesser erscheinen als Spalten).
--
-- Felder:
--   fish_species_id    uuid  — FK auf public.fish_species
--   fish_species_name  text  — Zeilenbezeichnung
--   water_body_id      uuid  — FK auf public.water_bodies
--   water_body_name    text  — Spaltenbezeichnung
--   total_quantity     bigint — Summe gefangener Fische (SUM(quantity))
--
-- Zugriff: nur admin / vorstand / superadmin im angefragten Club.
-- =============================================================

begin;

drop function if exists public.admin_catch_stats_matrix(uuid);

create or replace function public.admin_catch_stats_matrix(p_club_id uuid)
returns table (
  fish_species_id   uuid,
  fish_species_name text,
  water_body_id     uuid,
  water_body_name   text,
  total_quantity    bigint
)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  with
  _guard as (
    select 1
    where (
      current_user in ('postgres', 'service_role')
      or public.is_admin_in_any_club()
      or public.is_admin_or_vorstand_in_club(p_club_id)
    )
  ),
  club_waters as (
    select wb.id, wb.name
    from public.water_bodies wb
    where wb.club_id   = p_club_id
      and wb.is_active = true
  ),
  species_in_club as (
    select distinct ce.fish_species_id
    from public.catch_entries ce
    join club_waters cw on cw.id = ce.water_body_id
  )
  select
    fs.id                        as fish_species_id,
    fs.name                      as fish_species_name,
    cw.id                        as water_body_id,
    cw.name                      as water_body_name,
    coalesce(sum(ce.quantity), 0) as total_quantity
  from _guard
  cross join species_in_club sic
  join public.fish_species fs on fs.id = sic.fish_species_id
  cross join club_waters cw
  left join public.catch_entries ce
    on  ce.fish_species_id = fs.id
    and ce.water_body_id   = cw.id
  group by fs.id, fs.name, cw.id, cw.name
  order by fs.name, cw.name;
$$;

revoke all on function public.admin_catch_stats_matrix(uuid) from public, anon;
grant execute on function public.admin_catch_stats_matrix(uuid) to authenticated;
grant execute on function public.admin_catch_stats_matrix(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
