# Supabase Auth E-Mail Pflegeblatt (Copy/Paste)
Stand: 2026-03-10

## A) Subject-Liste (empfohlen)
- Confirm sign up: `Bitte bestätige deine E-Mail-Adresse`
- Invite user: `Deine Einladung zum Fishing-Club-Portal`
- Magic link: `Dein Anmelde-Link`
- Change email address: `Bitte bestätige deine neue E-Mail-Adresse`
- Reset password: `Passwort zurücksetzen`
- Reauthentication: `Sicherheitsbestätigung erforderlich`

## B) Template-Dateien (lokal)
- Confirm sign up: [01_confirm_signup.html](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/auth-email-templates/01_confirm_signup.html)
- Change email address: [02_change_email.html](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/auth-email-templates/02_change_email.html)
- Reset password: [03_reset_password.html](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/auth-email-templates/03_reset_password.html)
- Magic link: [04_magic_link.html](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/auth-email-templates/04_magic_link.html)
- Invite user: [05_invite_user.html](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/auth-email-templates/05_invite_user.html)
- Reauthentication: [06_reauthentication.html](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/auth-email-templates/06_reauthentication.html)

## B1) Verfügbare Supabase-Template-Variablen
- `{{ .ConfirmationURL }}`: Vollständiger Bestätigungs-/Action-Link (Standard für CTA-Button).
- `{{ .Token }}`: Einmalcode/OTP (nur nutzen, wenn Code-Flow im UI vorgesehen ist).
- `{{ .TokenHash }}`: Token-Hash (technisch, nicht für Endnutzeranzeige empfohlen).
- `{{ .SiteURL }}`: Projekt-Site-URL aus Supabase.
- `{{ .Email }}`: Empfänger-E-Mail (bei Change-Mail: alte E-Mail).
- `{{ .Data }}`: User-Metadata (nur wenn tatsächlich benötigt und datensparsam).
- `{{ .RedirectTo }}`: Ziel-Redirect (falls im Flow gesetzt).

## B2) FCP-Nutzungsregel für Variablen
- Primär in allen produktiven Templates: `{{ .ConfirmationURL }}`
- Optional für Transparenz:
  - Change Email: `{{ .Email }}` (+ falls verfügbar `{{ .NewEmail }}`)
- Nur falls explizit gebraucht:
  - OTP-Flow: `{{ .Token }}`
- Nicht im Standard-Usertext anzeigen:
  - `{{ .TokenHash }}`
- `{{ .Data }}` nur minimal und ohne sensitive Inhalte verwenden.

## C) Redirect-URL-Matrix (Supabase URL Configuration)

### Site URL
- Production: `https://www.fishing-club-portal.de`

### Additional Redirect URLs
- `https://www.fishing-club-portal.de/auth/callback/`
- `https://www.fishing-club-portal.de/login/`
- `http://127.0.0.1:4321/auth/callback/`
- `http://localhost:4321/auth/callback/`
- `http://127.0.0.1:4321/login/`
- `http://localhost:4321/login/`

## D) Flow-Ziel je Mailtyp (Soll)
- Confirm sign up: `/auth/callback/?flow=signup&next=/app/`
- Invite user: `/auth/callback/?flow=invite&next=/app/`
- Magic link: `/auth/callback/?flow=magiclink&next=/app/`
- Change email address: `/auth/callback/?flow=email_change&next=/app/einstellungen/`
- Reset password: `/auth/callback/?flow=recovery&next=/app/passwort-aendern/`
- Reauthentication: `/auth/callback/?flow=reauth&next=/app/einstellungen/`

## E) Live-Status (ausfüllen)

| Template | Subject gesetzt | HTML gesetzt | Redirect ok | Testmail erhalten | Callback ok | Live-fertig |
| --- | --- | --- | --- | --- | --- | --- |
| Confirm sign up | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Invite user | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Magic link | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Change email address | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Reset password | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Reauthentication | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## F) Abnahme
- Datum:
- Abgenommen von:
- Projekt:
- Hinweise:
