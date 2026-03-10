# AUTH E-Mail Templates Runbook (VDAN/FCP)
Stand: 2026-03-10

## Ziel
Saubere, nachvollziehbare Konfiguration aller Supabase-Auth-E-Mails inkl. Redirects, Inhalte, Zustelltests und Rollout-Status.

## Scope (Supabase Auth E-Mails)
- Confirm sign up
- Invite user
- Magic link
- Change email address
- Reset password
- Reauthentication
- Security-Notification-Mails (Password changed, Email changed, etc.)
- Security: Phone number changed
- Security: Identity linked
- Security: Identity unlinked
- Security: MFA method added
- Security: MFA method removed

## Pflicht-Baseline je Template
- [ ] Betreff verständlich, deutsch, produktkonform.
- [ ] Klarer CTA-Link vorhanden.
- [ ] Kein toter/misskonfigurierter Redirect.
- [ ] Verweis auf Impressum/Datenschutz vorhanden (Footer oder Linkbereich).
- [ ] Keine sensiblen Daten im Klartext.
- [ ] Plain/HTML konsistent.
- [ ] Testzustellung erfolgreich (Gmail, Outlook, iCloud mindestens je 1).

## Callback- und Redirect-Baseline
- [ ] Production Site URL gesetzt.
- [ ] Additional Redirect URLs gepflegt (Prod + Localhost/127.0.0.1).
- [ ] `type=email_change` korrekt verarbeitet.
- [ ] `type=recovery` korrekt verarbeitet.
- [ ] `type=signup` korrekt verarbeitet.
- [ ] Callback-Seite räumt URL-Fragmente auf und zeigt klare Nutzerführung.

## Technische Ziellogik (Auth)
- Login-Identifier = Auth-E-Mail.
- Mitgliedsnummer/Kürzel sind Anzeige-/Vereinsattribute.
- Legacy-Identifier nur Übergang (Feature-Flag-gesteuert).
- Rechtliches Gate nach Login muss vor Portalzugang erfüllt sein.

## Template-Matrix (laufende Pflege)

| Template | Aktiv | Redirect ok | Inhalt ok | Test gesendet | Test bestätigt | Owner | Letztes Update | Notizen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Confirm sign up | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Invite user | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Magic link | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Change email address | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Reset password | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Reauthentication | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Security: Password changed | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Security: Email address changed | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Security: Phone number changed | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Security: Identity linked | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Security: Identity unlinked | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Security: MFA method added | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |
| Security: MFA method removed | TBD | TBD | TBD | TBD | TBD | TBD | TBD |  |

## Testprotokoll (pro Durchlauf)

### Testlauf: ___
- Datum/Uhrzeit:
- Umgebung: Local / Staging / Prod
- User:
- Auslöser (z. B. Email change):
- Erwarteter Mailtyp:
- Tatsächlicher Mailtyp:
- Zustellung: OK / FAIL
- Linkziel: OK / FAIL
- Ergebnis:
- Follow-up:

## Bekannte Stolperfallen
- Change-email benötigt korrekten Callback mit `type=email_change`.
- Alte `.local`-Konten können keine echten Zustelltests erhalten.
- Rate-Limits in Supabase können Testläufe blocken.
- Bei fehlendem Redirect landet User ohne Session auf Loginseite.

## Entscheidungsregel vor Go-Live
Go-Live nur wenn:
- alle produktiven Templates in Matrix `Aktiv=OK`, `Redirect ok=OK`, `Test bestätigt=OK`
- Callback/Redirect-Baseline komplett `OK`
- mindestens ein vollständiger End-to-End-Test pro kritischem Flow durchgeführt:
  - Signup
  - Email change
  - Password reset
