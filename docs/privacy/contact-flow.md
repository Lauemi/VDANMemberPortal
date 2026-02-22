# VDAN Contact Flow (Anti-Spam / DSGVO)

Stand: 21.02.2026

## Architektur
- Frontend sendet nur an `contact-submit` Edge Function.
- Kein Direktversand per `mailto:` / SMTP aus dem Browser.
- Legacy `kontakt.php` ist deaktiviert (HTTP 410).

## Schutzschichten
- Turnstile-Token: serverseitig geprüft
- Honeypot-Feld
- Serverseitige Validierung (Mindestlängen, Link-only-Block, Spam-Keywords)
- Rate-Limits (IP-Hash + E-Mail) gegen Burst/Flut
- Double-Opt-In via `contact-confirm`

## Datenmodell
Tabelle: `public.contact_requests`
- status flow: `pending -> confirmed -> sent/rejected`
- `ip_hash` statt Klartext-IP
- `turnstile_verified`, `email_verified`
- `confirm_token_hash`, `confirm_expires_at`

## Erforderliche Secrets (Supabase Edge Functions)
- `TURNSTILE_SECRET_KEY`
- `IP_HASH_SALT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional für E-Mail:
  - `RESEND_API_KEY`
  - `CONTACT_FROM_EMAIL`
  - `CONTACT_NOTIFY_EMAIL` (Default im Code: `m.lauenroth@lauemi.de`)
  - `CONTACT_CONFIRM_BASE_URL`
  - `CONTACT_NOTIFY_WEBHOOK`

## Frontend ENV
- `PUBLIC_TURNSTILE_SITE_KEY`
- `PUBLIC_SUPABASE_URL`
