# Umsetzungsbericht: Mitgliedsregister + Auth-Basis (P0)

Stand: 2026-03-09  
Branch: `DEV_inner_Live`

## Ziel
Kontrollierbare Vereinsanlage und autorisierte Registrierung per QR/Invite sowie fachlich belastbare Basis für Mitgliedsdatenpflege.

## Umgesetzt

### 1) Kontrollierte Registrierung per Vereins-Invite (QR)
- Vereins-Setup erzeugt jetzt bei erfolgreicher Anlage automatisch:
  - Invite-Token
  - Registrierungs-Link (`/registrieren/?invite=...`)
  - QR-Link
  - Ablaufdatum
- Anzeige im Vereins-Setup:
  - neues QR-Panel mit Token, Link, Copy-Buttons

Technische Bausteine:
- `supabase/functions/club-admin-setup/index.ts` erweitert
- Neue Functions:
  - `supabase/functions/club-invite-verify/index.ts`
  - `supabase/functions/club-invite-claim/index.ts`
- Frontend:
  - `src/pages/app/vereine/index.astro`
  - `public/js/club-admin-setup.js`
  - `src/pages/registrieren.astro`
  - `public/js/member-auth.js`
  - `src/pages/login.astro`

### 2) Registrierungsseite wieder nutzbar (Invite-Pflicht)
- Registrierung ist nicht mehr global offen.
- Ohne Invite-Token kein sauberer Abschluss.
- Nach Signup erfolgt Club-Claim via Edge Function (direkt oder beim ersten Login per Pending-Claim).

### 3) Mitgliedsregister-P0 weiter geschlossen
- `app/mitgliederverwaltung` nutzt bereits fachliche Registry-RPCs.
- Lücke „Geburtsdatum nicht pflegbar“ geschlossen:
  - UI jetzt editierbar (`type="date"`)
  - Save-Flow über RPC-Parameter `p_birthdate`
- Status-Eingabe im Dialog auf strukturierte Auswahl (`active`/`inactive`) umgestellt.

Änderungen:
- `public/js/member-registry-admin.js`
- Neue SQL-Migration:
  - `docs/supabase/88_admin_member_registry_update_birthdate.sql`

## Verifikation
- `npm run build` erfolgreich
- `npm test` erfolgreich (`28/28`)
- Club-Anlage inkl. Invite-Generierung bereits manuell erfolgreich getestet

## Betriebs-/Deploy-Hinweise
Für produktiven Invite-Flow müssen diese Functions deployed sein:
1. `club-admin-setup`
2. `club-invite-verify`
3. `club-invite-claim`

Zusätzlich DB-seitig ausführen:
- `docs/supabase/88_admin_member_registry_update_birthdate.sql`

## Offene P0/P1 Punkte

### Offen P0 (fachlich wichtig)
- E-Mail-/Auth-Änderungsflow getrennt und sauber bedienbar machen (nicht über `members` mischen).
- Rollen-/Mitgliederseite inhaltlich weiter konsolidieren (klare Trennung:
  - `app/mitglieder`: Rollen/Auth-Admin
  - `app/mitgliederverwaltung`: fachliche Stammdaten)

### P1
- Validierungen im Dialog erweitern (PLZ-Format, Birthdate-Grenzen, Kartenstatuslisten).
- Änderungsjournal im UI anzeigen (wer hat wann geändert) auf Basis vorhandener Audit-/Admin-Logs.

### P2
- Bulk-Import/Batch-Update für Stammdatenpflege.
- Optional: dedizierter E-Mail-Change-Prozess mit Verifizierung und klarer Admin-Freigabe.

