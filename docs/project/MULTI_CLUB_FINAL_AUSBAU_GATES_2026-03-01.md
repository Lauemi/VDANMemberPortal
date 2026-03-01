# Multi-Club Final-Ausbau Gates (SQL/RLS/Operations)

Stand: 2026-03-01
Zweck: Verbindliche technische Abnahme-Gates fuer den Ausbau von Single-Club auf Multi-Club-Aggregation.

## 1) Architektur-Prinzip (nicht verhandelbar)
1. Backend bleibt strikt club-isoliert (`club_id`).
2. Frontend aggregiert nur Lesesichten ueber eigene Memberships.
3. Kein globaler, stiller Kontextwechsel bei Schreibaktionen.

## 2) Datenmodell-Gates

### 2.1 Pflichtfelder
1. Jede club-bezogene Tabelle hat `club_id uuid not null`.
2. Membership-Kernobjekt vorhanden:
   1. `id`
   2. `user_id`
   3. `club_id`
   4. `role`
   5. `member_no`
   6. `status`
   7. `valid_from`
   8. `valid_to`

### 2.2 Constraints
1. `unique (club_id, member_no)` fuer mitgliedsnummernbasierte Eindeutigkeit.
2. FK-Integritaet fuer `club_id` auf `clubs(id)`.
3. Status-Domain (mind.): `active`, `pending`, `suspended`, `left`.

### 2.3 Indexe (Minimum)
1. `create index ... on <table>(club_id, created_at desc)` fuer Feed/Listen.
2. `create index ... on events(club_id, start_at)` fuer Termine.
3. `create index ... on memberships(user_id, club_id, status)`.

## 3) RLS-Gates

### 3.1 Standard-Leseregel
Zugriff nur wenn aktive Membership existiert:
```sql
exists (
  select 1
  from memberships m
  where m.user_id = auth.uid()
    and m.club_id = target_table.club_id
    and m.status = 'active'
)
```

### 3.2 Schreibregeln
1. Insert/Update/Delete nur bei aktiver Membership und ausreichender Rolle.
2. Keine Policy ohne `club_id`-Bindung.
3. `security definer` nur fuer eng begrenzte, auditierte Sonderfaelle.

### 3.3 RLS-Testpflicht
1. Positivtest: eigener Club sichtbar/schreibbar.
2. Negativtest: fremder Club unsichtbar/nicht schreibbar.
3. Rollentest: member/vorstand/admin korrekt getrennt.

## 4) Aggregations-Gates (UI/Query)

### 4.1 My Feed
1. Query ueber `club_id in (user_club_ids)`.
2. Join auf `clubs(name, logo_url)` fuer eindeutige Kennzeichnung.
3. Pagination verpflichtend.

### 4.2 My Termine
1. Gleiches Muster wie Feed.
2. Sortierung nach `start_at`.
3. Clubkennzeichnung immer sichtbar.

### 4.3 My Ausweise
1. Alle aktiven Memberships als Karten parallel anzeigen.
2. Kein Umschalten notwendig.

## 5) Schreibfluss-Gates (kritisch)
1. Hat Nutzer 1 aktive Membership: automatische Zuordnung.
2. Hat Nutzer >1 aktive Membership: verpflichtender Club-Auswahldialog.
3. Default nur mit explizit gespeicherter Praeferenz (`last_used_club_id` oder `favorite_club_id`).
4. Keine unsichtbare globale Kontextumschaltung.

## 6) Idempotenz-/Konflikt-Gates
1. Schreibaktionen mit `client_request_id`.
2. Unique Constraint auf `(club_id, client_request_id)` bei queue-faehigen Entitaeten.
3. Konfliktstrategie dokumentiert (`updated_at`/`version` + UI-Konflikthinweis).

## 7) Push-/Notification-Gates
1. Push-Payload enthaelt:
   1. `club_id`
   2. `club_name`
   3. `target_url`
2. Subscription-Daten pro Geraet + pro Umgebung eindeutig.
3. VAPID-Schluessel strikt pro Umgebung getrennt.

## 8) Admin-Modell-Gates
1. `club_admin` (lokal) und `platform_admin` (global) klar getrennt.
2. Globale Admin-Rechte nur auf klar benannte Tables/Actions.
3. Audit-Log fuer Rollen-/Rechteaenderungen.

## 9) Migration Single-Club -> Multi-Club
1. Backfill-Script fuer `club_id` in Bestandsdaten.
2. Schrittfolge:
   1. `club_id` nullable einfuehren
   2. Backfill
   3. FK + Indexe
   4. `not null` erzwingen
   5. RLS final aktivieren
3. Rollback-Pfad je Migrationsschritt dokumentieren.

## 10) Operations-Gates
1. Smoke-Test fuer Multi-Club-User (mind. 2 Clubs) in staging und beta.
2. Restore-Drill bleibt quartalsweise Pflicht.
3. Rotation-Plan fuer Schluessel/Secrets bleibt aktiv.

## 11) Abnahme-Checkliste (Go/No-Go)
- [ ] Alle relevanten Tabellen enthalten `club_id not null`.
- [ ] RLS-Positiv-/Negativtests dokumentiert.
- [ ] Feed/Termine aggregiert und paginiert.
- [ ] Schreibdialog bei Mehrfachmitgliedschaft aktiv.
- [ ] Push club-aware getestet.
- [ ] Rollenmodell `club_admin` vs `platform_admin` freigegeben.
- [ ] Backfill + Rollback dokumentiert.

## 12) Nicht-Ziele in Phase 1
1. Keine Federationslogik ueber externe Plattformen.
2. Kein Marketplace-Zwang.
3. Keine Aufweichung von `club_id`-Isolation fuer Bequemlichkeit.
