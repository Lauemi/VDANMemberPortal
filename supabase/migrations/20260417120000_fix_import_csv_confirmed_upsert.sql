-- =============================================================
-- FIX: import_csv_confirmed – street/zip ergänzt, upsert statt skip
-- =============================================================
-- Vorher: INSERT ohne street/zip, EXCEPTION unique_violation → skipped.
-- Jetzt:  INSERT ... ON CONFLICT DO UPDATE für alle Felder incl. street/zip.
--         create-Zeilen werden angelegt, update-Zeilen werden aktualisiert.
-- =============================================================

CREATE OR REPLACE FUNCTION public.import_csv_confirmed(
  p_club_id uuid,
  p_rows    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row           jsonb;
  v_member_number integer;
  v_imported      integer := 0;
  v_max_seen      integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin', 'vorstand')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO internal.club_member_sequences (club_id, member_number_seq)
  VALUES (
    p_club_id,
    COALESCE(
      (SELECT MAX(cm.member_number)
       FROM public.club_members cm
       WHERE cm.club_id = p_club_id
         AND cm.member_number IS NOT NULL),
      0
    )
  )
  ON CONFLICT (club_id) DO NOTHING;

  PERFORM member_number_seq
  FROM internal.club_member_sequences
  WHERE club_id = p_club_id
  FOR UPDATE;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_member_number := NULL;

    IF (v_row->>'member_number') IS NOT NULL AND (v_row->>'member_number') != '' THEN
      BEGIN
        v_member_number := (v_row->>'member_number')::integer;
      EXCEPTION WHEN others THEN
        v_member_number := NULL;
      END;
    END IF;

    IF v_member_number IS NULL THEN
      UPDATE internal.club_member_sequences
      SET member_number_seq = member_number_seq + 1
      WHERE club_id = p_club_id
      RETURNING member_number_seq INTO v_member_number;
    END IF;

    IF v_member_number > v_max_seen THEN
      v_max_seen := v_member_number;
    END IF;

    INSERT INTO public.club_members (
      club_id, member_number, source,
      first_name, last_name, email,
      status, is_youth, membership_kind,
      birthdate, phone,
      street, zip, city,
      created_at, updated_at
    ) VALUES (
      p_club_id,
      v_member_number,
      'csv_import',
      NULLIF(v_row->>'first_name', ''),
      NULLIF(v_row->>'last_name', ''),
      NULLIF(v_row->>'email', ''),
      COALESCE(NULLIF(v_row->>'status', ''), 'active'),
      false,
      'standard',
      NULLIF(v_row->>'birthdate', '')::date,
      NULLIF(v_row->>'phone', ''),
      NULLIF(v_row->>'street', ''),
      NULLIF(v_row->>'zip', ''),
      NULLIF(v_row->>'city', ''),
      now(), now()
    )
    ON CONFLICT (club_id, member_number) DO UPDATE SET
      first_name  = NULLIF(EXCLUDED.first_name, ''),
      last_name   = NULLIF(EXCLUDED.last_name, ''),
      email       = NULLIF(EXCLUDED.email, ''),
      status      = COALESCE(NULLIF(EXCLUDED.status, ''), public.club_members.status),
      phone       = NULLIF(EXCLUDED.phone, ''),
      birthdate   = EXCLUDED.birthdate,
      street      = NULLIF(EXCLUDED.street, ''),
      zip         = NULLIF(EXCLUDED.zip, ''),
      city        = NULLIF(EXCLUDED.city, ''),
      updated_at  = now();

    v_imported := v_imported + 1;
  END LOOP;

  UPDATE internal.club_member_sequences
  SET member_number_seq = GREATEST(member_number_seq, v_max_seen)
  WHERE club_id = p_club_id;

  RETURN jsonb_build_object('imported', v_imported);
END;
$$;
