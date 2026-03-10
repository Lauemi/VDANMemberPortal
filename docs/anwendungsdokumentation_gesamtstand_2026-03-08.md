# Anwendungsdokumentation (Gesamtstand)

Stand: 2026-03-08
Projekt: VDAN App Template (Website + Mitgliederportal)

## 1. Zweck und Positionierung
Die Anwendung kombiniert eine oeffentliche Vereinswebsite mit einem geschuetzten Mitgliederportal.

- Website (`/` und Unterseiten): Information, Kontakt, Rechtstexte, Inhalte fuer Interessenten.
- Portal (`/app/*`): Interne Vereinsprozesse fuer Mitglieder, Vorstaende, Verwaltung und Organisation.

Ableitungen:
- Marketingunterlagen: Leistungsumfang, Zielgruppen, Kern-Use-Cases.
- Bedienungsanleitung: Rollen, typische Prozessablaeufe, Navigation.
- Technik/Security: Architekturprinzipien, Sicherheitsmodell, Betriebsanforderungen.
- Datenschutz: Datenkategorien, Verarbeitungszwecke, Schutzmassnahmen, Dokumentationspfade.

## 2. Funktionsumfang (Produktsicht)
### 2.1 Oeffentliche Website
Relevante Seiten (Auszug): Startseite, Termine, Veranstaltungen, Kontakt, Impressum, Datenschutz, Downloads, Login/Registrieren.

### 2.2 Mitgliederportal
Portal-Module (gem. Seitenindex und Rollenmatrix):
- App-Startseite (`/app`)
- Mitgliederverwaltung (`/app/mitglieder`, `/app/mitgliederverwaltung`)
- Fangliste (`/app/fangliste`, inkl. Cockpit)
- Arbeitseinsaetze (`/app/arbeitseinsaetze`, inkl. Cockpit)
- Termine/Sitzungen (`/app/termine/cockpit`, `/app/sitzungen`)
- Dokumente (`/app/dokumente`)
- Einstellungen/Passwort (`/app/einstellungen`, `/app/passwort-aendern`)
- Ausweis und Verifizierung (`/app/ausweis`, `/app/ausweis/verifizieren`)
- Vereine/Zustaendigkeiten/Admin-Bereiche (`/app/vereine`, `/app/zustaendigkeiten`, `/app/admin-panel`)

## 3. Rollen und Nutzungskontext
Die Anwendung ist rollenbasiert aufgebaut. Je nach Rolle variieren Sichtbarkeit, Aktionen und Datenzugriff.

- Interessent/Gast: Website-Inhalte, Kontakt, ggf. Registrierung.
- Mitglied: Portalnutzung fuer eigene Vereinsprozesse.
- Funktionstraeger/Verwaltung: erweiterte Pflege- und Verwaltungsfunktionen.
- Admin: administrative Steuerung, Betriebs- und Konfigurationsaufgaben.

Hinweis: Die konkrete Berechtigungsmatrix ist in den Fach-/Sicherheitsdokumenten und SQL-Policies abgebildet.

## 4. Bedienlogik (fuer Handbuch/Schulung)
Typischer Nutzerfluss:
1. Aufruf Website und Informationsgewinnung.
2. Login oder Registrierung.
3. Einstieg ueber `/app` und Navigation in das jeweilige Modul.
4. Ausfuehrung von Modulaktionen (z. B. Fangliste, Arbeitseinsatz, Termine, Dokumente).
5. Pflege persoenlicher Einstellungen und Passwortaenderung.

UI-Struktur:
- Oeffentliche Seiten fuer externe Kommunikation.
- Einheitliches Portalmuster fuer interne Workflows.
- Mehrere modulare Seiten mit komponentenbasierten Bereichen (Tabellen, Dialoge, Formulare, Toolbar-Aktionen).

## 5. Technische Architektur (kompakt)
Frontend:
- Astro-basierte Seitenstruktur unter `src/pages`.
- Trennung zwischen oeffentlichen Seiten und Portalpfad (`/app/*`).
- Modulbezogene JS-Logik in `public/js/*`.

Daten/Backend:
- Supabase/Postgres mit SQL-Migrationspaketen in `docs/supabase/*`.
- Datenmodell umfasst u. a. Mitgliederdaten, Termine, Einsaetze, Fangdaten, Dokumente, Einstellungen.

Betriebsmodell:
- Multi-Tenant-/Club-Scope ist im Sicherheits- und Datenzugriffsmodell verankert.
- Trennung zwischen Plattformbetrieb und Vereinsinhalt ist dokumentiert.

## 6. Security-Baseline (fuer technische Unterlagen)
Sicherheitsprinzipien im Projektstand:
- Least Privilege fuer Rollen und Datenzugriffe.
- Row Level Security (RLS) auf relevanten Tabellen.
- Gezielter Einsatz von `security definer`/`security_invoker` mit Härtungsfokus.
- Rollen-/Mandantenbezug bei Datenoperationen.
- Security- und Release-Gates als operative Freigabekriterien.

Referenzen:
- `docs/security-audit-2026-03-07.md`
- `docs/security-dsgvo-checklist.md`
- `docs/supabase/74_security_dsgvo_baseline.sql`
- weitere Security-Patches in `docs/supabase/*`

## 7. Datenschutz und DSGVO (fuer Datenschutzunterlagen)
Datenschutzrelevante Grundlogik:
- Verarbeitung personenbezogener Daten nur fuer definierte Vereins-/Portalzwecke.
- Zugriffsbeschraenkung ueber Rollen- und Mandantenkontext.
- Protokoll-/Auditfaehigkeit fuer sicherheitsrelevante Ereignisse.
- Trennung von Verantwortlichkeiten zwischen Plattformbetrieb und Verein (je nach Datenkontext).

Referenzen:
- `src/pages/datenschutz.html.astro`
- `docs/legal/datenschutzerklaerung_vdan_portal_audit_version_2026-03-04.md`
- `docs/legal/datenschutz_technik_soll_ist_2026-03-04.md`
- `docs/privacy/*`

Wichtig:
- Diese Dokumentation ist eine technische/fachliche Grundlage und keine Rechtsberatung.
- Juristische Endfreigabe der finalen Datenschutzhinweise bleibt erforderlich.

## 8. Ableitbare Unterlagen (direkt nutzbar)
### 8.1 Marketing-Summary
- Produkt: digitale Vereinsplattform mit Website + Mitgliederportal.
- Nutzen: zentrale Abbildung von Mitglieder-, Termin-, Einsatz- und Fangprozessen.
- Zielgruppen: Interessenten, Mitglieder, Vorstaende, Verwaltung.

### 8.2 Bedienungsanleitung (Gliederung)
1. Login/Registrierung
2. Start im Portal
3. Module im Ueberblick
4. Typische Aufgaben je Rolle
5. Einstellungen und Supportwege

### 8.3 Technisches Security-Briefing
1. Architektur und Datenfluss
2. Rollen-/Mandantensicherheit
3. RLS-/Policy-Konzept
4. Security-Gates und Runbooks
5. Auditnachweise

### 8.4 Datenschutz-Briefing
1. Datenkategorien und Zwecke
2. Rechtsgrundlagen und Verantwortlichkeiten
3. Speicherdauer/Loeschung/Betroffenenrechte
4. Technische Schutzmassnahmen
5. Operativer Datenschutzprozess (Auskunft, Berichtigung, Loeschung)

## 9. Quellenbasis fuer diesen Stand
- Seiten-/Komponenteninventar: `docs/page-component-index.md`
- Rollen-/Seitenmatrix: `docs/role-page-matrix.md`, `docs/role-page-matrix.csv`
- Sicherheits- und DSGVO-Dokumente im Ordner `docs/` (insb. `docs/legal`, `docs/privacy`, `docs/supabase`)

