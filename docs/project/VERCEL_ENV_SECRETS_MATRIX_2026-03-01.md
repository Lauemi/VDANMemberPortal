# Vercel Environment Secrets Matrix

Stand: 2026-03-01
Zweck: Vollständige, umgebungsgetrennte Variable-/Secret-Matrix fuer staging, beta, prod.

## 1) Regeln
1. Keine Secret-Wiederverwendung zwischen Environments bei serverseitigen Schluesseln.
2. `PUBLIC_*` ist nicht geheim, muss aber korrekt pro Environment sein.
3. VAPID Keypair ist pro Environment getrennt zu halten.
4. Push-Token pro Environment trennen.

## 2) Matrix (auszufuellen)

| Key | Typ | staging | beta | prod | Pflicht | Quelle |
| --- | --- | --- | --- | --- | --- | --- |
| VERCEL_TOKEN | secret |  |  |  | ja | Vercel Account Token |
| VERCEL_ORG_ID | secret |  |  |  | ja | Vercel Project Settings |
| VERCEL_PROJECT_ID | secret |  |  |  | ja | Vercel Project Settings |
| VERCEL_STAGING_DOMAIN | secret | staging.fishing-club-portal.de | staging.fishing-club-portal.de | staging.fishing-club-portal.de | empfohlen | DNS/Vercel |
| VERCEL_BETA_DOMAIN | secret | beta.fishing-club-portal.de | beta.fishing-club-portal.de | beta.fishing-club-portal.de | empfohlen | DNS/Vercel |
| PUBLIC_SUPABASE_URL | public |  |  |  | ja | Supabase Project URL |
| PUBLIC_SUPABASE_ANON_KEY | public |  |  |  | ja | Supabase API Keys |
| PUBLIC_SUPABASE_PUBLISHABLE_KEY | public |  |  |  | optional | Supabase API Keys |
| PUBLIC_VAPID_PUBLIC_KEY | public |  |  |  | ja | VAPID Keypair |
| PUBLIC_MEMBER_CARD_VERIFY_PUBKEY | public |  |  |  | ja | Crypto Keying |
| PUBLIC_APP_NAME | public | Fishing-Club-Portal | Fishing-Club-Portal | Fishing-Club-Portal | ja | Produkt |
| PUBLIC_APP_BRAND | public | FCP | FCP | FCP | ja | Produkt |
| PUBLIC_APP_CHANNEL | public | staging | beta | prod | ja | Build-Konvention |
| PUBLIC_APP_VERSION | public |  |  |  | ja | Release Nummer |
| PUBLIC_ENABLE_PASSWORD_RESET | public | true/false | true/false | true/false | empfohlen | Produktregel |
| PUBLIC_TURNSTILE_SITE_KEY | public |  |  |  | optional | Cloudflare |
| SUPABASE_URL | secret |  |  |  | ja | Supabase Project URL |
| SUPABASE_SERVICE_ROLE_KEY | secret |  |  |  | ja | Supabase API Keys |
| PUSH_NOTIFY_TOKEN | secret |  |  |  | ja | eigener Token |

## 3) Supabase Function Secrets Matrix (pro Supabase Projekt)
| Key | staging Supabase | beta Supabase | prod Supabase | Pflicht |
| --- | --- | --- | --- | --- |
| SUPABASE_URL |  |  |  | ja |
| SUPABASE_SERVICE_ROLE_KEY |  |  |  | ja |
| VAPID_PUBLIC_KEY |  |  |  | ja |
| VAPID_PRIVATE_KEY |  |  |  | ja |
| VAPID_SUBJECT |  |  |  | ja |
| PUSH_NOTIFY_TOKEN |  |  |  | ja |
| TURNSTILE_SECRET_KEY |  |  |  | optional |

## 4) Validierungs-Checklist pro Environment

### 4.1 Build/Runtime
- [ ] Build liefert erwarteten `PUBLIC_APP_CHANNEL`.
- [ ] `PUBLIC_APP_VERSION` sichtbar in App.
- [ ] Login funktioniert gegen korrektes Supabase-Projekt.

### 4.2 Push
- [ ] `PUSH_NOTIFY_TOKEN` matcht Function Secret.
- [ ] Push-Trigger gibt 2xx.
- [ ] Gerät registriert Subscription in korrektem Projekt.

### 4.3 Domain/CORS/CSP
- [ ] Auth Redirect URL enthält korrekte Domain.
- [ ] CORS erlaubt Domain.
- [ ] CSP connect/img/frame-src deckt Domain + APIs ab.

## 5) CLI-Vorlagen

### 5.1 GitHub Environment Secret setzen
```bash
gh secret set PUBLIC_SUPABASE_URL \
  --repo OWNER/REPO \
  --env staging \
  --body "https://xxxx.supabase.co"
```

### 5.2 Supabase Function Secrets setzen
```bash
npx --yes supabase secrets set \
  SUPABASE_URL="https://xxxx.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:admin@fishing-club-portal.de" \
  PUSH_NOTIFY_TOKEN="..." \
  --project-ref <PROJECT_REF>
```

## 6) Häufige Fehlbilder
1. 401 bei Push: fehlender/falscher Authorization Header.
2. 403 bei Push: falscher `x-push-token`.
3. Login-Loop: falsche Redirect-URL oder falsches Supabase-Projekt in PUBLIC URL.
4. Kein Push trotz Erfolg im CI: keine Device-Subscription im Zielprojekt.
5. Captcha-Hinweis sichtbar: `PUBLIC_TURNSTILE_SITE_KEY` fehlt im Ziel-Environment.
