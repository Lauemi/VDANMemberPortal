# 79 Club Governance ACL Foundation (Draft)

Status: `READY_FOR_MANUAL_APPLY`  
Datum: `2026-03-11`  
Ausführung: `NICHT ausgeführt` (nur vorbereitet)

## Ziel
Einführung einer ersten persistenten Vereins-Governance-Basis für Rollen und Rechte, ohne das bestehende Kern-Rollenmodell (`member`, `vorstand`, `admin`) zu brechen.

## Warum
Aktuell ist die Rollen-/Rechte-Matrix im Vereins-Board lokal (UI/LocalStorage).  
Für produktionsfähige Governance wird eine DB-seitige, club-spezifische ACL benötigt.

## Scope (dieser Draft)
1. Neue Tabellen:
- `public.club_roles`
- `public.club_role_permissions`
- `public.club_user_roles`

2. Schutzmechanik:
- Core-Rollen pro Verein (`member`, `vorstand`, `admin`) sind nicht löschbar
- Core-`role_key` ist nicht umbenennbar

3. Initialisierung:
- Core-Rollen pro bestehendem `club_id` anlegen
- bestehende `public.user_roles` nach `public.club_user_roles` backfillen

## Nicht im Scope
- Keine Umstellung bestehender Policies/RLS auf neues ACL-Modell
- Kein Entfernen/Ändern von `public.user_roles`
- Keine UI-API-Anbindung
- Kein Cutover

## Kompatibilität
Die Migration ist additiv.  
Bestehende Logik mit `public.user_roles` bleibt unverändert funktionsfähig.

## Preflight Checks (vor Ausführung)
```sql
-- 1) Gibt es user_roles mit club_id?
select count(*) as rows_with_club
from public.user_roles
where club_id is not null;

-- 2) Welche Rollen existieren aktuell?
select lower(role) as role, count(*) as n
from public.user_roles
group by lower(role)
order by n desc;

-- 3) Doppelte potenzielle Zielschlüssel?
select user_id, club_id, lower(role) as role_key, count(*) as n
from public.user_roles
where club_id is not null
group by user_id, club_id, lower(role)
having count(*) > 1;
```

## Ausführung (manuell, nach Freigabe)
Datei:
- `supabase/migrations/20260311113000_club_governance_acl_foundation.sql`

## Pflicht-Audit-SQL (Regel)
Zu dieser Migration gehört verpflichtend eine Audit-SQL.
Datei:
- `docs/supabase/79_club_governance_acl_foundation_audit.sql`

Hinweis:
- Migration ohne anschließende Audit-SQL gilt als nicht abgeschlossen.

## Postflight Checks
```sql
-- Tabellen vorhanden?
select to_regclass('public.club_roles') as club_roles;
select to_regclass('public.club_role_permissions') as club_role_permissions;
select to_regclass('public.club_user_roles') as club_user_roles;

-- Core-Rollen je Club
select club_id, role_key, is_core
from public.club_roles
where role_key in ('member','vorstand','admin')
order by club_id, role_key;

-- Backfill-Ergebnis
select count(*) as mapped_rows
from public.club_user_roles;
```

## Ausführungsreihenfolge
1. Preflight Checks
2. Migration ausführen
3. Audit-SQL vollständig ausführen
4. Ergebnis im Deploy-Log dokumentieren

## Rollback (nur im Notfall, manuell)
```sql
drop trigger if exists trg_protect_core_roles_upd on public.club_roles;
drop trigger if exists trg_protect_core_roles_del on public.club_roles;
drop function if exists public.tg_protect_core_roles();

drop trigger if exists trg_club_roles_updated_at on public.club_roles;
drop trigger if exists trg_club_role_permissions_updated_at on public.club_role_permissions;
drop function if exists public.tg_set_updated_at();

drop table if exists public.club_user_roles;
drop table if exists public.club_role_permissions;
drop table if exists public.club_roles;
```

## Hinweis
Nächster Schritt nach erfolgreicher Ausführung:
1. Read-API für ACL laden
2. Save-API für ACL schreiben
3. Danach RLS-Enforcement phasenweise aktivieren
