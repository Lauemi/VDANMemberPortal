# 82 ACL Helper Cutover to club_user_roles (Draft)

Status: `READY_FOR_MANUAL_APPLY`  
Datum: `2026-03-11`  
Ausführung: `NICHT ausgeführt` (nur vorbereitet)

## Ziel
Helper-Funktionen auf das neue ACL-Rollenmodell umstellen, ohne Policy-Aufrufer ändern zu müssen:
- `public.is_admin_in_club(uuid)`
- `public.is_admin_or_vorstand_in_club(uuid)`

Die Signaturen bleiben gleich, intern wechselt die Quelle von `public.user_roles` auf `public.club_user_roles`.

## Warum
Aktuelle RLS-Policies rufen diese Helper auf.  
Der Cutover hält die Policy-Namen und -Signaturen stabil und minimiert Risiko.

## Scope
- Nur Funktionskörper werden ersetzt (`create or replace function`)
- Keine Policy-Drops/Neuanlage
- Kein Entfernen von `public.user_roles`

## Preflight (manuell)
```sql
-- 1) Vergleich: user_roles vs club_user_roles für Kernrollen
with a as (
  select user_id, club_id, lower(role) as role_key
  from public.user_roles
  where club_id is not null
    and lower(role) in ('member','vorstand','admin')
),
b as (
  select user_id, club_id, role_key
  from public.club_user_roles
  where role_key in ('member','vorstand','admin')
)
select 'missing_in_acl' as side, * from a
except
select 'missing_in_acl' as side, * from b
union all
select 'extra_in_acl' as side, * from b
except
select 'extra_in_acl' as side, * from a;
```

## Ausführung (manuell, nach Freigabe)
Datei:
- `supabase/migrations/20260311133000_acl_helper_cutover_to_club_user_roles.sql`

## Pflicht-Audit-SQL (Regel)
Datei:
- `docs/supabase/82_acl_helper_cutover_to_club_user_roles_audit.sql`

Hinweis:
- Migration ohne anschließende Audit-SQL gilt als nicht abgeschlossen.

## Rollback (manuell)
Rollback bedeutet: Helper wieder auf `public.user_roles` umstellen.
Siehe SQL in Audit-Dokument (Rollback-Block).
