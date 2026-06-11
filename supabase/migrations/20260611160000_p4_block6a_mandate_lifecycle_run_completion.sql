-- P4 Block 6a: Mandate Lifecycle + Run Completion Fields
-- Extends member_bank_data with mandate lifecycle state.
-- Extends billing_runs with execution_date + sepa_message_id.
-- Extends billing_run_items with sequence_type + mandate snapshot fields.
-- Recreates admin_create_billing_run + admin_get_billing_preview with new signatures.

-- ============================================================
-- 1. member_bank_data — mandate lifecycle state
-- ============================================================

ALTER TABLE public.member_bank_data
  ADD COLUMN IF NOT EXISTS mandate_lifecycle_status text
    NOT NULL DEFAULT 'pending_first_collection'
    CHECK (mandate_lifecycle_status IN ('pending_first_collection', 'established', 'revoked')),
  ADD COLUMN IF NOT EXISTS established_at timestamptz,
  ADD COLUMN IF NOT EXISTS established_source text
    CHECK (established_source IN ('first_export', 'admin_declared', 'imported')),
  ADD COLUMN IF NOT EXISTS prior_collections_declared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imported_from text;

-- ============================================================
-- 2. billing_runs — execution_date + sepa_message_id
-- ============================================================

ALTER TABLE public.billing_runs
  ADD COLUMN IF NOT EXISTS execution_date date,
  ADD COLUMN IF NOT EXISTS sepa_message_id text,
  ADD COLUMN IF NOT EXISTS sepa_xml_hash text;

-- ============================================================
-- 3. billing_run_items — sequence_type + mandate snapshot
-- ============================================================

ALTER TABLE public.billing_run_items
  ADD COLUMN IF NOT EXISTS sequence_type text
    CHECK (sequence_type IN ('FRST', 'RCUR')),
  ADD COLUMN IF NOT EXISTS mandate_signed_at_snapshot date;

-- ============================================================
-- 4. Recreate admin_create_billing_run — add p_execution_date
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_create_billing_run(uuid, integer, text);
DROP FUNCTION IF EXISTS public.admin_create_billing_run(uuid, integer, text, date);

CREATE OR REPLACE FUNCTION public.admin_create_billing_run(
  p_club_id         uuid,
  p_run_year        integer,
  p_run_label       text    DEFAULT NULL,
  p_execution_date  date    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id    uuid;
  v_label     text;
  v_count     integer := 0;
  v_total     numeric := 0;
  v_preview   record;
BEGIN
  -- Verify caller is admin of this club
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin')
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_label := COALESCE(NULLIF(TRIM(p_run_label), ''), 'Abrechnungslauf ' || p_run_year);

  -- Insert billing run
  INSERT INTO public.billing_runs (
    club_id, run_year, run_label, status, execution_date,
    total_amount, member_count, created_by
  )
  VALUES (
    p_club_id, p_run_year, v_label, 'draft', p_execution_date,
    0, 0, auth.uid()
  )
  RETURNING id INTO v_run_id;

  -- Snapshot billing preview into billing_run_items
  FOR v_preview IN
    SELECT * FROM public.admin_get_billing_preview(p_club_id, p_run_year)
    WHERE total_amount > 0
  LOOP
    INSERT INTO public.billing_run_items (
      billing_run_id, club_id, run_year, run_label, member_id,
      member_no_snapshot, member_name_snapshot, price_tier,
      total_amount, sepa_included, item_status,
      iban_last4_snapshot, sepa_mandate_ref_snapshot,
      mandate_signed_at_snapshot,
      positions_json
    )
    SELECT
      v_run_id, p_club_id, p_run_year, v_label, v_preview.member_id,
      v_preview.club_member_no,
      v_preview.last_name || ' ' || v_preview.first_name,
      v_preview.price_tier,
      v_preview.total_amount,
      (v_preview.sepa_status = 'vollstaendig' OR v_preview.sepa_status = 'vollständig'),
      'calculated',
      v_preview.iban_last4,
      v_preview.sepa_mandate_ref,
      mbd.sepa_mandate_date,
      v_preview.positions_json
    FROM public.member_bank_data mbd
    WHERE mbd.member_id = v_preview.member_id
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
    v_total := v_total + v_preview.total_amount;
  END LOOP;

  -- Update aggregates on run
  UPDATE public.billing_runs
  SET member_count = v_count, total_amount = v_total
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'ok', true,
    'billing_run_id', v_run_id,
    'member_count', v_count,
    'total_amount', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_billing_run(uuid, integer, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_billing_run(uuid, integer, text, date) TO authenticated;

-- ============================================================
-- 5. Recreate admin_get_billing_preview — add mandate_lifecycle_status
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_billing_preview(uuid, integer);

CREATE OR REPLACE FUNCTION public.admin_get_billing_preview(
  p_club_id  uuid,
  p_run_year integer
)
RETURNS TABLE (
  member_id               uuid,
  club_member_no          text,
  last_name               text,
  first_name              text,
  delta_minutes           integer,
  price_tier              text,
  total_amount            numeric,
  sepa_status             text,
  mandate_lifecycle_status text,
  iban_last4              text,
  sepa_mandate_ref        text,
  positions_json          jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin of this club
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin')
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH member_hours AS (
    SELECT
      cm.id AS member_id,
      cm.club_member_no,
      m.last_name,
      m.first_name,
      cm.role,
      COALESCE(cc.pflicht_stunden_minuten, 0) AS pflicht_minuten,
      COALESCE((
        SELECT SUM(psa.geleistete_stunden * 60 + psa.geleistete_minuten)
        FROM public.pflichtstunden_abrechnung psa
        WHERE psa.mitglied_id = cm.id
          AND psa.jahr = p_run_year
      ), 0) AS geleistet_minuten,
      COALESCE((
        SELECT mbe.is_exempt
        FROM public.member_billing_exemptions mbe
        WHERE mbe.member_id = cm.id AND mbe.club_id = p_club_id
        LIMIT 1
      ), false) AS is_exempt,
      mbd.sepa_mandate_ref,
      mbd.iban_last4,
      mbd.mandate_status,
      mbd.mandate_lifecycle_status,
      mbd.prior_collections_declared
    FROM public.club_members cm
    JOIN public.members m ON m.id = cm.member_id
    JOIN public.club_core cc ON cc.id = p_club_id
    LEFT JOIN public.member_bank_data mbd ON mbd.member_id = cm.member_id
    WHERE cm.club_id = p_club_id AND cm.status = 'active'
  ),
  member_tier AS (
    SELECT
      mh.*,
      CASE
        WHEN mh.is_exempt THEN 'exempt'
        WHEN mh.role IN ('honorary') THEN 'honorary'
        WHEN mh.role IN ('youth', 'junior') THEN 'youth'
        ELSE 'default'
      END AS computed_tier,
      GREATEST(0, mh.pflicht_minuten - mh.geleistet_minuten) AS delta_min
    FROM member_hours mh
  ),
  member_price AS (
    SELECT
      mt.*,
      COALESCE((
        SELECT cbp.price_per_minute * mt.delta_min
        FROM public.club_billing_positions cbp
        WHERE cbp.club_id = p_club_id
          AND cbp.price_tier = mt.computed_tier
          AND cbp.is_active = true
        ORDER BY cbp.created_at DESC
        LIMIT 1
      ), 0) AS calc_amount
    FROM member_tier mt
  )
  SELECT
    mp.member_id,
    mp.club_member_no,
    mp.last_name,
    mp.first_name,
    mp.delta_min::integer,
    mp.computed_tier,
    mp.calc_amount,
    CASE
      WHEN mp.mandate_status = 'approved' AND mp.iban_last4 IS NOT NULL THEN 'vollstaendig'
      WHEN mp.mandate_status = 'approved' THEN 'mandat_genehmigt'
      WHEN mp.iban_last4 IS NOT NULL AND mp.mandate_status IS NULL THEN 'bankdaten_kein_mandat'
      WHEN mp.iban_last4 IS NOT NULL THEN 'genehmigt_keine_iban'
      ELSE 'kein_sepa'
    END AS sepa_status,
    COALESCE(mp.mandate_lifecycle_status, 'pending_first_collection'),
    mp.iban_last4,
    mp.sepa_mandate_ref,
    jsonb_build_object(
      'delta_minutes', mp.delta_min,
      'pflicht_minutes', mp.pflicht_minuten,
      'geleistet_minutes', mp.geleistet_minuten,
      'calc_amount', mp.calc_amount
    )
  FROM member_price mp
  WHERE mp.calc_amount > 0 OR mp.delta_min > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_billing_preview(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_billing_preview(uuid, integer) TO authenticated;
