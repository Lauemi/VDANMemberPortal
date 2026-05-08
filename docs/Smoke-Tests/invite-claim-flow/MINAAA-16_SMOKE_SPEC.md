# MINAAA-16 Smoke-Spezifikation: Invite-Claim (reproduzierbar)

Stand: 2026-05-08  
Bezug: MINAAA-15 Phase-1 Repo-Sync (Fix 1-4)

## Ziel

Nachweisen, dass der Invite-Claim-Flow nach Fix 2/4 fachlich korrekt ist:

1. `profiles.first_name` wird gesetzt
2. `profiles.last_name` wird gesetzt
3. `requirements.profile_complete = true`
4. `membership_state` wird bei `club_members.status = 'Aktiv'` als `ACTIVE` erkannt

## Vorbedingungen

- Laufzeitumgebung mit gültigen Secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Gültiger Test-Invite-Token für einen Club
- Test-User mit passender Mitglieder-E-Mail
- Testdatensatz in `club_members` mit:
  - `member_no`
  - `first_name`
  - `last_name`
  - `status = 'Aktiv'`

## Testablauf

### Schritt 1: Claim ausführen

`POST /functions/v1/club-invite-claim` mit Body:

```json
{
  "invite_token": "<TOKEN>",
  "member_no": "<MEMBER_NO>"
}
```

Erwartung: HTTP `200`, `ok: true`.

### Schritt 2: Profil prüfen

`profiles`-Row des Claim-Users prüfen.

Erwartung:
- `first_name` nicht leer
- `last_name` nicht leer

### Schritt 3: Onboarding-State prüfen

`get_onboarding_process_state` für denselben User/Club prüfen.

Erwartung:
- `requirements.profile_complete = true`
- `axes.membership_state = "ACTIVE"` bei `club_members.status = 'Aktiv'`

## Ergebnisdokumentation (Pflicht)

Ablage:
- `docs/Smoke-Tests/invite-claim-flow/results/MINAAA-16_<YYYY-MM-DD>_smoke.md`

Inhalt:
- Testzeitpunkt (UTC)
- Environment (z. B. CI-Run-ID / Projekt-Ref)
- Request-ID / User-ID (gekürzt)
- Ergebnis pro Schritt (PASS/FAIL)
- SQL/API-Belege (gekürzt, ohne Secrets)

## Abbruchkriterien

Abbrechen als `BLOCKED`, wenn:
- kein gültiger Invite-Token verfügbar ist
- Secrets fehlen
- Test-User/Member-Mapping nicht vorhanden ist

