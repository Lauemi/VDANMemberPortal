# 01_AGENT_Repo-Analyse-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: aktiv
Projekt: `Lauemi/VDANMemberPortal`
Ziel: Repo-Wahrheit für den Smoke-Test des Inline-Data-Table v2 im Bereich Mitgliederverwaltung ermitteln

---

## 1. SMOKE_TEST_SCOPE

Geprüfte Dateien:

- `docs/smoketestProzessbeschreibung/00_README_SMOKETEST_PROZESS.md`
- `docs/Smoke-Tests/inline-data-table/Smoketest-Anweisung-inline-data-table-v1.md`
- `public/js/fcp-inline-data-table-v2.js`
- `public/js/redesign.js`
- `public/css/redesign.css`
- `public/js/member-registry-admin.js`
- `src/pages/app/mitgliederverwaltung/index.astro`

Prüfumfang:

- Implementierung des Inline-Data-Table v2
- Redesign-/Popover-Abhängigkeit
- konkrete Mitglieder-Registry-Instanz
- Verdrahtung zur Route `app/mitgliederverwaltung`
- Ableitung der Browser-Prüfpunkte für Claude

Nicht geprüft:

- Browser-Verhalten
- Laufzeit- oder DB-Ergebnis außerhalb des Repo-Codes
- UX-Bewertung

---

## 2. IMPLEMENTATION_STATUS

### Inline Data Table v2

**Status:** vorhanden

- **Beobachtung:** Die Komponente ist implementiert als `window.FCPInlineDataTable.createStandardV2`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss eine UI prüfen, in der genau diese Komponente instanziiert ist, nicht nur eine allgemeine Tabellenansicht.

### Einbau in Mitgliederkontext

**Status:** vorhanden, aber nicht direkt an die Route `/app/mitgliederverwaltung/` belegbar

- **Beobachtung:** `member-registry-admin.js` instanziiert eine Mitglieder-Tabelle über `window.FCPInlineDataTable.createStandardV2({...})`.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Diese Datei ist die belastbare Repo-Quelle für die konkrete Mitglieder-Registry-v2.

- **Beobachtung:** `src/pages/app/mitgliederverwaltung/index.astro` lädt `fcp-inline-data-table-v2.js`, bootet die Seite aber über ADM-/Mask-Loader und nicht direkt über `member-registry-admin.js`.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Relevanz für Smoke-Test:** Die Route `/app/mitgliederverwaltung/` ist als Testeinstieg nur dann korrekt, wenn dort zur Laufzeit die Mitglieder-Registry-v2 tatsächlich sichtbar verwendet wird. Das ist aus dem Repo allein nicht direkt belegt.

### Parallelstruktur

**Status:** vorhanden

- **Beobachtung:** In `index.astro` werden sowohl `fcp-data-table.js` als auch `fcp-inline-data-table-v2.js` geladen.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Relevanz für Smoke-Test:** Claude muss prüfen, welche Tabellenlogik im realen Screen aktiv ist.

---

## 3. REPO_WAHRHEIT

### A. Einbau

#### A1. Komponenten-Einstieg

- **Beobachtung:** Der Einstiegspunkt der Komponente ist `createStandardV2(config = {})`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Alle prüfbaren Funktionen hängen an der Instanz dieser Factory.

#### A2. Konkrete Mitglieder-Instanz

- **Beobachtung:** `renderMembersInlineTable()` mountet `#memberRegistryInlineTableRoot` und ruft `window.FCPInlineDataTable.createStandardV2({...})` auf.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Das ist der repo-wahre Zielkontext für den Mitglieder-Table v2.

#### A3. Route `/app/mitgliederverwaltung/`

- **Beobachtung:** Die Route rendert `#clubSettingsAdmRoot` und bootet mit `window.FcpMaskPageLoader.boot(...)`.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Relevanz für Smoke-Test:** Die Route ist ADM-/Mask-getrieben. Ein direkter Nachweis, dass dort `member-registry-admin.js` die Mitglieder-Registry-v2 rendert, liegt in dieser Datei nicht vor.

#### A4. ADM-/Mask-Abhängigkeit

- **Beobachtung:** Die Route lädt `fcp-adm-qfm-contract-hub.js`, `fcp-mask-data-resolver.js`, `domain-adapter-vereinsverwaltung.js`, `vereinsverwaltung-adm.js`, `admin-panel-mask.js`, `fcp-mask-page-loader.js`.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Relevanz für Smoke-Test:** Der reale UI-Einstieg ist abhängig von ADM-/Mask-Verdrahtung, nicht nur von der Table-Komponente.

---

### B. Funktionen

#### B1. Kontextmenü Zeile

- **Beobachtung:** Rechtsklick auf `data-row-id` öffnet `window.RdPopover.openRowContextMenu(...)`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss Rechtsklick auf Zeile prüfen.

- **Beobachtung:** Klick auf `data-rd-row-action="menu"` öffnet `window.RdPopover.openRowMenu(...)`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss das Zeilen-`⋯` prüfen.

#### B2. Kontextmenü Spalte

- **Beobachtung:** Klick auf `data-col-menu-key` öffnet `window.RdPopover.openColumnMenu(...)`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss Header-`⋯` prüfen.

- **Beobachtung:** Header-Rechtsklick öffnet `openColumnMenuAtPoint(...)`; ohne Redesign wird stattdessen die Spalte direkt verborgen.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss den Unterschied zwischen Redesign an/aus berücksichtigen.

#### B3. Popover-Positionierung

- **Beobachtung:** Popover werden über `positionPopover(...)` bzw. `positionPopoverAtPoint(...)` relativ zum Anchor oder zum Cursor berechnet.
- **Datei:** `public/js/redesign.js`
- **Relevanz für Smoke-Test:** Claude muss Menüposition bei Randlage, Scroll und Cursoröffnung prüfen.

#### B4. Inline-Edit

- **Beobachtung:** Edit-Zeilen werden über `editorRowHtml("edit", ...)` unterhalb der aktiven Zeile gerendert.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss prüfen, dass Edit unter der richtigen Zeile erscheint.

- **Beobachtung:** In der Mitglieder-Registry ist `rowClickOpensEditor: false` gesetzt.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Claude darf nicht erwarten, dass normaler Row-Click Edit öffnet.

#### B5. Inline-Create

- **Beobachtung:** Create-Zeilen werden über `openCreateRow()` und `editorRowHtml("create", ...)` erzeugt.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss Inline-Create statt Dialog-Create prüfen, sofern die Instanz diese Konfiguration nutzt.

- **Beobachtung:** Die Mitglieder-Registry aktiviert Create über `showCreateButton: true` und `onCreateSubmit`.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Claude muss Save/Cancel und Re-Render nach Anlegen prüfen.

#### B6. Sortierung

- **Beobachtung:** Sortierung wird über `state.sortKey`, `state.sortDir`, Header-Buttons und Spaltenmenü verwaltet.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss Header-Sort und Menü-Sort getrennt prüfen.

#### B7. Suche / Filter

- **Beobachtung:** Globale Suche läuft über `state.search`; Filter laufen über `filterFields`; Redesign-Inline-Filter laufen über `state.rdInlineFilters`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss globale Suche und Filterzeile separat prüfen.

- **Beobachtung:** Die Mitglieder-Registry definiert Filter für `status`, `club_code`, `role`, `login_dot`.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Diese vier Filter sind der repo-wahre Prüfbereich im Mitgliederkontext.

#### B8. Row-Actions

- **Beobachtung:** Zulässige Actions sind `edit`, `duplicate`, `delete`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss alle drei Actions prüfen, soweit sie im UI sichtbar sind.

- **Beobachtung:** Die Mitglieder-Registry verdrahtet `onEditSubmit`, `onDelete`, `onDuplicate`.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Diese Aktionen sind funktional an Backend-Aufrufe gekoppelt.

#### B9. Card-View / View-Switch

- **Beobachtung:** Die Komponente unterstützt `table` und `cards`; Umschaltung erfolgt über `data-view-mode`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss prüfen, ob die Mitgliederinstanz den Switch real anbietet und ob Actions/Edit in beiden Modi arbeiten.

#### B10. Drag / Resize / Layout

- **Beobachtung:** Spaltenverschiebung läuft über `dragstart` / `drop`; Breitenänderung über `mousedown` auf `data-resize-key`; Persistenz über `localStorage`.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Claude muss Drag, Resize und Verhalten nach Re-Render oder Reload prüfen.

#### B11. Sonderfall `role_only`

- **Beobachtung:** Zeilen mit `row_kind === "role_only"` sind für Edit/Delete/Duplicate eingeschränkt.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Claude muss diese Zeilen getrennt von normalen Mitgliedszeilen bewerten.

---

### C. UI / CSS

#### C1. Redesign-Layer

- **Beobachtung:** `redesign.css` ist der Override-Layer für `.is-redesign`.
- **Datei:** `public/css/redesign.css`
- **Relevanz für Smoke-Test:** Alle Menü-, Hover- und Editor-Prüfungen müssen den Redesign-Zustand berücksichtigen.

#### C2. Kontextmenü-Styling

- **Beobachtung:** `.rd-popover` ist `position: fixed` mit `z-index: 120`.
- **Datei:** `public/css/redesign.css`
- **Relevanz für Smoke-Test:** Claude muss Popover auf Clipping, Stapelung und Position bei Scroll prüfen.

#### C3. Row-Actions-Styling

- **Beobachtung:** `.rd-row-actions` ist `position: absolute`, rechts an der Zeile ausgerichtet und nur bei Hover sichtbar.
- **Datei:** `public/css/redesign.css`
- **Relevanz für Smoke-Test:** Claude muss prüfen, ob Hover-Actions Clicks oder Edit-Zeilen überlagern.

#### C4. Header / Filter Sticky

- **Beobachtung:** `.data-table__head` ist sticky; `.rd-filter-row` ist sticky.
- **Datei:** `public/css/redesign.css`
- **Relevanz für Smoke-Test:** Claude muss prüfen, wie sich Menüs und Filter im Scrollkontext verhalten.

#### C5. Scroll-Container

- **Beobachtung:** `.data-table-wrap` ist der horizontale Scroll-Container mit `overflow-x: auto`.
- **Datei:** `public/css/redesign.css`
- **Relevanz für Smoke-Test:** Claude muss horizontales Scrollen zusammen mit Popover und Hover-Actions prüfen.

#### C6. Inline-Edit-Styling

- **Beobachtung:** `.data-table__row--editor`, `.data-table__editor-cell`, `.data-table__editor-cell--actions` definieren die Inline-Edit-Darstellung.
- **Datei:** `public/css/redesign.css`
- **Relevanz für Smoke-Test:** Claude muss prüfen, ob Edit-Zeilen vollständig sichtbar und bedienbar bleiben.

---

### D. Verdrahtung

#### D1. Backend-Anbindung Mitglieder

- **Beobachtung:** Lesen erfolgt über `/rest/v1/rpc/admin_member_registry`.
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Claude prüft nicht nur Frontend-Rendern, sondern ein datengetriebenes Grid.

- **Beobachtung:** Schreiben erfolgt über:
  - `/rest/v1/rpc/admin_member_registry_create`
  - `/rest/v1/rpc/admin_member_registry_update`
  - `/rest/v1/rpc/admin_member_registry_delete`
- **Datei:** `public/js/member-registry-admin.js`
- **Relevanz für Smoke-Test:** Create/Edit/Delete sind reale Write-Pfade und müssen entsprechend beobachtet werden.

#### D2. Redesign-Abhängigkeit

- **Beobachtung:** `fcp-inline-data-table-v2.js` ruft `window.RdPopover` auf.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Ohne `redesign.js` ist das Popover-Verhalten nicht vollständig vorhanden.

- **Beobachtung:** `redesign.js` stellt `window.RdPopover` und `window.toggleRedesign` bereit.
- **Datei:** `public/js/redesign.js`
- **Relevanz für Smoke-Test:** Claude muss Redesign-Zustand und Popover-Verhalten zusammen prüfen.

#### D3. Contract-Hub-Abhängigkeit

- **Beobachtung:** `fcp-inline-data-table-v2.js` liest `window.FcpAdmQfmContractHub.field` und nutzt Feldrenderer/-normalisierung.
- **Datei:** `public/js/fcp-inline-data-table-v2.js`
- **Relevanz für Smoke-Test:** Feld-Rendering und Editor-Control können von Contract-Hub-Implementierung abhängen.

#### D4. ADM-/Mask-Verdrahtung der Route

- **Beobachtung:** `index.astro` bootet die Seite über `window.FcpMaskPageLoader.boot(...)` mit ADM-Konfiguration.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Relevanz für Smoke-Test:** Claude muss prüfen, ob die reale UI auf dieser Route tatsächlich die Mitglieder-Registry-v2 zeigt oder nur ADM-/Mask-Flächen.

---

## 4. SMOKE_TEST_RELEVANTE_PUNKTE

1. **Aktive Tabellenlogik feststellen**
   - Prüfen, ob die sichtbare Mitglieder-Tabelle im Browser aus `fcp-inline-data-table-v2.js` stammt.

2. **Zeilen-`⋯` prüfen**
   - Öffnet `openRowMenu(...)` sichtbar und vollständig.

3. **Rechtsklick auf Zeile prüfen**
   - Öffnet `openRowContextMenu(...)` an Cursorposition.

4. **Header-`⋯` prüfen**
   - Sort Asc / Desc
   - Hide Column
   - Reset Width

5. **Header-Rechtsklick prüfen**
   - Im Redesign Spaltenmenü am Cursor
   - ohne Redesign abweichendes Verhalten

6. **Inline-Edit prüfen**
   - Öffnung unter der Zielzeile
   - Save / Cancel
   - keine Überlagerung durch `.rd-row-actions`

7. **Inline-Create prüfen**
   - Öffnung der Create-Zeile
   - Save / Cancel
   - Re-Render nach Submit

8. **Filter prüfen**
   - globale Suche
   - `status`
   - `club_code`
   - `role`
   - `login_dot`
   - ggf. Redesign-Inline-Filter

9. **Sortierung prüfen**
   - Header-Sort
   - Menü-Sort

10. **Card-View prüfen**
    - Umschaltung `table/cards`
    - Actions/Edit im Card-View

11. **Column Toggle / Hidden Columns prüfen**
    - Ausblenden / Einblenden
    - stabiles Grid

12. **Drag / Resize prüfen**
    - Reihenfolge ändern
    - Breite ändern
    - Verhalten nach erneutem Rendern

13. **Scroll / Sticky / Overlay prüfen**
    - sticky Header
    - sticky Filterzeile
    - horizontales Scrollen
    - Popover-Stabilität

14. **Sonderfall `role_only` prüfen**
    - eingeschränkte Aktionen korrekt

---

## 5. RISIKEN

### R1. Parallel geladene Tabellenlogik

- **Beobachtung:** `fcp-data-table.js` und `fcp-inline-data-table-v2.js` werden parallel geladen.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Folge für Smoke-Test:** Claude muss zuerst feststellen, welche Implementierung sichtbar aktiv ist.

### R2. Route ist ADM-/Mask-getrieben

- **Beobachtung:** Die Route `/app/mitgliederverwaltung/` bootet über ADM-/Mask-Loader.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Folge für Smoke-Test:** Die Route ist nicht automatisch gleichbedeutend mit der Mitglieder-Registry-v2.

### R3. Zustandslogik verteilt

- **Beobachtung:** `member-registry-admin.js` enthält zusätzlich eigene Registry-/ACL-/Club-/Workspace-Logik neben der Table-Komponente.
- **Datei:** `public/js/member-registry-admin.js`
- **Folge für Smoke-Test:** Fehlerbilder können aus Seitenlogik oder aus der Table-Komponente stammen; Claude muss das trennen.

### R4. Overlay-/Positionierungsrisiko

- **Beobachtung:** Kombination aus `.rd-row-actions { position:absolute; }`, `.rd-popover { position:fixed; }`, sticky Header/Filter und horizontalem Scrollcontainer.
- **Datei:** `public/css/redesign.css`
- **Folge für Smoke-Test:** Claude muss Positionierung, Überlagerung und Clipping explizit prüfen.

### R5. Redesign-Abhängigkeit

- **Beobachtung:** Kontextmenüs hängen funktional an `window.RdPopover`.
- **Dateien:** `public/js/fcp-inline-data-table-v2.js`, `public/js/redesign.js`
- **Folge für Smoke-Test:** Menüs sind abhängig von geladener und aktiver Redesign-/Popover-Schicht.

### R6. Offener UI-Einstieg

- **Beobachtung:** Die konkrete UI-Route, in der `member-registry-admin.js` im Live-Screen gerendert wird, ist aus den geprüften Dateien nicht direkt belegt.
- **Dateien:** `public/js/member-registry-admin.js`, `src/pages/app/mitgliederverwaltung/index.astro`
- **Folge für Smoke-Test:** Der Testeinstieg ist als offene Eintrittsfrage zu behandeln, bis die reale UI-Zuordnung im laufenden System bestätigt ist.

---

## 6. NÄCHSTER SCHRITT

1. Den Browser-Smoke-Test auf die **repo-wahre Mitglieder-Registry-v2** zuschneiden, nicht auf allgemeine Tabellen- oder ADM-Flächen.

2. Vor Testbeginn den **konkreten UI-Einstieg** bestätigen, in dem `member-registry-admin.js` tatsächlich die v2-Tabelle rendert.

3. Die Claude-Smoke-Test-Datei an den Punkten **Kontextmenü, Inline-Edit, Inline-Create, Filter, Sort, Card-View, Drag/Resize, Scroll/Overlay und `role_only`** präzisieren.

---

## 7. KONKRETER TESTEINSTIEG FÜR CLAUDE

### Repo-wahre Antwort

#### 1. Welche konkrete Route Claude öffnen soll

**Repo-wahr nicht eindeutig belegbar.**

- **Beobachtung:** `public/js/member-registry-admin.js` enthält die konkrete Mitglieder-Registry-v2.
- **Datei:** `public/js/member-registry-admin.js`
- **Eintrittsrelevanz:** Diese Datei belegt die Ziel-UI fachlich, aber nicht die konkrete Route.

#### 2. Ist `/app/mitgliederverwaltung/` aktuell der richtige reale Testeinstieg?

**Nicht eindeutig belegbar.**

- **Beobachtung:** `src/pages/app/mitgliederverwaltung/index.astro` lädt `fcp-inline-data-table-v2.js`, bootet aber über ADM-/Mask-Loader und referenziert nicht direkt `member-registry-admin.js`.
- **Datei:** `src/pages/app/mitgliederverwaltung/index.astro`
- **Schluss:** Aus dem Repo allein ist nicht beweisbar, dass `/app/mitgliederverwaltung/` die Mitglieder-Registry-v2 als reale Testoberfläche zeigt.

#### 3. Falls nein: welcher Einstieg stattdessen?

**Repo-wahr offen.**

- **Beobachtung:** Die belastbare Implementierung der Mitglieder-Registry-v2 liegt in `public/js/member-registry-admin.js`.
- **Datei:** `public/js/member-registry-admin.js`
- **Schluss:** Claude muss die UI öffnen, in der diese Datei tatsächlich aktiv ist. Die genaue Route oder Menüführung ist aus den geprüften Dateien nicht eindeutig ableitbar.

#### 4. Ergebnis für die Smoke-Test-Vorbereitung

**Offene Eintrittsfrage.**

Claude darf `/app/mitgliederverwaltung/` nicht ungeprüft als finalen Testeinstieg annehmen.

Vor dem eigentlichen Smoke-Test ist zuerst festzustellen:

- ob diese Route die Mitglieder-Registry-v2 real enthält,
- oder ob ein anderer UI-Einstieg innerhalb der Vereins-/Mitgliederverwaltung die durch `member-registry-admin.js` gerenderte Tabelle zeigt.
