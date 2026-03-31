# FCP Systemlandkarte – Masterboard Vorlage

Stand: 2026-03-31

## Zweck

Diese Datei ist die strukturierte Vorlage fuer ein zentrales draw.io-Masterboard des FCP.

Ziel:

- sichtbare Prozesse und Module sammeln
- vorhandene Repo-/Schema-Bausteine markieren
- Verbindungen und Abhaengigkeiten sichtbar machen
- Luecken / Brueche / offene Baustellen markieren

Status-Legende:

- `vorhanden`
- `teilweise`
- `fehlt`

## 1. Einstieg / Core-Flows

### 1. Website / Marketing

- Status: `vorhanden`
- Wichtigste Pfade:
  - `src/pages/index.astro`
  - oeffentliche Web-/Landing-Pages unter `src/pages/`
  - Runtime-/Brand-Kontext ueber `public/js/static-web-runtime.js`
  - Brand-/Web-Config ueber `public/js/app-brand-runtime.js`
  - Edge Function: `admin-web-config`
- Abhaengigkeiten:
  - Runtime Config
  - Theme / Branding
  - Registrierung / Join
  - Billing-Kommunikation indirekt
- Groesste Luecken:
  - kein zentrales oeffentliches Masterboard fuer alle Einstiegsstrecken
  - CSV-Onboarding noch nicht als sichtbarer Marketing-/Sales-Pfad integriert

### 2. Registrierung

- Status: `vorhanden`
- Wichtigste Pfade:
  - `public/js/member-auth.js`
  - `public/js/membership-apply.js`
  - `src/pages/vereinssignin.astro`
  - `src/pages/registrieren.astro`
  - `src/pages/verein-anfragen.astro`
  - Tabellen:
    - `public.membership_applications`
    - `public.membership_application_bank_data`
    - `public.membership_application_audit`
  - RPCs:
    - `submit_membership_application`
    - `approve_membership`
    - `reject_membership`
- Abhaengigkeiten:
  - Auth / Profiles
  - Legal / DSGVO
  - Mitglieder
  - Invite / Claim
- Groesste Luecken:
  - CSV-Onboarding ist noch nicht Teil dieser Strecke
  - Join-/Claim-/CSV-Pfade noch nicht auf einem gemeinsamen Gesamtprozess eingefroren

### 3. Login

- Status: `vorhanden`
- Wichtigste Pfade:
  - `public/js/member-auth.js`
  - Header-Login-Popover / Mobile Login-UX
  - Supabase Auth
  - Invite-/Claim-Strecke:
    - `club-invite-verify`
    - `club-invite-claim`
    - `profile-bootstrap`
- Abhaengigkeiten:
  - Auth / Profiles
  - Invite-System
  - Rollen / ACL
  - Dashboard
- Groesste Luecken:
  - Login und Vereinszuordnung sind funktional, aber fachlich noch nicht als Gesamtlandkarte dokumentiert

### 4. Onboarding

- Status: `vorhanden`
- Wichtigste Pfade:
  - Edge Functions:
    - `club-admin-setup`
    - `club-onboarding-workspace`
    - `club-onboarding-status`
    - `club-onboarding-progress`
  - Tabellen:
    - `public.club_onboarding_state`
    - `public.club_onboarding_audit`
    - `public.club_billing_subscriptions`
    - `public.club_billing_webhook_events`
  - RPCs:
    - `club_onboarding_requirements`
    - `club_onboarding_snapshot`
- Abhaengigkeiten:
  - Billing
  - Vereinsdaten
  - Gewaesser
  - Karten
  - Mitglieder
  - Rollen / ACL
- Groesste Luecken:
  - CSV-Onboarding-MVP noch nicht implementiert
  - Karten aktuell teils noch als Settings/Workspace-JSON statt als harte Fachentitaet

### 5. App-Einstieg / Dashboard

- Status: `vorhanden`
- Wichtigste Pfade:
  - `public/js/app-dashboard.js`
  - verschiedene `/src/pages/app/...`
  - Club-/Board-Kontext ueber `get_club_identity_map`
- Abhaengigkeiten:
  - Auth / Profiles
  - Rollen / ACL
  - Runtime Config
  - alle Fachmodule
- Groesste Luecken:
  - zentrales Modul-/Prozess-Masterboard fehlt bisher

## 2. Fachmodule

### 6. Mitglieder

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.club_members`
    - `public.members`
    - `public.club_member_identities`
  - RPCs:
    - `admin_member_registry`
    - `admin_member_registry_create`
    - `admin_member_registry_update`
    - `admin_member_registry_delete`
  - UI:
    - `public/js/member-registry-admin.js`
    - `src/pages/app/mitgliederverwaltung/index.astro`
- Abhaengigkeiten:
  - Auth / Profiles
  - Rollen / ACL
  - Karten
  - Invite / Claim
  - Onboarding
- Groesste Luecken:
  - Stammsatz und Mitgliedschaftshistorie noch nicht getrennt
  - `members` und `club_members` sind fachlich noch nicht sauber entkoppelt
  - Rollenanzeige braucht aktuell Zusatzlogik, weil `club_user_roles` und `club_members.role` nicht deckungsgleich sind

### 7. Gewaesser

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabelle:
    - `public.water_bodies`
  - Edge Function:
    - `club-onboarding-workspace` (`create_water`, `update_water`, `delete_water`, `toggle_water`)
  - UI:
    - `public/js/member-registry-admin.js` (Waters inline v2)
- Abhaengigkeiten:
  - Onboarding
  - Karten
  - Fangliste / Trips
- Groesste Luecken:
  - Kartenzuordnung laeuft noch teils ueber Settings/Assignments statt vollwertiges Fachmodell
  - `water_bodies` uniqueness ist fuer CSV-/Multi-Club-MVP noch zu global

### 8. Karten / Beiträge

- Status: `teilweise`
- Wichtigste Tabellen / Pfade / Endpoints:
  - aktuell stark ueber Settings / Workspace:
    - `club_cards:{clubId}` in `app_secure_settings`
    - `club-onboarding-workspace` Aktion `save_cards`
  - in Mitgliedern aktuell:
    - `club_members.fishing_card_type`
    - `members.fishing_card_type`
- Abhaengigkeiten:
  - Mitglieder
  - Gewaesser
  - Onboarding
  - Billing indirekt
- Groesste Luecken:
  - keine echte Tabelle `club_card_types`
  - keine Kartenhistorie
  - keine saubere Mehrfachkartenlogik
  - Beitragslogik nicht als klares Fachmodul vorhanden

### 9. Arbeitsstunden

- Status: `teilweise`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.work_events`
    - `public.work_participations`
    - `public.work_checkins`
  - UI:
    - Cockpit-/Member-/Board-JS rund um `work-events`
- Abhaengigkeiten:
  - Mitglieder
  - Rollen / ACL
  - Event-/Terminlogik
- Groesste Luecken:
  - kein kleines Vereins-Arbeitsstundenmodell fuer Onboarding/Import
  - `WORK_HOURS` aus CSV hat aktuell keinen klaren Zielpfad

### 10. Sitzungen / Protokolle / Aufgaben

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.meeting_sessions`
    - `public.meeting_agenda_items`
    - `public.meeting_tasks`
    - `public.task_assignees`
  - Migrationsbasis:
    - `docs/supabase/34_meeting_sessions_and_agenda.sql`
    - `docs/supabase/32_paket_3_assignments.sql`
- Abhaengigkeiten:
  - Dokumente
  - Rollen / ACL
  - Feed / Kommunikation indirekt
- Groesste Luecken:
  - im aktuellen Admin-/Board-Bild noch nicht so stark sichtbar wie andere Module
  - keine zentrale Prozesslandkarte fuer Sitzung -> Aufgabe -> Dokument

### 11. Feed / Kommunikation

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabelle:
    - `public.feed_posts`
    - zugehoerige Media-/Kommentar-Pfade aus Feed-Kontext
  - JS:
    - Home-/Feed-nahe Runtime
- Abhaengigkeiten:
  - Auth / Profiles
  - Rollen / ACL
  - Runtime Config
- Groesste Luecken:
  - Feed ist technisch da, aber in der Gesamtmodullandkarte noch nicht hart mit anderen Vereinsprozessen verbunden

### 12. Dokumente

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabelle:
    - `public.documents`
  - Legal-Dokumente separat:
    - `public.legal_documents`
    - `public.legal_acceptance_events`
- Abhaengigkeiten:
  - Rollen / ACL
  - Legal / DSGVO
  - Sitzungen / Aufgaben
- Groesste Luecken:
  - operative Dokumente und Legal-Dokumente liegen als getrennte Welten vor
  - noch keine zentrale Board-Sicht darauf

### 13. Benachrichtigungen

- Status: `teilweise`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabelle:
    - `public.push_subscriptions`
  - verschiedene JS-/Runtime-Pfade fuer Push / Notifications
- Abhaengigkeiten:
  - Auth / Profiles
  - Runtime Config
  - Feed / Termine / Arbeitseinsaetze
- Groesste Luecken:
  - kein vollstaendiges zentrales Benachrichtigungsmodul als klare Fachbox
  - eher Infrastruktur-/Feature-verteilt

### 14. Fangliste / Trips

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.fishing_trips`
    - `public.catch_entries`
    - `public.water_bodies`
  - UI:
    - Fangliste / Catchlist / Trip-JS
- Abhaengigkeiten:
  - Auth / Profiles
  - Gewaesser
  - Karten indirekt
- Groesste Luecken:
  - Verbindung zur Mitglieder-/Kartenlogik noch nicht als Gesamtprozess modelliert

### 15. Termine / Club Events

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.club_events`
    - `public.work_events`
  - Event- / Eventplanner-UI
- Abhaengigkeiten:
  - Rollen / ACL
  - Gewaesser optional
  - Benachrichtigungen
- Groesste Luecken:
  - Club Events und Work Events sind fachlich verwandt, aber in der Landkarte als getrennte Knoten sinnvoll

### 16. Vereine / Vereinsdaten

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Club-Kontext heute stark ueber:
    - `public.app_secure_settings`
    - `get_club_identity_map`
    - `club-admin-setup`
    - `club-onboarding-workspace`
  - UI:
    - `/app/vereine/`
    - Registry-Teil `Vereinsdaten`
- Abhaengigkeiten:
  - Runtime Config
  - Onboarding
  - Billing
  - Mitglieder
- Groesste Luecken:
  - Club-Stammdaten liegen teils noch als Settings statt als harte Fachentitaet

## 3. System / Infrastruktur

### 17. Auth / Profiles

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `auth.users`
    - `public.profiles`
  - Functions:
    - `profile-bootstrap`
  - JS:
    - `public/js/member-auth.js`
- Abhaengigkeiten:
  - Registrierung
  - Login
  - Mitglieder
  - Rollen / ACL
- Groesste Luecken:
  - Mitglied, Profile und Vereinsrolle sind noch nicht als vollstaendig harmonisierte Identitaetskette eingefroren

### 18. Rollen / ACL

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.club_roles`
    - `public.club_role_permissions`
    - `public.club_user_roles`
    - legacy `public.user_roles`
  - UI:
    - `Rollen / Rechte` in `member-registry-admin.js`
- Abhaengigkeiten:
  - fast alle Admin-/App-Module
  - Mitglieder
  - Onboarding
- Groesste Luecken:
  - Dualitaet zwischen `club_user_roles` und sichtbarer Mitgliederrolle
  - importierte Mitglieder ohne `user_id` passen nicht sauber in `club_user_roles`

### 19. Billing

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.club_billing_subscriptions`
    - `public.club_billing_webhook_events`
  - Onboarding-Snapshot-/State-Logik
- Abhaengigkeiten:
  - Onboarding
  - Vereine
  - Portal-Aktivierung
- Groesste Luecken:
  - Billing ist systemisch vorhanden, aber als Gesamtprozess im Board noch nicht mit CSV-Onboarding / Setup verzahnt dargestellt

### 20. DSGVO / Legal

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabellen:
    - `public.legal_documents`
    - `public.legal_acceptance_events`
    - `public.app_secure_settings` fuer aktive Versionen / Runtime-Flags
  - JS:
    - `public/js/legal-acceptance.js`
- Abhaengigkeiten:
  - Registrierung
  - Onboarding
  - Dokumente
- Groesste Luecken:
  - Legal ist sauber vorbereitet, aber visuell nicht als eigener Querschnitt im Gesamtboard verankert

### 21. Audit

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - `public.club_onboarding_audit`
  - `public.membership_application_audit`
  - weitere Audit-/Security-/Governance-SQLs
- Abhaengigkeiten:
  - Onboarding
  - Registrierung
  - spaeter CSV-Onboarding
- Groesste Luecken:
  - noch kein zentraler Audit-Knoten fuer alle Business-Prozesse

### 22. Runtime Config

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Tabelle:
    - `public.app_secure_settings`
  - Function:
    - `admin-web-config`
  - Runtime:
    - `app-brand-runtime.js`
    - `static-web-runtime.js`
- Abhaengigkeiten:
  - Website / Marketing
  - Vereine
  - Onboarding
  - Theme / Branding
  - Invite / Club-Kontext
- Groesste Luecken:
  - einige Fachkonfigurationen liegen noch zu stark in Settings statt in harten Fachtabellen

### 23. Template / Theme-System

- Status: `teilweise`
- Wichtigste Tabellen / Pfade / Endpoints:
  - FCP-Komponenten-Dokumente
  - `FCP_INLINE_DATA_TABLE_V2_MASTER_CONTRACT.md`
  - Brand-/Runtime-Config
  - CSS-/Shell-System
- Abhaengigkeiten:
  - Website
  - Dashboard
  - alle Adminmasken
- Groesste Luecken:
  - Standardisierung ist in Arbeit, aber noch nicht ueberall hart durchgezogen

### 24. CSV-Onboarding

- Status: `fehlt`
- Wichtigste Zielpfade laut aktuellem Rahmen:
  - `club_members`
  - `water_bodies`
  - neue Tabelle `club_card_types`
  - neue Tabelle `club_work_settings`
  - `club_onboarding_state`
  - `club_onboarding_audit`
  - optional `club_csv_import_jobs`
- Geplante Endpoints:
  - `csv-onboarding-preview`
  - `csv-onboarding-confirm`
- Abhaengigkeiten:
  - Billing
  - Onboarding
  - Mitglieder
  - Gewaesser
  - Karten
  - Audit
- Groesste Luecken:
  - noch nicht implementiert
  - `water_bodies` uniqueness noch nicht club-spezifisch genug
  - `club_card_types` fehlt
  - `WORK_HOURS` hat noch keinen kleinen Zielpfad

### 25. Invite / Claim / Vereinsbeitritt

- Status: `vorhanden`
- Wichtigste Tabellen / Pfade / Endpoints:
  - Functions:
    - `club-invite-create`
    - `club-invite-verify`
    - `club-invite-claim`
    - `club-request-submit`
    - `club-request-decision`
  - JS:
    - `member-auth.js`
    - `member-registry-admin.js` fuer Invite-Erzeugung
- Abhaengigkeiten:
  - Auth / Profiles
  - Mitglieder
  - Vereine
  - Onboarding
- Groesste Luecken:
  - noch kein zentrales Gesamtbild Join / Claim / CSV / Setup als ein Board-Flow

## 4. Empfohlene draw.io Hauptboxen

### Ebene A – Core-Flows

- Website / Marketing
- Registrierung
- Login / Auth
- Invite / Claim / Vereinsbeitritt
- Onboarding
- Dashboard / App-Einstieg

### Ebene B – Fachmodule

- Mitglieder
- Gewaesser
- Karten / Beiträge
- Arbeitsstunden
- Termine / Club Events
- Sitzungen / Protokolle / Aufgaben
- Feed / Kommunikation
- Dokumente
- Benachrichtigungen
- Fangliste / Trips
- Vereine / Vereinsdaten

### Ebene C – Querschnitt / System

- Auth / Profiles
- Rollen / ACL
- Billing
- DSGVO / Legal
- Audit
- Runtime Config
- Template / Theme-System
- CSV-Onboarding

## 5. Wichtigste Verbindungen fuer das Masterboard

### Core-Verbindungen

- Website / Marketing -> Registrierung
- Website / Marketing -> Vereinsanfrage / Join
- Registrierung -> Login / Auth
- Login / Auth -> Dashboard / App-Einstieg
- Billing -> Onboarding
- Onboarding -> Mitglieder
- Onboarding -> Gewaesser
- Onboarding -> Karten / Beiträge
- Onboarding -> Dashboard / App-Einstieg

### Mitglieder-Verbindungen

- Mitglieder <-> Rollen / ACL
- Mitglieder <-> Invite / Claim
- Mitglieder <-> Karten / Beiträge
- Mitglieder <-> Arbeitsstunden
- Mitglieder <-> Auth / Profiles

### Gewaesser-/Karten-Verbindungen

- Gewaesser <-> Karten / Beiträge
- Gewaesser <-> Fangliste / Trips
- Karten / Beiträge <-> Mitglieder

### Admin-/Governance-Verbindungen

- Rollen / ACL -> alle Adminmodule
- Legal -> Registrierung
- Legal -> Onboarding
- Audit -> Onboarding
- Audit -> Registrierung
- Runtime Config -> Website / Marketing
- Runtime Config -> Vereine / Vereinsdaten
- Template / Theme-System -> Dashboard / Adminmasken

## 6. Wichtigste Gap-Markierungen fuer draw.io

Diese Punkte sollten im Masterboard explizit als `Gap` oder `Baustelle` markiert werden:

### GAP-001 – CSV-Onboarding fehlt

- Preview / Mapping / Confirm noch nicht implementiert

### GAP-002 – Kartenmodell ist noch zu weich

- Kartentypen teils noch Settings statt harte Fachentitaet

### GAP-003 – Mitglieder-Stammsatz vs. Historie

- aktuelle Registry pflegt Live-Zustand
- Verlauf von Status/Karten/Mitgliedschaft fehlt noch

### GAP-004 – Rollenmodell fuer importierte Mitglieder

- `club_user_roles` braucht `user_id`
- importierte Mitglieder haben den oft noch nicht

### GAP-005 – Vereinsdaten liegen teils noch in Settings

- Club-/Karten-/Workspace-Meta nicht vollstaendig als harte Fachstruktur modelliert

### GAP-006 – `water_bodies` uniqueness fuer CSV-/Multi-Club-MVP

- club-scoped uniqueness noch nicht final

### GAP-007 – Arbeitsstunden-Importziel fehlt

- `WORK_HOURS` aus CSV braucht kleinen Settings-/Model-Pfad

## 7. Kompakte Statusmatrix

| Bereich | Status | Kurzbegruendung |
| --- | --- | --- |
| Website / Marketing | vorhanden | oeffentliche Einstiegsseiten + Runtime-/Brandpfade vorhanden |
| Registrierung | vorhanden | Membership-/Join-/Claim-Pfade vorhanden |
| Login / Auth | vorhanden | Supabase Auth + member-auth + invite integration |
| Onboarding | vorhanden | Onboarding-State, Audit, Workspace, Setup-Functions vorhanden |
| Dashboard | vorhanden | App-Einstieg und Board-/Dashboard-Pfade vorhanden |
| Mitglieder | vorhanden | Registry, RPCs, Tabellen vorhanden |
| Gewaesser | vorhanden | `water_bodies` + Workspace-Pfade vorhanden |
| Karten / Beiträge | teilweise | aktuelle Kartentypen funktional, aber kein hartes Tabellenmodell fuer V1 |
| Arbeitsstunden | teilweise | operative Events vorhanden, Import-/Vereinsmodell fehlt |
| Sitzungen / Aufgaben | vorhanden | Tabellenbasis vorhanden |
| Feed / Kommunikation | vorhanden | Feed-Tabellen und UI-Pfade vorhanden |
| Dokumente | vorhanden | operative und Legal-Dokumente vorhanden |
| Benachrichtigungen | teilweise | Push-Basis vorhanden, kein grosses zentrales Modul |
| Fangliste / Trips | vorhanden | Catch-/Trip-Basis vorhanden |
| Rollen / ACL | vorhanden | club_roles / permissions / user_roles vorhanden |
| Billing | vorhanden | Onboarding-/Billing-Tabellen vorhanden |
| DSGVO / Legal | vorhanden | Legal-Dokumente und Acceptance vorhanden |
| Audit | vorhanden | Onboarding- und Membership-Audit vorhanden |
| Runtime Config | vorhanden | `app_secure_settings` + admin-web-config vorhanden |
| Template / Theme-System | teilweise | Standardisierung vorhanden, aber noch nicht komplett durchgezogen |
| CSV-Onboarding | fehlt | fachlich definiert, technisch noch nicht gebaut |

## 8. Empfohlene draw.io-Darstellung

Fuer das Masterboard wuerde ich drei Zonen bauen:

1. **oben**
   - Einstieg / Core-Flows

2. **mitte**
   - Fachmodule

3. **unten oder rechts**
   - System / Infrastruktur / Querschnitt

Zusatzmarkierungen:

- `gruen` = vorhanden
- `gelb` = teilweise
- `rot` = fehlt / Gap
- gestrichelte Pfeile = indirekte Abhaengigkeit
- Blitz-/Warnsymbol = offene Baustelle / Schema-Bruch
