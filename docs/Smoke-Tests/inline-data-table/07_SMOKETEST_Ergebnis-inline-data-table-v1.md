# 07_SMOKETEST_Ergebnis-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: abgeschlossen
Bezug:
- `docs/Smoke-Tests/inline-data-table/06_CLAUDE_Cowork_Nachtest-inline-data-table-v1.md`
- Tester: Claude (Cowork-Modus)

## 1. NACHGETESTETE_UMSETZUNGSPUNKTE

Laut `05_SMOKETEST_Umsetzung-inline-data-table-v1.md` wurden folgende Punkte nachgetestet:

- Overflow-/Containment-Fehler bereinigt
- Row-Actions und Header-Menüs nachgeschärft
- Inline-Edit auf Row-Aufklapp-Prinzip zurückgeführt
- Lokaler Hell/Dunkel-Schalter ergänzt
- Header-3-Punkte lokal am Button verankert
- Header-Rechtsklick öffnet dasselbe Menü statt Direkt-Hide
- Menüpositionierung auf Button-/Klickpunkt-Verankerung geschärft

## 2. BESTÄTIGT_FUNKTIONSFÄHIG

- Inline-Edit öffnet sich sauber direkt unter der geklickten Zeile.
- Abbrechen schließt den Editor korrekt.
- Header-Rechtsklick öffnet ein App-eigenes Menü statt des Browser-Standardmenüs.
- Zeilen-Rechtsklick öffnet ein App-eigenes Menü.
- Overflow/Containment ist real verbessert:
  `body.scrollWidth` bleibt im Viewport, horizontales Scrollen ist auf den Tabellen-Container begrenzt.
- RowClick und Menü-Interaktion sind sauber getrennt.

## 3. TEILWEISE_ODER_UNSAUBER

- Row-Actions sind nur in reduzierten Spaltenansichten stabil erreichbar; in voller Spaltenansicht liegen sie weiterhin weit außerhalb des Viewports.
- Menüinhalte reagieren technisch, landen aber räumlich weiterhin falsch.
- Zeilen-`...`-Menü enthält die richtigen Aktionen und ESC schließt es, die Platzierung bleibt aber fehlerhaft.

## 4. KLARE_FEHLER

### FEHLER 1 – Kritisch: Popover-Positionierung Header-Menü nicht behoben

- Das Header-Menü (`rd-popover`) öffnet laut Nachtest weiterhin mit `position: static`.
- Gemessene Position: `top: 733px`, `left: 3px`
- Effekt: Menü landet unterhalb des Footer-Bereichs statt lokal am Trigger.

### FEHLER 2 – Kritisch: Popover-Positionierung Zeilen-Menü nicht behoben

- Auch Zeilen-`...` und Zeilen-Rechtsklick öffnen das Menü räumlich losgelöst am Seitenende.
- Inhalte sind korrekt, die Verankerung bleibt aber kaputt.

### FEHLER 3 – Hell/Dunkel-Schalter ohne sichtbare Wirkung

- `data-rd-theme` wechselt technisch zwischen `light` und `dark`.
- Visuell reagiert die Tabelle laut Nachtest jedoch nicht.
- Der Schalter ist damit funktional nur Attributwechsel, aber kein echter UI-Wechsel.

### FEHLER 4 – ESC und Klick-außen schließen Inline-Edit nicht

- ESC schließt den offenen Editor nicht.
- Klick außerhalb schließt den offenen Editor ebenfalls nicht.
- Nur der `Abbrechen`-Button funktioniert.

### FEHLER 5 – Row-Actions nicht stabil im Viewport verankert

- In voller Spaltenansicht liegen die Hover-Actions weiterhin außerhalb des sichtbaren Bereichs.
- Das Problem ist damit nicht grundsätzlich gelöst.

### FEHLER 6 – Kontrastproblem bei Hover

- Beim Hover über Zeilen ist der Textkontrast laut Nachtest zu schwach.
- Ergebnis: Inhalte werden auf dem hellen Overlay schlecht lesbar.

## 5. SCREENSHOT-HINWEISE

| Screenshot-ID | Inhalt |
|---|---|
| `ss_7766t933g` | Header-Menü unten auf der Seite, `position: static` |
| `ss_9140cuw7p` | Rechtsklick auf Header, Trigger-Bereich |
| `ss_98113numw` | Rechtsklick auf Zeile, Menü wieder unten |
| `ss_2481ktyh4` | Zeilen-`...`-Menü unten auf der Seite |
| `ss_9109mdw0c` | Inline-Edit offen und korrekt unter der Zeile |
| `ss_3172lxw14` | Hell-Modus ohne sichtbaren Unterschied |
| `ss_6092rmgm8` | Dunkel-Modus ohne sichtbaren Unterschied |
| `ss_8125ttv7i` | Row-Actions in schmaler Ansicht erreichbar |
| `ss_6496p8tlr` | Hover-Zustand mit schwachem Kontrast |

## 6. GESAMTURTEIL

**→ noch nicht sauber**

Der Nachtest bestätigt reale Fortschritte bei Overflow/Containment, RowClick-Editor und Custom-Rechtsklick-Handlern. Der primäre kritische Fehler aus dem Erstbefund bleibt jedoch bestehen: `rd-popover` ist laut Nachtest weiterhin räumlich falsch platziert und landet am Seitenende statt lokal am Trigger. Zusätzlich bleiben Theme-Umschaltung ohne sichtbare Wirkung, fehlendes ESC/Klick-außen-Schließen des Editors, instabile Row-Actions in voller Spaltenansicht und Kontrastprobleme offen.

## Kurzfazit

Bereits real behoben:

- Overflow/Containment
- Inline-Edit Öffnung per RowClick
- Abbrechen im Editor
- Custom-Rechtsklick statt Browser-Standardmenü

Weiterhin offen:

1. Popover-Verankerung Header + Zeile
2. sichtbare Hell/Dunkel-Umschaltung
3. ESC/Klick-außen für Inline-Edit
4. stabile Viewport-Verankerung der Row-Actions
5. Hover-Kontrast
