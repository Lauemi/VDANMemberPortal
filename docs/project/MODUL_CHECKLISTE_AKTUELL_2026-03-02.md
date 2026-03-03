# Modulliste Aktuell (Abhakbar)

Stand: 2026-03-02  
Quelle: aktuelle Routen unter `src/pages` und `src/pages/app` (Ist-Stand Codebasis)

## 1) App-Module (Login erforderlich)

| Status | Modul | Route |
| --- | --- | --- |
| [ ] | Member-Start / Dashboard | `/app/` |
| [ ] | Arbeitseinsätze | `/app/arbeitseinsaetze/` |
| [ ] | Arbeitseinsätze Cockpit | `/app/arbeitseinsaetze/cockpit/` |
| [ ] | Termine Cockpit | `/app/termine/cockpit/` |
| [ ] | Fangliste | `/app/fangliste/` |
| [ ] | Fangliste Cockpit | `/app/fangliste/cockpit/` |
| [ ] | Mitgliedsausweis | `/app/ausweis/` |
| [ ] | Ausweis Verifikation | `/app/ausweis/verifizieren/` |
| [ ] | Gewässerkarte | `/app/gewaesserkarte/` |
| [ ] | Dokumente (intern) | `/app/dokumente/` |
| [ ] | Einstellungen | `/app/einstellungen/` |
| [ ] | Passwort ändern | `/app/passwort-aendern/` |
| [ ] | Mitgliederverwaltung (Admin) | `/app/mitglieder/` |
| [ ] | Bewerbungen (Admin/Vorstand) | `/app/bewerbungen/` |
| [ ] | Sitzungen | `/app/sitzungen/` |
| [ ] | Zuständigkeiten | `/app/zustaendigkeiten/` |
| [ ] | Notizen | `/app/notes/` |
| [ ] | Lizenzfreie APIs / Wetter-Radar | `/app/lizenzen/` |

## 2) Public-Module (ohne Login)

| Status | Modul | Route |
| --- | --- | --- |
| [ ] | Startseite | `/` |
| [ ] | Öffentliche Termine | `/termine.html/` |
| [ ] | Veranstaltungen | `/veranstaltungen.html/` |
| [ ] | VDAN Jugend | `/vdan-jugend.html/` |
| [ ] | Mitglied werden | `/mitglied-werden.html/` |
| [ ] | Downloads | `/downloads.html/` |
| [ ] | Kontakt | `/kontakt.html/` |
| [ ] | Impressum | `/impressum.html/` |
| [ ] | Datenschutz | `/datenschutz.html/` |
| [ ] | Nutzungsbedingungen | `/nutzungsbedingungen.html/` |
| [ ] | Login | `/login/` |
| [ ] | Passwort vergessen | `/passwort-vergessen/` |
| [ ] | Offline-Seite | `/offline/` |
| [ ] | Anglerheim Ottenheim | `/anglerheim-ottenheim.html/` |
| [ ] | Fischereiprüfung | `/fischereipruefung.html/` |
| [ ] | Docs / interne Übersicht | `/docs/` |

## 3) System- und Betriebsmodule (Querschnitt)

| Status | Modul | Technische Basis |
| --- | --- | --- |
| [ ] | Auth & Session-Handling | `public/js/member-auth.js`, `public/js/ui-session.js` |
| [ ] | Rollen-Guard / Routen-Guard | `public/js/member-guard.js` |
| [ ] | Portal-Quick-Menü | `public/js/portal-quick.js` |
| [ ] | Offline Store | `public/js/offline-data-store.js` |
| [ ] | Offline Sync | `public/js/offline-sync.js` |
| [ ] | PWA Registrierung / Updates | `public/js/pwa-register.js` |
| [ ] | Runtime-/Maintenance-Gates | `public/js/runtime-guard.js`, `public/js/maintenance-gate.js` |
| [ ] | Push-Subscription Flow | `public/js/app-settings.js` + DB `push_subscriptions` |
| [ ] | Sicherheit / Consent Layer | `public/js/consent-manager.js` |

## 4) Hinweise zur Nutzung

| Status | Hinweis | Zweck |
| --- | --- | --- |
| [ ] | `[ ]` zu `[x]` ändern | Fortschritt markieren |
| [ ] | Bei neuen Modulen neue Zeile ergänzen | Vollständigkeit sichern |
| [ ] | Vor Release mit Smoke-Test abgleichen | Freigabequalität sichern |
