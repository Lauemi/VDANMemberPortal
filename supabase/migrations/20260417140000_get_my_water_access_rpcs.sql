-- =============================================================
-- Serverseitige Gewässer-Berechtigungswahrheit
-- =============================================================
-- Ersetzt client-seitiges parseCardScope() / isAllowed() in
-- member-card.js und member-water-map.js.
--
-- Logik: member_card_assignments (card_id) → CASE WHEN → area_kind
--        → JOIN water_bodies / water_areas auf club_id + area_kind
--
-- Karten-Mapping (kanonisch):
--   innenwasser → vereins_gemeinschaftsgewaesser
--   rheinlos39  → rheinlos39
--
-- Beide RPCs lesen club_id aus profiles des eingeloggten Nutzers.
-- is_allowed = hat der Nutzer eine aktive Karte für dieses area_kind.
-- Kartenvalidität (member_card_valid) wird bewusst NICHT einbezogen:
-- die Clients zeigen "AUSWEIS UNGÜLTIG" separat, wenn is_allowed=true
-- aber member_card_valid=false.
-- =============================================================

-- -------------------------------------------------------------
-- 1. get_my_water_bodies_access()
--    → für member-card.js (Gewässer-Liste im Ausweis)
--    Quelle: water_bodies (Name, area_kind – keine GeoJSON)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_water_bodies_access()
RETURNS TABLE (
  id         uuid,
  name       text,
  area_kind  text,
  is_active  boolean,
  is_allowed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH my_area_kinds AS (
    SELECT DISTINCT
      CASE mca.card_id
        WHEN 'innenwasser' THEN 'vereins_gemeinschaftsgewaesser'
        WHEN 'rheinlos39'  THEN 'rheinlos39'
      END AS area_kind,
      mca.club_id
    FROM public.profiles p
    JOIN public.member_card_assignments mca
      ON  mca.member_no = p.member_no
      AND mca.club_id   = p.club_id
    WHERE p.id = auth.uid()
      AND mca.card_id IN ('innenwasser', 'rheinlos39')
  )
  SELECT
    wb.id,
    wb.name,
    wb.area_kind,
    wb.is_active,
    (mak.area_kind IS NOT NULL) AS is_allowed
  FROM public.water_bodies wb
  JOIN public.profiles p
    ON  p.id      = auth.uid()
    AND p.club_id = wb.club_id
  LEFT JOIN my_area_kinds mak
    ON  mak.area_kind = wb.area_kind
    AND mak.club_id   = wb.club_id
  WHERE wb.is_active = true
  ORDER BY wb.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_water_bodies_access() TO authenticated;

-- -------------------------------------------------------------
-- 2. get_my_water_areas_access()
--    → für member-water-map.js (Karte mit GeoJSON-Polygonen)
--    Quelle: water_areas (GeoJSON, area_kind)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_water_areas_access()
RETURNS TABLE (
  id         uuid,
  name       text,
  area_kind  text,
  geojson    jsonb,
  is_active  boolean,
  is_allowed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH my_area_kinds AS (
    SELECT DISTINCT
      CASE mca.card_id
        WHEN 'innenwasser' THEN 'vereins_gemeinschaftsgewaesser'
        WHEN 'rheinlos39'  THEN 'rheinlos39'
      END AS area_kind,
      mca.club_id
    FROM public.profiles p
    JOIN public.member_card_assignments mca
      ON  mca.member_no = p.member_no
      AND mca.club_id   = p.club_id
    WHERE p.id = auth.uid()
      AND mca.card_id IN ('innenwasser', 'rheinlos39')
  )
  SELECT
    wa.id,
    wa.name,
    wa.area_kind,
    wa.geojson,
    wa.is_active,
    (mak.area_kind IS NOT NULL) AS is_allowed
  FROM public.water_areas wa
  JOIN public.profiles p
    ON  p.id      = auth.uid()
    AND p.club_id = wa.club_id
  LEFT JOIN my_area_kinds mak
    ON  mak.area_kind = wa.area_kind
    AND mak.club_id   = wa.club_id
  WHERE wa.is_active = true
  ORDER BY wa.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_water_areas_access() TO authenticated;
