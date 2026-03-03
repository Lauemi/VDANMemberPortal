# Secrets Matrix

Stand: 2026-03-02
Purpose: define each variable once: scope, source, and rotation policy.

## 1) Handling rules
1. Never commit real secret values to git.
2. Use password manager as source of truth.
3. `PUBLIC_*` values are not secret, but still env-specific and must be tracked.
4. Rotate one-time-display keys immediately if they were not stored.

## 2) Variable catalog

| Key | Class | Required | Scope | Source of truth | Rotation |
| --- | --- | --- | --- | --- | --- |
| VERCEL_TOKEN | secret | yes | github env | Password manager | 90d or incident |
| VERCEL_ORG_ID | config | yes | github env | Vercel settings | on change |
| VERCEL_PROJECT_ID | config | yes | github env | Vercel settings | on change |
| VERCEL_STAGING_DOMAIN | config | recommended | github env | DNS/Vercel | on change |
| VERCEL_BETA_DOMAIN | config | recommended | github env | DNS/Vercel | on change |
| PUBLIC_SUPABASE_URL | public config | yes | app env | Supabase settings | on project split |
| PUBLIC_SUPABASE_ANON_KEY | public key | yes | app env | Supabase settings | on key rotation |
| PUBLIC_SUPABASE_PUBLISHABLE_KEY | public key | optional | app env | Supabase settings | on key rotation |
| PUBLIC_VAPID_PUBLIC_KEY | public key | yes | app env | generated VAPID pair | with private key |
| PUBLIC_MEMBER_CARD_VERIFY_PUBKEY | public key | yes | app env | crypto process | by crypto policy |
| PUBLIC_APP_NAME | public config | yes | app env | product decision | on change |
| PUBLIC_APP_BRAND | public config | yes | app env | product decision | on change |
| PUBLIC_APP_CHANNEL | public config | yes | app env | env convention | fixed per env |
| PUBLIC_APP_VERSION | public config | yes | app env | release process | each release |
| PUBLIC_ENABLE_PASSWORD_RESET | public config | recommended | app env | product decision | on policy change |
| PUBLIC_TURNSTILE_SITE_KEY | public key | optional | app env | Cloudflare | on change |
| SUPABASE_URL | secret/config | yes | server + functions | Supabase settings | on project split |
| SUPABASE_SERVICE_ROLE_KEY | secret | yes | server + functions | Supabase settings | 90d or incident |
| PUSH_NOTIFY_TOKEN | secret | yes | server + functions | generated | 90d or incident |
| CLIENT_REQUEST_SALT | secret | recommended | server/functions | generated | 180d |
| VAPID_PRIVATE_KEY | secret | yes | functions | generated VAPID pair | 180d |
| VAPID_SUBJECT | config | yes | functions | ops decision | on change |

## 3) Storage locations
- Password manager vault: canonical values
- GitHub Environment secrets: `staging`, `beta`, `prod`
- Vercel Environment variables: `preview` and `production`
- Supabase function secrets: per project (`supabase secrets set`)

## 4) Validation commands
```bash
GH_REPO=OWNER/REPO TARGET_ENV=staging bash scripts/verify-vercel-env-readiness.sh
GH_REPO=OWNER/REPO TARGET_ENV=beta bash scripts/verify-vercel-env-readiness.sh
GH_REPO=OWNER/REPO TARGET_ENV=prod bash scripts/verify-vercel-env-readiness.sh
```

