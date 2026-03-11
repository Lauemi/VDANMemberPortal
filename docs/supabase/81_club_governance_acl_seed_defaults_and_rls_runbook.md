# 81 Club Governance ACL - Seed Defaults + RLS (Draft)

Status: `READY_FOR_MANUAL_APPLY`  
Datum: `2026-03-11`  
Ausführung: `NICHT ausgeführt` (nur vorbereitet)

## Ziel
1. Default-Rechte pro `club_id` für Kernrollen (`member`, `vorstand`, `admin`) seeden.
2. RLS für ACL-Tabellen aktivieren und club-scoped Policies setzen.

## Fokus club_id + RLS
- Alle ACL-Tabellen arbeiten über `club_id`.
- Policies nutzen:
  - `public.is_same_club(club_id)`
  - `public.is_admin_in_club(club_id)`
  - `public.is_admin_or_vorstand_in_club(club_id)`

## Scope
- `club_role_permissions` wird mit Standardrechten befüllt (idempotent via `on conflict do nothing`)
- RLS aktiviert auf:
  - `public.club_roles`
  - `public.club_role_permissions`
  - `public.club_user_roles`
- Policies für read/write entsprechend Rolle gesetzt

## Nicht im Scope
- Kein Cutover der gesamten App auf ACL-Tabellen
- Keine Entfernung alter `user_roles`-Pfade

## Ausführung (manuell, nach Freigabe)
Datei:
- `supabase/migrations/20260311125500_club_governance_acl_seed_defaults_and_rls.sql`

## Pflicht-Audit-SQL (Regel)
Datei:
- `docs/supabase/81_club_governance_acl_seed_defaults_and_rls_audit.sql`

Hinweis:
- Migration ohne anschließende Audit-SQL gilt als nicht abgeschlossen.

## Ausführungsreihenfolge
1. Migration ausführen
2. Audit-SQL vollständig ausführen
3. Ergebnis im Deploy-Log dokumentieren
