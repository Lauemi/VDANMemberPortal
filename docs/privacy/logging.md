# VDAN Logging Policy

Stand: 21.02.2026

## Ziel
Technische Protokollierung für Stabilität und Sicherheit, ohne unnötige personenbezogene Daten.

## Aufbewahrung
- Web-/Access-Logs: 14 Tage
- Fehler-/Anwendungslogs: 14 Tage
- Security-/Audit-Events (Rollenwechsel, Freigaben): 365 Tage

## Minimierung
- Keine Passwörter, Tokens oder Secrets in Logs.
- Keine Klartext-IBAN in Logs.
- Keine vollständigen Formularinhalte in Fehlerausgaben.

## Betrieb
- Logs werden ausschließlich zur Fehleranalyse, Missbrauchserkennung und Betriebssicherheit verwendet.
- Für produktive Systeme ist ein regelmäßiger Review der Retention-Einstellungen verpflichtend.
