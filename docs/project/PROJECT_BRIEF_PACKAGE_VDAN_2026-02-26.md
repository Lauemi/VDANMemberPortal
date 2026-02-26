# Project Brief Package – VDAN Fishing-Club-Portal

Stand: 26.02.2026
Projektleitung/technischer Ansprechpartner: Michael Lauenroth
Verein: VDAN (Verein der Angler und Naturfreunde Ottenheim 1957 e.V.)

## 1) Produkt- und Scope-Basis

### 1.1 One-Pager

1. Zielgruppen:
   Mitglieder, Vorstand, Admins, Interessenten (oeffentlicher Bereich).
2. Hauptproblem:
   Vereinsablaeufe sind verteilt (Listen, Termine, Dokumente, Nachweise) und schwer mobil nutzbar.
3. Kernnutzen:
   Ein zentrales Fishing-Club-Portal mit rollenbasiertem Zugriff, klaren Prozessen und PWA-Faehigkeit.
4. MVP-Umfang:
   Login/Portal, Fangliste, Arbeitseinsaetze, Ausweis/Verifikation, Dokumente, Mitgliedsantraege, Push-Update.
5. Spaeter:
   Multi-Tenant-Isolation, Stage/Prod-Trennung, erweiterte Audit- und Rollenprofile.

### 1.2 Feature-Liste (Public vs Member vs Admin)

1. Public:
   Startseite, Termine, Veranstaltungen, Kontakt, Impressum, Datenschutz, Downloads.
2. Member:
   Fangliste, Arbeitseinsaetze, Mitgliedsausweis, Gewaesserkarte, Einstellungen, Zustaendigkeiten.
3. Vorstand/Admin:
   Cockpits (Fangliste, Termine, Arbeitseinsaetze), Bewerbungen, Dokumentverwaltung.
4. Admin:
   Mitglieder-/Rollenverwaltung.

### 1.3 Rollen und Rechte (Ist)

1. Gast (nicht eingeloggt): nur oeffentliche Seiten.
2. Mitglied (`member`): memberbezogene Funktionen.
3. Vorstand (`vorstand`): erweiterte Managementfunktionen.
4. Admin (`admin`): Vollzugriff auf Admin-Bereiche.

### 1.4 User Journeys (Kernflows)

1. Registrierung/Login:
   Login -> Portal -> Modulwahl -> Abmeldung.
2. Mitglied werden:
   Formular -> Validierung -> Verschluesselte Speicherung -> Pruefung Vorstand/Admin -> Entscheidung.
3. Vorstand-Flow:
   Cockpit -> Datensatz pruefen -> freigeben/ablehnen -> Auditspur.
4. Mitglied-Flow:
   Fang erfassen oder Arbeitseinsatz waehlen -> Detaildialog -> Status sehen.
5. Push-Flow:
   Push aktivieren -> Subscription speichern -> Update-Benachrichtigung erhalten.

## 2) System-Ueberblick

### 2.1 Architektur (Text)

1. Frontend:
   Astro-basiertes Web/PWA-Frontend.
2. Backend:
   Supabase (Postgres, Auth, RLS, Edge Functions).
3. Storage:
   Supabase Storage Buckets fuer Medien/Dokumente.
4. E-Mail:
   Edge-Function-gestuetzter Versand (abh. von konfiguriertem Provider/SMTP/API).
5. Hosting:
   Laut Vorgabe IONOS (Deployment-Prozess projektseitig definiert).

### 2.2 Umgebungen / Deploy

1. Aktuell: Fokus auf Dev/Produktiv-nahem Testlauf.
2. Stage/Prod-Trennung: geplant nach grossem Update.
3. Deploy-Weg:
   Frontend-Build + Supabase SQL-Migrationen + Edge Function Deploy.

## 3) Daten und Sicherheit

### 3.1 DB-Schema (Kurzueberblick)

Wichtige Domaintabellen (Auszug):

1. `profiles`, `user_roles`, `user_settings`
2. `feed_posts`, `catch_entries`, `work_events`, `work_participations`
3. `membership_applications`, `membership_application_bank_data`, `members`, `member_bank_data`
4. `public_documents`, `push_subscriptions`

### 3.2 RLS-Uebersicht (Kurz)

1. Zugriff ueber `auth.uid()` + Rollenhelper (`is_admin`, `is_admin_or_vorstand`).
2. Viele Tabellen haben "own-data" plus Vorstand/Admin-Erweiterung.
3. Kritische Views auf `security_invoker=true` gestellt.
4. Tenant-Isolation derzeit nicht systemweit erzwungen (Single-Tenant-Betrieb).

### 3.3 Auth-Konzept (Kurz)

1. Supabase Auth mit Session/Refresh.
2. Rollen in `user_roles`.
3. Sensitive Backend-Aktionen via Edge Functions/Funktionen mit serverseitigen Checks.

## 4) UI-/Content-Grundlage

### 4.1 Navigation Map (Ist)

1. Public-Navigation:
   Oeffentliche Seiten (Info/Rechtliches/Kontakt etc.).
2. Portal-Navigation:
   Portal-Quick/Favoriten + Modulzugriffe im Login-Bereich.

### 4.2 Hauptseiten fuer Dokumentation/Screenshots

1. `/`
2. `/login/`
3. `/app/`
4. `/app/fangliste/`
5. `/app/arbeitseinsaetze/`
6. `/app/ausweis/`
7. `/app/dokumente/`
8. `/app/bewerbungen/`
9. `/app/mitglieder/`
10. `/app/einstellungen/`

### 4.3 Textquellen (Ist)

1. Seiten-/UI-Texte in Astro- und JS-Dateien.
2. Fehlermeldungen in Frontend/Edge Functions.
3. Kontakt-/Benachrichtigungslogik ueber Functions.

## 5) Roadmap und Risiken

### 5.1 Jetzt

1. Stabilisierung UI/UX-Standards.
2. Push-Update-Fluss.
3. Sicherheits-/Schluesselsetup und Runbooks.

### 5.2 Naechstes Quartal

1. Stage/Prod-Trennung.
2. Vollstaendige Tenant-Isolation.
3. Erweiterte Audit-/Betriebsmetriken.

### 5.3 Spaeter

1. Rollenprofile/Presets vollstaendig.
2. Weitere Automatisierung (Release Gates, Monitoring).

### 5.4 Constraints & Risiken

1. PWA-Cache/Update-Verhalten braucht disziplinierten Rollout.
2. Mobile UI-Feinheiten (kleine Displays, Overlay-Verhalten).
3. Single-Tenant-Architektur ist bewusstes Zwischenziel.

## 6) Minimal-Paket (wenn Zeit knapp)

1. One-Pager
2. Feature-Liste + Rollen
3. Seiten-/Menue-Liste
4. 10-15 Screenshots
5. 3-5 User Journeys

## 7) Audit-Paket (CTO-Level)

1. DB-Schema-Export
2. RLS-Policy-Uebersicht pro Tabelle
3. Tenant-Logik (oder dokumentierter Single-Tenant-Status + Migrationsplan)
4. Auth-Konzept inkl. Session/Refresh/Recovery

