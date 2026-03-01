# Open-Items Tracker - Masterliste Stand 1

Stand: 2026-03-01
Branch: prep_vercel_multienv_admin_tools
Zweck: Operative Abarbeitung der noch offenen Punkte aus Masterliste, Risk-Matrix, Smoke-Test und Vercel-Cutover.

## 1) Priorisierung
- `P0`: Blockiert Staging/Beta/Prod oder kann Security-/Datenrisiko erzeugen.
- `P1`: Wichtig fuer stabilen Betrieb, aber nicht sofort blockierend.
- `P2`: Verbesserungen/Prozesshygiene.

## 2) Gesamtstatus
| Bereich | Status | Prioritaet | Owner | Naechster Schritt |
| --- | --- | --- | --- | --- |
| Vercel Environments | offen | P0 | DevOps | Environments anlegen + Secrets setzen |
| Domain Mapping | offen | P0 | DevOps | staging/beta/prod Domains verbinden |
| Supabase Env-Trennung | teiloffen | P0 | Backend | stage/beta/prod Projekte finalisieren |
| Release Smoke-Test Betrieb | offen | P0 | QA | Smoke-Test je Env verbindlich laufen lassen |
| Security Release Gates | offen | P0 | Security/Tech Lead | Gate-Liste pro Release abhaken |
| Restore Drill | offen | P1 | DevOps | Quartals-Drill terminieren |
| Key Rotation Plan | offen | P1 | DevOps/Security | Rotationsrunbook + Termin |
| Abuse/Rate Limits | offen | P1 | Backend | Kontakt/Login/Upload/Push Schutz final |
| Multi-Club Phase 1 | vorbereitet | P1 | Architektur/Backend | Implementierungsphase starten |
| Board-Kurzreporting | offen | P2 | Projektleitung | Ampelreport pro Woche |

## 3) P0 Aufgaben (sofort)

### P0-01 GitHub Environments + Secrets
- Status: offen
- Ziel: getrennte Secrets fuer `staging`, `beta`, `prod`.
- Artefakt:
  - `docs/project/VERCEL_CUTOVER_RUNBOOK_2026-03-01.md`
  - `scripts/setup-vercel-env-secrets-template.sh`
- Akzeptanz:
  - [ ] Environment `staging` vorhanden
  - [ ] Environment `beta` vorhanden
  - [ ] Environment `prod` vorhanden
  - [ ] Secrets vollständig gesetzt

### P0-02 Vercel Domains + Routing
- Status: offen
- Ziel:
  - `staging.fishing-club-portal.de`
  - `beta.fishing-club-portal.de`
  - `fishing-club-portal.de`
- Akzeptanz:
  - [ ] Branch `develop` landet auf staging domain
  - [ ] Branch `beta` landet auf beta domain
  - [ ] Branch `main` landet auf prod domain

### P0-03 Erste Deploy-Kette pruefen
- Status: offen
- Ziel: `develop -> staging` läuft inkl. Push-Trigger ohne 401/403.
- Akzeptanz:
  - [ ] Workflow erfolgreich
  - [ ] App erreichbar
  - [ ] Push-Trigger status 2xx oder bewusst übersprungen mit Grund

### P0-04 Release-Gates verbindlich
- Status: offen
- Ziel: keine Promotion ohne Gate-Nachweis.
- Artefakt:
  - `docs/project/RELEASE_SMOKE_TEST_STAGING_BETA_PROD_2026-03-01.md`
- Akzeptanz:
  - [ ] Gate-Checkliste vor `beta`
  - [ ] Gate-Checkliste vor `prod`

## 4) P1 Aufgaben (naechster Block)

### P1-01 Restore Drill
- Ziel: "Backup vorhanden" -> "Restore messbar erfolgreich".
- Akzeptanz:
  - [ ] Restore in Staging ausgefuehrt
  - [ ] Dauer dokumentiert
  - [ ] Protokollpfad verlinkt

### P1-02 Secret/Key Rotation
- Betroffene Keys:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
  - `PUSH_NOTIFY_TOKEN`
- Akzeptanz:
  - [ ] Rotationsreihenfolge dokumentiert
  - [ ] Downtime-freie Übergangsphase definiert
  - [ ] letzter Rotationstermin erfasst

### P1-03 Abuse/Rate-Limits
- Schutzobjekte:
  - Kontaktformular
  - Login
  - Upload
  - Push-Trigger
- Akzeptanz:
  - [ ] technische Limits dokumentiert
  - [ ] negative Testfälle durchgespielt

### P1-04 Multi-Club Phase-1 Start
- Artefakte:
  - `docs/project/MULTI_CLUB_FINAL_AUSBAU_GATES_2026-03-01.md`
  - `docs/project/MULTI_CLUB_PHASE1_IMPLEMENTATION_BACKLOG_2026-03-01.md`
  - `docs/supabase/50_multi_club_phase1_plan.sql`
- Akzeptanz:
  - [ ] Architektur-Gates mit Ownern versehen
  - [ ] SQL Plan gegen Staging validiert

## 5) P2 Aufgaben
- Board-Dashboard aus Risiko-Matrix erzeugen.
- Monatsreport Security/Release Hygiene.
- KPI-Set fuer Betriebsstabilitaet definieren (Deploy-Fehlerquote, Push-Erfolgsquote, Upload-Fehlerrate).

## 6) Weekly Ops Review Template
- Woche:
- Freigegebene Releases:
- Offene P0:
- Offene P1:
- Neu identifizierte Risiken:
- Entscheidungen/Blocker:
- Owner-Updates:

## 7) Sofort-Naechste 5 Schritte
1. GitHub Environments erstellen.
2. Environment-Secrets mit Script setzen.
3. Vercel Domains verbinden.
4. `develop` pushen, Staging prüfen.
5. Smoke-Test protokollieren und erst dann `beta` mergen.
