-- =============================================================
-- admin_permit_water_overview(p_club_id uuid)
-- =============================================================
-- Admin-Reader für die Permit-Prüfsicht (/app/permit-wahrheit/).
--
-- Liest ausschließlich:
--   permit_card_types  → Kartentypen des Clubs (via tenant_nodes)
--   permit_water_links → Verknüpfungen Karte ↔ Gewässer
--   water_bodies       → Gewässer-Stammdaten (club-scoped)
--   water_areas        → GeoJSON-Polygone (für area_count)
--
-- Felder exakt passend zum bestehenden public/js/permit-wahrheit.js:
--   card_title, card_type_key, water_name, water_area_kind,
--   area_count, water_is_active, mapping_status
--
-- mapping_status-Werte:
--   ok             → genau 1 aktive Area verknüpft
--   multi_area     → > 1 aktive Areas für denselben Body
--   missing_area   → Body existiert und ist aktiv, aber 0 Areas mit water_body_id
--   inactive_water → Body existiert aber is_active = false
--   orphaned_link  → legacy_water_body_id zeigt auf nichtexistenten Body
--
-- Zugriff: nur admin / vorstand / superadmin im angefragten Club.
-- =============================================================

begin;

drop function if exists public.admin_permit_water_overview(uuid);

create or replace function public.admin_permit_water_overview(p_club_id uuid)
returns table (
  card_type_id    uuid,
  card_type_key   text,
  card_title      text,
  water_body_id   uuid,
  water_name      text,
  water_area_kind text,
  water_is_active boolean,
  area_count      bigint,
  mapping_status  text
)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  with
  -- Zugriff-Guard: wie admin_work_overview
  _guard as (
    select 1
    where (
      current_user in ('postgres', 'service_role')
      or public.is_admin_in_any_club()
      or public.is_admin_or_vorstand_in_club(p_club_id)
    )
  ),
  -- tenant_id des Clubs (Brücke zu permit_card_types)
  tenant as (
    select tn.tenant_id
    from public.tenant_nodes tn
    where tn.legacy_club_id = p_club_id
    limit 1
  ),
  -- Alle Kartentypen des Tenants (inkl. inaktiver, für vollständiges Bild)
  card_types as (
    select pct.id, pct.card_type_key, pct.title
    from public.permit_card_types pct
    where pct.tenant_id = (select tenant_id from tenant)
  ),
  -- Alle permit_water_links dieser Kartentypen
  links as (
    select pwl.card_type_id, pwl.legacy_water_body_id
    from public.permit_water_links pwl
    where pwl.card_type_id in (select id from card_types)
  ),
  -- Aktive area_count pro water_body_id (club-scoped)
  area_counts as (
    select
      wa.water_body_id,
      count(*) as cnt
    from public.water_areas wa
    where wa.club_id         = p_club_id
      and wa.is_active       = true
      and wa.water_body_id   is not null
    group by wa.water_body_id
  )
  select
    ct.id                 as card_type_id,
    ct.card_type_key,
    ct.title              as card_title,
    wb.id                 as water_body_id,
    wb.name               as water_name,
    wb.area_kind          as water_area_kind,
    wb.is_active          as water_is_active,
    coalesce(ac.cnt, 0)   as area_count,
    case
      -- link zeigt auf nichtexistenten Body
      when l.legacy_water_body_id is not null and wb.id is null
           then 'orphaned_link'
      -- Body vorhanden aber deaktiviert
      when wb.is_active = false
           then 'inactive_water'
      -- Body aktiv, aber keine Area verknüpft
      when coalesce(ac.cnt, 0) = 0
           then 'missing_area'
      -- Body aktiv, mehr als eine Area
      when coalesce(ac.cnt, 0) > 1
           then 'multi_area'
      -- Normalfall
      else 'ok'
    end                   as mapping_status
  from _guard
  cross join links l
  join card_types ct on ct.id = l.card_type_id
  left join public.water_bodies wb
    on  wb.id      = l.legacy_water_body_id
    and wb.club_id = p_club_id
  left join area_counts ac on ac.water_body_id = wb.id
  order by ct.card_type_key, wb.name nulls last;
$$;

revoke all on function public.admin_permit_water_overview(uuid) from public, anon;
grant execute on function public.admin_permit_water_overview(uuid) to authenticated;
grant execute on function public.admin_permit_water_overview(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
