-- VDAN Template — Key Setup (SQL + markierte Platzhalter)
-- Datum: 2026-02-25
--
-- WICHTIG:
-- 1) Diese Datei setzt NUR DB-seitige Keys per SQL.
-- 2) Supabase Function Secrets (SUPABASE_URL, VAPID_*, ...) gehen NICHT per SQL.
-- 3) Platzhalter mit <<<...>>> exakt ersetzen.

begin;

-- =========================================================
-- A) DB-Key: membership_encryption_key (PFLICHT)
-- =========================================================
-- Muss gesetzt sein, sonst Fehler: "Encryption key missing..."
-- Mindestlänge 16, empfohlen 32+ Zeichen.

insert into public.app_secure_settings (setting_key, setting_value)
values (
  'membership_encryption_key',
  '<<<HIER_RANDOM_SECRET_MIN_16_BESSER_32PLUS>>>'
)
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

commit;

-- =========================================================
-- B) Prüfung (nach Ausführung)
-- =========================================================
-- Erwartung: len >= 16 und kein Platzhalter mehr.

select
  setting_key,
  length(setting_value) as len,
  (setting_value like '%<<<%>>>%') as placeholder_still_present,
  updated_at
from public.app_secure_settings
where setting_key = 'membership_encryption_key';

-- =========================================================
-- C) Nicht-SQL Keys (nur als markierte Vorlage)
-- =========================================================
-- Diese Befehle laufen NICHT im SQL Editor, sondern im Terminal:
--
-- npx supabase secrets set \
--   SUPABASE_URL="<<<https://PROJECT_REF.supabase.co>>>" \
--   SUPABASE_SERVICE_ROLE_KEY="<<<SERVICE_ROLE_KEY>>>" \
--   VAPID_PUBLIC_KEY="<<<VAPID_PUBLIC_KEY>>>" \
--   VAPID_PRIVATE_KEY="<<<VAPID_PRIVATE_KEY>>>" \
--   VAPID_SUBJECT="<<<mailto:admin@deine-domain.de>>>" \
--   PUSH_NOTIFY_TOKEN="<<<OPTIONAL_RANDOM_32PLUS>>>" \
--   --project-ref "<<<PROJECT_REF>>>"
--
-- Frontend ENV (Hosting/.env):
--   PUBLIC_SUPABASE_URL="<<<https://PROJECT_REF.supabase.co>>>"
--   PUBLIC_SUPABASE_ANON_KEY="<<<ANON_KEY>>>"
--   PUBLIC_VAPID_PUBLIC_KEY="<<<VAPID_PUBLIC_KEY>>>"
--   PUBLIC_TURNSTILE_SITE_KEY="<<<TURNSTILE_SITE_KEY>>>"
--   PUBLIC_MEMBER_CARD_VERIFY_PUBKEY="<<<PUBLIC_KEY_PEM>>>"
