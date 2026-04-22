# 05_SMOKETEST_Umsetzung-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: umgesetzt

## Umsetzung (Codex)

### Relevante Commits

- `c9721a9` `fix: address inline table smoke test regressions`
- `5edede4` `refine inline table editor and anchored menus`
- `3ef08a8` `professionalize inline table header context menus`

### Umgesetzt

- Overflow-/Containment-Fehler der produktiven Inline-Data-Table bereinigt, damit die Tabelle im richtigen Container bleibt und nicht mehr die umgebende Seite nach rechts aufbläht.
- Row-Actions und Header-Menüs der produktiven Komponente nachgeschärft, damit Hover-/Menübedienung nicht mehr wie lose Overlay-Reste wirkt.
- Inline-Edit/Inline-Erfassung aus der blockigen Formularwirkung zurück auf das tatsächliche Row-Aufklapp-Prinzip geführt.
- Lokalen Hell/Dunkel-Schalter direkt an der Tabelleninstanz ergänzt, ohne neues globales Theme-System einzuführen.
- Header-Kontextmenü professionalisiert:
  - Header-3-Punkte öffnen lokal verankert am Button.
  - Header-Rechtsklick öffnet jetzt dasselbe Menü statt Direkt-Hide.
  - Menüpositionierung wurde auf Button-/Klickpunkt-Verankerung statt bloßer Viewport-Korrektur geschärft.

### Warum

- Der Smoke-Test zeigte keinen grundlegenden Neubau-Bedarf, sondern konkrete Produktbrüche:
  - fehlerhafte Menü-Verankerung,
  - unprofessionelle Header-/Context-Menü-Interaktion,
  - zu blockige Editor-Darstellung,
  - Layout-/Overflow-Probleme der produktiven Instanz.
- Deshalb wurde keine neue Architektur gebaut, sondern die bestehende produktive Inline-Data-Table direkt vervollständigt.
