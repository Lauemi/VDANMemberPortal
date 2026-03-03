# Vercel Env Setup (Prep-Branch)

Stand: 2026-03-03  
Branch-Ziel: `prep_vercel_multienv_admin_tools`  
Ziel: FCP auf Vercel deploybar, aber komplett geschlossen (`lockdown`).

## 1) Wo eintragen in Vercel
1. `Project -> Settings -> Environment Variables`
2. Key anlegen
3. `Environments`: **Preview** + **Production**
4. Speichern
5. Nach allen Einträgen: letzten Deploy `Redeploy`

## 2) Pflicht-Set (sofort eintragen)

| Key | Value | Environments |
| --- | --- | --- |
| `PUBLIC_SITE_LOCKDOWN` | `true` | `Preview`, `Production` |
| `PUBLIC_APP_NAME` | `Fishing-Club-Portal` | `Preview`, `Production` |
| `PUBLIC_APP_BRAND` | `FCP` | `Preview`, `Production` |
| `PUBLIC_APP_CHANNEL` | `prep` | `Preview`, `Production` |
| `PUBLIC_APP_VERSION` | `2026.03.03-prep.1` | `Preview`, `Production` |
| `PUBLIC_ENABLE_PASSWORD_RESET` | `false` | `Preview`, `Production` |

## 3) Platzhalter-Set (vorläufig, später ersetzen)

| Key | Value | Environments |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | `https://placeholder.supabase.co` | `Preview`, `Production` |
| `PUBLIC_SUPABASE_ANON_KEY` | `placeholder` | `Preview`, `Production` |
| `PUBLIC_VAPID_PUBLIC_KEY` | `placeholder` | `Preview`, `Production` |
| `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY` | `placeholder` | `Preview`, `Production` |
| `SUPABASE_URL` | `https://placeholder.supabase.co` | `Preview`, `Production` |
| `SUPABASE_SERVICE_ROLE_KEY` | `placeholder` | `Preview`, `Production` |
| `PUSH_NOTIFY_TOKEN` | `placeholder` | `Preview`, `Production` |
| `CLIENT_REQUEST_SALT` | `placeholder` | `Preview`, `Production` |
| `VAPID_PRIVATE_KEY` | `placeholder` | `Preview`, `Production` |
| `VAPID_SUBJECT` | `mailto:info@fishing-club-portal.de` | `Preview`, `Production` |

## 4) Optional (wenn genutzt)

| Key | Value |
| --- | --- |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `placeholder` |
| `PUBLIC_TURNSTILE_SITE_KEY` | `placeholder` |

## 5) Nachkontrolle
1. Deploy in Vercel neu anstoßen (`Redeploy`).
2. Erwartung: Seite zeigt nur "geschlossen / hier entsteht".
3. Keine Navigation, keine Unterseiteninhalte sichtbar.

## 6) Sicherheitshinweis
- Diese Datei enthält nur Platzhalter.
- Echte Secret-Werte nicht ins Repo schreiben.
- Echte Werte später über `docs/ops/SECRETS_MATRIX.md` + Rotation-Runbook einpflegen.

