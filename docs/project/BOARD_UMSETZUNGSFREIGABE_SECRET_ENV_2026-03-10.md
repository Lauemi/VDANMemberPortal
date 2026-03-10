# BOARD-Umsetzungsfreigabe: Secret- und Environment-Management (VDAN/FCP)
Stand: 2026-03-10

## Beschluss
Für das Projekt VDAN/FCP wird ein verbindliches Secret- und Environment-Management eingeführt.

Leitprinzip:
`Eine Wahrheit -> kontrollierte Spiegelung -> dokumentierter Drift-Check`.

## Geltungsbereich
Diese Freigabe gilt für:
- lokale Entwicklungsumgebungen,
- GitHub Secrets (CI/CD),
- Vercel Environment Variables (Build/Runtime),
- Supabase-bezogene Schlüssel und Tokens.

Aktueller Betriebsmodus:
- Es gibt kein separates Staging-System.
- Verbindliche Umgebungen sind `Local`, `Vercel Preview` und `Production`.
- Freigaben laufen über Preview-Validierung und anschließende Production-Freigabe.

## Verbindliche Regeln
1. Source of Truth je Umgebung: lokale Master-Dateien  
` .env.local.master`, `.env.preview.master`, `.env.production.master`
2. Audit-Quelle im Repo: `SECRET_MATRIX_VDAN_FCP_2026-03-10.md`
3. Trennung:
- `public_config` (z. B. `PUBLIC_*`) ist Konfiguration.
- `secret` ist vertraulich und wird nie mit Wert in Doku geführt.
4. GitHub enthält nur CI/CD-relevante Secrets.
5. Vercel enthält nur Build-/Runtime-Variablen.
6. Änderungen laufen immer in dieser Reihenfolge:  
`Master-Datei -> Matrix-Update -> Zielsysteme setzen -> Drift-Check -> Smoke-Test`.

## Kontrollmodell (One-Man-Show)
Da kein 4-Augen-Prinzip verfügbar ist, gilt als Ersatz:
1. 2-Phasen-Selbstkontrolle (Prepare/Apply zeitlich getrennt).
2. Pflicht-Checkliste vor Apply (Zweck, Scope, Rollback, Zielsysteme).
3. Proof-of-Change nach Apply (Drift-Check + Smoke-Test + Matrix-Eintrag).
4. Incident-Regel: Bei Verdacht auf Leak sofortige Rotation + Protokoll.

## Umsetzungsfreigabe
Die Umsetzung wird freigegeben mit Stichtag **2026-03-10**.

Freigabestatus:
`Umsetzungsfreigabe erteilt (operativ), Abschlussfreigabe nach erstem vollständigen Drift-Check und dokumentiertem Smoke-Test`.

## Abschlusskriterien
1. Secret-Matrix ist vollständig gepflegt.
2. Runbook ist vorhanden und angewendet.
3. Master-Dateien sind lokal gepflegt und im Repo nur als `.example` vorhanden.
4. GitHub/Vercel stehen im Soll-Zustand gemäß Matrix.
5. Erster vollständiger Durchlauf ist protokolliert (Datum, Ergebnis, Abweichungen).

## Referenzen
- `docs/project/SECRET_MATRIX_VDAN_FCP_2026-03-10.md`
- `docs/project/RUNBOOK_SECRET_SYNC_VDAN_FCP_2026-03-10.md`
- `docs/project/PROJECT_TODO_STATUS_2026-03-10.md`
