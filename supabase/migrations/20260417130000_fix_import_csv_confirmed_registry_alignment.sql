-- =============================================================
-- FIX: import_csv_confirmed – Registry-Wahrheit herstellen
-- =============================================================
-- admin_member_registry() liest street/zip/city aus public.members,
-- nicht aus public.club_members. Join: membership_number = cm.member_no.
-- Die vorige Version schrieb nur in public.club_members → Daten kamen
-- nie in der Registry an.
--
-- Neue Version:
--   Update-Pfad (member_no vorhanden): UPDATE club_members + UPSERT members
--   Create-Pfad (kein member_no):      INSERT club_members + INSERT members
-- Identität: member_no (MID-XXX, text) statt member_number (integer).
-- =============================================================

CREATE OR REPLACE FUNCTION public.import_csv_confirmed(
  p_club_id uuid,
  p_rows    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row             jsonb;
  v_member_no       text;
  v_club_code       text;
  v_club_member_no  text;
  v_imported        integer := 0;
BEGIN
  IF NOT (public.is_admin_or_vorstand_in_club(p_club_id) OR public.is_admin_in_any_club())
     AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- club_code einmalig für den Create-Pfad nachschlagen
  SELECT COALESCE(MAX(NULLIF(TRIM(cm.club_code), '')), '')
    INTO v_club_code
  FROM public.club_members cm
  WHERE cm.club_id = p_club_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_member_no      := NULLIF(TRIM(COALESCE(v_row->>'member_no', '')), '');
    v_club_member_no := NULL;

    IF v_member_no IS NOT NULL THEN
      -- -------------------------------------------------------
      -- Update-Pfad: Mitglied existiert bereits in club_members
      -- -------------------------------------------------------

      -- Kern-Felder in club_members aktualisieren
      UPDATE public.club_members SET
        first_name = COALESCE(NULLIF(v_row->>'first_name', ''), first_name),
        last_name  = COALESCE(NULLIF(v_row->>'last_name', ''), last_name),
        status     = COALESCE(NULLIF(v_row->>'status', ''), status),
        updated_at = now()
      WHERE club_id = p_club_id
        AND member_no = v_member_no;

      -- club_member_no für den members-Upsert nachschlagen
      SELECT cm.club_member_no INTO v_club_member_no
      FROM public.club_members cm
      WHERE cm.club_id = p_club_id AND cm.member_no = v_member_no;

      -- Adress- und Stammdaten in public.members schreiben
      -- (membership_number = member_no ist der Registry-Join-Key)
      INSERT INTO public.members (
        club_id, status, membership_number, club_member_no,
        first_name, last_name, birthdate,
        street, email, zip, city, phone,
        mobile, guardian_member_no, is_local, known_member,
        fishing_card_type, sepa_approved, source_application_id
      ) VALUES (
        p_club_id,
        COALESCE(NULLIF(v_row->>'status', ''), 'active'),
        v_member_no,
        v_club_member_no,
        COALESCE(NULLIF(v_row->>'first_name', ''), 'Vorname'),
        COALESCE(NULLIF(v_row->>'last_name', ''), 'Nachname'),
        NULLIF(v_row->>'birthdate', '')::date,
        COALESCE(NULLIF(v_row->>'street', ''), '-'),
        NULLIF(v_row->>'email', ''),
        COALESCE(NULLIF(v_row->>'zip', ''), '-'),
        COALESCE(NULLIF(v_row->>'city', ''), '-'),
        NULLIF(v_row->>'phone', ''),
        NULL, NULL, false, NULL, '-', true, NULL
      )
      ON CONFLICT (membership_number) DO UPDATE SET
        club_id      = EXCLUDED.club_id,
        status       = EXCLUDED.status,
        club_member_no = COALESCE(EXCLUDED.club_member_no, public.members.club_member_no),
        first_name   = EXCLUDED.first_name,
        last_name    = EXCLUDED.last_name,
        birthdate    = EXCLUDED.birthdate,
        street       = EXCLUDED.street,
        email        = COALESCE(EXCLUDED.email, public.members.email),
        zip          = EXCLUDED.zip,
        city         = EXCLUDED.city,
        phone        = COALESCE(EXCLUDED.phone, public.members.phone),
        -- sepa_approved wird bewusst NICHT überschrieben: Approval-Flag
        updated_at   = now();

    ELSE
      -- -------------------------------------------------------
      -- Create-Pfad: neues Mitglied anlegen
      -- -------------------------------------------------------
      v_member_no      := public.generate_internal_member_no();
      v_club_member_no := public.next_club_member_no(p_club_id);

      INSERT INTO public.club_members (
        club_id, club_code, member_no, club_member_no,
        first_name, last_name, status,
        membership_kind, fishing_card_type, role
      ) VALUES (
        p_club_id,
        v_club_code,
        v_member_no,
        v_club_member_no,
        COALESCE(NULLIF(v_row->>'first_name', ''), 'Vorname'),
        COALESCE(NULLIF(v_row->>'last_name', ''), 'Nachname'),
        COALESCE(NULLIF(v_row->>'status', ''), 'active'),
        'Mitglied',
        '-',
        'member'
      );

      INSERT INTO public.members (
        club_id, status, membership_number, club_member_no,
        first_name, last_name, birthdate,
        street, email, zip, city, phone,
        mobile, guardian_member_no, is_local, known_member,
        fishing_card_type, sepa_approved, source_application_id
      ) VALUES (
        p_club_id,
        COALESCE(NULLIF(v_row->>'status', ''), 'active'),
        v_member_no,
        v_club_member_no,
        COALESCE(NULLIF(v_row->>'first_name', ''), 'Vorname'),
        COALESCE(NULLIF(v_row->>'last_name', ''), 'Nachname'),
        NULLIF(v_row->>'birthdate', '')::date,
        COALESCE(NULLIF(v_row->>'street', ''), '-'),
        NULLIF(v_row->>'email', ''),
        COALESCE(NULLIF(v_row->>'zip', ''), '-'),
        COALESCE(NULLIF(v_row->>'city', ''), '-'),
        NULLIF(v_row->>'phone', ''),
        NULL, NULL, false, NULL, '-', true, NULL
      )
      ON CONFLICT (membership_number) DO UPDATE SET
        club_id      = EXCLUDED.club_id,
        status       = EXCLUDED.status,
        club_member_no = EXCLUDED.club_member_no,
        first_name   = EXCLUDED.first_name,
        last_name    = EXCLUDED.last_name,
        birthdate    = EXCLUDED.birthdate,
        street       = EXCLUDED.street,
        email        = COALESCE(EXCLUDED.email, public.members.email),
        zip          = EXCLUDED.zip,
        city         = EXCLUDED.city,
        phone        = COALESCE(EXCLUDED.phone, public.members.phone),
        updated_at   = now();
    END IF;

    v_imported := v_imported + 1;
  END LOOP;

  RETURN jsonb_build_object('imported', v_imported);
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_csv_confirmed(uuid, jsonb) TO authenticated;
