# Multi-Club Phase 1 - Implementierungsbacklog

Stand: 2026-03-01
Zweck: Konkrete Umsetzungsliste vom aktuellen Single-Club-Stand zu Multi-Club Aggregation Phase 1.

## 1) Scope Phase 1
1. Mehrfachmitgliedschaft pro User.
2. Aggregierter Feed/Termine/Ausweise ohne globalen Vereinswechsel.
3. Strikte `club_id`-Isolation bleibt erhalten.
4. Schreibaktionen mit expliziter Vereinswahl bei mehreren Memberships.

## 2) Workstream A - Schema & Daten

### A-01 Clubs Basistabelle prüfen/ergänzen
- Deliverable:
  - `clubs(id, name, logo_url, status, created_at)`
- Done wenn:
  - [ ] club-Tabelle stabil vorhanden
  - [ ] aktive/inaktive Clubs verwaltbar

### A-02 Memberships als Kernobjekt
- Deliverable:
  - `memberships(id, user_id, club_id, role, member_no, status, valid_from, valid_to, attributes jsonb)`
- Done wenn:
  - [ ] `unique(club_id, member_no)`
  - [ ] FK `club_id -> clubs(id)`
  - [ ] FK `user_id -> auth.users(id)`

### A-03 `club_id` Backfill in Domaintabellen
- Betroffene Tabellen (minimum):
  - posts/feed
  - events/work_events
  - catches/fishing_trips
  - documents
  - notes
  - applications/members
- Done wenn:
  - [ ] jede relevante Tabelle `club_id not null`
  - [ ] geeignete Indizes gesetzt

## 3) Workstream B - RLS & RPC

### B-01 RLS Standardpattern pro Tabelle
- Regel:
  - aktive Membership mit gleicher `club_id` notwendig.
- Done wenn:
  - [ ] Select/Insert/Update/Delete Policies je Tabelle angepasst
  - [ ] Negativtests gegen fremde Clubdaten erfolgreich

### B-02 Role Layer trennen
- Rollen:
  - `member`
  - `club_admin` (oder `vorstand` als club-lokal)
  - `platform_admin`
- Done wenn:
  - [ ] keine globalen Admin-Rechte ohne explizite Prüfung

### B-03 Idempotenz für Offline-Sync
- Deliverable:
  - `client_request_id` + `unique(club_id, client_request_id)` wo sinnvoll
- Done wenn:
  - [ ] Doppel-Submit Tests ohne Duplikate

## 4) Workstream C - Frontend Aggregation

### C-01 Aggregierter Feed
- Query:
  - `where club_id in (user_club_ids)`
- UI:
  - Clubname + Logo je Entry
- Done wenn:
  - [ ] Feed zeigt Clubkennzeichnung
  - [ ] Filter „Alle / Club X“ optional vorhanden

### C-02 Aggregierte Termine
- Query analog Feed, sortiert nach `start_at`.
- Done wenn:
  - [ ] Terminliste enthält Clubkennzeichnung

### C-03 Ausweise parallel
- Jede aktive Membership = eigene Ausweiskarte.
- Done wenn:
  - [ ] mehrere Cards gleichzeitig sichtbar

### C-04 Schreibdialog bei Mehrfachmitgliedschaft
- Fälle:
  - 1 Membership -> auto club
  - >1 Membership -> Pflichtauswahl-Dialog
- Done wenn:
  - [ ] kein impliziter globaler Kontextwechsel

## 5) Workstream D - Notifications & Navigation

### D-01 Push Payload erweitern
- Pflichtfelder:
  - `club_id`, `club_name`, `target_url`
- Done wenn:
  - [ ] Push führt korrekt ins Zielobjekt

### D-02 Deep-Linking ohne Kontextbruch
- Done wenn:
  - [ ] App kann Zielobjekt direkt öffnen

## 6) Workstream E - Migration & Rollout

### E-01 Migrationsreihenfolge
1. `club_id` nullable einführen.
2. Backfill laufen lassen.
3. Index/FK ergänzen.
4. `not null` aktivieren.
5. RLS auf neue Regeln umstellen.

### E-02 Rollback
- Für jeden Schritt eindeutiger Rückweg.
- Done wenn:
  - [ ] Runbook dokumentiert

### E-03 Stufenrollout
1. Staging
2. Beta
3. Prod
- Done wenn:
  - [ ] Smoke-Test je Stufe bestanden

## 7) Testkatalog (Muss)
1. User mit 1 Club sieht nur eigenen Club.
2. User mit 2 Clubs sieht aggregierte Listen mit Kennzeichnung.
3. User mit 2 Clubs erstellt Post/Fang nur nach Clubauswahl.
4. Zugriff auf fremde Clubdaten wird durch RLS blockiert.
5. Offline-Doppelklick erzeugt keine Duplikate.
6. Push öffnet korrektes Clubobjekt.

## 8) Akzeptanzkriterien Phase 1 (Go)
- [ ] Alle relevanten Tabellen haben `club_id not null`.
- [ ] RLS-Tests positiv/negativ dokumentiert.
- [ ] Feed/Termine/Ausweise aggregiert im UI.
- [ ] Schreibdialog bei Mehrfachmitgliedschaft aktiv.
- [ ] Push club-aware getestet.
- [ ] Migrations- und Rollback-Runbook freigegeben.

## 9) Owner/Zeitschiene (Template)
| Workstream | Owner | Start | Ziel | Status |
| --- | --- | --- | --- | --- |
| A Schema |  |  |  | offen |
| B RLS/RPC |  |  |  | offen |
| C Frontend |  |  |  | offen |
| D Push/Nav |  |  |  | offen |
| E Rollout |  |  |  | offen |
