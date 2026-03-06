# Board Release Gate - Multi-Tenant + DSGVO

Stand: 5. Maerz 2026

Ziel: Go/No-Go Entscheidung vor produktivem Deployment auf Basis klarer, pruefbarer Kriterien.

## 0) Aktueller Board-Stand (Snapshot 2026-03-05)

- Ampelstatus: **Gelb-Gruen**
- Vorlaeufige Bewertung: **Bedingtes Go** (noch kein finales Go-Protokoll)
- Vorlaeufige Board-Lage: **No-Go bis Gate-Closure**

Harte No-Go-Kriterien (muessen vor Go nachweislich "erfuellt" sein):
1. Security/Consent nicht vollstaendig dokumentiert bestanden.
2. Restore-Drill ohne belastbaren Nachweis (inkl. RPO/RTO).
3. Fehlende Owner + Zieldatum in den Betriebsaufgaben.

Aktuell noch offen:
- Security Gate (alle 3 Kriterien offen).
- Functional Gate (alle 4 Kriterien offen).
- Consent Gate (beide Kriterien offen).
- Betriebsaufgaben (Owner/Zieldatum/Status nicht befuellt).

## 1) Security Gate (Pflicht)

- [ ] `anon` Write-Grants = 0 (keine INSERT/UPDATE/DELETE/TRUNCATE Grants auf Business-Tabellen)
- [ ] Keine aktiven `anon`-Write-RLS-Policies
- [ ] RLS-Leak-Test bestanden (kein Cross-Club-Read, keine ungewollte Privilege Escalation)

## 2) Functional Gate (Pflicht)

- [ ] Smoke-Test `anon/public` bestanden
- [ ] Smoke-Test `authenticated/member` bestanden
- [ ] Smoke-Test `admin` bestanden
- [ ] Public Feed/Events/Documents/Waters sichtbar wie erwartet

## 3) Consent Gate (Pflicht)

- [ ] Externe Inhalte laden erst nach Einwilligung
- [ ] Widerruf der Einwilligung greift technisch wirksam

## 4) Betriebsaufgaben (Owner + Datum verpflichtend)

1. Monitoring/Alerting Definition
Owner:
Zieldatum:
Status:

2. Restore-Drill (Backup-Wiederherstellung getestet)
Owner:
Zieldatum:
Status:

3. Juristische Endfreigabe Datenschutzdokumente
Owner:
Zieldatum:
Status:

## 5) Board-Entscheidung

- [ ] Go
- [ ] No-Go

Begruendung:

Entscheider:
Datum:

## 6) Anregung Zur Sicherheitsbewertung (2026-03-05)

Einordnung:
- Vertrauenswuerdigkeit aktuell: **technisch fundiert, operativ noch unter Vorbehalt**.
- Gesamtbild: **Gelb-Gruen** (Architektur stabil, finale Betriebs-/Gate-Nachweise noch offen).

Fokuspunkte fuer die finale Einstufung "sicher":
1. Technische Isolation (Multi-Tenancy)
- RLS-Leak-Test formal dokumentiert (kein Cross-Club-Read, keine Privilege Escalation).
- `anon` Write-Rechte auf Business-Tabellen nachweislich = 0.
2. Daten-Resilienz
- Restore-Drill (Backup-Wiederherstellung) nachgewiesen, inkl. RPO/RTO.
3. Juristische/DSGVO-Endabsicherung
- Juristische Endfreigabe dokumentiert.
- Consent/Widerruf technisch verifiziert.
4. Operative Reaktionsfaehigkeit
- Monitoring/Alerting aktiv.
- Incident-Runbook einsatzbereit.
5. Rollenbasierte Funktionsabnahme
- Smoke-Tests fuer `anon`, `member`, `admin` in Zielumgebung mit produktionsnahen Keys erfolgreich.

Praezisierung fuer die Board-Entscheidung:
- Owner + Zieldatum fuer alle Betriebsaufgaben sind Pflicht.
- Falls noch Uebergangsmodus (Single-DB) aktiv ist, muss das als Restrisiko explizit im Go-Protokoll stehen.
