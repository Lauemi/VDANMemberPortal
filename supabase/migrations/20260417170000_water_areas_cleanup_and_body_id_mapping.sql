-- =============================================================
-- Gewässer-Bereinigung: Konflikte lösen + water_body_id setzen
-- =============================================================
-- Hauptverein: 736c6406-e90f-46cd-b0d8-f14a4323a177
-- tenant_id:   33fbb369-8c10-48be-b2f7-1ec3859d6439
--
-- Was geändert wird (alle Entscheidungen dokumentiert):
--
-- 1. body 59652eb0 (Rhein): area_kind vgw → rheinlos39
--    Begründung: Rhein trägt Rheinlos39-Fischerei; body war fehlerhaft
--    als vgw eingetragen. permit_water_links entsprechend aktualisiert.
--
-- 2. area 8221eb1b (Angelweiher, vgw → rheinlos39):
--    Begründung: Der Angelweiher ist geografisch derselbe wie body c8215002
--    (rheinlos39). Die vgw-Klassifizierung war falsch.
--
-- 3. Neues body "Spitzweier" (vgw): area 20bfab3d (Spitzweier) hat keinen body.
--    Ohne body bleibt die area nach RPC-Umstellung verwaist.
--
-- 4. water_body_id gesetzt für 17 areas (9× 1:1, 2× Split, 3× Kanal, 2× Rhein,
--    1× Angelweiher-Fix, 1× Spitzweier-neu).
--
-- 5. get_my_water_areas_access() auf water_body_id-Join umgestellt.
--    Kein grober area_kind + club_id-Massenjoin mehr als Berechtigungsbrücke.
--
-- OFFEN (bewusst nicht geändert):
-- - area b465f881 (Vogelbaggersee, rheinlos39) ↔ body 97f1005a (Vogel-Baggersee, vgw)
--   area_kind-Konflikt, fachlich unklar — bleibt unverknüpft.
-- - Beispiel-Einträge (210c9df0, 18c363fb) — Beispieldaten, kein body nötig.
-- - Bodies ohne area (Absatzbecken 3b574bcb, Druckwasser-Kanal 947b3c23) — kein GeoJSON.
-- =============================================================

DO $$
DECLARE
  v_innenwasser_pct_id  uuid;
  v_rheinlos39_pct_id   uuid;
  v_spitzweier_body_id  uuid;
BEGIN

  -- -------------------------------------------------------
  -- Permit-Typ-IDs nachschlagen (robust, kein Hardcode)
  -- -------------------------------------------------------
  SELECT id INTO v_innenwasser_pct_id
  FROM public.permit_card_types
  WHERE tenant_id = '33fbb369-8c10-48be-b2f7-1ec3859d6439'
    AND card_type_key = 'innenwasser';

  SELECT id INTO v_rheinlos39_pct_id
  FROM public.permit_card_types
  WHERE tenant_id = '33fbb369-8c10-48be-b2f7-1ec3859d6439'
    AND card_type_key = 'rheinlos39';

  -- -------------------------------------------------------
  -- 1. Rhein-Body: area_kind vgw → rheinlos39
  -- -------------------------------------------------------
  UPDATE public.water_bodies
  SET area_kind = 'rheinlos39'
  WHERE id = '59652eb0-b432-450b-822f-0a913128fcf1'
    AND club_id = '736c6406-e90f-46cd-b0d8-f14a4323a177';

  -- permit_water_links: Rhein-Body aus innenwasser-Permit entfernen
  DELETE FROM public.permit_water_links
  WHERE card_type_id         = v_innenwasser_pct_id
    AND legacy_water_body_id = '59652eb0-b432-450b-822f-0a913128fcf1';

  -- permit_water_links: Rhein-Body in rheinlos39-Permit aufnehmen
  INSERT INTO public.permit_water_links (card_type_id, legacy_water_body_id)
  VALUES (v_rheinlos39_pct_id, '59652eb0-b432-450b-822f-0a913128fcf1')
  ON CONFLICT (card_type_id, legacy_water_body_id) DO NOTHING;

  -- -------------------------------------------------------
  -- 2. Angelweiher-Area (8221eb1b): area_kind vgw → rheinlos39
  --    (geografisch identisch mit body c8215002, falsch klassifiziert)
  -- -------------------------------------------------------
  UPDATE public.water_areas
  SET area_kind  = 'rheinlos39',
      updated_at = now()
  WHERE id = '8221eb1b-bc27-4df4-9b90-b757f3c40627'
    AND club_id = '736c6406-e90f-46cd-b0d8-f14a4323a177';

  -- -------------------------------------------------------
  -- 3. Neues body "Spitzweier" anlegen + Permit
  -- -------------------------------------------------------
  v_spitzweier_body_id := gen_random_uuid();

  INSERT INTO public.water_bodies (id, name, area_kind, club_id, is_active)
  VALUES (
    v_spitzweier_body_id,
    'Spitzweier',
    'vereins_gemeinschaftsgewaesser',
    '736c6406-e90f-46cd-b0d8-f14a4323a177',
    true
  )
  ON CONFLICT (name, area_kind) DO NOTHING;

  -- Spitzweier-Body-ID holen (falls conflict: bereits vorhanden)
  SELECT id INTO v_spitzweier_body_id
  FROM public.water_bodies
  WHERE name     = 'Spitzweier'
    AND area_kind = 'vereins_gemeinschaftsgewaesser'
    AND club_id  = '736c6406-e90f-46cd-b0d8-f14a4323a177';

  -- Spitzweier in innenwasser-Permit aufnehmen
  INSERT INTO public.permit_water_links (card_type_id, legacy_water_body_id)
  VALUES (v_innenwasser_pct_id, v_spitzweier_body_id)
  ON CONFLICT (card_type_id, legacy_water_body_id) DO NOTHING;

  -- -------------------------------------------------------
  -- 4. water_body_id setzen: 9× saubere 1:1-Matches
  -- -------------------------------------------------------
  UPDATE public.water_areas SET water_body_id = 'e5d322cc-cef2-457b-87e8-95539a14d81b', updated_at = now()
    WHERE id = '1eaf0b9c-c85a-484d-9057-b4aa91528229'; -- Altes Baggerloch vgw

  UPDATE public.water_areas SET water_body_id = 'f6f6b563-5a2b-4de0-a7a3-2ddd69136c0c', updated_at = now()
    WHERE id = 'a8ecefe5-0a95-4528-9806-c418e7b8afdd'; -- Eisweiher vgw

  UPDATE public.water_areas SET water_body_id = '9c139bfd-bd3e-44be-a2d0-d45b338eb2c7', updated_at = now()
    WHERE id = '7ea637fc-7197-4d4e-a96a-8017d7ed7cf1'; -- Elzkanal vgw

  UPDATE public.water_areas SET water_body_id = '1d49b4f2-c4b3-42ff-8643-c422b0fb3c59', updated_at = now()
    WHERE id = '92bdd45d-971a-43b5-9217-935235cceb42'; -- Kehl vgw

  UPDATE public.water_areas SET water_body_id = 'd96c5cfa-82a6-4945-b036-ff21af96a536', updated_at = now()
    WHERE id = '6bd0000b-a1ad-4f3b-a44c-cea56bf21424'; -- Krottenloch vgw

  UPDATE public.water_areas SET water_body_id = '4a22c3b2-b078-4fee-bf8e-c83f025075cf', updated_at = now()
    WHERE id = '35bdd75a-ac64-4a6b-a279-fa8f94c40c76'; -- Mühlbach vgw

  UPDATE public.water_areas SET water_body_id = 'c8f68736-c6f2-4444-ae16-4c893bd50309', updated_at = now()
    WHERE id = 'ad69acdc-6330-4b21-ae93-61fc0b3b1ee3'; -- Sandkehl vgw

  UPDATE public.water_areas SET water_body_id = '4beb85f9-3b0b-4f40-8f8f-94300840219b', updated_at = now()
    WHERE id = 'ac285b94-9bf2-4200-ada3-7f2ee2ba7a4c'; -- Unterer Bann vgw

  UPDATE public.water_areas SET water_body_id = 'c8215002-a904-4c16-869e-6347ab2c7a42', updated_at = now()
    WHERE id = '46d8dbab-37dc-4132-aa5f-a5fd74ab8338'; -- Angelweiher rheinlos39

  -- -------------------------------------------------------
  -- 5. water_body_id setzen: Angelweiher-Fix (jetzt rheinlos39)
  -- -------------------------------------------------------
  UPDATE public.water_areas SET water_body_id = 'c8215002-a904-4c16-869e-6347ab2c7a42', updated_at = now()
    WHERE id = '8221eb1b-bc27-4df4-9b90-b757f3c40627'; -- Angelweiher (korrigiert zu rheinlos39)

  -- -------------------------------------------------------
  -- 6. water_body_id setzen: Split-Fall Oberer/Unterer Holzplatz
  --    1 body → 2 areas
  -- -------------------------------------------------------
  UPDATE public.water_areas SET water_body_id = '99d6e7f5-ccad-4125-9f8d-ac6771368f2d', updated_at = now()
    WHERE id = '8e879e40-fb32-4a20-8d32-50b9e9cebce9'; -- Oberer Holzplatz

  UPDATE public.water_areas SET water_body_id = '99d6e7f5-ccad-4125-9f8d-ac6771368f2d', updated_at = now()
    WHERE id = 'b034cdaf-be30-43e2-9f2e-a0c043b94197'; -- Unterer Holzplatz

  -- -------------------------------------------------------
  -- 7. water_body_id setzen: Schutter-Entlastungskanal
  --    1 body → 3 Abschnitte (Areas)
  -- -------------------------------------------------------
  UPDATE public.water_areas SET water_body_id = '743e7d95-7c77-4097-8fcf-4a98b7dd9342', updated_at = now()
    WHERE id IN (
      'c8efd023-27c6-47ce-9826-9e0a99a9290b',
      '2e19df41-63de-4a3e-a3c7-dd9a9655f6a4',
      '48726c0a-90b4-4ae0-aab7-0a5570870668'
    ); -- Schutter-Entlastungskanal Abschnitte 1–3

  -- -------------------------------------------------------
  -- 8. water_body_id setzen: Rhein (2 Areas → body nach Fix)
  -- -------------------------------------------------------
  UPDATE public.water_areas SET water_body_id = '59652eb0-b432-450b-822f-0a913128fcf1', updated_at = now()
    WHERE id IN (
      '241b363e-040b-4c3c-be8b-f11df4f9fff4',
      '7a283ace-9346-4344-9367-2c9d74ba7f2e'
    ); -- Rhein Abschnitt 1 + 2

  -- -------------------------------------------------------
  -- 9. water_body_id setzen: Spitzweier (neue body-ID)
  -- -------------------------------------------------------
  UPDATE public.water_areas SET water_body_id = v_spitzweier_body_id, updated_at = now()
    WHERE id = '20bfab3d-37e3-48a7-9bfc-d172fbc14e8f'; -- Spitzweier

END;
$$;

-- =============================================================
-- get_my_water_areas_access() — auf water_body_id-Join umstellen
-- =============================================================
-- Vorher: Strukturjoin water_bodies → water_areas via area_kind + club_id
--         (grob, 1:N, unkontrolliert)
-- Jetzt:  Direktjoin via water_areas.water_body_id → water_bodies.id
--         (präzise, 1:1 oder 1:N-Abschnitte desselben Bodies)
--
-- Areas ohne water_body_id (Vogelbaggersee, Beispiel-Einträge) werden
-- NICHT angezeigt — sie sind entweder fachlich ungeklärt oder Beispieldaten.
-- =============================================================
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
  -- Erlaubte water_body_ids via vollständige Permit-Kette
  -- (identisch mit get_my_water_bodies_access — gleiche Wahrheitsquelle)
  allowed_body_ids AS (
    SELECT DISTINCT pwl.legacy_water_body_id AS body_id
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
  )
  SELECT
    wa.id,
    wa.name,
    wa.area_kind,
    wa.geojson,
    wa.is_active,
    (abi.body_id IS NOT NULL) AS is_allowed
  FROM public.water_areas wa
  -- Direktjoin via water_body_id — kein Massenjoin über area_kind mehr
  JOIN public.water_bodies wb
    ON  wb.id      = wa.water_body_id
    AND wb.club_id = wa.club_id
  JOIN me ON wa.club_id = me.club_id
  LEFT JOIN allowed_body_ids abi ON abi.body_id = wa.water_body_id
  WHERE wa.is_active  = true
    AND wb.is_active  = true
    AND wa.water_body_id IS NOT NULL   -- orphaned areas ausschliessen
  ORDER BY wa.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_water_areas_access() TO authenticated;
