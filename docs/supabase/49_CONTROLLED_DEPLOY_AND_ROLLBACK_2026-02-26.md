# Controlled Deploy + Rollback (RIESEN PATCH)

Stand: 2026-02-26

Ziel: Release mit kontrollierter Reihenfolge, klaren Gates und sicherem Rollback ohne Datenverlust.

## 0) Grundprinzip fuer diesen Patch

- SQL-Migrationen sind ueberwiegend additiv/hardening.
- Deshalb: **kein destruktiver DB-Rollback** (keine Drops auf produktiven Tabellen).
- Rollback-Strategie: **App/Function auf vorherige Version zurueck**, DB bleibt vorwaertskompatibel.

Wenn ein harter DB-Rollback noetig waere: nur per Backup/PITR.

## 1) Preflight (MUSS gruen sein)

Lokal:

```bash
npm run test
npm run build
```

Supabase:

```sql
select to_regclass('public.push_subscriptions') as push_table;
select setting_key, length(setting_value) as len
from public.app_secure_settings
where setting_key = 'membership_encryption_key';
```

CLI:

```bash
npx supabase functions list
npx supabase secrets list
```

## 2) Release-Reihenfolge (kontrolliert)

1. Frontend deployen (ohne sofortigen Full-Traffic-Switch, falls Hosting das kann).
2. Edge Function deployen:

```bash
npx supabase functions deploy push-notify-update
```

3. Smoke-Test auf Live:
- Login + Portal-Schnellzugriff
- Dokumente/Downloads (kein 404)
- Push aktivieren + Test-Update
- Scanner auf HTTPS (iPhone + Android)
- Membership-Antrag (kein Encryption-Fehler)

4. Erst wenn alle Smoke-Tests gruen: Release freigeben.

## 3) Rollback (ohne Datenverlust)

### A) Sofortmassnahme bei Frontend-Fehler

1. Auf vorherige Hosting-Deployment-Version zurueckrollen.
2. Browser/PWA Cache invalidieren durch neuen Build (oder Version bump), falls noetig.

### B) Bei Function-Fehler

1. Letzte stabile Function-Version redeployen.
2. Bis dahin optional Push-Trigger stoppen (kein Update-Event senden).

### C) Bei DB-seitigem Problem

- Keine schnellen DROP-Rollbacks.
- Entweder:
1. Hotfix-Migration vorwaerts (bevorzugt), oder
2. Restore ueber Backup/PITR (nur wenn wirklich kritisch).

## 4) Go/No-Go Kriterien

Go nur wenn:

1. `npm run test` = gruen
2. `npm run build` = gruen
3. Secrets vorhanden (`VAPID_*`, `PUSH_NOTIFY_TOKEN`, usw.)
4. `membership_encryption_key` vorhanden (`len >= 16`)
5. Smoke-Test iPhone + Android bestanden

No-Go wenn eines rot ist.

## 5) Kurzprotokoll (waehrend Deploy ausfuellen)

- Startzeit:
- Deploy Frontend ok:
- Deploy Function ok:
- Smoke-Test Web ok:
- Smoke-Test iPhone ok:
- Smoke-Test Android ok:
- Rollback noetig: ja/nein
- Endzeit:

