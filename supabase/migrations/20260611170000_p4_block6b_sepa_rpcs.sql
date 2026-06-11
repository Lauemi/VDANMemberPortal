-- P4 Block 6b: SEPA RPCs
-- 8 new RPCs for SEPA config, billing run management, mandate management,
-- and the service-role-only data access functions needed by the Edge Function.
-- P4 scope: Verein→Mitglied only. No P6/Stripe.

-- ============================================================
-- 1. admin_get_sepa_config — public read for SEPA config
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_sepa_config(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_sepa_config(p_club_id uuid)
RETURNS TABLE (
  glaeubiger_id       text,
  club_iban_last4     text,
  club_bic            text,
  vorankuendigung_tage integer,
  bank_portal_url     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin') AND cm.status = 'active'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    csc.glaeubiger_id,
    RIGHT(pgp_sym_decrypt(csc.club_iban_enc::bytea, (SELECT value FROM app_secure_settings WHERE key = 'iban_encryption_key')), 4),
    csc.club_bic,
    csc.vorankuendigung_tage,
    csc.bank_portal_url
  FROM public.club_sepa_config csc
  WHERE csc.club_id = p_club_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_sepa_config(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_sepa_config(uuid) TO authenticated;

-- ============================================================
-- 2. admin_upsert_sepa_config — write SEPA config
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_upsert_sepa_config(uuid, text, text, text, integer, text);

CREATE OR REPLACE FUNCTION public.admin_upsert_sepa_config(
  p_club_id               uuid,
  p_glaeubiger_id         text,
  p_club_iban             text,
  p_club_bic              text    DEFAULT NULL,
  p_vorankuendigung_tage  integer DEFAULT 14,
  p_bank_portal_url       text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc text;
  v_last4 text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin') AND cm.status = 'active'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_club_iban IS NULL OR LENGTH(TRIM(p_club_iban)) < 15 THEN
    RAISE EXCEPTION 'invalid_iban';
  END IF;

  v_enc   := pgp_sym_encrypt(UPPER(REPLACE(p_club_iban, ' ', '')),
                              (SELECT value FROM app_secure_settings WHERE key = 'iban_encryption_key'));
  v_last4 := RIGHT(UPPER(REPLACE(p_club_iban, ' ', '')), 4);

  INSERT INTO public.club_sepa_config (
    club_id, glaeubiger_id, club_iban_enc, club_iban_last4,
    club_bic, vorankuendigung_tage, bank_portal_url
  ) VALUES (
    p_club_id, TRIM(p_glaeubiger_id), v_enc, v_last4,
    NULLIF(TRIM(COALESCE(p_club_bic, '')), ''),
    COALESCE(p_vorankuendigung_tage, 14),
    NULLIF(TRIM(COALESCE(p_bank_portal_url, '')), '')
  )
  ON CONFLICT (club_id) DO UPDATE SET
    glaeubiger_id       = EXCLUDED.glaeubiger_id,
    club_iban_enc       = EXCLUDED.club_iban_enc,
    club_iban_last4     = EXCLUDED.club_iban_last4,
    club_bic            = EXCLUDED.club_bic,
    vorankuendigung_tage = EXCLUDED.vorankuendigung_tage,
    bank_portal_url     = EXCLUDED.bank_portal_url,
    updated_at          = NOW();

  RETURN jsonb_build_object('ok', true, 'iban_last4', v_last4);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_sepa_config(uuid, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_sepa_config(uuid, text, text, text, integer, text) TO authenticated;

-- ============================================================
-- 3. admin_update_billing_run_status — manual status transitions
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_update_billing_run_status(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_update_billing_run_status(
  p_billing_run_id uuid,
  p_club_id        uuid,
  p_new_status     text,
  p_note           text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin') AND cm.status = 'active'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_new_status NOT IN ('submitted', 'completed', 'failed') THEN
    RAISE EXCEPTION 'invalid_status: %', p_new_status;
  END IF;

  SELECT status INTO v_old_status FROM public.billing_runs
  WHERE id = p_billing_run_id AND club_id = p_club_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'billing_run_not_found'; END IF;

  UPDATE public.billing_runs
  SET
    status       = p_new_status,
    submitted_at = CASE WHEN p_new_status = 'submitted'  THEN NOW() ELSE submitted_at END,
    completed_at = CASE WHEN p_new_status = 'completed'  THEN NOW() ELSE completed_at END
  WHERE id = p_billing_run_id AND club_id = p_club_id;

  RETURN jsonb_build_object(
    'ok', true,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'note', p_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_billing_run_status(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_billing_run_status(uuid, uuid, text, text) TO authenticated;

-- ============================================================
-- 4. admin_mark_billing_item_returned — Rückläufer
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_mark_billing_item_returned(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.admin_mark_billing_item_returned(
  p_item_id      uuid,
  p_club_id      uuid,
  p_return_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin') AND cm.status = 'active'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  UPDATE public.billing_run_items
  SET item_status = 'returned'
  WHERE id = p_item_id AND club_id = p_club_id
    AND item_status IN ('exported', 'submitted');

  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found_or_wrong_status'; END IF;

  RETURN jsonb_build_object('ok', true, 'reason', p_return_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_billing_item_returned(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_billing_item_returned(uuid, uuid, text) TO authenticated;

-- ============================================================
-- 5. admin_upsert_member_mandate — mandate management
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_upsert_member_mandate(uuid, uuid, text, boolean, text, text, text, date);

CREATE OR REPLACE FUNCTION public.admin_upsert_member_mandate(
  p_club_id                  uuid,
  p_member_id                uuid,
  p_mandate_lifecycle_status text    DEFAULT NULL,
  p_prior_collections_declared boolean DEFAULT NULL,
  p_imported_from            text    DEFAULT NULL,
  p_established_source       text    DEFAULT NULL,
  p_sepa_mandate_ref         text    DEFAULT NULL,
  p_sepa_mandate_date        date    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin') AND cm.status = 'active'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_mandate_lifecycle_status IS NOT NULL AND
     p_mandate_lifecycle_status NOT IN ('pending_first_collection', 'established', 'revoked') THEN
    RAISE EXCEPTION 'invalid_mandate_lifecycle_status: %', p_mandate_lifecycle_status;
  END IF;

  UPDATE public.member_bank_data SET
    mandate_lifecycle_status    = COALESCE(p_mandate_lifecycle_status, mandate_lifecycle_status),
    prior_collections_declared  = COALESCE(p_prior_collections_declared, prior_collections_declared),
    imported_from               = COALESCE(p_imported_from, imported_from),
    established_source          = COALESCE(p_established_source, established_source),
    established_at              = CASE
                                    WHEN p_mandate_lifecycle_status = 'established' AND established_at IS NULL
                                    THEN NOW()
                                    ELSE established_at
                                  END,
    sepa_mandate_ref            = COALESCE(p_sepa_mandate_ref, sepa_mandate_ref),
    sepa_mandate_date           = COALESCE(p_sepa_mandate_date, sepa_mandate_date)
  WHERE member_id = p_member_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'member_bank_data_not_found'; END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_member_mandate(uuid, uuid, text, boolean, text, text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_member_mandate(uuid, uuid, text, boolean, text, text, text, date) TO authenticated;

-- ============================================================
-- 6. admin_get_billing_run_iban_data — service_role only
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_billing_run_iban_data(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_billing_run_iban_data(p_billing_run_id uuid)
RETURNS TABLE (
  item_id                  uuid,
  member_id                uuid,
  member_name_snapshot     text,
  member_no_snapshot       text,
  mandate_reference        text,
  mandate_signed_at        date,
  iban_plaintext           text,
  total_amount             numeric,
  mandate_lifecycle_status text,
  prior_collections_declared boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bri.id,
    bri.member_id,
    bri.member_name_snapshot,
    bri.member_no_snapshot,
    bri.sepa_mandate_ref_snapshot,
    bri.mandate_signed_at_snapshot,
    pgp_sym_decrypt(mbd.iban_enc::bytea,
      (SELECT value FROM public.app_secure_settings WHERE key = 'iban_encryption_key')),
    bri.total_amount,
    mbd.mandate_lifecycle_status,
    mbd.prior_collections_declared
  FROM public.billing_run_items bri
  JOIN public.member_bank_data mbd ON mbd.member_id = bri.member_id
  WHERE bri.billing_run_id = p_billing_run_id
    AND bri.sepa_included = true
    AND bri.item_status = 'calculated';
END;
$$;

-- service_role ONLY — revoke from all others
REVOKE ALL ON FUNCTION public.admin_get_billing_run_iban_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_billing_run_iban_data(uuid) TO service_role;

-- ============================================================
-- 7. admin_get_club_sepa_data — service_role only
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_club_sepa_data(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_club_sepa_data(p_club_id uuid)
RETURNS TABLE (
  glaeubiger_id       text,
  club_iban_plaintext text,
  club_iban_last4     text,
  club_bic            text,
  vorankuendigung_tage integer,
  bank_portal_url     text,
  club_legal_name     text,
  club_code           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    csc.glaeubiger_id,
    pgp_sym_decrypt(csc.club_iban_enc::bytea,
      (SELECT value FROM public.app_secure_settings WHERE key = 'iban_encryption_key')),
    csc.club_iban_last4,
    csc.club_bic,
    csc.vorankuendigung_tage,
    csc.bank_portal_url,
    cc.legal_name,
    cc.club_code
  FROM public.club_sepa_config csc
  JOIN public.club_core cc ON cc.id = csc.club_id
  WHERE csc.club_id = p_club_id;
END;
$$;

-- service_role ONLY
REVOKE ALL ON FUNCTION public.admin_get_club_sepa_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_club_sepa_data(uuid) TO service_role;

-- ============================================================
-- 8. admin_finalize_sepa_export — atomic state write after XML gen
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_finalize_sepa_export(uuid, text, text, jsonb, uuid[]);

CREATE OR REPLACE FUNCTION public.admin_finalize_sepa_export(
  p_billing_run_id    uuid,
  p_sepa_message_id   text,
  p_sepa_xml_hash     text,
  p_item_sequence_types jsonb,  -- [{item_id: uuid, sequence_type: "FRST"|"RCUR"}]
  p_frst_member_ids   uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_seq  text;
BEGIN
  -- Update billing_run → exported
  UPDATE public.billing_runs SET
    status          = 'exported',
    exported_at     = NOW(),
    sepa_message_id = p_sepa_message_id,
    sepa_xml_hash   = p_sepa_xml_hash
  WHERE id = p_billing_run_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing_run_not_found_or_not_draft';
  END IF;

  -- Update each item's sequence_type + status
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_item_sequence_types) AS x(item_id uuid, sequence_type text)
  LOOP
    UPDATE public.billing_run_items SET
      sequence_type = v_item.sequence_type,
      item_status   = 'exported'
    WHERE id = v_item.item_id AND billing_run_id = p_billing_run_id;
  END LOOP;

  -- Transition FRST mandates → established
  UPDATE public.member_bank_data SET
    mandate_lifecycle_status = 'established',
    established_at           = COALESCE(established_at, NOW()),
    established_source       = COALESCE(established_source, 'first_export')
  WHERE member_id = ANY(p_frst_member_ids)
    AND mandate_lifecycle_status = 'pending_first_collection';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- service_role ONLY
REVOKE ALL ON FUNCTION public.admin_finalize_sepa_export(uuid, text, text, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_sepa_export(uuid, text, text, jsonb, uuid[]) TO service_role;

-- ============================================================
-- 9. admin_get_billing_runs — expose execution_date
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_billing_runs(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_billing_runs(p_club_id uuid)
RETURNS TABLE (
  id            uuid,
  run_year      integer,
  run_label     text,
  status        text,
  total_amount  numeric,
  member_count  integer,
  execution_date date,
  sepa_message_id text,
  created_at    timestamptz,
  exported_at   timestamptz,
  submitted_at  timestamptz,
  completed_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id AND cm.member_id = auth.uid()
      AND cm.role IN ('admin', 'vorstand', 'superadmin') AND cm.status = 'active'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT br.id, br.run_year, br.run_label, br.status,
         br.total_amount, br.member_count, br.execution_date, br.sepa_message_id,
         br.created_at, br.exported_at, br.submitted_at, br.completed_at
  FROM public.billing_runs br
  WHERE br.club_id = p_club_id
  ORDER BY br.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_billing_runs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_billing_runs(uuid) TO authenticated;
