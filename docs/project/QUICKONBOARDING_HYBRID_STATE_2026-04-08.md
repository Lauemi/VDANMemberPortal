# QuickOnboarding Hybridstand – 2026-04-08

## Ziel dieses Dokuments

Dieses Dokument beschreibt den aktuell umgesetzten QuickOnboarding-MVP im Repo, trennt sauber zwischen vorhandenem Verhalten und noch nicht deklarativ hochgezogener Struktur und hält die naechste technische Leitplanke fest.

## Ist-Stand

QuickOnboarding ist aktuell als Hybrid umgesetzt:

- Die fachlichen Datenpfade, Panels und Save-/Load-Anbindungen existieren.
- Der reduzierte 3-Schritt-Einstieg wird derzeit im Seitenentry gesteuert.
- Die ADM-Masken-JSON beschreibt den Workspace weiterhin als volle Verwaltungsmaske.

Das bedeutet:

- QuickOnboarding existiert funktional.
- QuickOnboarding existiert noch nicht als vollstaendig nativer ADM-Renderer-Modus.

## Relevante Dateien

- Masken-Definition: [docs/masks/templates/Onboarding/ADM_clubSettings.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/ADM_clubSettings.json)
- Seitenentry: [src/pages/app/mitgliederverwaltung/index.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/app/mitgliederverwaltung/index.astro)
- ADM-Renderer: [public/js/admin-panel-mask.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/admin-panel-mask.js)
- Mask Loader: [public/js/fcp-mask-page-loader.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/fcp-mask-page-loader.js)

## Was bereits live ist

In der Maske sind die fachlich relevanten QuickOnboarding-Bausteine vorhanden:

- Section `club_settings_cards`
  - Panel `club_settings_cards_quick_add`
  - Panel `club_settings_cards_config_table`
- Section `club_settings_work`
  - Panel `club_settings_work_hours_config`
- Section `club_settings_members`
  - Panel `club_settings_members_quick_add`

Zusammen mit den bereits angebundenen Edge Functions und RPCs ergibt das einen funktionierenden QuickOnboarding-MVP fuer:

- Kartenbasis anlegen
- Pflichtstunden konfigurieren
- Mitglieder schnell anlegen

## Was aktuell nicht deklarativ in der Maskenstruktur lebt

Die Masken-JSON beschreibt weiterhin den kompletten Verwaltungsworkspace:

- `workspaceMode: "full_width"`
- linke Navigation ueber alle Sections
- keine native Einschraenkung auf nur drei QuickOnboarding-Sections

Nicht vorhanden als nativer ADM-Mechanismus:

- `visibleInModes`
- ein generischer Section-Filter im Renderer
- ein eingebauter Stepper
- eine eingebaute Resume-Logik auf Renderer-Ebene

## Wo der Modus heute technisch lebt

Der reduzierte QuickOnboarding-Einstieg wird in `src/pages/app/mitgliederverwaltung/index.astro` hergestellt:

- URL-Schalter `?mode=quickonboarding`
- Resume-Aufloesung ueber Onboarding-Snapshot
- Filterung auf die drei QuickOnboarding-Sections
- Aktivierung der zuerst offenen Section

Das ist bewusst keine Parallelmaske, sondern ein reduzierter Einstieg in denselben Workspace.

## Ergebnis der Renderer-Pruefung

`public/js/admin-panel-mask.js` hat aktuell keinen offiziellen eingebauten Mechanismus fuer:

- Section-Sichtbarkeit nach Modus
- Section-Filter anhand von Masken-Metadaten
- mode-basierte Navigationseinschraenkung

Der ADM-Renderer rendert schlicht:

- `config.sections`
- `config.workspaceNav.items`

Wenn ein reduzierter Modus genutzt werden soll, muessen diese Daten vor oder waehrend der Initialisierung passend gefiltert werden.

## Architekturentscheidung fuer den MVP

Die kleinste saubere deklarative Hochziehung ist daher nicht:

- einen neuen Parallelrenderer bauen
- oder willkuerliche neue Renderer-Properties ohne Runtime-Anschluss einzufuehren

Sondern:

- den QuickOnboarding-Modus deklarativ in der Masken-JSON beschreiben
- den bestehenden Seitenentry diese deklarative Konfiguration auswerten lassen

Damit bleibt die Verantwortung sauber verteilt:

- Masken-JSON beschreibt den Modus
- Seitenentry setzt ihn um
- ADM-Renderer bleibt unveraendert, solange kein generischer Modusmechanismus existiert

## Empfohlene naechste Stufe

Wenn QuickOnboarding spaeter rendererweit standardisiert werden soll, sollte der naechste allgemeine Schritt sein:

1. einen offiziellen Section-Filter-Hook im ADM-Renderer oder Loader definieren
2. darauf aufbauend `modes` oder `visibleInModes` repo-weit formal einfuehren
3. erst dann weitere Masken auf diesen Mechanismus umstellen

Bis dahin ist der aktuelle Hybridansatz systemtreu und fuer den MVP die kleinste saubere Loesung.
