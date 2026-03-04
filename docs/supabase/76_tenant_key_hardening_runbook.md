# Runbook - 76 Tenant Key Hardening (Safe)

Ziel: kontrollierte Ausfuehrung von `76_tenant_key_hardening_safe.sql` mit minimalem Betriebsrisiko.

Datei:
- `docs/supabase/76_tenant_key_hardening_safe.sql`

## 1) Vorbedingungen

- Deployment-Fenster mit geringer Last (2-5 Minuten) festlegen.
- Admin-Zugriff auf Supabase SQL Editor.
- Kein paralleler DB-Migrationslauf.

## 2) Precheck (vorher ausfuehren)

```sql
-- A) Aktuelle PK user_roles pruefen
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.user_roles'::regclass
  and contype = 'p';

-- B) Gibt es doppelte Reihen fuer (user_id, club_id, role)?
select user_id, club_id, role, count(*) as c
from public.user_roles
group by user_id, club_id, role
having count(*) > 1;

-- C) Gibt es doppelte Reihen fuer (club_id, member_no)?
select club_id, member_no, count(*) as c
from public.club_members
group by club_id, member_no
having count(*) > 1;
```

Erwartung:
- B) und C) liefern `0 rows`.

## 3) Ausfuehrung

SQL aus `76_tenant_key_hardening_safe.sql` komplett ausfuehren.

Hinweis:
- Kurzer Lock auf `user_roles`/`club_members` ist normal.
- Script hat `lock_timeout`/`statement_timeout` und ist idempotent.

## 4) Verifikation (direkt danach)

```sql
-- A) PK user_roles jetzt tenant-aware?
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.user_roles'::regclass
  and contype = 'p';

-- B) Unique guard auf club_members vorhanden?
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.club_members'::regclass
  and contype in ('p', 'u')
order by conname;
```

Erwartung:
- `PRIMARY KEY (user_id, club_id, role)`
- `club_members_club_id_member_no_key UNIQUE (club_id, member_no)`

## 5) Smoke-Test App

- Login als normales Mitglied.
- Rollenabfrage/Portalzugriff testen.
- Oeffentlichen Feed prüfen (ausgeloggt).
- Admin-Funktionen kurz pruefen (Mitgliederverwaltung).

## 6) Fallback (nur wenn noetig)

Wenn ungeplante Seiteneffekte auftreten:

Vor Ruecksetzung der PK auf `(user_id, role)` zwingend pruefen, ob es bereits
mehrere Rollenzeilen pro User und Rolle ueber verschiedene Clubs gibt:

```sql
select user_id, role, count(*) as c
from public.user_roles
group by user_id, role
having count(*) > 1;
```

Wenn diese Abfrage Zeilen liefert, darf die alte PK nicht direkt gesetzt werden.
In diesem Fall zuerst fachlich entscheiden, welche Zeilen bestehen bleiben sollen.

```sql
begin;

alter table public.user_roles
  drop constraint if exists user_roles_pkey;
alter table public.user_roles
  add constraint user_roles_pkey primary key (user_id, role);

alter table public.club_members
  drop constraint if exists club_members_club_id_member_no_key;

commit;
```

Danach sofort Smoke-Test wiederholen.

## 7) Board-Doku

- Ergebnis in `docs/board-release-gate.md` eintragen:
  - Status Security Gate
  - Zeitpunkt Ausfuehrung
  - Owner + Ergebnis
