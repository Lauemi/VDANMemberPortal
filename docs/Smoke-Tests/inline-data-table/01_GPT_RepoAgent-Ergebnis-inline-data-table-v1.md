# 01_GPT_RepoAgent-Ergebnis-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: aktiv
Projekt: `Lauemi/VDANMemberPortal`
Bereich: `Inline-Data-Table v2 / Mitgliederverwaltung`

---

## 1. SMOKE_TEST_SCOPE

Geprüft wurde repo-wahr der Smoke-Test-Kontext für den **Inline-Data-Table im Bereich Mitgliederverwaltung**.

Primärquellen:

- `docs/smoketestProzessbeschreibung/00_README_SMOKETEST_PROZESS.md`
- `docs/Smoke-Tests/inline-data-table/Smoketest-Anweisung-inline-data-table-v1.md`
- `public/js/fcp-inline-data-table-v2.js`
- `public/js/redesign.js`
- `public/css/redesign.css`
- `public/js/member-registry-admin.js`
- `src/pages/app/mitgliederverwaltung/index.astro`

Repo-wahre Prozesskalibrierung:

- Der Smoke-Test-Prozess verlangt zuerst die repo-wahre Voranalyse durch den Repo-Agenten.
- Danach folgt die Browser-Ausführung durch Claude.
- Danach Ergebnisablage und Ableitung.

Ziel dieser Dateiprüfung war ausschließlich:

- Was existiert im Repo wirklich?
- Wie ist der Inline-Data-Table v2 real eingebaut?
- Welche Funktionen sind laut Code tatsächlich vorhanden?
- Was muss Claude im Browser konkret prüfen?

Kein Browser-Test wurde durchgeführt.
Keine Architektur wurde neu entworfen.

---

## 2. IMPLEMENTATION_STATUS

### Inline Data Table

**Status:** vorhanden

Repo-wahr vorhanden ist eine eigenständige Komponente in:

- `public/js/fcp-inline-data-table-v2.js`

Dort wird exportiert:

- `window.FCPInlineDataTable.createStandardV2`

### Einbau

**Status:** fragmentiert / indirekt

Repo-wahr ergibt sich folgendes Bild:

1. Die Komponente `fcp-inline-data-table-v2.js` existiert real.
2. In `public/js/member-registry-admin.js` gibt es eine echte Instanziierung für eine Mitglieder-Registry.
3. Die Route `src/pages/app/mitgliederverwaltung/index.astro` ist jedoch nicht nur eine direkte Table-Seite, sondern ADM-/Mask-getrieben.
4. Zusätzlich wird dort parallel auch `fcp-data-table.js` geladen.

Daraus folgt repo-wahr:

- Der Inline-Data-Table v2 ist vorhanden.
- Die reale Einbindung für Mitglieder ist vorhanden.
- Der Einbau ist aber nicht als reine Einzelstruktur, sondern in einem größeren ADM-/Mask-/Domain-Kontext eingebettet.
- Parallelstrukturen alt/v2 sind nicht auszuschließen, sondern im Repo belegt.

---

## 3. REPO_WAHRHEIT

### A. Einbau

#### 1. Reale Komponente vorhanden

In `public/js/fcp-inline-data-table-v2.js` ist der Inline-Data-Table v2 als eigenständige Komponente implementiert.

Repo-wahr belegt:

- Komponentenname: `FCP Inline Data Table v2`
- Einstieg: `createStandardV2(config = {})`
- Export: `window.FCPInlineDataTable = { createStandardV2 }`

#### 2. Reale Mitglieder-Instanz in `member-registry-admin.js`

In `public/js/member-registry-admin.js` wird die Komponente in `renderMembersInlineTable()` instanziiert.

Repo-wahr belegt:

- Mountpoint: `#memberRegistryInlineTableRoot`
- Aufruf: `window.FCPInlineDataTable.createStandardV2({...})`
- Table-ID: `member-registry-inline`
- Titel: `Mitglieder`
- Beschreibung: `Registry-Ansicht mit Suche, Filtern und Stammdatenpflege.`

#### 3. Route `app/mitgliederverwaltung` ist ADM-/Mask-getrieben

In `src/pages/app/mitgliederverwaltung/index.astro` wird nicht direkt `member-registry-admin.js` gebootet, sondern ein ADM-/Mask-System.

Repo-wahr belegt:

- JSON-Maskenquelle: `docs/masks/templates/Onboarding/ADM_clubSettings.json`
- Boot über: `window.FcpMaskPageLoader.boot(...)`
- zusätzliche Scripte:
  - `fcp-mask-process-state.js`
  - `fcp-adm-qfm-contract-hub.js`
  - `fcp-mask-data-resolver.js`
  - `fcp-data-table.js`
  - `fcp-inline-data-table-v2.js`
  - `fcp-adm-qfm-shared-renderers.js`
  - `fcp-table-dialog-host.js`
  - `domain-adapter-vereinsverwaltung.js`
  - `vereinsverwaltung-adm.js`
  - `admin-panel-mask.js`
  - `fcp-mask-page-loader.js`
  - `redesign.js`

#### 4. Parallelstruktur alt vs. v2 ist repo-wahr möglich

In `src/pages/app/mitgliederverwaltung/index.astro` werden sowohl geladen:

- `fcp-data-table.js`
- `fcp-inline-data-table-v2.js`

Das ist ein realer Hinweis auf parallele Tabellenlogik bzw. Übergangs-/Koexistenzstruktur.

---

### B. Funktionen

Nur repo-wahr belegte Funktionen:

#### 1. Kontextmenü

Vorhanden.

Repo-wahr belegt:

- Rechtsklick auf Zeile öffnet im Redesign-Modus ein Row-Context-Menü.
- `window.RdPopover.openRowContextMenu(...)`
- Klick auf `⋯` in der Zeile öffnet Row-Menü.
- `window.RdPopover.openRowMenu(...)`
- Klick auf `⋯` im Header öffnet Spaltenmenü.
- `window.RdPopover.openColumnMenu(...)`
- Header-Rechtsklick öffnet in Redesign ein Spaltenmenü am Cursor.
- Ohne Redesign blendet Header-Rechtsklick direkt die Spalte aus.

#### 2. Inline-Edit

Vorhanden.

Repo-wahr belegt:

- Edit-Zeile wird unterhalb der Tabellenzeile gerendert.
- Funktion: `editorRowHtml("edit", ...)`
- Zustand über `state.openEditorRowId`
- Öffnung per Row-Action `edit` oder optional Row-Click.

Mitglieder-spezifisch repo-wahr:

- In `member-registry-admin.js` ist `rowClickOpensEditor: false` gesetzt.
- Damit soll Edit in dieser Integration nicht blind über normalen Row-Click aufgehen.

#### 3. Create-Row / Inline-Create

Vorhanden.

Repo-wahr belegt:

- Funktion `openCreateRow()`
- Create-Editor über `editorRowHtml("create", ...)`
- Zustand über `state.createOpen`
- Submit/Cancel vorhanden

Mitglieder-spezifisch repo-wahr:

- `showCreateButton: true`
- `createLabel: "＋ Neuer Eintrag"`
- `onCreateSubmit` verdrahtet

#### 4. Sortierung

Vorhanden.

Repo-wahr belegt:

- Sortierung per Header-Schaltfläche `data-sort-key`
- Zustand über `state.sortKey` und `state.sortDir`
- Spaltenmenü bietet `sortAsc` und `sortDesc`
- Persistenz via `localStorage`

#### 5. Suche / Filter

Vorhanden.

Repo-wahr belegt:

- globale Suche über Search-Input
- klassische Filter über `filterFields`
- zusätzliche Redesign-Inline-Filter über `state.rdInlineFilters`

Mitglieder-spezifisch repo-wahr:

- Filter für `status`
- Filter für `club_code`
- Filter für `role`
- Filter für `login_dot`

#### 6. Row-Actions

Vorhanden.

Repo-wahr belegt:

- erlaubte Actions: `edit`, `duplicate`, `delete`
- Buttons werden real gerendert
- in Redesign zusätzlich Hover-Overlay `rd-row-actions`

Mitglieder-spezifisch repo-wahr:

- `onEditSubmit`
- `onDelete`
- `onDuplicate`
- Sonderfall `row_kind === "role_only"` mit Sperren für bestimmte Aktionen

#### 7. Card-View / View-Switch

Vorhanden.

Repo-wahr belegt:

- View-Modes `table` und `cards`
- Toggle vorhanden
- responsive Umschaltung unterstützt

Mitglieder-spezifisch repo-wahr:

- `showViewSwitch: true`

#### 8. Event-Handling

Vorhanden.

Repo-wahr belegt:

- `input`
- `change`
- `click`
- `dragstart`
- `dragover`
- `drop`
- `dragend`
- `contextmenu`
- `mousedown`
- globale `pointerdown`- und `keydown`-Listener

Wichtige repo-wahre Eventlogik:

- `stopPropagation()` wird an kritischen Stellen verwendet
- interaktive Elemente werden gegen Row-Click abgegrenzt
- Escape schließt Floating-UI / Popover
- Außenklick schließt Utility-/Toggle-Oberflächen

#### 9. Zustand / Selection

Vorhanden.

Repo-wahr belegt:

- `createOpen`
- `openUtilityMenuKey`
- `openEditorRowId`
- `draftCreate`
- `draftEdit`
- `viewMode`
- `sortKey`
- `sortDir`
- `columnOrder`
- `columnWidths`
- `hiddenColumns`
- `columnTogglePanelOpen`
- `feedback`
- `rdFiltersOpen`
- `rdInlineFilters`
- visuelle Markierung selektierter Zeilen über `is-selected`

#### 10. Weitere belegte Funktionen

Vorhanden.

Repo-wahr belegt:

- Spaltenreihenfolge per Drag & Drop
- Spaltenbreitenänderung per Resizer
- Column Toggle / Hidden Columns
- Layout-Persistenz über `localStorage`
- Utility-Actions in der Toolbar
- Theme-Toggle `Hell / Dunkel`

---

### C. UI / CSS

#### 1. Zuständige CSS-Datei

Für den Redesign-Modus ist `public/css/redesign.css` die zentrale Darstellungsdatei.

Repo-wahr belegt:

- Die Datei ist ein Override-Layer für `.is-redesign`
- Die Hauptdarstellung wird dort mit höherer Spezifität überschrieben

#### 2. Harte Farben vs. Theme-Variablen

Repo-wahr belegt:

- Das Redesign arbeitet überwiegend mit CSS-Variablen
- Beispiele:
  - `--rd-bg`
  - `--rd-surface`
  - `--rd-line`
  - `--rd-ink`
  - `--rd-gold`
  - `--rd-danger`
- Es existieren Light-/Dark-Varianten

#### 3. Kontextmenü-spezifische Styles

Vorhanden.

Repo-wahr belegt:

- `.rd-popover`
- `.rd-popover button`
- `.rd-popover-hint`

#### 4. Inline-Edit-spezifische Styles

Vorhanden.

Repo-wahr belegt:

- `.data-table__row--editor`
- `.data-table__editor-cell`
- `.data-table__editor-cell--actions`
- `.editor-actions`
- Fokus-/Input-Styling für Inline-Editoren

#### 5. Kontext-/Hover-Actions-Styling

Vorhanden.

Repo-wahr belegt:

- `.rd-row-actions`
- Hover-Einblendung der schwebenden Row-Actions
- separate Stylinglogik für Header-Buttons und Column-Menü-Buttons

#### 6. Bekannte repo-wahre Konfliktstellen

Als echte UI-Risikozonen im Code erkennbar:

- `.rd-row-actions` ist `position: absolute`
- `.rd-popover` ist `position: fixed`
- `.data-table__head` ist sticky
- `.rd-filter-row` ist sticky
- `.data-table-wrap` ist horizontaler Scroll-Container

Diese Kombination ist browserseitig testkritisch für:

- Positionierung
- Overlay-Verhalten
- Scroll-Verhalten
- Z-Index / Clipping

---

### D. Verdrahtung

#### 1. Datenherkunft

Die Mitgliederdaten kommen repo-wahr nicht statisch, sondern aus Backend-Aufrufen.

Belegt in `member-registry-admin.js`:

- `loadRows()` -> `/rest/v1/rpc/admin_member_registry`
- `createMemberInline()` -> `/rest/v1/rpc/admin_member_registry_create`
- `updateMemberInline()` -> `/rest/v1/rpc/admin_member_registry_update`
- `deleteMemberInline()` -> `/rest/v1/rpc/admin_member_registry_delete`

#### 2. Reale Verdrahtung der Mitglieder-Registry an v2

Repo-wahr belegt:

- `renderMembersInlineTable()` baut die v2-Tabelle
- `memberInlineColumns()` definiert reale Spalten
- `getCreateDefaults()` definiert reale Create-Defaults
- `onCreateSubmit`, `onEditSubmit`, `onDelete`, `onDuplicate` sind verdrahtet
- `onSortChange` schreibt Sortzustand zurück

#### 3. Redesign-Abhängigkeit

Repo-wahr belegt:

- `fcp-inline-data-table-v2.js` verwendet `window.RdPopover`
- `redesign.js` liefert diese Popover-API
- `toggleRedesign()` schaltet Redesign über `root._fcpApi.setRedesign(...)`

#### 4. Contract-Hub-Abhängigkeit

Repo-wahr belegt:

- `fcp-inline-data-table-v2.js` liest `window.FcpAdmQfmContractHub`
- insbesondere `fieldContracts`
- verwendet:
  - `formatFieldDisplayValue`
  - `normalizeColumnField`
  - `renderFieldControlHtml`

#### 5. ADM / Mask / Domain Adapter Abhängigkeit

Repo-wahr belegt in `src/pages/app/mitgliederverwaltung/index.astro`:

- ADM-Kontext über Masken-JSON
- Domain Adapter vorhanden
- Mask Page Loader vorhanden
- Seite ist nicht nur simple Inline-Table-Route

---

## 4. SMOKE_TEST_RELEVANTE_PUNKTE

Claude muss im Browser mindestens diese repo-wahren Punkte prüfen:

### 1. Reale aktive Instanz

- Ob im Mitgliederverwaltungs-Kontext tatsächlich die v2-Komponente sichtbar aktiv läuft
- Nicht nur Script-Ladung, sondern echte Instanziierung im UI

### 2. Zeilen-Kontextmenü

- Klick auf `⋯` an der Zeile öffnet Menü
- Menü sitzt lokal und nachvollziehbar
- Menü schließt per Außenklick / Escape
- Duplicate/Delete/Edit sind klickbar

### 3. Rechtsklick-Kontextmenü

- Rechtsklick auf Tabellenzeile öffnet echtes Row-Context-Menü
- Menü erscheint an Cursorposition
- Menü bleibt benutzbar

### 4. Spalten-Menü

- Klick auf Header-`⋯`
- Sort Asc / Desc
- Hide Column
- Reset Width

### 5. Inline-Edit

- Edit öffnet sich unter der richtigen Zeile
- Inputs sind sauber fokussierbar
- Save / Cancel funktionieren
- Keine Fehltrigger durch Row-Click oder Hover-Actions

### 6. Inline-Create

- Create-Zeile öffnet korrekt
- Save / Cancel funktionieren
- Nach Save wird Zustand sauber zurückgesetzt

### 7. Suche / Filter

- globale Suche
- Status-Filter
- Club-Filter
- Rollen-Filter
- Login-Filter
- falls aktiv: Inline-Spaltenfilter des Redesigns

### 8. Sortierung

- Sort via Header
- Sort via Spaltenmenü
- sichtbares Umschalten der Richtung

### 9. Row-Actions vs. Eventgrenzen

- Klick auf Action triggert nicht zusätzlich falschen Row-Click
- `stopPropagation` wirkt im Browser real korrekt

### 10. Card-View / View-Switch

- Umschaltung Tabelle / Cards
- Verhalten der Actions/Edit im Card-View

### 11. Column Toggle / Hidden Columns

- Spalten ausblenden
- Spalten wieder einblenden
- Grid bleibt stabil

### 12. Drag & Resize

- Spalten verschieben
- Spaltenbreiten ändern
- Verhalten nach Reload / Re-Render

### 13. Overlay / Sticky / Scroll

- Header sticky
- Filterzeile sticky
- Popover bei Scroll stabil
- kein Clipping im horizontalen Scrollcontainer
- Hover-Actions kollidieren nicht mit Edit-Zeile

### 14. Sonderfall `role_only`

- Zeilen ohne Mitgliedssatz verhalten sich korrekt
- Edit/Delete/Duplicate-Sperren greifen sichtbar korrekt

---

## 5. RISIKEN

Nur echte repo-wahre Risiken:

### 1. Parallelstruktur alt / v2

Repo-wahr vorhanden:

- `fcp-data-table.js`
- `fcp-inline-data-table-v2.js`

beide in derselben Route geladen.

Risiko:

- unklare aktive Tabellenlogik im realen Screen
- möglicher Mischbetrieb oder Übergangsstand

### 2. Mitgliederverwaltung nicht rein table-direkt

Die Route `app/mitgliederverwaltung` ist ADM-/Mask-getrieben.

Risiko:

- Browser-Smoke-Test muss den realen UI-Einstieg korrekt treffen
- sonst wird evtl. nicht die tatsächliche v2-Instanz geprüft

### 3. Doppelte Zuständigkeiten

`member-registry-admin.js` enthält weiterhin umfangreiche eigene Logik für:

- Filter
n- Paging
- Dialoge
- ACL
- Club-Kontext
- Workspace-Handling

zusätzlich zur Table-v2.

Risiko:

- Zustands- und Integrationskonflikte zwischen Seitenlogik und Komponentenlogik

### 4. Overlay-/Positionierungsrisiko

Durch repo-wahre Kombination aus:

- `position: absolute` bei `rd-row-actions`
- `position: fixed` bei `rd-popover`
- sticky Header
- sticky Filterzeile
- horizontalem Scrollcontainer

Risiko:

- falsche Menüposition
- abgeschnittene Overlays
- Hover-/Click-Konflikte

### 5. Redesign-Abhängigkeit

Kontextmenü-Verhalten ist real an `window.RdPopover` gekoppelt.

Risiko:

- anderes Verhalten je nach aktivem Redesign-Zustand
- Smoke-Test muss diesen Zustand bewusst beobachten

### 6. Sonderfall `role_only`

Es gibt im Repo Zeilen ohne vollwertigen Mitgliedssatz.

Risiko:

- scheinbare Fehlfunktion bei Edit/Delete/Duplicate, obwohl repo-wahr bewusst gesperrt

---

## 6. NÄCHSTER SCHRITT

1. Claude muss den Browser-Smoke-Test **gezielt auf die reale Mitglieder-Registry-v2** ausführen, nicht allgemein auf irgendeine Tabelle.

2. Vor dem Browser-Smoke-Test muss der **konkrete UI-Einstieg** bestätigt werden, der im laufenden System tatsächlich die Mitglieder-Registry-v2 zeigt.

3. Der Browser-Test muss den Fokus auf **Kontextmenü, Inline-Edit, Create, Filter/Sort, Card-View sowie Overlay-/Scroll-Verhalten** legen.
