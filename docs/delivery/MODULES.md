# Modulstatus

Stand: 2026-03-13

## Legende

- `live`: produktiv nutzbar
- `partial`: teilweise fertig, mit Luecken oder Fallbacks
- `stub`: sichtbar, aber fachlich noch nicht fertig
- `internal`: internes Tool / Demo / Arbeitsmittel

## Kernmodule

| Modul | Route | Status | Offene Punkte | Hauptdateien |
| --- | --- | --- | --- | --- |
| Fangliste | `/app/fangliste/` | live | Vorlaeufig freigegeben; Restthemen nur noch als spaetere Optimierung oder Edgecase-Beobachtung behandeln | `src/pages/app/fangliste/index.astro`, `public/js/catchlist.js` |
| Arbeitseinsaetze Member | `/app/arbeitseinsaetze/` | live | QR-/Offline-Flow weiter im Betrieb pruefen | `src/pages/app/arbeitseinsaetze/index.astro`, `public/js/work-events-member.js` |
| Arbeitseinsaetze Cockpit | `/app/arbeitseinsaetze/cockpit/` | partial | Fachlich stark, aber Admin-Nacharbeiten und Betriebsabnahme offen | `src/pages/app/arbeitseinsaetze/cockpit.astro`, `public/js/work-events-cockpit.js` |
| Termine Cockpit | `/app/termine/cockpit/` | live | Offline-/Archivierungsworkflow weiter pruefen | `src/pages/app/termine/cockpit.astro`, `public/js/term-events-cockpit.js` |
| Mitgliedsausweis | `/app/ausweis/` | live | Lifecycle-Verwaltung im Registry-Bereich fehlt noch | `src/pages/app/ausweis/index.astro`, `public/js/member-card.js` |
| Scanner | `/app/ausweis/verifizieren/` | live | Betriebsfreigabe und Rollen-Feinschliff pruefen | `src/pages/app/ausweis/verifizieren.astro`, `public/js/member-card-verify.js` |
| Einstellungen | `/app/einstellungen/` | partial | Account-RPC/Fallback finalisieren, Zugangspruefung aus Preview holen | `src/pages/app/einstellungen/index.astro`, `public/js/app-settings.js` |
| Zugang pruefen | `/app/zugang-pruefen/` | partial | Noch Preview-/Rollout-Charakter | `src/pages/app/zugang-pruefen/index.astro`, `public/js/identity-check.js` |

## Admin und Vereinsbetrieb

| Modul | Route | Status | Offene Punkte | Hauptdateien |
| --- | --- | --- | --- | --- |
| Mitglieder | `/app/mitglieder/` | partial | Echte Betriebsabnahme und Rollen-/Policy-Pruefung | `src/pages/app/mitglieder/index.astro`, `public/js/members-admin.js` |
| Mitglieder-Registry | `/app/mitgliederverwaltung/` | stub | Mehrere Teilbereiche fehlen, ACL noch Pilot-Stub | `src/pages/app/mitgliederverwaltung/index.astro`, `public/js/member-registry-admin.js` |
| Bewerbungen | `/app/bewerbungen/` | live | Betriebsprozess und Exportfluss pruefen | `src/pages/app/bewerbungen/index.astro`, `public/js/membership-applications-admin.js` |
| Dokumente | `/app/dokumente/` | partial | Betriebsreife und Rechtefluss absichern | `src/pages/app/dokumente/index.astro`, `public/js/documents-admin.js` |
| Sitzungen | `/app/sitzungen/` | partial | Fachlich vorhanden, aber echte Einsatzreife pruefen | `src/pages/app/sitzungen/index.astro`, `public/js/responsibilities.js` |
| Fangliste Cockpit | `/app/fangliste/cockpit/` | live | Reporting/Policy-Check im Betrieb | `src/pages/app/fangliste/cockpit.astro`, `public/js/catchlist-cockpit.js` |
| Admin Board | `/app/admin-panel/` | partial | Mehrere Boards sind reine Platzhalter | `src/pages/app/admin-panel/index.astro`, `public/js/admin-board.js` |
| Vereins-Setup | `/app/vereine/` | live | Operative Abnahme Invite-/Setup-Flows | `src/pages/app/vereine/index.astro`, `public/js/club-admin-setup.js` |

## Interne Werkzeuge

| Modul | Route | Status | Offene Punkte | Hauptdateien |
| --- | --- | --- | --- | --- |
| Component Library | `/app/component-library/` | internal | Laufend pflegen, kein Endnutzer-Modul | `src/pages/app/component-library/index.astro` |
| Template Studio | `/app/template-studio/` | internal | Preview-/Schema-Werkzeug, nicht produktkritisch | `src/pages/app/template-studio/index.astro` |
| UI Demo | `/app/ui-neumorph-demo/` | internal | Demo | `src/pages/app/ui-neumorph-demo/index.astro` |
| Notes | `/app/notes/` | internal | Demo/Arbeitsmittel | `src/pages/app/notes/index.astro` |
| Kontrollboard | `/app/kontrollboard/` | internal | Lokales Steuerboard fuer Audit, Smoke-Tests, Issues und Export | `src/pages/app/kontrollboard/index.astro`, `public/js/control-board.js` |

## Definition of Done pro Modul

Ein Modul gilt erst als `live`, wenn:

- Rollen und RLS sauber geklaert sind
- keine Platzhaltertexte oder Preview-Hinweise mehr sichtbar sind
- kein lokaler Stub anstelle echter Backend-Logik verwendet wird
- Happy Path einmal manuell getestet wurde
- bekannte Restpunkte entweder geschlossen oder bewusst dokumentiert sind
- mindestens ein Workflow-Audit und ein Komponenten-Audit fuer die Hauptmaske vorliegen

## Pflichtpruefung pro Hauptmaske

Fuer jede Hauptmaske brauchen wir kuenftig zwei dokumentierte Sichtweisen:

1. Workflow
- Zweck
- Rollen
- States
- Datenquellen
- RPCs / Edge Functions / Tabellen

2. Komponenten
- Welche sichtbaren Elemente sind verbaut
- Welche davon sind echte Standardkomponenten
- Welche sind nur standardnah
- Welche sind bewusste Spezialkomponenten
- Welche Elemente sind wahrscheinlich Wildwuchs und Rueckbaukandidaten

## Welle 1 Startset

Die erste Audit-Welle dient als Referenz fuer den restlichen Umbau:

- Fangliste
- Arbeitseinsaetze Member
- Mitglieder
- Einstellungen

Erwartetes Ergebnis aus Welle 1:

- pro Maske ein fertiges Workflow-Audit
- pro Maske ein fertiges Komponenten-Audit
- erste belastbare Standard-Matches und Abweichungsmuster
- konkrete Folgeaufgaben fuer Welle 2
