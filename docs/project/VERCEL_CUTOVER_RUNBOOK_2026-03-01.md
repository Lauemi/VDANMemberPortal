# Vercel Cutover Runbook - Staging, Beta, Prod

Stand: 2026-03-01
Ziel: Ab sofort nur noch Vercel fuer automatische Deploys nutzen, mit branchbasiertem Multi-Env-Betrieb.

## 1) Zielabbild
1. `develop` -> `staging` -> `staging.fishing-club-portal.de`
2. `beta` -> `beta` -> `beta.fishing-club-portal.de`
3. `main` -> `prod` -> `fishing-club-portal.de`
4. IONOS-Workflow nur noch manuell (kein Auto-Deploy mehr).

## 2) Bereits vorbereitet im Repo
1. Neuer Workflow: `.github/workflows/deploy-vercel.yml`
2. IONOS-Workflow auf `workflow_dispatch` umgestellt: `.github/workflows/deploy-ionos.yml`

## 3) GitHub Environments anlegen (Pflicht)
Lege in GitHub unter `Settings -> Environments` an:
1. `staging`
2. `beta`
3. `prod`

Optional: Protection Rules pro Environment:
1. Required reviewers fuer `prod`
2. Wait timer fuer `prod`

## 4) Secrets je Environment setzen (Pflicht)
Setze in jedem Environment dieselben Keys, aber mit umgebungsspezifischen Werten.

### 4.1 Vercel Deploy Keys
1. `VERCEL_TOKEN`
2. `VERCEL_ORG_ID`
3. `VERCEL_PROJECT_ID`
4. `VERCEL_STAGING_DOMAIN` (mind. in `staging`)
5. `VERCEL_BETA_DOMAIN` (mind. in `beta`)

### 4.2 Public App Keys
1. `PUBLIC_SUPABASE_URL`
2. `PUBLIC_SUPABASE_ANON_KEY`
3. `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. `PUBLIC_VAPID_PUBLIC_KEY`
5. `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`
6. `PUBLIC_APP_NAME`
7. `PUBLIC_APP_BRAND`
8. `PUBLIC_APP_CHANNEL`
9. `PUBLIC_APP_VERSION`
10. `PUBLIC_ENABLE_PASSWORD_RESET`
11. `PUBLIC_TURNSTILE_SITE_KEY` (optional)

### 4.3 Server/Push Keys
1. `SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`
3. `PUSH_NOTIFY_TOKEN`

## 5) Vercel Projekt konfigurieren
1. Repo mit Vercel verbinden (oder vorhandenes Projekt nutzen).
2. Production-Domain zuweisen:
   1. `fishing-club-portal.de`
3. Preview-Domains vorbereiten:
   1. `staging.fishing-club-portal.de`
   2. `beta.fishing-club-portal.de`
4. Build-Settings:
   1. Framework: Astro
   2. Build command: `npm run build`
   3. Output: `dist`

## 6) Supabase je Environment vorbereiten
1. Empfohlen: eigenes Supabase-Projekt je Environment.
2. Pro Environment sicherstellen:
   1. SQL-Migrationen identisch ausgerollt
   2. Edge Functions deployt
   3. Secrets gesetzt (`VAPID_*`, `PUSH_NOTIFY_TOKEN`, etc.)
3. Redirect/CORS/CSP je Domain aktualisieren.

## 7) Branch-Flow aktiv nutzen
1. Push auf `develop` -> deploy nach staging.
2. Push auf `beta` -> deploy nach beta.
3. Push auf `main` -> deploy nach prod.

## 8) Smoke Test je Promotion
1. Login/Logout/Session.
2. Feed + Bild-Upload.
3. Fangliste + Offline/Sync.
4. Termine/Arbeitseinsatz.
5. Push-Subscription und Test-Push.
6. Einstellungen/Portal-Menue/One-Hand.

Referenz: `docs/project/RELEASE_SMOKE_TEST_STAGING_BETA_PROD_2026-03-01.md`

## 9) DNS und Cutover
1. Erst staging/beta stabilisieren.
2. Dann `fishing-club-portal.de` auf Vercel production zeigen.
3. VDAN-Domain erst nach fachlicher Freigabe auf neue Domain 301-redirecten.

## 10) Rollback
1. Vercel: letzte stabile Deployment-ID auf production promoten.
2. Falls kritisch: `main` auf letzten stabilen Commit zurückrollen und neu deployen.
3. Push-Trigger Fehler blockiert Deploy nicht, muss aber im Nachgang gefixt werden.

## 11) Sofort-Checkliste (jetzt ausfuehren)
1. [ ] GitHub Environments (`staging`,`beta`,`prod`) angelegt
2. [ ] Environment-Secrets gesetzt
3. [ ] Vercel Domains gesetzt
4. [ ] Supabase-Ziele je Env klar
5. [ ] Erster Test-Push auf `develop`
6. [ ] Smoke-Test `staging` bestanden
