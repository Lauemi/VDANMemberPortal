-- =============================================================
-- Permit-System: Seed + RPC v2
-- =============================================================
-- Zielarchitektur:
--   member_card_assignments.card_id
--     → permit_card_types.card_type_key  (tenant-gebunden)
--     → permit_water_links.card_type_id
--     → permit_water_links.legacy_water_body_id
--     → water_bodies.id
--
-- Für water_areas (GeoJSON-Karte):
--   water_bodies → area_kind + club_id → water_areas (Strukturjoin,
--   KEIN Permission-Check auf area_kind)
--
-- Kein hardcoded Mapping mehr in den RPCs.
-- Änderungen an permit_water_links greifen sofort.
-- =============================================================

-- -------------------------------------------------------------
-- 1. UNIQUE-Constraint auf permit_water_links (card_type_id, legacy_water_body_id)
--    Verhindert doppelte Einträge beim Seeding.
-- -------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'permit_water_links'
      AND constraint_name = 'uq_permit_water_links'
  ) THEN
    ALTER TABLE public.permit_water_links
      ADD CONSTRAINT uq_permit_water_links
      UNIQUE (card_type_id, legacy_water_body_id);
  END IF;
END;
$$;

-- -------------------------------------------------------------
-- 2. Seed: permit_card_types für Hauptverein
--    tenant_id = 33fbb369-8c10-48be-b2f7-1ec3859d6439
--    (legacy_club_id = 736c6406-e90f-46cd-b0d8-f14a4323a177)
-- -------------------------------------------------------------
INSERT INTO public.permit_card_types (
  tenant_id, card_type_key, title, card_kind, is_active
) VALUES
  (
    '33fbb369-8c10-48be-b2f7-1ec3859d6439',
    'innenwasser',
    'Innenwasser',
    'standard',
    true
  ),
  (
    '33fbb369-8c10-48be-b2f7-1ec3859d6439',
    'rheinlos39',
    'Rheinlos 39',
    'standard',
    true
  )
ON CONFLICT (tenant_id, title) DO UPDATE SET
  card_type_key = EXCLUDED.card_type_key,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- -------------------------------------------------------------
-- 3. Seed: permit_water_links
--    Verknüpft Kartentypen mit konkreten water_bodies.
--
--    Innenwasser → alle vereins_gemeinschaftsgewaesser (13 Körper)
--    Rheinlos 39 → alle rheinlos39 (2 Körper)
-- -------------------------------------------------------------
INSERT INTO public.permit_water_links (card_type_id, legacy_water_body_id)
SELECT pct.id, wb.id
FROM public.permit_card_types pct
CROSS JOIN public.water_bodies wb
WHERE pct.tenant_id = '33fbb369-8c10-48be-b2f7-1ec3859d6439'
  AND wb.club_id    = '736c6406-e90f-46cd-b0d8-f14a4323a177'
  AND wb.is_active  = true
  AND (
    (pct.card_type_key = 'innenwasser' AND wb.area_kind = 'vereins_gemeinschaftsgewaesser')
    OR
    (pct.card_type_key = 'rheinlos39'  AND wb.area_kind = 'rheinlos39')
  )
ON CONFLICT (card_type_id, legacy_water_body_id) DO NOTHING;

-- -------------------------------------------------------------
-- 4. get_my_water_bodies_access() — permit-basiert
--    Ersetzt die area_kind-basierte Übergangslösung.
--    Quelle: water_bodies (für Gewässerliste im Ausweis)
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
  WITH
  -- Eingeloggter Nutzer: member_no + club_id
  me AS (
    SELECT member_no, club_id
    FROM public.profiles
    WHERE id = auth.uid()
  ),
  -- tenant_id des Clubs (Brücke zu permit_card_types)
  my_tenant AS (
    SELECT tn.tenant_id
    FROM public.tenant_nodes tn
    JOIN me ON tn.legacy_club_id = me.club_id
  ),
  -- Erlaubte water_body_ids via vollständige Permit-Kette
  allowed_body_ids AS (
    SELECT DISTINCT pwl.legacy_water_body_id AS body_id
    FROM public.member_card_assignments mca
    JOIN me  ON mca.member_no = me.member_no AND mca.club_id = me.club_id
    JOIN public.permit_card_types pct
      ON  pct.card_type_key = mca.card_id
      AND pct.tenant_id     = (SELECT tenant_id FROM my_tenant)
      AND pct.is_active     = true
      AND (pct.valid_from  IS NULL OR pct.valid_from  <= now())
      AND (pct.valid_until IS NULL OR pct.valid_until >  now())
    JOIN public.permit_water_links pwl
      ON  pwl.card_type_id         = pct.id
      AND pwl.legacy_water_body_id IS NOT NULL
      AND (pwl.valid_from  IS NULL OR pwl.valid_from  <= now())
      AND (pwl.valid_until IS NULL OR pwl.valid_until >  now())
  )
  SELECT
    wb.id,
    wb.name,
    wb.area_kind,
    wb.is_active,
    (abi.body_id IS NOT NULL) AS is_allowed
  FROM public.water_bodies wb
  JOIN me ON wb.club_id = me.club_id
  LEFT JOIN allowed_body_ids abi ON abi.body_id = wb.id
  WHERE wb.is_active = true
  ORDER BY wb.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_water_bodies_access() TO authenticated;

-- -------------------------------------------------------------
-- 5. get_my_water_areas_access() — permit-basiert
--    Ersetzt die area_kind-basierte Übergangslösung.
--    Quelle: water_areas (GeoJSON-Polygone für die Karte)
--
--    Da water_areas.water_body_id für alle Live-Zeilen NULL ist,
--    wird der Strukturjoin water_bodies → water_areas über
--    area_kind + club_id geführt. Das ist ein datenbankinterner
--    Relationsbrücken-Join, KEIN Permission-Check.
--    Die Berechtigung selbst kommt vollständig aus permit_water_links.
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
  WITH
  me AS (
    SELECT member_no, club_id
    FROM public.profiles
    WHERE id = auth.uid()
  ),
  my_tenant AS (
    SELECT tn.tenant_id
    FROM public.tenant_nodes tn
    JOIN me ON tn.legacy_club_id = me.club_id
  ),
  -- Erlaubte area_kinds: aus water_bodies, die per Permit verknüpft sind
  -- Strukturjoin: water_bodies → water_areas via area_kind + club_id
  allowed_area_kinds AS (
    SELECT DISTINCT wb.area_kind, wb.club_id
    FROM public.member_card_assignments mca
    JOIN me ON mca.member_no = me.member_no AND mca.club_id = me.club_id
    JOIN public.permit_card_types pct
      ON  pct.card_type_key = mca.card_id
      AND pct.tenant_id     = (SELECT tenant_id FROM my_tenant)
      AND pct.is_active     = true
      AND (pct.valid_from  IS NULL OR pct.valid_from  <= now())
      AND (pct.valid_until IS NULL OR pct.valid_until >  now())
    JOIN public.permit_water_links pwl
      ON  pwl.card_type_id         = pct.id
      AND pwl.legacy_water_body_id IS NOT NULL
      AND (pwl.valid_from  IS NULL OR pwl.valid_from  <= now())
      AND (pwl.valid_until IS NULL OR pwl.valid_until >  now())
    JOIN public.water_bodies wb
      ON  wb.id      = pwl.legacy_water_body_id
      AND wb.club_id = me.club_id
  )
  SELECT
    wa.id,
    wa.name,
    wa.area_kind,
    wa.geojson,
    wa.is_active,
    (aak.area_kind IS NOT NULL) AS is_allowed
  FROM public.water_areas wa
  JOIN me ON wa.club_id = me.club_id
  LEFT JOIN allowed_area_kinds aak
    ON  aak.area_kind = wa.area_kind
    AND aak.club_id   = wa.club_id
  WHERE wa.is_active = true
  ORDER BY wa.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_water_areas_access() TO authenticated;
