# 11_CLAUDE_Cowork_Nachtest-inline-data-table-v1 – ERGEBNIS

**Tester:** Claude (Cowork-Modus)  
**Stand:** 2026-04-24  
**Bezug:** Commit `030e510` fix: close remaining inline table smoke test gaps  
**Testgrundlage:** Docs 07 / 08 / 09 / 10, direkter Live-Test auf http://127.0.0.1:4321/app/mitgliederverwaltung/

---

## 1. GEPRÜFTE_FIXPUNKTE

Alle fünf laut Commit 030e510 behaupteten Behebungen wurden gezielt nachgetestet:

1. **Popover-/Menüpfad** — Header-⋯, Header-Rechtsklick, Zeilen-⋯, Zeilen-Rechtsklick
2. **Theme-Wirkung Hell/Dunkel** — visueller UI-Unterschied zwischen beiden Modi
3. **Editor-Dismiss** — ESC und Klick-außen für Edit- und Create-Zustand
4. **Row-Actions in breiter Tabellenansicht** — sticky-Verhalten bei maximalem horizontalen Scroll
5. **Hover-Kontrast** — Hell-Modus und Dunkel-Modus, Hover- und Selected-Zustände

---

## 2. REAL_BEHOBEN

### Primärfehler FEHLER 1 + FEHLER 2 (Kritisch aus Dok 07): Popover-Positionierung **real behoben**

**Messung vor Commit (Dok 07):** `position: static`, `top: 733px`, `left: 3px` → Menü am Seitenende.

**Messung nach Commit 030e510:**
- Header-⋯ geöffnet: `position: fixed`, `top: 380px`, `left: 728px` ✓
- Header-Rechtsklick: `position: fixed`, `top: 364px`, `left: 699px` ✓
- Zeilen-⋯: `position: fixed`, `top: 482px`, `left: 928px` ✓
- Zeilen-Rechtsklick: `position: fixed`, `top: 446px`, `left: 556px` ✓

Alle vier Menü-Typen sitzen lokal am Trigger/Klickpunkt im sichtbaren Viewport. `position: static` am Seitenende ist nicht mehr reproduzierbar. Der Primärfehler ist **real geschlossen**.

Alle Menüinhalte funktionieren:
- Aufsteigend sortieren → wirkt nachweislich
- Absteigend sortieren → vorhanden
- Spalte ausblenden → wirkt
- Breite zurücksetzen → vorhanden
- Bearbeiten / Duplizieren / Löschen → vorhanden

Menüpositionierung ist in Hell- und Dunkel-Modus identisch korrekt (beide getestet und gemessen).

---

### FEHLER 3 (Hell/Dunkel ohne sichtbare Wirkung): **real behoben**

**Vorher (Dok 07):** `data-rd-theme` wechselt nur als Attribut, visuell keine Wirkung.

**Jetzt:** Sichtbarer Unterschied zwischen beiden Modi klar erkennbar und getestet:

| Element | Hell-Modus | Dunkel-Modus |
|---|---|---|
| Tabellen-Hintergrund | beige/cremig `#f0ece2` | fast-schwarz `~#2a2d24` |
| Zelltext | `rgb(42, 45, 36)` dunkel | `rgb(236, 234, 217)` cremig-weiß |
| Header | beige-goldton | dunkelgrau mit heller Schrift |
| Buttons | helle Füllung, dunkle Icons | dunkle Füllung, hell abgesetzte Icons |
| Hover-Zeile (Hell): | `rgba(221, 212, 194, 0.62)` (dunkler beige) | — |
| Hover-Zeile (Dunkel): | — | `rgba(~53, ~58, ~48, 0.83)` (etwas aufgehellt) |

Die Umschaltung ist keine Attrappe mehr.

---

### FEHLER 4 (ESC / Klick-außen): **real behoben**

**Vorher (Dok 07):** ESC und Klick-außen schlossen den Editor nicht.

**Jetzt:**
- ESC schließt offenen Edit-Zustand → **bestätigt**
- Klick außerhalb (auf Seitennavigation) schließt Edit-Zustand → **bestätigt**
- ESC schließt Create-Zustand (Neues Mitglied) → **bestätigt**
- Klick außerhalb schließt Create-Zustand → **bestätigt**

Kein unbeabsichtigtes Schließen bei legitimer Interaktion innerhalb des Editors beobachtet.

---

### FEHLER 5 (Row-Actions Viewport-Verankerung): **real behoben (im wesentlichen)**

**Vorher (Dok 07):** Row-Actions in voller Spaltenansicht weit außerhalb des Viewports.

**Jetzt:** Row-Actions haben `position: sticky` mit `right: 8px`. Bei maximalem horizontalen Scroll (scrollLeft: 2970px, Tabelleninhalt 3890px breit) saßen Row-Actions bei `left: 914`, `right: 970` — innerhalb des 1061px breiten Viewports. Sie bleiben immer 8px vom rechten Container-Rand entfernt und sind damit unabhängig vom horizontalen Scroll erreichbar.

---

### FEHLER 6 (Hover-Kontrast): **real verbessert**

**Hell-Modus Hover:** Hintergrund `rgba(221, 212, 194, 0.62)`, Text `rgb(42, 45, 36)` — ausreichend Kontrast, Text klar lesbar.

**Dunkel-Modus Hover:** Hintergrund `rgba(~53, ~58, ~48, 0.83)`, Text `rgb(236, 234, 217)` — klarer Kontrast, Text klar lesbar.

Kein Hell-auf-Hell oder Dunkel-auf-Dunkel-Problem mehr feststellbar.

---

### Overflow/Containment: **weiterhin sauber**

`body.scrollWidth: 1046px` < `window.innerWidth: 1061px` → kein horizontales Seiten-Overflow. Horizontaler Scroll bleibt im Tabellencontainer begrenzt. Aus Dok 07 bekannte Verbesserung hält.

---

## 3. TEILWEISE_BEHOBEN

### Editor-Zeile: Speichern/Abbrechen-Buttons nicht direkt erreichbar

**Was funktioniert:** Editor öffnet sich korrekt unter der Zeile, Felder sind bearbeitbar, Dismiss per ESC und Klick-außen funktioniert.

**Was nicht produktreif ist:** Die Speichern- und Abbrechen-Buttons sitzen im Grid-Layout am **rechten Ende der gesamten Tabellenbreite** (`left: 3372px` / `left: 3491px` bei einem Viewport von 1061px). Um sie per Maus zu erreichen, muss man den Tabellencontainer weit nach rechts scrollen. Das ist kein produktreif nutzbarer Workflow. 

Der Editor ist damit functional offen/schließbar, aber das primäre Ziel eines Inline-Editors — direktes Speichern bearbeiteter Werte — ist ohne Workaround nicht erreichbar.

---

## 4. WEITERHIN_OFFEN

### RESTFEHLER 1 – Kritisch: Speichern/Abbrechen im Editor nicht direkt erreichbar

- Editor-Row ist ein CSS-Grid mit der vollen Tabellenbreite (3885px)
- Speichern-Button: `left: 3372px`, außerhalb des 1061px Viewports
- Abbrechen-Button: `left: 3491px`, außerhalb des Viewports
- Kein automatisches Scroll-to-Buttons beim Öffnen des Editors
- Einzige funktionierende Abbruchmethode: ESC oder Klick-außen
- Einzige funktionierende Speichermethode: derzeit nicht direkt nutzbar ohne manuellen horizontalen Scroll bis ans Ende der Tabelle
- Das ist **funktional nicht produktreif** für den Haupt-Editierweg

**Erwarteter Zielzustand laut Commit:** Editor mit Speichern/Abbrechen direkt benutzbar.

---

## 5. SCREENSHOT-HINWEISE

| Screenshot-ID | Inhalt |
|---|---|
| `ss_83703vccv` | Dunkel-Modus Gesamtansicht der Tabelle (initial) |
| `ss_6692lclx3` | Hell-Modus nach Umschaltung — sichtbarer Unterschied zum Dunkel-Modus |
| `ss_1371y6vfo` | Header-⋯ Menü geöffnet, lokal am Name-Header, position: fixed top:380 left:728 |
| `ss_4299qbaky` | Header-Rechtsklick-Menü, lokal am Trigger, position: fixed top:364 left:699 |
| `ss_73537b3gp` | Zeilen-⋯ Menü geöffnet, lokal an der Zeile, position: fixed top:482 left:928 |
| `ss_64523t3is` | Zeilen-Rechtsklick-Menü, lokal am Klickpunkt, position: fixed top:446 left:556 |
| `ss_361264isa` | Inline-Edit offen unter Lauenroth-Zeile (Hell-Modus) |
| `ss_8378cvpha` | Nach ESC: Editor geschlossen, Tabelle wieder normal |
| `ss_7357ejnjv` | Nach Klick außerhalb: Editor geschlossen |
| `ss_94998vtew` | Create-Zustand (Neues Mitglied) geöffnet mit leerer Editor-Zeile |
| `ss_03411ja13` | Dunkel-Modus Hover — Zeile mit lesbarem Kontrast und sichtbaren Row-Actions |
| `ss_05087c1wi` | Breiter Tabellenzustand (far-right scroll), Row-Actions noch sichtbar im Container |
| `ss_4362p0w1f` | Header-⋯ Menü im Dunkel-Modus, korrekt positioniert |
| `ss_6822yycto` | Editor offen im Dunkel-Modus, Speichern/Abbrechen links außerhalb des sichtbaren Bereichs abgeschnitten |

---

## 6. GESAMTURTEIL

**→ für nächsten Schritt brauchbar**

### Begründung

Commit `030e510` hat den Primärfehler aus Dok 07 real geschlossen: `rd-popover` landet nicht mehr mit `position: static` am Seitenende, sondern sitzt mit `position: fixed` korrekt am Trigger. Das wurde für alle vier Menü-Typen gemessen und bestätigt.

Hell/Dunkel erzeugt jetzt echte, sichtbare UI-Unterschiede — kein Attrappen-Wechsel mehr.

ESC und Klick-außen schließen den Editor und den Create-Zustand zuverlässig.

Row-Actions bleiben via `position: sticky; right: 8px` auch bei maximalem horizontalen Scroll im Viewport.

Hover-Kontrast ist in beiden Modi lesbar.

**Offener Blocker:** Die Speichern/Abbrechen-Buttons im Editor sind wegen des Grid-Layouts (3885px breit) nicht direkt erreichbar. Das verhindert den normalen Editier-Workflow. ESC und Klick-außen als einzige Dismiss-Wege sind kein produktreifer Ersatz für direkt erreichbares Speichern.

**Für nächsten Schritt brauchbar** bedeutet: Die Grundlage (Popover, Theme, Dismiss, Row-Actions, Kontrast) ist jetzt belastbar genug für den Weiterbau — aber der Restfehler mit den Editor-Buttons muss als nächster Fixpunkt adressiert werden, bevor der Inline-Edit-Flow als produktiv nutzbar gilt.

---

## Kurzfazit

**Real behoben durch Commit 030e510:**
1. Popover-Verankerung (Primärfehler) — `position: fixed` statt `static`
2. Hell/Dunkel — echter sichtbarer UI-Unterschied
3. ESC und Klick-außen — schließen Edit- und Create-Zustand
4. Row-Actions — sticky-Verankerung, auch in breiter Ansicht erreichbar
5. Hover-Kontrast — lesbar in beiden Modi

**Noch offen:**
1. Speichern/Abbrechen-Buttons im Editor liegen bei `left: ~3400px` außerhalb des Viewports — der Editier-Workflow ist damit nicht direkt abschließbar