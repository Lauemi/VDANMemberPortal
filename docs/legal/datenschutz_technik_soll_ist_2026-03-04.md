# Datenschutz Technik Soll-Ist-Check

Stand: 4. März 2026

Ziel: Abgleich der aktualisierten Datenschutzerklärung mit dem technisch belegbaren Ist-Zustand im Projekt.

## 1) Ergebnis auf einen Blick

- Erfüllt: Consent-Mechanismus für externe Inhalte, TLS/HTTPS-Anforderung in kritischen Flows, rollenbasierte Zugriffskontrolle, tenant-scope in DB/RLS, öffentlich/geschützt getrennte Datenzugriffe.
- Teilweise/organisatorisch offen: Subprozessor-Anlage mit Drittlandgrundlage je Dienstleister, juristische Endfreigabe (Anwalt/DSB), formale AVV-Dokumentationsablage im Verein.
- Rollenklärung (wichtig): Technischer Portalbetrieb und inhaltliche Vereinsverantwortung sind in den Rechtstexten jetzt getrennt benannt.

## 2) Technische Nachweise (Code/Config)

### A) Einwilligungsmanagement und externe Inhalte

- Consent-Banner + Einstellungen:
  - `public/js/consent-manager.js`
  - Einwilligungs-Kategorie `external_media` wird technisch ausgewertet.
- Google Maps nur per Consent:
  - `src/pages/anglerheim-ottenheim.html.astro` (`data-consent-src`, `data-consent-category="external_media"`).
- Leaflet/OSM nur nach Consent:
  - `public/js/member-water-map.js` (unpkg + OSM, Listener auf `vdan:consent-changed`).
- Externer QR-Dienst vorhanden:
  - `public/js/member-card.js`
  - `public/js/work-events-cockpit.js`

Bewertung: **Erfüllt**.

### B) Lokale Speichertechniken

- `localStorage` / `sessionStorage` für Session-, UI- und Consent-Zustände:
  - z. B. `public/js/member-auth.js`, `public/js/offline-data-store.js`, `public/js/consent-manager.js`.

Bewertung: **Erfüllt** (technisch dokumentiert).

### C) HTTPS/TLS-Anforderung

- Kamera-/Verifikationsflow weist explizit auf HTTPS-Anforderung hin:
  - `public/js/member-card-verify.js`.

Bewertung: **Erfüllt** (technische Erwartung klar im Client hinterlegt).

### D) Zugriffsschutz / Rollen / Mandantentrennung

- Rollenabfragen in geschützten UIs:
  - `public/js/member-guard.js`, `public/js/ui-session.js`, weitere Admin-Module.
- DB-seitiges Tenant-Scoping und RLS-Härtung über Migrationen:
  - `docs/supabase/68_club_id_not_null_and_tenant_rls.sql`
  - `docs/supabase/69_public_content_tenant_scope.sql`
  - `docs/supabase/72_main_compat_policy_patch.sql`
  - `docs/supabase/73_hotfix_auth_roles_and_feed_access.sql`
- Security-Baseline Least-Privilege für `anon`:
  - `docs/supabase/74_security_dsgvo_baseline.sql`

Bewertung: **Erfüllt** (für Vereins-/SMB-Niveau stark).

### E) DSGVO-Operationsfähigkeit (Nachweis/DSAR)

- Compliance-Event-Log + Admin-Funktionen:
  - `docs/supabase/75_dsgvo_ops_helpers.sql`
  - Funktionen: `admin_dsgvo_log_event`, `admin_dsgvo_subject_snapshot`

Bewertung: **Erfüllt** (technische Betroffenenprozess-Unterstützung vorhanden).

## 3) Rollenabgrenzung Verein vs. Portal

Aktueller Stand in den Rechtstexten:

- Datenschutzerklärung: Verein als Verantwortlicher für inhaltliche Vereinsdaten, technische Plattform als Auftragsverarbeitung.
  - `src/pages/datenschutz.html.astro`
- Nutzungsbedingungen: ausdrückliche Trennung der Verantwortung für Vereinsinhalte vs. IT-/Portalbetrieb.
  - `src/pages/nutzungsbedingungen.html.astro` (Abschnitt `5a`)

Bewertung: **Erfüllt** (rechtlich klarer als zuvor).

## 4) Offene Punkte für „juristisch final“

- Subprozessor-Anlage mit konkreten Angaben je Dienstleister dauerhaft pflegen:
  - Dienstleister, Zweck, Rolle, Datenkategorien, Region/Land, Drittlandgrundlage, AVV-Referenz.
- Juristische Endprüfung der finalen Website-Texte (Anwalt/DSB).
- Organisatorische Prozesse im Verein nachweisen:
  - Betroffenenrechte-SLA,
  - Löschfristen-Nachweis,
  - regelmäßiger Rechte-/Sicherheitsreview.

## 5) Fazit

Für den aktuellen Leistungsumfang ist der technische Datenschutzstand gut und belastbar.  
Die wesentlichen rechtlichen Klarstellungen (Drittland, Widerruf, Rollenabgrenzung) sind textlich umgesetzt.  
Für „formal abschlussreif“ fehlt primär die externe juristische Freigabe und die laufende organisatorische Dokumentationsdisziplin.
