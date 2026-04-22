# 07_SMOKETEST_Ergebnis-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: ausstehend
Bezug:
- `docs/Smoke-Tests/inline-data-table/06_CLAUDE_Cowork_Nachtest-inline-data-table-v1.md`

---

## Ergebnis (Claude einfügen)

Dieser Bereich wird durch den gezielten Nachtest (06) befüllt.

---

## Struktur

### 1. NACHGETESTETE_UMSETZUNGSPUNKTE

### 2. BESTÄTIGT_FUNKTIONSFÄHIG

### 3. TEILWEISE_ODER_UNSAUBER

### 4. KLARE_FEHLER

### 5. SCREENSHOT-HINWEISE

### 6. GESAMTURTEIL

---

# 06_CLAUDE_Cowork_Nachtest-inline-data-table-v1 — Ergebnis

**Version: v1 | Stand: 2026-04-22 | Tester: Claude (Cowork-Modus)**

---

## 1. NACHGETESTETE_UMSETZUNGSPUNKTE

Laut `05_SMOKETEST_Umsetzung-inline-data-table-v1.md` wurden folgende Punkte umgesetzt:

- Overflow-/Containment-Fehler bereinigt → **getestet**
- Row-Actions und Header-Menüs nachgeschärft → **getestet**
- Inline-Edit auf Row-Aufklapp-Prinzip zurückgeführt → **getestet**
- Lokaler Hell/Dunkel-Schalter ergänzt → **getestet**
- Header-3-Punkte lokal am Button verankert → **getestet**
- Header-Rechtsklick öffnet dasselbe Menü statt Direkt-Hide → **getestet**
- Menüpositionierung auf Button-/Klickpunkt-Verankerung geschärft → **getestet**

---

## 2. BESTÄTIGT_FUNKTIONSFÄHIG

**Inline-Edit öffnet sich sauber:**
RowClick öffnet die Edit-Zeile direkt unterhalb der geklickten Zeile. Tabellenstruktur bleibt erhalten. Felder (Datum, Freitext, IBAN-Feld) sichtbar und bedienbar. Speichern-/Abbrechen-Buttons vorhanden und klickbar.

**Abbrechen schließt den Editor:**
Funktioniert korrekt, Tabelle kehrt in den Normalzustand zurück.

**Header-Rechtsklick öffnet Custom-Menü (nicht Browser-Nativ):**
Das Browser-Standardmenü wird verhindert. Ein App-eigenes Menü erscheint (Aufsteigend/Absteigend sortieren, Spalte ausblenden, Breite zurücksetzen). Menüinhalte sind vollständig und klickbar – Sortierung funktioniert technisch.

**Zeilen-Rechtsklick öffnet Custom-Menü:**
Kein Browser-Standard-Menü, das App-Menü erscheint mit Bearbeiten/Duplizieren/Löschen.

**Overflow/Containment:**
Die Seite bläht sich nicht mehr horizontal auf. `body.scrollWidth` liegt innerhalb des Viewports. Horizontales Scrollen ist korrekt auf den Tabellen-Container (`data-table-wrap`, scrollWidth 3852px) begrenzt – die Seite selbst scrollt nicht mit.

**RowClick vs. Menü-Click sauber getrennt:**
Normaler Linksklick auf eine Zeile öffnet kein Kontextmenü, nur das Inline-Edit.

---

## 3. TEILWEISE_ODER_UNSAUBER

**Row-Actions (Hover-Buttons) in manchen Spaltenansichten erreichbar:**
In der reduzierten Ansicht (5 Spalten: G, Be, SEPA, IBAN, IB) sitzen die Row-Action-Buttons bei `left: 914px` – innerhalb des Viewports von 1061px. In der vollen Spaltenansicht (mit echten Daten-Spalten) wurde `left: 3846px` gemessen, also weit außerhalb. Die Erreichbarkeit ist damit **spaltenabhängig**, nicht stabil gelöst.

**Menüinhalte funktionieren technisch:**
Sortierung reagiert, die Menüpunkte können geklickt werden – aber nur wenn man weit genug nach unten scrollt, da das Menü am Seitenende landet.

**Zeilen-`...`-Menü setzt korrekte Inhalte:**
Bearbeiten, Duplizieren, Löschen sind vorhanden. ESC schließt das Menü.

---

## 4. KLARE_FEHLER

### FEHLER 1 – Kritisch: Popover-Positionierung NICHT behoben (Header-Menü)

**Exakt derselbe Fehler wie im Erstbefund.**

Beim Klick auf den Header-`...`-Button öffnet sich das Menü (`rd-popover`) mit `position: static` im normalen DOM-Fluss. Gemessene Position: `top: 733px`, `left: 3px` – das ist **unterhalb des Footers**, vollständig losgelöst vom Trigger. Das Menü landet am Seitenende und muss durch manuelles Scrollen erreicht werden. Die Doku (03_aktuell, Version v2) behauptet „funktioniert" – das ist **falsch**.

**DOM-Beweis:** `window.getComputedStyle(rdPopover).position === 'static'`

### FEHLER 2 – Kritisch: Popover-Positionierung NICHT behoben (Zeilen-Menü)

**Exakt derselbe Fehler wie im Erstbefund.**

Beim Klick auf Zeilen-`...` oder Rechtsklick auf Zeile erscheint das `rd-popover` ebenfalls mit `position: static` bei `top: 598–727px` – weit unterhalb des sichtbaren Tabellenbereichs, am Seitenende. Menüinhalt korrekt (Bearbeiten/Duplizieren/Löschen), aber räumlich vollständig losgelöst von der Zeile.

### FEHLER 3 – Hell/Dunkel-Schalter ohne visuelle Wirkung

Das `data-rd-theme`-Attribut auf `.qfp-inline-data-table-root` wechselt korrekt zwischen `light` und `dark`. Aber **kein CSS reagiert darauf**. Hell und Dunkel sehen visuell identisch aus: gleicher dunkler Header, gleiche dunklen Zeilen, gleiche Hintergrundfarben. Es fehlt entweder die CSS-Implementierung der `[data-rd-theme="light"]` / `[data-rd-theme="dark"]`-Selektoren, oder die CSS-Variablen werden nicht korrekt angewendet.

Die Doku (03_aktuell) listet diesen Punkt nicht als Problem. Das ist **zu positiv** – der Schalter ist Attrappe.

### FEHLER 4 – ESC und Klick-außen schließen Inline-Edit nicht

Wie im Erstbefund: ESC hat keine Wirkung auf den offenen Editor. Klick außerhalb der Edit-Zeile schließt ebenfalls nicht. Nur der „Abbrechen"-Button funktioniert. Dieser Punkt war im Erstbefund als offen markiert und bleibt **offen** – die Umsetzung hat ihn nicht behoben.

### FEHLER 5 – Row-Actions nicht stabil im Viewport verankert

In der vollen Spaltenansicht (alle echten Datenspalten sichtbar) sitzen die Row-Action-Buttons bei `left: 3846px` – außerhalb des Viewports. Nur in einer reduzierten Ansicht mit wenigen Spalten (Standard-Ansicht mit 5 Spalten) sind sie bei `left: 914px` erreichbar. Das Layout-Problem ist nicht grundsätzlich gelöst, sondern nur in einem Teilfall weniger schlimm.

### FEHLER 6 – Kontrast: Zeilen-Text bei Hover unlesbar

Beim Hover über eine Datenzeile wird der Zellinhalt (weiße/helle Schrift) auf einem hellen beigen Overlay-Hintergrund angezeigt. Das Ergebnis ist weißer Text auf fast weißem Hintergrund – sehr schwacher Kontrast, kaum lesbar.

---

## 5. SCREENSHOT-HINWEISE

| Screenshot-ID | Inhalt |
|---|---|
| `ss_7766t933g` | **Header-Menü unten auf der Seite** – position:static, Menü unterhalb Footer-Bereich |
| `ss_9140cuw7p` | Rechtsklick auf Header – Trigger-Bereich, Menü noch nicht sichtbar |
| `ss_98113numw` | Rechtsklick auf Zeile – Zeile hervorgehoben, Menü wieder unten |
| `ss_2481ktyh4` | **Zeilen-`...`-Menü unten auf der Seite** – Bearbeiten/Duplizieren/Löschen am Seitenende |
| `ss_9109mdw0c` | **Inline-Edit offen** – korrekt unter der Zeile, mit Speichern/Abbrechen |
| `ss_3172lxw14` | **Hell-Modus** – Tabelle im dunklen Design, kein sichtbarer Unterschied |
| `ss_6092rmgm8` | **Dunkel-Modus** – identisches Erscheinungsbild wie Hell-Modus |
| `ss_8125ttv7i` | Row-Actions in schmaler Ansicht erreichbar (left: 914px) |
| `ss_6496p8tlr` | Hover auf Zeile – Row-Actions rechts, aber Text schwacher Kontrast |

---

## 6. GESAMTURTEIL

**→ noch nicht sauber**

Die Umsetzung hat reale Teilerfolge erzielt: Overflow-Containment funktioniert, RowClick öffnet das Inline-Edit sauber, Abbrechen funktioniert, Rechtsklick-Handler ist registriert. Aber der **primäre kritische Fehler aus dem Erstbefund – die Popover-Positionierung – ist nicht behoben**. `rd-popover` hat noch immer `position: static` und landet am Seitenende, bei beiden Menütypen (Header und Zeile). Die Dokumentation (03_aktuell) hat dies fälschlicherweise als „behoben" markiert. Zusätzlich ist der Hell/Dunkel-Schalter eine nicht-funktionale Attrappe, und ESC/Klick-außen fehlen weiterhin.

---

## WAS CODEX WIRKLICH BEHOBEN HAT

- Overflow/Containment: **Ja, real behoben**
- Inline-Edit Öffnung (RowClick): **Ja, real behoben**
- Abbrechen: **Ja, funktional**
- Rechtsklick-Handler registriert (Custom-Menü statt Browser-Standard): **Ja, vorhanden**

## WAS IN DER DOKU ZU OPTIMISTISCH IST

- „Kontextmenü funktioniert" (03_aktuell): **Falsch – Position ist noch static, Menü landet am Seitenende**
- „Rechtsklick funktioniert": **Nur halb – Menü existiert, sitzt aber falsch**
- Hell/Dunkel: Nicht als Problem erwähnt, obwohl Schalter ohne CSS-Effekt ist

## WAS IM UI WEITERHIN KAPUTT IST

1. `rd-popover` position:static → muss `fixed` oder `absolute` mit Viewport-Berechnung werden
2. Hell/Dunkel hat keine CSS-Implementierung
3. ESC und Klick-außen schließen Editor nicht
4. Row-Actions in voller Spaltenansicht noch außerhalb des Viewports

## WEITERGEBAUT WERDEN KANN?

**Nein, noch nicht.** Der primäre kritische Fehler (Popover-Positionierung) aus dem Erstbefund ist identisch erhalten geblieben. Er muss zuerst real behoben und verifiziert werden, bevor der Bereich als stabile Grundlage gilt.
