# RLS Initplan Audit

Datum: 2026-03-28

Betroffene Migrationen:
- `supabase/migrations/20260328113000_rls_initplan_easy_fixes.sql`
- `supabase/migrations/20260328114500_rls_initplan_helper_fixes.sql`

## Ziel

Die beiden Migrationen beheben nur `auth_rls_initplan`-Warnungen aus dem Supabase-Linter.
Sie sollen die Auswertung von `auth.uid()` in RLS-Kontexten optimieren, ohne die fachliche Berechtigungslogik zu veraendern.

## Audit-Scope

Geprueft wurde nur:
- direkter Ersatz von `auth.uid()` durch `(select auth.uid())`
- direkter Ersatz helper-interner `auth.uid()`-Nutzung durch `(select auth.uid())`

Nicht geaendert wurden:
- Rollen
- Zieltabellen
- Policy-Namen
- `using`/`with check`-Logik ausserhalb des mechanischen Wrappers
- OR/AND-Verknuepfungen
- permissive/restrictive-Eigenschaften
- Policy-Konsolidierungen

## Migration 1

Datei: `supabase/migrations/20260328113000_rls_initplan_easy_fixes.sql`

Geaenderte Policies:
- `club_registration_requests_select_own_or_admin`
- `club_member_identities_select_self_or_admin`
- `event_planner_registrations_select_own_or_manager`
- `member_notifications_select_own`
- `legal_acceptance_events_self_or_club_select`

Audit-Bewertung:
- rein mechanische Aenderung
- gleiche Tabellen
- gleiche Rollen (`authenticated`)
- gleiche Policy-Namen
- gleiche fachliche Bedingungen
- nur `auth.uid()` bzw. ein helper-Aufruf in ein `select` gewrappt

Rest-Risiko:
- gering
- fachlich nur relevant, falls eine der Policies auf implizites SQL-Auswertungsverhalten angewiesen gewesen waere; dafuer gibt es hier keinen Hinweis

## Migration 2

Datei: `supabase/migrations/20260328114500_rls_initplan_helper_fixes.sql`

Geaenderte Helper:
- `public.current_user_club_id()`
- `public.is_admin_in_club(uuid)`
- `public.is_admin_or_vorstand_in_club(uuid)`
- `public.is_admin_in_any_club()`
- `public.has_usecase_access(uuid, text, text)`

Audit-Bewertung:
- ebenfalls mechanische Aenderung
- gleiche Signaturen
- gleiche Rueckgabetypen
- gleiche `search_path`-Konfiguration
- gleiche Tabellenzugriffe
- nur `auth.uid()` auf `(select auth.uid())` umgestellt

Rest-Risiko:
- niedrig bis mittel
- nicht wegen Logikaenderung, sondern weil diese Helper breit wiederverwendet werden
- dadurch koennen sich viele Linter-Funde gleichzeitig aendern

## Ausdruecklich nicht Teil dieser Runde

Diese Themen wurden bewusst nicht angefasst:
- `multiple_permissive_policies`
- Policy-Zusammenfuehrungen auf `profiles`, `user_roles`, `documents`, `club_events`
- oeffentliche Tabellen mit `anon`-Lesepfaden wie `feature_flags`, `fish_species`, `fish_species_rules`
- Funktionslogik ausserhalb von `auth.uid()`-Initialisierung

## Vor dem Einspielen pruefen

1. Es wurden keine lokalen Aenderungen an bestehenden Migrationen ueberschrieben.
2. Die neuen Migrationen enthalten keine fachlichen Logikumbauten.
3. Die Reihenfolge ist korrekt:
   - erst `20260328113000_rls_initplan_easy_fixes.sql`
   - dann `20260328114500_rls_initplan_helper_fixes.sql`

## Nach dem Einspielen pruefen

1. Supabase-Linter erneut laufen lassen.
2. Speziell auf Veraenderungen bei diesen Warnungstypen achten:
   - `auth_rls_initplan`
   - `multiple_permissive_policies`
3. Smoke-Checks fuer echte Nutzerpfade:
   - eigene `club_registration_requests` lesen
   - eigene `member_notifications` lesen
   - `event_planner_registrations` als eigenes Mitglied lesen
   - `legal_acceptance_events` als eigener Nutzer lesen
   - Admin-/Vorstand-Sicht auf club-gebundene Daten pruefen

## Entscheidungsregel fuer die naechste Runde

Falls nach dem Linter-Lauf noch Restfaelle uebrig bleiben:
- weiter mechanisch fixen, wenn nur `auth.uid()` oder `current_setting(...)` direkt in Policy-Ausdruecken steckt
- nicht mechanisch fixen, wenn gleichzeitig Policy-Dubletten, oeffentliche Sichtbarkeit oder Governance-Logik beruehrt werden

## Kurzfazit

Die beiden Migrationen sind aus Audit-Sicht fuer eine erste und zweite Performance-Welle vertretbar:
- kleiner Scope
- keine beabsichtigte Fachlogik-Aenderung
- klare Trennung zu spaeteren, riskanteren Policy-Konsolidierungen
