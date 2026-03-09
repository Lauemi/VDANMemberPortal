# BOARD/CTO Login-Briefing (VDAN/FCP)
Stand: 2026-03-09

## 1. Zielbild
- Technische Authentifizierung über Supabase Auth.
- Source of truth für Login ist die Auth-E-Mail.
- Vereinskennungen (Mitgliedsnummer, Kürzel wie `VD01598`) sind Funktions-/Anzeigeattribute, kein primärer Auth-Identifier.

## 2. Aktueller Login-Mechanismus
- Login-Endpunkt: Supabase Password Grant (`/auth/v1/token?grant_type=password`).
- Eingabe im Login-Feld:
  - E-Mail: direkter Login.
  - Legacy-Mitgliedsnummer: interne Ableitung auf Pseudo-Mail (`member_<nr>@members...`) für Altkonten.
- Nach erfolgreichem Login:
  - `profile-bootstrap` wird ausgeführt (Profilkonsistenz sicherstellen).

## 3. Identity-Verifikation (kontrollierter Rollout)
- Runtime-Flags:
  - `identity_dialog_enabled`
  - `identity_dialog_force`
  - `identity_dialog_preview_user_ids`
- User-Flag:
  - `profiles.must_verify_identity`
- Verhalten:
  - Preview: nur definierte Testuser.
  - Force: markierte User müssen vor Portalzugriff Daten prüfen + E-Mail-Status bestätigen.

## 4. Kritischer Architekturfix (bereits umgesetzt)
- Problem vorher: Club-Kontext konnte über `member_no + LIMIT 1` nicht-deterministisch aufgelöst werden.
- Lösung: deterministische Auflösung über `profiles.club_id + member_no`.
- Migration: `docs/supabase/92_identity_dialog_club_resolution_fix_2026-03-09.sql`.
- Kontrollstatus: `OK_DETERMINISTIC`.

## 5. Security-/DSGVO-Relevanz
- Tenant-Isolation wurde im Identity-Gate gehärtet (kein zufälliger Club-Fallback mehr).
- Profil-E-Mail-Sync erfolgt erst nach bestätigter Auth-E-Mail.
- Legacy-`.local`-Konten werden kontrolliert auf echte Auth-Mails migriert.

## 6. Betriebsentscheidungen
- `profile-bootstrap` läuft stabil mit interner User-Prüfung (`auth.getUser()`).
- Unautorisierte Aufrufe liefern `401` (bestätigt).
- `identity_dialog_force` aktuell `false` (kein harter globaler Lock).

## 7. Offene operative Punkte
- Supabase URL Configuration vollständig pflegen (Prod + Local Callback URLs).
- Pilot-Rollout für Verifikationspflicht schrittweise aktivieren.
- Restliche Legacy-Auth-Mails (`@members...`) in Wellen migrieren.

## 8. Release-Statement
- Technisch ist der Login-Stack für Main/Deploy freigegeben.
- Empfehlung: kontrollierter Rollout der Pflichtverifikation, kein Big-Bang.

