# Feature Masterliste Stand 1 - VDAN Fishing-Club-Portal

Stand: 2026-03-01
Projekt: Fishing-Club-Portal (VDAN)
Ansprechpartner: Michael Lauenroth
Zweck: Zentrale Basis fuer Bedienungsanleitung, Marketing, Audit und Release-Freigaben.

## 1) Produktkern (Kurzfassung)
- Produktname intern/eingeloggt: `Fishing-Club-Portal`
- Ziel: Vereinsprozesse zentral, mobil, rollenbasiert und nachvollziehbar betreiben.
- Betriebsmodus Stand 1: Single-Tenant, produktionsnah, PWA-faehig, Supabase-Backend.

## 2) Rollen und Rechte (Stand 1)
- `Gast`: oeffentliche Seiten.
- `Mitglied` (`member`): interne Member-Module.
- `Vorstand` (`vorstand`): erweiterte Orga-/Pruef-Funktionen.
- `Admin` (`admin`): Vollzugriff auf Admin-Module und Einstellungen.

## 3) Modul- und Featureliste (Stand 1)

### 3.1 Public / Website
- F-001 Startseite mit News/Teaser.
  - Nutzen: Oeffentliche Vereinskommunikation.
  - Handling: Inhalte aus Feed-/Termindaten, kein Login noetig.
- F-002 Rechtstexte (`Impressum`, `Datenschutz`, `Nutzungsbedingungen`).
  - Nutzen: Rechts- und Transparenzpflichten.
  - Handling: statische Seiten, versionierbar im Repo.
- F-003 Kontaktformular.
  - Nutzen: strukturierte Kontaktaufnahme.
  - Handling: Formularprozess mit optionalem Captcha (Konfiguration abhaengig von ENV).
- F-004 Oeffentliche Termine/Veranstaltungen/Downloads.
  - Nutzen: Vereinssichtbarkeit, Basis-Information.

### 3.2 Auth, Session, Guard
- F-010 Login/Logout inkl. Rollen-Guard.
  - Nutzen: Zugriffsschutz auf Member-Bereiche.
  - Handling: Session in Supabase Auth, Guard auf App-Routen.
- F-011 Passwort vergessen / Passwort aendern.
  - Nutzen: Self-Service und Kontosicherheit.
- F-012 Session-Verhalten inkl. "angemeldet bleiben" Logik.
  - Nutzen: bessere UX, weniger Re-Login.
  - Handling: lokale/sessionbasierte Persistenz, Token-Refresh.

### 3.3 Portal UX / One-Hand
- F-020 Portal-Quick-Menue mit rollenabhaengigen Modulen.
- F-021 One-Hand-Bedienung (Handedness links/rechts/auto).
- F-022 Toggle/Favoriten/Shortcuts im Portal.
- F-023 Branding im Login-Zustand als `Fishing-Club-Portal`.

### 3.4 Feed / Posts / Medien
- F-030 Feed mit Kategorien (inkl. Termine/Arbeitseinsatz-Logik).
- F-031 Beitrag erstellen/bearbeiten/loeschen (rollenbasiert).
- F-032 Bild-Upload mit automatischer clientseitiger Verkleinerung.
  - Nutzen: stabile Uploads bei mobilen Fotos.
  - Handling: Vorverarbeitung + Upload + visuelles Erfolgssignal.
- F-033 Upload-Status/Feedback (inkl. success check am Speichern-Button).

### 3.5 Termine und Arbeitseinsaetze
- F-040 Termin-Ansichten (Zeile/Karte), Filter, Detaildialog.
- F-041 Arbeitseinsaetze inkl. Cockpit.
- F-042 Teilnehmer-/Anwesenheitsprozesse.
- F-043 Jugend-Flag fuer relevante Inhalte.

### 3.6 Fangliste
- F-050 Fangfahrten/Faenge mit Tabellen-/Kartenansicht.
- F-051 Offline-Queue + Konfliktbehandlung + Sync-Hinweise.
- F-052 Fotoverarbeitung fuer Fangbilder (kompakt, mobil tauglich).
- F-053 Cockpit-Auswertung fuer Vorstand/Admin.

### 3.7 Mitgliedsausweis / Verifikation
- F-060 Digitaler Ausweis (Member View).
- F-061 Verifizierungsansicht / Scan-Flow (rollenabhaengig).
- F-062 Card-/Member-Nummerbezug.

### 3.8 Gewaesserkarte
- F-070 Kartenansicht fuer Gewaesser.
- F-071 Anzeige/Interaktion fuer Mitgliedernutzung.

### 3.9 Dokumente
- F-080 Dokumentenbereich (public/member/admin gesteuert).
- F-081 Download/Verwaltung nach Freigabestufe.

### 3.10 Bewerbungen / Mitgliedschaft
- F-090 Mitgliedsantrag digital.
- F-091 sensible Daten getrennt/gesichert verarbeitet.
- F-092 Pruef- und Entscheidungsfluss durch Vorstand/Admin.

### 3.11 Mitgliederverwaltung (Admin)
- F-100 Mitgliederliste und Detailpflege.
- F-101 Rollenpflege (`member`, `vorstand`, `admin`).
- F-102 Ausweis-/Profilattribute pflegbar.

### 3.12 Einstellungen
- F-110 Profil-/Kontoeinstellungen.
- F-111 Benachrichtigungseinstellungen.
- F-112 Handedness/Portal-Praeferenzen.
- F-113 Link auf Nutzungsbedingungen im eingeloggten Kontext.

### 3.13 Push und Update-Hinweise
- F-120 Push-Subscription speichern/entfernen (geraetebezogen).
- F-121 App-Update-Trigger via deploy-naher Funktion.
- F-122 PWA-Update-Hinweise und Release-Flow.

### 3.14 Admin-Tooling "lizenzfreie APIs"
- F-130 Admin-Seite fuer Wetter/Karten API (`/app/lizenzen/`).
- F-131 Wetter aktuell (Temp, Druck, Niederschlag).
- F-132 Luftdruck-Tagesmittelreihe (2 Tage rueck, heute, 5 Tage voraus) mit Trendpfeil.
- F-133 Wettervorschau (7 Tage) aufklappbar, mit Icon-Darstellung.
- F-134 Mondphase mit Label + visueller Darstellung.
- F-135 Regenradar Overlay auf Karte mit Frame-Steuerung (vor/zurueck/select), Opacity, Refresh.
- F-136 Standort speichern mit frei waehlbarem Namen.

### 3.15 Zusatzmodule
- F-140 Notizen-Modul (`/app/notes/`) inkl. offline-nahem Verhalten.
- F-141 Sitzungen (`/app/sitzungen/`) und Zustaendigkeiten (`/app/zustaendigkeiten/`).

## 4) Bedienungs-/Handbuch-Bausteine (pro Rolle)

### 4.1 Mitglied (Kurzablauf)
- Login.
- Portal-Menue oeffnen.
- Feed lesen/ggf. reagieren.
- Fang eintragen inkl. Foto.
- Termine/Arbeitseinsatz ansehen und Teilnahme managen.
- Ausweis anzeigen.
- Einstellungen/Benachrichtigungen setzen.

### 4.2 Vorstand
- Cockpit fuer Fangliste/Termine/Arbeitseinsatz aufrufen.
- Anwesenheiten/Status steuern.
- Bewerbungen pruefen.
- Inhalte steuern.

### 4.3 Admin
- Mitglieder und Rollen pflegen.
- Feature-Flags / Systemeinstellungen kontrollieren.
- API-Tools im Admin-Modul nutzen.
- Deploy-/Push-Trigger nach Runbook durchfuehren.

## 5) Marketing-Bausteine (copy-ready)
- M-001 "Alle Vereinsprozesse in einer App: mobil, klar, rollenbasiert."
- M-002 "Vom Fang bis zum Arbeitseinsatz: dokumentiert, nachvollziehbar, teamtauglich."
- M-003 "PWA-faehig: schnelle Nutzung auf Smartphone und Desktop."
- M-004 "Sicherheitsfokus: Zugriffskontrollen, getrennte Rechte, klare Betriebsprozesse."

## 6) Security Baseline (Stand 1)
- S-001 Rollenbasierter Zugriff (Guard + RLS-orientierte Architektur).
- S-002 Authentifizierung ueber Supabase Auth, Session/Refresh-Handling.
- S-003 Security Header/CSP aktiv, Inline-Script-Disziplin.
- S-004 Secrets nicht im Repo, nur ENV/Secret Stores (z. B. GitHub Actions Secrets, Supabase).
- S-005 PWA-Sicherheitsmodus: keine ungepruefte API/Auth-Caches im Offline-Mode.
- S-006 Datenminimierung und getrennte Verarbeitung sensibler Felder in Membership-Flows.
- S-007 Deploy kontrolliert via Runbook + Rollback-Pfad.

## 7) Auditfaehigkeit (Nachweisquellen)
- A-001 SQL-Migrationshistorie unter `docs/supabase/*.sql`.
- A-002 Security-/Datenschutzdokumente unter `docs/legal/`, `docs/privacy/`.
- A-003 Release-/Deploy-Checks unter `docs/release/` und CI-Logs.
- A-004 Tests (`npm test`) und Build-Artefakte (`npm run build`).
- A-005 Feature-/Projektbeschreibung unter `docs/project/`.
- A-006 Tech-Risiko-Matrix: `docs/project/TECH_RISIKO_MATRIX_2026-03-01.md`.
- A-007 Release-Smoke-Test je Umgebung: `docs/project/RELEASE_SMOKE_TEST_STAGING_BETA_PROD_2026-03-01.md`.
- A-008 Multi-Club-Ausbau-Gates: `docs/project/MULTI_CLUB_FINAL_AUSBAU_GATES_2026-03-01.md`.
- A-009 Vercel-Cutover-Runbook: `docs/project/VERCEL_CUTOVER_RUNBOOK_2026-03-01.md`.
- A-010 Open-Items-Tracker: `docs/project/MASTERLISTE_OPEN_ITEMS_TRACKER_2026-03-01.md`.
- A-011 Vercel Environment Secrets Matrix: `docs/project/VERCEL_ENV_SECRETS_MATRIX_2026-03-01.md`.
- A-012 Multi-Club Phase-1 Implementierungsbacklog: `docs/project/MULTI_CLUB_PHASE1_IMPLEMENTATION_BACKLOG_2026-03-01.md`.
- A-013 Multi-Club SQL-Plan: `docs/supabase/50_multi_club_phase1_plan.sql`.
- A-014 Staging/Beta/Prod Execution Checkpoints: `docs/project/STAGING_BETA_PROD_EXECUTION_CHECKPOINTS_2026-03-01.md`.

## 8) Fallstricke und Risiken (operativ wichtig)
- R-001 PWA Cache-/Update-Verhalten kann alte UI-Zustaende zeigen, wenn SW-Update nicht sauber greift.
- R-002 Push auf iOS haengt stark an Browser-/PWA-Kontext und User-Interaktion.
- R-003 Upload-Fehler koennen trotz Komprimierung durch Storage-RLS/Netzwerk entstehen.
- R-004 Lange mobile Overlays koennen One-Hand-Bedienung verschlechtern.
- R-005 Secret-Mismatch (GitHub vs Supabase) fuehrt zu Deploy-/Push-Fehlern.
- R-006 Stage/Prod-Trennung noch ausbaufahig; disziplinierte Rollouts erforderlich.

## 9) Security-Checkliste vor Release
- [ ] Build erfolgreich.
- [ ] Tests erfolgreich.
- [ ] Keine Secrets im Commit.
- [ ] Actions-Secrets konsistent (URL/Keys/Tokens).
- [ ] Kritische Flows smoke-getestet (Login, Feed-Post, Bild-Upload, Fangliste, Arbeitseinsatz, Push).
- [ ] Rechtstexte/Datenschutz auf aktuellem Stand.

## 10) Pflegeprozess (wichtig)
- Neue Idee zuerst in `IDEEN_BACKLOG_STAND1_VDAN_2026-03-01.md` eintragen.
- Nach Freigabe: in dieser Masterliste als neues `F-xxx` aufnehmen.
- Nach Umsetzung: Status in Ideenliste auf erledigt setzen und in Release-Notiz aufnehmen.

## 11) Verbindliche Betriebsdokumente
- Tech-Risiken und Gegenmassnahmen: `docs/project/TECH_RISIKO_MATRIX_2026-03-01.md`.
- Release-Freigabecheck (staging/beta/prod): `docs/project/RELEASE_SMOKE_TEST_STAGING_BETA_PROD_2026-03-01.md`.
- Multi-Club Final-Ausbau: `docs/project/MULTI_CLUB_FINAL_AUSBAU_GATES_2026-03-01.md`.
- Vercel-Cutover und Branch-Deploys: `docs/project/VERCEL_CUTOVER_RUNBOOK_2026-03-01.md`.
- Open-Items und Priorisierung: `docs/project/MASTERLISTE_OPEN_ITEMS_TRACKER_2026-03-01.md`.
- Vercel Secret-Matrix je Environment: `docs/project/VERCEL_ENV_SECRETS_MATRIX_2026-03-01.md`.
- Multi-Club Umsetzungsbacklog + SQL-Phase-1: `docs/project/MULTI_CLUB_PHASE1_IMPLEMENTATION_BACKLOG_2026-03-01.md`, `docs/supabase/50_multi_club_phase1_plan.sql`.
- Ausfuehrungs-Checkpoints fuer Staging/Beta/Prod: `docs/project/STAGING_BETA_PROD_EXECUTION_CHECKPOINTS_2026-03-01.md`.
