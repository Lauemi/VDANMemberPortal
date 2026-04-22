# 08_SMOKETEST_Ableitung-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: offen
Bezug:
- `docs/Smoke-Tests/inline-data-table/07_SMOKETEST_Ergebnis-inline-data-table-v1.md`
- `docs/Smoke-Tests/inline-data-table/05_SMOKETEST_Umsetzung-inline-data-table-v1.md`

## Ableitung (ChatGPT)

### Ergebnislage

- `05` war in Teilen real wirksam:
  Overflow/Containment, RowClick-Editor, Abbrechen und Custom-Rechtsklick sind bestätigt.
- Der zentrale Menü-Befund ist laut `07` aber weiterhin nicht sauber gelöst:
  Die Popover-Verankerung ist im Nachtest weiterhin kaputt.

### Was Codex zuletzt konkret gemacht hat

- `c9721a9` `fix: address inline table smoke test regressions`
- `5edede4` `refine inline table editor and anchored menus`
- `3ef08a8` `professionalize inline table header context menus`

Diese Arbeit hat reale Teilverbesserungen erzeugt, aber den primären Positionierungsfehler laut Nachtest nicht verlässlich geschlossen.

### Nächste Codex-Aufgabe

1. `rd-popover` real an Trigger/Klickpunkt verankern und den `position: static`-Fehler belastbar schließen.
2. Hell/Dunkel-Schalter visuell wirksam machen oder bis zur echten CSS-Wirkung wieder zurücknehmen.
3. Inline-Edit um `ESC` und Klick-außen-Schließen ergänzen.
4. Row-Actions in voller Spaltenansicht stabil im sichtbaren Bereich halten.
5. Hover-Kontrast der Datenzeilen lesbar machen.

### Bewertung

Weiterbau auf dieser Komponente ist erst sinnvoll, wenn Punkt 1 real behoben und per Nachtest bestätigt ist. Bis dahin ist die Fläche funktional verbessert, aber noch keine stabile Grundlage.
