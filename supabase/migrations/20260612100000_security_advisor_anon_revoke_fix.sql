-- =============================================================
-- Security Advisor Fix Teil 2 — 2026-06-12
-- =============================================================
-- Die erste Migration hat REVOKE FROM anon verwendet.
-- Das funktioniert nur wenn es einen expliziten GRANT TO anon gab.
-- Wenn die Funktion nur über PUBLIC zugreifbar war (PostgreSQL-Default
-- bei CREATE FUNCTION), muss FROM PUBLIC revoked werden.
--
-- Korrekte Sequenz:
--   1. REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;
--   2. GRANT EXECUTE ON FUNCTION ... TO authenticated;
--
-- Damit:
--   - anon: kein Zugriff mehr (PUBLIC-Grant weg, kein expliziter anon-Grant)
--   - authenticated: Zugriff behalten
--   - SECURITY DEFINER-Ketten: nicht betroffen (laufen als Owner)
--
-- ABSICHTLICH NICHT GEAENDERT (public access required):
--   club_request_gate_state()         — Gate für unangemeldete Anfragen
--   member_invite_preview(text)        — Einladungs-Preview ohne Login
--   public_active_club_id()            — öffentliche Club-ID-Auflösung
--   submit_membership_application(...) — öffentliches Aufnahmeformular
-- =============================================================

begin;

-- ------------------------------------------------------------------
-- Auth-Helper (werden vom Frontend direkt per RPC aufgerufen)
-- ------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin_in_any_club() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_in_any_club() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin_in_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_in_club(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_vorstand() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_vorstand() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_vorstand_in_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_vorstand_in_club(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_same_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_same_club(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_service_role_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_service_role_request() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fcp_is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fcp_is_superadmin() TO authenticated;

-- ------------------------------------------------------------------
-- Legal / Zustimmung (post-auth, kein anon-Zugriff nötig)
-- ------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.accept_current_legal(boolean, boolean, boolean, text, boolean, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_current_legal(boolean, boolean, boolean, text, boolean, text, text, text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.legal_acceptance_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legal_acceptance_state() TO authenticated;

-- ------------------------------------------------------------------
-- Admin Mitglieder-/Rollen-Verwaltung
-- ------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.admin_club_members_for_role_assign(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_club_members_for_role_assign(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_club_role_members_read(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_club_role_members_read(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_club_role_permissions_read(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_club_role_permissions_read(uuid, text) TO authenticated;

-- ------------------------------------------------------------------
-- Abrechnung / Billing
-- ------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.admin_get_billing_positions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_billing_positions(uuid) TO authenticated;

-- ------------------------------------------------------------------
-- Gewässer-Admin
-- ------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.admin_water_bodies_for_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_water_bodies_for_club(uuid) TO authenticated;

-- ------------------------------------------------------------------
-- Permit-Regeln (fehlten in der ersten Migration komplett)
-- ------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.admin_permit_card_types_for_rules(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_permit_card_types_for_rules(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_permit_rule_delete(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_permit_rule_delete(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_permit_rules_for_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_permit_rules_for_club(uuid) TO authenticated;

-- ------------------------------------------------------------------
-- Mitglieder-Angelschein (braucht auth.uid())
-- ------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_my_permit_rules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_permit_rules() TO authenticated;

-- ------------------------------------------------------------------
-- PostgREST Schema-Reload
-- ------------------------------------------------------------------

notify pgrst, 'reload schema';
commit;
