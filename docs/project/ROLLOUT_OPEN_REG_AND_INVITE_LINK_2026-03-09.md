# Rollout-Runbook: Offene Registrierung + Invite-Link (Live-sicher)

Stand: 2026-03-09

## Ziel
- Registrierung ohne Verein ermöglichen (kontrolliert per Feature-Flag)
- Invite-Links für bestehende Vereine erzeugen
- Live-Betrieb stabil halten (additiv, ohne harte Breaking Changes)

## Umgesetzt
- Neue Edge Function: `profile-bootstrap`
  - Legt bei Login/Registrierung fehlendes `profiles`-Mapping sicher an
  - Vergibt bei Bedarf `member_no` (`AUTO-*`), wenn kein Verein gesetzt ist
- Neue Edge Function: `club-invite-create`
  - Erstellt Invite-Link für bestehenden Verein per `club_code`
  - Nur mit Rolle `admin`/`vorstand` im Zielverein
- Registrierung erweitert:
  - mit Invite-Token: bestehender Vereins-Onboarding-Flow
  - ohne Invite-Token: offene Registrierung via E-Mail (nur wenn Flag aktiv)
- Vereinsseite erweitert:
  - neuer Button „Invite-Link erzeugen“ für existierende Clubs

## Live-Flags
- `PUBLIC_OPEN_SELF_REGISTRATION_ENABLED`
  - `false` = offene Registrierung aus (Default, live-sicher)
  - `true` = offene Registrierung aktiv

## Deployment-Reihenfolge (empfohlen)
1. Edge Functions deployen:
   - `profile-bootstrap`
   - `club-invite-create`
2. Frontend deployen.
3. Kurztest (Smoke):
   - Login bestehender User funktioniert.
   - `/app/vereine/` -> Invite-Link für existierenden Club erzeugbar.
   - `/registrieren/` ohne Invite:
     - bei Flag `false` blockiert
     - bei Flag `true` erlaubt

## Rollback
- Sofortmaßnahme: `PUBLIC_OPEN_SELF_REGISTRATION_ENABLED=false`
- Invite-Flow bleibt weiterhin über bestehende Token nutzbar.
- Falls nötig: nur Frontend zurückrollen, Edge Functions können additiv bestehen bleiben.

## Risiken / Hinweise
- Offene Registrierung erzeugt zunächst User ohne Vereinszuordnung (`club_id = null`).
- Datenmodule mit Club-Filter bleiben für diese User faktisch leer, bis Vereinszuordnung erfolgt.
- Für produktive Aktivierung offene Registrierung zuerst im Pilotverein testen.
- `WICHTIG (ROT / USER-HINWEIS):` Zugangsnamen im Format `VD01598` sind aktuell Anzeige-/Prozess-IDs, aber kein direkter Auth-Login-Identifier.
- Login-Source-of-Truth ist die Auth-E-Mail in Supabase (Legacy-Mitgliedsnummern-Login nur solange Pseudo-Mail-Accounts aktiv sind).
