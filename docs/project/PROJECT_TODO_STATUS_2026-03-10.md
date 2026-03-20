# Projekt-To-Do / Status (VDAN -> FCP)
Stand: 2026-03-10

## 1) Erledigt
- Multi-Tenant-DB-Hardening umgesetzt (`94_*`, `96_*`) und Audit angelegt (`95_*`).
- Audit-Ergebnis erreicht: `multi-tenant-ready-db-baseline` mit `policy_smells=0`, `role_users_without_profile_club=0`, `legacy_fallback_enabled_flag=0`.
- Runtime-Pfade gehärtet:
  - `profile-bootstrap` (deterministische Club-Bindung),
  - `work-event-admin-update` (club-scharfe Berechtigung),
  - `push-notify-update` (`club_id` Pflicht + club-scharfer Versand).
- Nutzungsbedingungen inhaltlich nachgeschärft (Rollen, Pilotstatus, Login-Architektur, Exit-Regelung).
- Rechtliches Akzeptanz-Gate inkl. Checkbox/Flow vorbereitet (`93_*`).
- Supabase Auth E-Mail-Templates als vollständiges Paket (01-13) im Repo abgelegt.
- Footer-Texte vereinheitlicht:
  - Website/Portal: `© VDAN Ottenheim` + Plattform-Hinweis.
  - Mail-Templates: gleicher Footer plus Anbieterhinweis.
- Accessibility-Fix: Dialog-Fokus vor `aria-hidden` sauber zurückgeführt.
- Board-Doku + Umsetzungsfreigabe für Secret/Env-Management erstellt (`BOARD_UMSETZUNGSFREIGABE_SECRET_ENV_2026-03-10.md`).
- Secret-Matrix, Sync-Runbook und `.master`-Beispielstrukturen angelegt.
- Merge-Runbook `main -> prep` für Shared-DB-Betrieb angelegt (`MAIN_TO_PREP_MERGE_RUNBOOK_2026-03-10.md`).

## 2) Offen
- Finale Runtime-Sanity-Tests nach letztem Deploy vollständig protokollieren.
- Supabase-Templates 1:1 im Dashboard pflegen/prüfen (alle 13, nicht nur Kern-4).
- Auth-Mail-Cutover sauber planen (VDAN-Hosting heute, FCP-Domain später).
- Domain-/Redirect-Switch vorbereiten (VDAN -> `www.fishing-club-portal.de`).
- Secret-/Key-Rotation mit reproduzierbarem VSCode-Flow umsetzen.
- MVP-Entscheidungen für Multi-Club-Betrieb (z. B. MFA-Status, Umschaltlogik, Support-Prozess).
- Eventplaner als Vorstands-Modul ausbauen:
  - UI jetzt als Aggregationsschicht ueber `club_events` + `work_events`.
  - Keine neue Kern-Eventtabelle anlegen.
  - Slot-/Schichtlogik spaeter nur als kleine Erweiterungsschicht mit Referenz auf Basisobjekt (`base_kind`, `base_id`).

## 3) Entscheidungen, die ich noch von dir brauche
- `MFA`:
  - vorerst aus (`ja/nein`) und ab wann Pilot?
- `Domain-Switch-Strategie`:
  - Big-Bang an einem Stichtag oder stufenweise (VDAN primär, FCP parallel)?
- `Supabase URL Configuration`:
  - welche endgültigen Callback-/Redirect-URLs gelten für Prod/Preview/Local?
- `Auth-Mail Absenderidentität`:
  - finaler From-Name, Reply-To, Logo-URL, Support-Kontakt.
- `Secret-Management`:
  - welches zentrale Secret-Store-Tool wird gesetzt (1Password/Bitwarden/Doppler/Vault)?
- `Release-Gate`:
  - welche Smoke-Tests sind Pflicht für Deploy-Freigabe (Minimalset festlegen)?

## 4) Offene To-Do-Liste (priorisiert)
1. `P0` Runtime-Sanity-Test dokumentieren:
   - `profile-bootstrap`, Invite/Claim, Login, Event Update/Delete, Push Dry-Run club-scharf.
2. `P0` Supabase Auth E-Mail-Templates vollständig im Dashboard einpflegen:
   - Confirm signup, Invite user, Magic link, Change email, Reset password, Reauthentication.
   - Security-Templates: Password changed, Email changed, Phone changed, Identity linked/unlinked, MFA added/removed.
3. `P0` Mail-Wechsel/Cutover vorbereiten (explizit):
   - aktuelles Hosting: `www.vdan-ottenheim.com`
   - Ziel: `https://www.fishing-club-portal.de/`
   - Aufgaben: Logo-URL, Footer/Branding final, Subjects final, Redirect-Matrix final, Testmails bei 2 Providern.
4. `P1` Secret-/Key-Rotation durchführen:
   - Supabase Keys, GitHub Secrets, Vercel Env synchronisieren.
   - Ablauf dokumentieren (Runbook + Rollback).
5. `P1` Deploy-Flow stabilisieren:
   - eindeutiger Branch->Deploy-Workflow, Checkliste vor Merge.
6. `P1` Rechtliches finalisieren:
   - Datenschutz + Nutzungsbedingungen final gegen Impressum und Betriebsmodell gegenlesen.
7. `P2` Multi-Club-Operations vorbereiten:
   - Onboarding-Checkliste pro Verein, Support/Incident-Prozess, Monitoring-Metriken.

## 5) Praktische nächste 3 Schritte (heute)
1. Supabase Dashboard: alle 13 Mail-Templates einpflegen und Testmails auslösen.
2. Runtime-Sanity-Tests einmal sauber durchführen und Ergebnis kurz protokollieren (`pass/fail` je Test).
3. Domain-/Mail-Cutover-Entscheidung treffen (stufenweise vs. Stichtag), danach Redirect-Matrix fixieren.

## 6) Eventplaner-Architektur
- `club_events` bleibt Source of Truth fuer Termine.
- `work_events` bleibt Source of Truth fuer Arbeitseinsaetze.
- `work_participations` bleibt die bestehende Basis fuer Helferanmeldungen und Freigaben.
- Der neue `Eventplaner` liest diese Tabellen zusammen und schafft eine Vorstands-Sicht, ohne Stammdaten zu duplizieren.
- Falls strukturierte Planung mit Slots gebraucht wird, dann nur als Zusatzmodell wie `event_planner_configs`, `event_planner_slots`, `event_planner_registrations` mit Referenz auf das Basisobjekt.

## 7) Eventplaner Phase 2
- Migration angelegt: `supabase/migrations/20260314101000_event_planner_phase2_extension.sql`
- Zusatzhaertung angelegt: `supabase/migrations/20260314113000_event_planner_phase2_hardening.sql`
- Phase 2b.1 Notifications angelegt: `supabase/migrations/20260314123000_member_notifications_phase2b1.sql`
- Neue/erweiterte UI-Dateien:
  - `src/pages/app/eventplaner/index.astro`
  - `src/pages/app/eventplaner/mitmachen.astro`
  - `public/js/event-planner-board.js`
  - `public/js/event-planner-member.js`
  - `public/js/notifications-center.js`
  - `src/layouts/Site.astro`
- Technische Leitplanke gegen DB-Dschungel:
  - `event_planner_configs` referenziert immer genau ein Basisobjekt (`base_club_event_id` oder `base_work_event_id`)
  - beide Basis-Referenzen sind per Constraint/FK abgesichert
  - `event_planner_slots` haengen zwingend an `event_planner_configs`
  - Trigger validieren, dass Slots zeitlich innerhalb des Basisobjekts liegen
  - Zeitfenster-Aenderungen an `club_events` / `work_events` werden blockiert, falls bestehende Slots danach ausserhalb des Basisfensters laegen
  - `event_planner_registrations` haengen zwingend an Config und optional an genau einem Slot
  - strukturierte Registrierungen ohne Slot und Slots ohne Basisobjekt sind technisch verboten
  - Registrations-Freigabe/Ablehnung soll nur noch ueber die vorgesehenen RPCs laufen, nicht mehr ueber offene Tabellen-Schreibpfade fuer Manager
- Phase 2b.1 Produkt-Schnitt:
  - generische Tabelle `member_notifications` als Nutzer-Inbox
  - Glocke + Badge im Header als sichtbarer Einstieg
  - Eventplaner ist erster Producer fuer relevante Hinweise
  - initiale Notification-Faelle:
    - Event-Zeit geaendert
    - Slot-Zeit geaendert
    - Slot geloescht
    - Event abgesagt
    - Anmeldung bestaetigt
    - Anmeldung abgelehnt
- Phase 2b.2 bleibt getrennt:
  - administrative Teilnahme-Korrektur mit Auditspur
  - bewusst nicht in denselben ersten Notification-Wurf gezogen
