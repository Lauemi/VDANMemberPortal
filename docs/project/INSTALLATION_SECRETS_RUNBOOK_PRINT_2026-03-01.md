# Installations-Runbook (druckbar) - Secrets und Deployment

Stand: 2026-03-01
Projekt: Fishing-Club-Portal

## Ziel
Dieses Dokument beschreibt die minimale und empfohlene Secret-Konfiguration fuer:
- GitHub Actions Deploy
- Supabase Functions
- Frontend Build-Variablen

Hinweis:
- `PUBLIC_*` Werte sind im Browser sichtbar.
- Alles ohne `PUBLIC_` ist geheim.
- `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `TURNSTILE_SECRET_KEY`, `PUSH_NOTIFY_TOKEN` nie committen.

## 1) Pflicht-Secrets in GitHub (Repository Secrets)

### 1.1 Build/App (PUBLIC)
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (falls genutzt; sonst wie ANON setzen)
- `PUBLIC_VAPID_PUBLIC_KEY`
- `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`
- `PUBLIC_APP_NAME`
- `PUBLIC_APP_BRAND`

### 1.2 Optional Build/App (PUBLIC)
- `PUBLIC_APP_CHANNEL` (z. B. `beta`, `staging`, `prod`)
- `PUBLIC_APP_VERSION` (z. B. `2026.03.01-beta.1`)
- `PUBLIC_ENABLE_PASSWORD_RESET` (`true`/`false`)
- `PUBLIC_TURNSTILE_SITE_KEY`

### 1.3 Hosting (IONOS SFTP)
- `IONOS_SFTP_HOST`
- `IONOS_SFTP_USER`
- `IONOS_SFTP_PASS`
- `IONOS_SFTP_PORT`
- `IONOS_REMOTE_PATH`

### 1.4 Push Trigger / Deploy Hook
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUSH_NOTIFY_TOKEN`

## 2) Pflicht-Secrets in Supabase (Functions Secrets)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (z. B. `mailto:admin@deinedomain.de`)
- `PUSH_NOTIFY_TOKEN`

Optional je Function:
- `TURNSTILE_SECRET_KEY`

## 3) Installationsreihenfolge (empfohlen)
1. Supabase Projekt anlegen (pro Umgebung getrennt: staging/prod).
2. GitHub Secrets setzen.
3. Supabase Function Secrets setzen.
4. SQL Migrationen einspielen.
5. Edge Functions deployen.
6. Frontend Build/Deploy.
7. Smoke Test (Login, Feed, Bild-Upload, Push).

## 4) Verifikation nach Setup
- Build: erfolgreich.
- Deploy: erfolgreich.
- Push-Trigger liefert kein 401/403.
- `push_subscriptions` hat bei aktiviertem Geraet Eintraege.
- Kontaktformular/Captcha entspricht ENV-Konfiguration.

## 5) Schnelle Fehlerdiagnose
- Push 401: fehlender `Authorization` Header oder falscher Key.
- Push 403: `x-push-token` stimmt nicht mit Function Secret ueberein.
- Kein Push auf iPhone: iOS/PWA/Permission-Kontext unvollstaendig.
- Upload-Fehler trotz Komprimierung: meist Storage-RLS oder Netzwerk, nicht nur Bildgroesse.

## 6) Dateien mit technischen Referenzen
- `.github/workflows/deploy-ionos.yml`
- `docs/supabase/48_keys_setup_template.sql`
- `docs/supabase/KEYS_FUER_DUMMIES_2026-02-25.md`
- `docs/supabase/FINAL_SQL_PACK_AND_KEYS_2026-02-25.md`
