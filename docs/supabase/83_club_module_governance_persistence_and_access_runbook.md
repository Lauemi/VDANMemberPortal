# 83 Club Module Governance Persistence + Access

Status: `READY_FOR_MANUAL_APPLY`  
Datum: `2026-03-11`  
Ausführung: `NICHT ausgeführt` (nur vorbereitet)

## Ziel
1. Modul-/Usecase-Katalog in DB persistent machen.
2. Modulfreigaben pro `club_id` persistent machen.
3. Helper für effektiven Zugriff (`has_usecase_access`) bereitstellen.

## Scope
- Neue Tabellen:
  - `public.module_catalog`
  - `public.module_usecases`
  - `public.club_module_usecases`
- Seeds für Standardmodule/Usecases
- Seed pro bekanntem Club für aktive Usecases
- ACL-Seed für Usecase-Ebene in `club_role_permissions`
- RLS + Policies für neue Governance-Tabellen
- Neue Helper:
  - `public.is_admin_in_any_club()`
  - `public.has_usecase_access(uuid, text, text)`

## Nicht im Scope
- Kein vollständiger Cutover aller bestehenden Feature-Guards auf `has_usecase_access`
- Keine Entfernung alter Rollenpfade (`user_roles`-basierte Guards)

## Ausführung (manuell, nach Freigabe)
Datei:
- `supabase/migrations/20260311143000_club_module_governance_persistence_and_access.sql`

## Pflicht-Audit-SQL (Regel)
Datei:
- `docs/supabase/83_club_module_governance_persistence_and_access_audit.sql`

Hinweis:
- Migration ohne anschließende Audit-SQL gilt als nicht abgeschlossen.

## Ausführungsreihenfolge
1. Migration ausführen
2. Audit-SQL vollständig ausführen
3. Ergebnis im Deploy-Log dokumentieren
