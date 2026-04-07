-- ============================================================
-- SQL-REFERENZVERTRAG: Usecase Access Channel
-- ============================================================
-- Datei:    docs/sql-contracts/roles/READ_usecase_access_channel.sql
-- Zweck:    Dokumentiert den bestehenden serverseitigen Rechtekanal.
--           Dies ist KEINE neue Wahrheit – nur eine lesbare Referenz.
-- Autor:    FCP / Claude + ChatGPT + Codex
-- Datum:    2026-04-07
-- Status:   REFERENZ (kein Migration-SQL)
--
-- ============================================================
-- KANONISCHE WAHRHEIT
-- ============================================================
--
-- Die eigentliche serverseitige Wahrheit liegt in:
--
--   public.module_usecases         → alle bekannten Usecases systemweit
--   public.club_module_usecases    → welche Usecases im Club aktiv sind
--   public.club_roles              → welche Rollen im Club existieren
--   public.club_role_permissions   → was jede Rolle pro Usecase darf
--   public.club_user_roles         → welcher User hat welche Rolle im Club
--
-- Der saubere serverseitige Prüfkanal ist:
--
--   public.has_usecase_access(p_club_id uuid, p_usecase_key text, p_action text)
--   → returns boolean
--   → security definer
--   → nutzt auth.uid() intern
--   → prüft: User → Rolle → Permission → Usecase aktiv im Club
--
-- ============================================================
-- BEKANNTE USECASE_KEYS (repo-nah, Stand 2026-04-07)
-- ============================================================
--
-- Kanonische Quelle: public.module_usecases
-- Diese Liste ist illustrativ – nicht normativ.
--
--   fangliste
--   go_fishing
--   fangliste_cockpit
--   arbeitseinsaetze
--   arbeitseinsaetze_cockpit
--   eventplaner
--   eventplaner_mitmachen
--   feed
--   mitglieder
--   mitglieder_registry
--   dokumente
--   sitzungen
--   einstellungen
--
-- ============================================================
-- ERLAUBTE ACTIONS
-- ============================================================
--
--   view     → kann der User den Bereich sehen?
--   read     → kann der User Daten lesen?
--   write    → kann der User neue Daten anlegen?
--   update   → kann der User bestehende Daten ändern?
--   delete   → kann der User Daten löschen?
--
-- ============================================================
-- PRÜFLOGIK (was has_usecase_access intern tut)
-- ============================================================

with params as (
  select
    null::uuid as p_club_id,                -- echte club_id hier einsetzen
    'mitglieder_registry'::text as p_usecase_key,
    'read'::text as p_action
)
select exists (
  select 1
  from params
  join public.club_module_usecases cmu
    on cmu.club_id = params.p_club_id
  join public.club_user_roles cur
    on cur.club_id = cmu.club_id
   and cur.user_id = (select auth.uid())
  join public.club_role_permissions crp
    on crp.club_id = cmu.club_id
   and crp.role_key = cur.role_key
   and crp.module_key = cmu.usecase_key
  where cmu.usecase_key = params.p_usecase_key
    and cmu.is_enabled = true
    and (
      case lower(params.p_action)
        when 'view'   then crp.can_view
        when 'read'   then crp.can_read
        when 'write'  then crp.can_write
        when 'update' then crp.can_update
        when 'delete' then crp.can_delete
        else false
      end
    )
) as access_granted;

-- Alternative, wenn du direkt den produktiven Kanal testen willst:
-- select public.has_usecase_access(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'mitglieder_registry',
--   'read'
-- ) as access_granted;

-- ============================================================
-- WICHTIGE REGELN
-- ============================================================
--
-- 1. Status schlägt Rolle
--    Ein suspendiertes Mitglied hat keine Rechte –
--    auch wenn eine Rolle zugewiesen ist.
--    → Mitgliedschaftsstatus muss separat geprüft werden.
--
-- 2. Mehrfachrollen addieren sich
--    Hat ein User mehrere Rollen, zählt das Maximum.
--    has_usecase_access gibt true zurück sobald EINE Rolle passt.
--
-- 3. Modul muss aktiv sein
--    is_enabled = true in club_module_usecases ist Pflicht.
--    Rechte allein reichen nicht.
--
-- 4. Kein UI-seitiges Sicherheitscheck
--    Die Runtime darf NUR gegen has_usecase_access prüfen.
--    Rollennamen in JSON (allowedRoles) sind nur Übergangsstand.
--
-- ============================================================
-- VERWENDUNG IN ADM/QFM (Zielzustand)
-- ============================================================
--
-- Jedes Panel referenziert im securityContext:
--
--   "securityContext": {
--     "moduleKey":      "members",          ← fachlicher Modulbereich
--     "usecaseKey":     "mitglieder_registry", ← exakter serverseitiger Key
--     "requiredAction": "read",             ← eine der 5 Actions
--     "serverValidated": true               ← Runtime nutzt has_usecase_access
--   }
--
-- Runtime ruft auf:
--   has_usecase_access(club_id, securityContext.usecaseKey, securityContext.requiredAction)
--
-- ============================================================
-- NICHT IN DIESEN VERTRAG GEHÖRT
-- ============================================================
--
--   - Panel-Namen oder maskId
--   - UI-Logik oder Renderentscheidungen
--   - allowedRoles-Listen (das ist Übergangsstand)
--   - Write-Verträge (separater Vertrag)
--
