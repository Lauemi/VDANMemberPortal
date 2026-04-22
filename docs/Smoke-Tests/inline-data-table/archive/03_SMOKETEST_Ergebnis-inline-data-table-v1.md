# 03_SMOKETEST_Ergebnis-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: archiviert
Archiviert_am: 2026-04-22
Hinweis: Ursprüngliches Erst-Ergebnis vor Umsetzung laut `05_SMOKETEST_Umsetzung-inline-data-table-v1.md`.

## Ergebnis (Claude einfügen)

---

## Vorklärung: Ist das die richtige Oberfläche?

**Kurze Antwort: Ja — es ist die richtige Komponente. Aber das Kontextmenü hat einen konkreten Positionierungsfehler.**

---

### 1. Ist dort eine Inline-Data-Table-v2?

**Ja, eindeutig bestätigt.**

- Root-Element im DOM: `div.qfp-inline-data-table-root.is-redesign`
- Dateigrundlage: `fcp-inline-data-table-v2.js` (412.151 Zeichen, geladen)
- Feature-Set sichtbar: Spalten-Aktionen, Tabelle/Cards-Umschalter, Hell/Dunkel-Toggle, Suche, Sortierung, Spalten-Verwaltung
- Daten-Attribute: `data-rd-row-action="menu"`, `data-rd-row-id="MID-..."` → das ist die v2-Signatur

---

### 2. Funktioniert das 3-Punkte-Menü?

**Ja und Nein — mit einem klaren Fehler.**

| Aspekt | Ergebnis |
|---|---|
| `⋯` Mehr-Button (Row-Action) vorhanden? | ✅ Ja — erscheint beim Hover rechts in der Zeile |
| Hover-Trigger sichtbar ohne Scrollen? | ❌ **Nein** — Buttons sitzen bei `left: 3268px`, also nur ganz rechts außen erreichbar |
| Klick öffnet Menü? | ⚠️ **Ja, aber falsch positioniert** |
| Menüinhalt korrekt? | ✅ Bearbeiten / Duplizieren / Löschen |
| Menü am Trigger verankert? | ❌ **Nein** — Popover hat `position: static`, rendert am Ende der Seite / unterhalb des Footer-Bereichs |

**Konkreter Fehler:** Das `rd-popover` öffnet sich mit `position: static` im normalen DOM-Flow ganz unten auf der Seite — komplett losgelöst von der Zeile. Es ist sichtbar, aber **nicht lokal am Trigger verankert**.

---

### 3. Funktioniert Rechtsklick-Menü?

**Nein** — Rechtsklick auf eine Zeile öffnet kein App-eigenes Kontextmenü. Nur der Browser-Standard könnte erscheinen.

---

### 4. Funktioniert Inline-Edit?

**Ja — und das ist das Beste an der Komponente.**

- Klick auf Zeile → Edit-Bereich öffnet sich **direkt unter der geklickten Zeile**
- Zeile wird gedimmt, darunter erscheinen Felder (Input, Dropdowns)
- Das Tabellengefühl bleibt erhalten — kein separater Formular-Block
- Speichern/Abbrechen-Buttons vorhanden
- Abbrechen schließt das Edit korrekt

⚠️ **Kleiner Befund**: ESC schließt das Edit nicht. Klick außerhalb schließt es ebenfalls nicht — nur "Abbrechen" Button funktioniert.

---

### 5. Wirkt es wie v2-Komponente oder alt?

**Es ist die v2-Komponente** (`qfp-inline-data-table-root is-redesign`). Die Grundstruktur ist richtig. Aber das **Kontextmenü-Popover hat ein kritisches Positionierungsproblem** — es fehlt das korrekte absolute/fixed Positioning mit Viewport-Berechnung.

---

### Kurzbefund für den vollständigen Smoke-Test

| Test | Status |
|---|---|
| Richtige Komponente? | ✅ v2 bestätigt |
| Inline-Edit funktional? | ✅ Ja, sauber |
| 3-Punkte-Menü erreichbar? | ⚠️ Nur nach manuellem Scroll ganz rechts |
| Kontextmenü korrekt positioniert? | ❌ Kritischer Fehler — rendert außerhalb am Seitenende |
| Rechtsklick-Menü? | ❌ Nicht vorhanden / nicht implementiert |
| ESC / Klick-außen schließt Edit? | ❌ Fehlt |

**→ Richtige Oberfläche: Ja. Aber mindestens 1 kritischer Fehler (Kontextmenü-Positionierung) und 2 weitere Befunde für den vollständigen Smoke-Test.**