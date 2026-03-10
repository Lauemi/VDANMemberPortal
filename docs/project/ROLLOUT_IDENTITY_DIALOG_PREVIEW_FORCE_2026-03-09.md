# Rollout-Runbook: Identity-Dialog (Preview -> Force)

Stand: 2026-03-09

## Ziel
Bestehende User mit altem Login-Setup (z. B. Mitgliedsnummer + Pseudo-Mail) kontrolliert in einen verifizierten Auth-Zustand bringen, ohne sofortigen Live-Ausfall.

## SQL ausrollen
1. `docs/supabase/91_identity_verification_dialog_live_safe.sql` ausführen.
2. Danach sind Defaults gesetzt:
   - `identity_dialog_enabled = false`
   - `identity_dialog_force = false`
   - `identity_dialog_preview_user_ids = ''`

## Preview aktivieren (nur für dich)
```sql
update public.app_secure_settings
set setting_value = 'true', updated_at = now()
where setting_key = 'identity_dialog_enabled';

update public.app_secure_settings
set setting_value = '<DEINE_USER_ID>', updated_at = now()
where setting_key = 'identity_dialog_preview_user_ids';
```

Preview öffnen:
- `/app/zugang-pruefen/?preview=1`
- oder über Einstellungen: „Prüfmaske im Preview öffnen“

## Betroffene Nutzer markieren (noch ohne Zwang)
```sql
update public.profiles
set must_verify_identity = true,
    updated_at = now()
where member_no in ('598');
```

## Zwang später aktivieren
```sql
update public.app_secure_settings
set setting_value = 'true', updated_at = now()
where setting_key = 'identity_dialog_force';
```

Wirkung:
- Markierte User (`must_verify_identity=true`) werden nach Login automatisch auf `/app/zugang-pruefen/` umgeleitet.

## Abschluss je User
Im Dialog „Prüfung abschließen“ setzt:
- `profiles.must_verify_identity = false`
- `profiles.identity_verified_at = now()`

## Sofort-Rollback (live-safe)
```sql
update public.app_secure_settings
set setting_value = 'false', updated_at = now()
where setting_key in ('identity_dialog_force', 'identity_dialog_enabled');
```

Dann gibt es keine Umleitung mehr.
