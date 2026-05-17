-- Fix 1: is_service_role_request() — dual-check for JWT claims
--
-- PostgREST setzt je nach Version entweder request.jwt.claim.role (individual GUC)
-- oder request.jwt.claims (full JSON blob). Die alte Implementierung prüfte nur
-- request.jwt.claim.role, was in der aktuellen Supabase-Edge-Runtime-Konfiguration
-- nicht gesetzt wird. Der Fallback auf request.jwt.claims stellt Kompatibilität
-- mit beiden Varianten sicher.
--
-- Gefunden: Phase-3-Smoke-Test 2026-05-17, admin_upsert_club_cards warf
-- forbidden_club_scope, weil is_service_role_request() false zurückgab.

CREATE OR REPLACE FUNCTION public.is_service_role_request()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $$
  SELECT
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR (
      coalesce(current_setting('request.jwt.claims', true), '') NOT IN ('', '{}', 'null')
      AND (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
$$;

-- Fix 2: Alter Overload von admin_member_registry_create entfernen
--
-- Es existierten zwei Overloads: der ursprüngliche (17 Parameter, ohne p_role und
-- p_club_member_no) und der aktuelle (19 Parameter, mit p_role DEFAULT 'member' und
-- p_club_member_no DEFAULT NULL). PostgREST konnte bei Aufrufen mit den gemeinsamen
-- Parametern nicht disambiguieren (PGRST203). Der alte Overload ist funktional durch
-- den neuen ersetzt; Aufrufer müssen p_role / p_club_member_no nicht übergeben, da
-- beide Felder Default-Werte haben.
--
-- Gefunden: Phase-3-Smoke-Test 2026-05-17, club-admin-setup schlug beim Erstellen
-- des Creator-Mitglieds fehl.

DROP FUNCTION IF EXISTS public.admin_member_registry_create(
  p_club_id           uuid,
  p_club_code         text,
  p_member_no         text,
  p_first_name        text,
  p_last_name         text,
  p_status            text,
  p_fishing_card_type text,
  p_street            text,
  p_zip               text,
  p_city              text,
  p_phone             text,
  p_mobile            text,
  p_guardian_member_no text,
  p_sepa_approved     boolean,
  p_iban              text,
  p_birthdate         date,
  p_email             text
);
