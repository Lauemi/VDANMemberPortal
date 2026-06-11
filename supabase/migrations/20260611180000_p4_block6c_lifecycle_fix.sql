-- P4 Block 6c: Lifecycle-Fix
-- mandate_lifecycle_status → established darf NICHT beim Export passieren.
-- Frühester zulässiger Zeitpunkt: billing_run.status = 'completed'.
--
-- Änderungen:
-- 1. admin_finalize_sepa_export: p_frst_member_ids Parameter + Mandate-Transition entfernt
-- 2. admin_update_billing_run_status: bei 'completed' → FRST-Items des Laufs → established

-- ============================================================
-- 1. admin_finalize_sepa_export — ohne Mandate-Transition
-- ============================================================

-- Alte Signature mit p_frst_member_ids droppen
DROP FUNCTION IF EXISTS public.admin_finalize_sepa_export(uuid, text, text, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.admin_finalize_sepa_export(uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.admin_finalize_sepa_export(
  p_billing_run_id      uuid,
  p_sepa_message_id     text,
  p_sepa_xml_hash       text,
  p_item_sequence_types jsonb  -- [{item_id: uuid, sequence_type: "FRST"|"RCUR"}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
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

  -- Update each item's sequence_type + status (immutable export snapshot)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_item_sequence_types) AS x(item_id uuid, sequence_type text)
  LOOP
    UPDATE public.billing_run_items SET
      sequence_type = v_item.sequence_type,
      item_status   = 'exported'
    WHERE id = v_item.item_id AND billing_run_id = p_billing_run_id;
  END LOOP;

  -- NO mandate lifecycle transition here.
  -- pending_first_collection → established happens only at billing_run.status = 'completed'
  -- via admin_update_billing_run_status.

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- service_role ONLY
REVOKE ALL ON FUNCTION public.admin_finalize_sepa_export(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_sepa_export(uuid, text, text, jsonb) TO service_role;

-- ============================================================
-- 2. admin_update_billing_run_status — mandate transition at completed
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
  v_old_status   text;
  v_frst_updated integer := 0;
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

  -- At completed: promote FRST mandates to established (only non-returned items)
  IF p_new_status = 'completed' THEN
    WITH frst_members AS (
      SELECT DISTINCT bri.member_id
      FROM public.billing_run_items bri
      WHERE bri.billing_run_id = p_billing_run_id
        AND bri.sequence_type = 'FRST'
        AND bri.item_status NOT IN ('returned', 'failed')
    )
    UPDATE public.member_bank_data mbd SET
      mandate_lifecycle_status = 'established',
      established_at           = COALESCE(mbd.established_at, NOW()),
      established_source       = COALESCE(mbd.established_source, 'first_completed_run')
    FROM frst_members fm
    WHERE mbd.member_id = fm.member_id
      AND mbd.mandate_lifecycle_status = 'pending_first_collection';

    GET DIAGNOSTICS v_frst_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'frst_mandates_established', v_frst_updated,
    'note', p_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_billing_run_status(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_billing_run_status(uuid, uuid, text, text) TO authenticated;
