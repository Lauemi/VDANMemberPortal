# 80 Club Governance ACL - can_view (Draft)

Status: `READY_FOR_MANUAL_APPLY`  
Datum: `2026-03-11`  
Ausführung: `NICHT ausgeführt` (nur vorbereitet)

## Ziel
Die Rechte-Matrix um eine explizite Sichtbarkeitssteuerung erweitern:
- `can_view` als eigene Spalte
- Regel:
  - `can_view = false` => keine Rechte (`read/write/update/delete = false`)
  - `can_view = true` => `can_read = true` (Lesen standardmäßig aktiv)

## Warum
Nur mit eigener Sichtbarkeits-Spalte ist klar trennbar:
- Modul sehen dürfen
- Modul-Aktionen ausführen dürfen

## Scope
1. `can_view` zu `public.club_role_permissions` hinzufügen
2. Bestandsdaten aus altem Modell normalisieren
3. Trigger erzwingt Semantik bei Insert/Update
4. Check-Constraint schützt vor inkonsistenten Kombinationen

## Nicht im Scope
- Keine Umstellung auf finale RLS-ACL-Durchsetzung
- Keine API-/Frontend-Umstellung in dieser SQL

## Preflight Checks
```sql
-- Tabelle vorhanden?
select to_regclass('public.club_role_permissions') as club_role_permissions;

-- Struktur vor Migration
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'club_role_permissions'
order by ordinal_position;
```

## Ausführung (manuell, nach Freigabe)
Datei:
- `supabase/migrations/20260311121500_club_governance_acl_add_can_view.sql`

## Pflicht-Audit-SQL (Regel)
Datei:
- `docs/supabase/80_club_governance_acl_add_can_view_audit.sql`

Hinweis:
- Migration ohne anschließende Audit-SQL gilt als nicht abgeschlossen.

## Ausführungsreihenfolge
1. Preflight Checks
2. Migration ausführen
3. Audit-SQL vollständig ausführen
4. Ergebnis im Deploy-Log dokumentieren
