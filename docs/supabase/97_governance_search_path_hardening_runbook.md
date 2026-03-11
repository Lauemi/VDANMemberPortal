# 97 Governance - Search Path Hardening

Status: `READY_FOR_MANUAL_APPLY`  
Datum: `2026-03-11`  
Ausführung: `NICHT ausgeführt` (nur vorbereitet)

## Ziel
1. Supabase-Linter Warnungen `function_search_path_mutable` für folgende Funktionen beheben:
   - `public.tg_set_updated_at`
   - `public.tg_protect_core_roles`
   - `public.tg_club_role_permissions_sanitize`
2. Auditierbare, feste `search_path`-Konfiguration sicherstellen.

## Scope
- SQL-Migration setzt für die drei Funktionen eine feste `search_path`.
- Audit-SQL prüft Existenz + gesetzte `search_path`.

## Nicht im Scope
- Keine Änderung an RLS-Policies.
- Keine semantische Logikänderung der Triggerfunktionen.
- Kein Fix für `auth_leaked_password_protection` per SQL (Supabase Auth-Konsole/Config-Thema).

## Ausführung (manuell)
Datei:
- `supabase/migrations/20260311160000_governance_search_path_hardening.sql`

## Pflicht-Audit-SQL
Datei:
- `docs/supabase/97_governance_search_path_hardening_audit.sql`

Hinweis:
- Migration ohne anschließende Audit-SQL gilt als nicht abgeschlossen.

## Ausführungsreihenfolge
1. Migration ausführen
2. Audit-SQL vollständig ausführen
3. Ergebnis im Deploy-Log dokumentieren

## Externer Security-Hinweis: Leaked Password Protection
Der Supabase-Linter-Hinweis `auth_leaked_password_protection` ist kein DB-SQL-Thema.

Manuelle Aktion in Supabase:
1. Supabase Dashboard öffnen
2. `Authentication` -> `Providers` -> `Email` (oder Security-Settings je UI-Version)
3. `Leaked password protection` aktivieren
4. Save/Apply

Dokumentation:
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

