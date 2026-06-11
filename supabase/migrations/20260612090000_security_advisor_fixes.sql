-- =============================================================
-- Security Advisor Fixes — 2026-06-12
-- =============================================================
-- Behebt drei Klassen von Advisor-Warnungen:
--
-- 1. function_search_path_mutable (7 Funktionen)
--    Sicherheitsrisiko: Angreifer könnte search_path manipulieren
--    und Funktionen in anderen Schemas mit gleichem Namen einschleusen.
--    Fix: SET search_path = public, pg_catalog explizit per ALTER FUNCTION.
--
-- 2. Ghost-Funktion admin_permit_rule_upsert(uuid, uuid, ...)
--    Ältere Version mit p_card_type_id als UUID existiert noch neben
--    der aktuellen Version (text). Nie explizit gedropt, wird vom
--    Advisor als unsicher markiert. Fix: DROP.
--
-- 3. anon_security_definer_function_executable
--    Admin- und interne Hilfsfunktionen sind per DEFAULT EXECUTE
--    für die anon-Rolle zugänglich, weil PostgreSQL EXECUTE an
--    PUBLIC vergibt, wenn nicht explizit widerrufen. Diese Funktionen
--    haben eigene Auth-Guards (auth.uid()-Checks), aber die Oberfläche
--    sollte trotzdem geschlossen werden.
--    Fix: REVOKE EXECUTE FROM anon für alle nicht-öffentlichen Funktionen.
--
-- NICHT geändert (intentional public access):
--   club_request_gate_state()         — Gate für unangemeldete Club-Anfragen
--   member_invite_preview(text)        — Einladungs-Vorschau ohne Login
--   public_active_club_id()            — Öffentliche Club-ID-Auflösung
--   submit_membership_application(...) — Öffentliches Aufnahmeformular
-- =============================================================

begin;

-- ------------------------------------------------------------------
-- 1. search_path fixieren (ALTER FUNCTION ist idempotent/sicher)
-- ------------------------------------------------------------------

-- Trigger-Funktion für permit_rules.updated_at
ALTER FUNCTION public.permit_rules_set_updated_at()
  SET search_path = public, pg_catalog;

-- Admin-Funktion für Gewässer — existiert in DB, keine Migration gefunden
ALTER FUNCTION public.admin_water_bodies_for_club(uuid)
  SET search_path = public, pg_catalog;

-- permit_rules RPCs — Migration 20260609090000 setzt search_path,
-- aber alte Versionen (vor der Migration) könnten noch existieren.
-- ALTER überschreibt in jedem Fall.
ALTER FUNCTION public.admin_permit_rules_for_club(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.admin_permit_rule_delete(uuid, uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.admin_permit_card_types_for_rules(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.get_my_permit_rules()
  SET search_path = public, pg_catalog;

-- ------------------------------------------------------------------
-- 2. Ghost-Funktion droppen
-- ------------------------------------------------------------------
-- admin_permit_rule_upsert existiert in zwei Versionen:
--   (uuid, text, text, integer, uuid, uuid)  ← aktuelle Version (Migration 20260609090000)
--   (uuid, uuid, text, integer, uuid, uuid)  ← Ghost: p_card_type_id war früher UUID
-- Die Ghost-Version hat weder search_path gesetzt noch REVOKE.
-- Sie kann gedroppt werden — die aktuelle text-Version ist produktiv.

DROP FUNCTION IF EXISTS public.admin_permit_rule_upsert(uuid, uuid, text, integer, uuid, uuid);

-- ------------------------------------------------------------------
-- 3. REVOKE anon-Zugriff auf Admin- und interne Hilfsfunktionen
-- ------------------------------------------------------------------

-- Abrechnung / SEPA / P4
REVOKE EXECUTE ON FUNCTION public.admin_create_billing_run(uuid, integer, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_billing_positions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_billing_preview(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_billing_run_items(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_billing_runs(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_sepa_config(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_mark_billing_item_returned(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_billing_position(uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, boolean, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_member_mandate(uuid, uuid, text, boolean, text, text, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_sepa_config(uuid, text, text, text, integer, text) FROM anon;

-- Rollen / Mitglieder-Zuweisung
REVOKE EXECUTE ON FUNCTION public.admin_club_members_for_role_assign(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_club_role_members_read(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_club_role_permissions_read(uuid, text) FROM anon;

-- Gewässer (admin)
REVOKE EXECUTE ON FUNCTION public.admin_water_bodies_for_club(uuid) FROM anon;

-- Permit-Regeln (Migration hat revoke, but Ghost-Version musste separat gedropt werden)
-- Die aktuellen Versionen haben bereits revoke in der Migration — kein Schaden hier.

-- Interne Auth-Helper — diese Funktionen prüfen auth.uid() intern,
-- aber die Oberfläche für anon schließen ist Best Practice.
REVOKE EXECUTE ON FUNCTION public.fcp_is_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_in_any_club() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_in_club(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_vorstand() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_vorstand_in_club(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_same_club(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_service_role_request() FROM anon;

-- Legal / Zugang — brauchen auth.uid()
REVOKE EXECUTE ON FUNCTION public.accept_current_legal(boolean, boolean, boolean, text, boolean, text, text, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.legal_acceptance_state() FROM anon;

-- Mitglieder-spezifisch — brauchen auth.uid()
REVOKE EXECUTE ON FUNCTION public.get_my_permit_rules() FROM anon;

-- ------------------------------------------------------------------
-- 4. Passwortschutz — HINWEIS (nicht per Migration konfigurierbar)
-- ------------------------------------------------------------------
-- "Leaked Password Protection" (HaveIBeenPwned-Check) muss im
-- Supabase-Dashboard unter Authentication → Settings aktiviert werden.
-- Kann nicht per SQL-Migration gesetzt werden.
-- ------------------------------------------------------------------

notify pgrst, 'reload schema';
commit;
