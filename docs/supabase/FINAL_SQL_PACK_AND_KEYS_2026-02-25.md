# Final SQL Pack + Keys (am Ende ausführen)

Stand: 2026-02-25

WICHTIG: Bis zur finalen Freigabe keine SQL/Secrets ausführen. Diese Reihenfolge erst am Schluss durchführen.
Laufende Installations-/Fehlerdoku: `docs/supabase/INSTALL_RUNBOOK_2026-02-25.md`
Kontrollierter Release + Rollback: `docs/supabase/49_CONTROLLED_DEPLOY_AND_ROLLBACK_2026-02-26.md`

## 1) SQL-Reihenfolge

1. `docs/supabase/43_user_settings_portal_quick.sql`
   - User-Settings für Portal-Schnellzugriff (`nav_handedness`, `portal_favorites`)

2. `docs/supabase/45_membership_security_patch.sql`
   - Security-Härtung Membership (search_path + verschlüsselter Key-Fallback über `app_secure_settings`)

3. `docs/supabase/46_push_subscriptions.sql`
   - Tabelle + RLS für Web-Push-Abos (`push_subscriptions`)

4. `docs/supabase/47_security_invoker_views_patch.sql`
   - Behebt Security-Linterfehler für Views (`v_admin_online_users`, `v_my_responsibilities`, `export_members`)

Hinweis: `44_set_encryption_key_example.sql` bleibt nur als Beispiel und wird nicht mit echtem Secret committet.

## 2) Function Deploy (am Ende)

1. `push-notify-update` deployen
2. optional vorhandene Functions erneut deployen, falls parallel angepasst

Beispiel:
`npx supabase functions deploy push-notify-update --project-ref <PROJECT_REF>`

## 3) Benötigte Secrets / Umgebungswerte

### Supabase Edge Function Secrets
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (z. B. `mailto:admin@verein.de`)
- `PUSH_NOTIFY_TOKEN` (optional, für sicheren technischen Trigger ohne User-JWT)

Beispiel (einmalig am Ende):
`npx supabase secrets set SUPABASE_URL=\"https://<PROJECT_REF>.supabase.co\" SUPABASE_SERVICE_ROLE_KEY=\"<SERVICE_ROLE_KEY>\" VAPID_PUBLIC_KEY=\"<VAPID_PUBLIC_KEY>\" VAPID_PRIVATE_KEY=\"<VAPID_PRIVATE_KEY>\" VAPID_SUBJECT=\"mailto:<MAIL>\" PUSH_NOTIFY_TOKEN=\"<OPTIONAL_TOKEN>\" --project-ref <PROJECT_REF>`

### Frontend PUBLIC Variablen
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_TURNSTILE_SITE_KEY`
- `PUBLIC_VAPID_PUBLIC_KEY` (muss zu `VAPID_PUBLIC_KEY` passen)
- `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`
- optional: `PUBLIC_APP_VERSION`

### Server/Backend Sicherheitswerte
- Membership Encryption Key in `public.app_secure_settings`:
  - `setting_key = 'membership_encryption_key'`
  - `setting_value = <random secret, min. 16, empfohlen 32+>`

## 4) Go-Live Prüfungen (kurz)

1. Push-Abo aus Einstellungen anlegen -> Eintrag in `push_subscriptions` vorhanden.
2. Push-Testversand über `push-notify-update` -> Notification kommt auf iPhone + Android.
3. Membership Antrag absenden -> kein Encryption-Fehler.
4. Scanner auf echter Domain (HTTPS) testen.
5. Hard Reload einmal nach SW-Update, dann normaler Update-Flow prüfen.
