# Board Release Gate - Multi-Tenant + DSGVO

Stand: 4. Maerz 2026

Ziel: Go/No-Go Entscheidung vor produktivem Deployment auf Basis klarer, pruefbarer Kriterien.

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
