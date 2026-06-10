-- =============================================================
-- admin_catch_stats_matrix(p_club_id uuid) — Korrektur
-- =============================================================
-- Vorher: Strukturquelle war species_in_club (nur Arten mit
-- vorhandenen catch_entries). Das liefert nur den belegten Raum.
--
-- Jetzt: Vollständiger fachlicher Raum.
--   Zeilen  = ALLE aktiven fish_species (global, kein Club-Filter)
--   Spalten = ALLE aktiven water_bodies des Clubs (club-scoped)
--   Werte   = SUM(quantity) — COALESCE auf 0 füllt den leeren Raum
--
-- Damit zeigt die Matrix auch Gewässer × Fischarten ohne einen
-- einzigen Eintrag, was fachlich korrekt ist.
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
  all_species as (
    select fs.id, fs.name
    from public.fish_species fs
    where fs.is_active = true
  )
  select
    sp.id                        as fish_species_id,
    sp.name                      as fish_species_name,
    cw.id                        as water_body_id,
    cw.name                      as water_body_name,
    coalesce(sum(ce.quantity), 0) as total_quantity
  from _guard
  cross join all_species sp
  cross join club_waters cw
  left join public.catch_entries ce
    on  ce.fish_species_id = sp.id
    and ce.water_body_id   = cw.id
  group by sp.id, sp.name, cw.id, cw.name
  order by sp.name, cw.name;
$$;

revoke all on function public.admin_catch_stats_matrix(uuid) from public, anon;
grant execute on function public.admin_catch_stats_matrix(uuid) to authenticated;
grant execute on function public.admin_catch_stats_matrix(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
