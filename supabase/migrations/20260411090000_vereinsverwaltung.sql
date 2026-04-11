-- =============================================================
-- MIGRATION: Vereinsverwaltung – Mitgliedsnummern, CSV, Invite
-- =============================================================

CREATE SCHEMA IF NOT EXISTS internal;

ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS member_number     integer,
  ADD COLUMN IF NOT EXISTS source            text CHECK (source IN ('manual', 'csv_import', 'application')),
  ADD COLUMN IF NOT EXISTS invite_token      text,
  ADD COLUMN IF NOT EXISTS invite_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.club_members
  DROP CONSTRAINT IF EXISTS club_members_club_id_member_number_key;
ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_club_id_member_number_key
  UNIQUE (club_id, member_number);

ALTER TABLE public.club_members
  DROP CONSTRAINT IF EXISTS club_members_invite_token_key;
ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_invite_token_key
  UNIQUE (invite_token);

CREATE INDEX IF NOT EXISTS idx_club_members_club_id_member_number
  ON public.club_members (club_id, member_number);

CREATE INDEX IF NOT EXISTS idx_club_members_invite_token
  ON public.club_members (invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_members_auth_user_id
  ON public.club_members (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS member_number_seq integer NOT NULL DEFAULT 0;

UPDATE public.clubs c
SET member_number_seq = COALESCE(
  (SELECT MAX(cm.member_number)
   FROM public.club_members cm
   WHERE cm.club_id = c.id
     AND cm.member_number IS NOT NULL),
  0
);

CREATE TABLE IF NOT EXISTS public.applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'rejected')),
  first_name          text NOT NULL,
  last_name           text NOT NULL,
  email               text NOT NULL,
  phone               text,
  birthdate           date,
  city                text,
  notes               text,
  converted_member_id uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_club_id
  ON public.applications (club_id);
CREATE INDEX IF NOT EXISTS idx_applications_status
  ON public.applications (club_id, status);

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_accepted_requires_member;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_accepted_requires_member
  CHECK (
    status != 'accepted' OR converted_member_id IS NOT NULL
  );

CREATE OR REPLACE FUNCTION internal.next_member_number(p_club_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  UPDATE public.clubs
  SET member_number_seq = member_number_seq + 1
  WHERE id = p_club_id
  RETURNING member_number_seq INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Club not found: %', p_club_id;
  END IF;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_member_number(p_club_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT member_number_seq + 1
  FROM public.clubs
  WHERE id = p_club_id;
$$;

CREATE OR REPLACE FUNCTION public.create_member(
  p_club_id       uuid,
  p_first_name    text,
  p_last_name     text,
  p_email         text,
  p_status        text DEFAULT 'active',
  p_is_youth      boolean DEFAULT false,
  p_membership_kind text DEFAULT 'standard',
  p_birthdate     date DEFAULT NULL,
  p_phone         text DEFAULT NULL,
  p_city          text DEFAULT NULL
)
RETURNS public.club_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_number  integer;
  v_result  public.club_members;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin', 'vorstand')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT internal.next_member_number(p_club_id) INTO v_number;

  INSERT INTO public.club_members (
    club_id, member_number, source,
    first_name, last_name, email,
    status, is_youth, membership_kind,
    birthdate, phone, city,
    created_at, updated_at
  ) VALUES (
    p_club_id, v_number, 'manual',
    p_first_name, p_last_name, p_email,
    p_status, p_is_youth, p_membership_kind,
    p_birthdate, p_phone, p_city,
    now(), now()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_csv_rows(
  p_club_id uuid,
  p_rows    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_row           jsonb;
  v_idx           integer := 0;
  v_results       jsonb := '[]'::jsonb;
  v_row_result    jsonb;
  v_errors        jsonb;
  v_member_number integer;
  v_seen_numbers  integer[] := '{}';
  v_seen_emails   text[] := '{}';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin', 'vorstand')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_errors := '[]'::jsonb;

    IF (v_row->>'first_name') IS NULL OR trim(v_row->>'first_name') = '' THEN
      v_errors := v_errors || '["first_name fehlt"]'::jsonb;
    END IF;
    IF (v_row->>'last_name') IS NULL OR trim(v_row->>'last_name') = '' THEN
      v_errors := v_errors || '["last_name fehlt"]'::jsonb;
    END IF;
    IF (v_row->>'email') IS NULL OR trim(v_row->>'email') = '' THEN
      v_errors := v_errors || '["email fehlt"]'::jsonb;
    END IF;

    IF (v_row->>'email') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = p_club_id
        AND email = v_row->>'email'
    ) THEN
      v_errors := v_errors || '["email bereits vorhanden"]'::jsonb;
    END IF;

    IF (v_row->>'email') = ANY(v_seen_emails) THEN
      v_errors := v_errors || '["email doppelt im Import"]'::jsonb;
    END IF;
    v_seen_emails := array_append(v_seen_emails, v_row->>'email');

    IF (v_row->>'member_number') IS NOT NULL THEN
      BEGIN
        v_member_number := (v_row->>'member_number')::integer;
      EXCEPTION WHEN others THEN
        v_errors := v_errors || '["member_number ungültig (nicht numerisch)"]'::jsonb;
        v_member_number := NULL;
      END;

      IF v_member_number IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.club_members
          WHERE club_id = p_club_id
            AND member_number = v_member_number
        ) THEN
          v_errors := v_errors || '["member_number bereits vergeben"]'::jsonb;
        END IF;
        IF v_member_number = ANY(v_seen_numbers) THEN
          v_errors := v_errors || '["member_number doppelt im Import"]'::jsonb;
        END IF;
        v_seen_numbers := array_append(v_seen_numbers, v_member_number);
      END IF;
    END IF;

    v_row_result := jsonb_build_object(
      'row_index', v_idx,
      'status', CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'ok' ELSE 'error' END,
      'errors', v_errors
    );
    v_results := v_results || jsonb_build_array(v_row_result);
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_results;
END;
$$;

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
  v_skipped       integer := 0;
  v_max_seen      integer := 0;
  v_existing_seq  integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin', 'vorstand')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT member_number_seq INTO v_existing_seq
  FROM public.clubs
  WHERE id = p_club_id
  FOR UPDATE;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    IF (v_row->>'member_number') IS NOT NULL THEN
      BEGIN
        v_member_number := (v_row->>'member_number')::integer;
      EXCEPTION WHEN others THEN
        v_member_number := NULL;
      END;
    END IF;

    IF v_member_number IS NULL THEN
      UPDATE public.clubs
      SET member_number_seq = member_number_seq + 1
      WHERE id = p_club_id
      RETURNING member_number_seq INTO v_member_number;
    END IF;

    IF v_member_number > v_max_seen THEN
      v_max_seen := v_member_number;
    END IF;

    BEGIN
      INSERT INTO public.club_members (
        club_id, member_number, source,
        first_name, last_name, email,
        status, is_youth, membership_kind,
        birthdate, phone, city,
        created_at, updated_at
      ) VALUES (
        p_club_id,
        v_member_number,
        'csv_import',
        v_row->>'first_name',
        v_row->>'last_name',
        v_row->>'email',
        COALESCE(v_row->>'status', 'active'),
        COALESCE((v_row->>'is_youth')::boolean, false),
        COALESCE(v_row->>'membership_kind', 'standard'),
        NULLIF(v_row->>'birthdate', '')::date,
        v_row->>'phone',
        v_row->>'city',
        now(), now()
      );
      v_imported := v_imported + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  UPDATE public.clubs
  SET member_number_seq = GREATEST(member_number_seq, v_max_seen)
  WHERE id = p_club_id;

  RETURN jsonb_build_object('imported', v_imported, 'skipped', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_application(
  p_application_id uuid
)
RETURNS public.club_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_app     public.applications;
  v_number  integer;
  v_member  public.club_members;
BEGIN
  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found: %', p_application_id;
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Application already processed: %', v_app.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = v_app.club_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin', 'vorstand')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT internal.next_member_number(v_app.club_id) INTO v_number;

  INSERT INTO public.club_members (
    club_id, member_number, source,
    first_name, last_name, email,
    phone, birthdate, city,
    status,
    created_at, updated_at
  ) VALUES (
    v_app.club_id, v_number, 'application',
    v_app.first_name, v_app.last_name, v_app.email,
    v_app.phone, v_app.birthdate, v_app.city,
    'active',
    now(), now()
  )
  RETURNING * INTO v_member;

  UPDATE public.applications
  SET status = 'accepted',
      converted_member_id = v_member.id,
      updated_at = now()
  WHERE id = p_application_id;

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_member(
  p_member_id      uuid,
  p_expires_days   integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token   text;
  v_member  public.club_members;
BEGIN
  SELECT * INTO v_member
  FROM public.club_members
  WHERE id = p_member_id;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = v_member.club_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin', 'vorstand')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Member already claimed';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  UPDATE public.club_members
  SET invite_token      = v_token,
      invite_sent_at    = now(),
      invite_expires_at = now() + (p_expires_days || ' days')::interval,
      invite_claimed_at = NULL,
      updated_at        = now()
  WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'invite_token', v_token,
    'invite_expires_at', (now() + (p_expires_days || ' days')::interval)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_invite(
  p_token       text,
  p_auth_user_id uuid
)
RETURNS public.club_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member public.club_members;
BEGIN
  SELECT * INTO v_member
  FROM public.club_members
  WHERE invite_token = p_token
  FOR UPDATE;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Invalid invite token';
  END IF;

  IF v_member.invite_claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already claimed';
  END IF;

  IF v_member.invite_expires_at IS NOT NULL AND v_member.invite_expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Member already has account';
  END IF;

  UPDATE public.club_members
  SET auth_user_id      = p_auth_user_id,
      invite_claimed_at = now(),
      updated_at        = now()
  WHERE id = v_member.id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

CREATE OR REPLACE VIEW public.club_members_safe AS
  SELECT
    id, club_id, member_number, source,
    first_name, last_name, email,
    status, is_youth, membership_kind,
    birthdate, phone, city,
    invite_sent_at, invite_claimed_at, invite_expires_at,
    auth_user_id,
    created_at, updated_at
  FROM public.club_members;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS applications_club_scoped ON public.applications;
CREATE POLICY applications_club_scoped
  ON public.applications
  FOR ALL
  USING (
    club_id IN (
      SELECT club_id FROM public.club_members
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'vorstand')
    )
  );
