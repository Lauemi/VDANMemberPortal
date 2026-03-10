# Secret Matrix VDAN/FCP
Stand: 2026-03-10

## Zweck
Diese Matrix ist die zentrale Audit- und Steuerungsquelle für Environment-Variablen und Secrets.

Regel:
- Keine Secret-Werte in dieser Datei eintragen.
- Nur Namen, Zuständigkeit, Zielsysteme und Prüfstatus dokumentieren.

## Legende
- `Typ`: `public_config` oder `secret`
- `Secret`: `ja/nein`
- `Setzen in`: `ja/nein`
- `Rotation`: z. B. `90 Tage`, `180 Tage`, `bei Wechsel`, `-`

## Matrix
| Name | Zweck | Typ | Secret | Owner | Local | GitHub | Vercel Preview | Vercel Production | Rotation | Letzter Check | Notiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUBLIC_SUPABASE_URL | Supabase Projekt-URL | public_config | nein | Michael | ja | nein | ja | ja | - | 2026-03-10 |  |
| PUBLIC_SUPABASE_ANON_KEY | Public Client Key | public_config | nein | Michael | ja | nein | ja | ja | - | 2026-03-10 |  |
| PUBLIC_APP_NAME | App-Anzeigename | public_config | nein | Michael | ja | nein | ja | ja | - | 2026-03-10 | VDAN/FCP Branding beachten |
| PUBLIC_APP_BRAND | App-Brand Label | public_config | nein | Michael | ja | nein | ja | ja | - | 2026-03-10 | VDAN/FCP Branding beachten |
| SUPABASE_SERVICE_ROLE_KEY | Serverzugriff Supabase | secret | ja | Michael | ja | ggf. | ja | ja | 90 Tage | 2026-03-10 | nur serverseitig |
| SUPABASE_ACCESS_TOKEN | Supabase CLI/CI Zugriff | secret | ja | Michael | optional | ja | nein | nein | 180 Tage | 2026-03-10 | nur CI/CD |
| SUPABASE_PROJECT_REF | Projekt-Referenz CI | secret/internal | ja | Michael | optional | ja | nein | nein | bei Wechsel | 2026-03-10 | CI/CD |
| VERCEL_TOKEN | Deploy via CI | secret | ja | Michael | optional | ja | nein | nein | 180 Tage | 2026-03-10 | CI/CD |
| VERCEL_ORG_ID | Vercel CI Zuordnung | secret/internal | ja | Michael | optional | ja | nein | nein | bei Wechsel | 2026-03-10 | CI/CD |
| VERCEL_PROJECT_ID | Vercel CI Zuordnung | secret/internal | ja | Michael | optional | ja | nein | nein | bei Wechsel | 2026-03-10 | CI/CD |

## Offene Punkte
- Finale Liste aller produktiven Variablen aus Vercel/GitHub/Local inventarisieren.
- Jede Variable auf Soll-Zuordnung prüfen (gehört sie wirklich an den jeweiligen Ort?).
- Rotationsdaten für alle kritischen Secrets ergänzen.
