# 10_SMOKETEST_Umsetzung-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: umgesetzt
Bezug:
- `docs/Smoke-Tests/inline-data-table/09_CODEX_Fixauftrag-inline-data-table-v1.md`
- `docs/Smoke-Tests/inline-data-table/07_SMOKETEST_Ergebnis-inline-data-table-v1.md`
- `docs/Smoke-Tests/inline-data-table/08_SMOKETEST_Ableitung-inline-data-table-v1.md`

## Umsetzung (Codex)

### Relevante Commits

- noch nicht committed in diesem Arbeitsstand

### Konkret umgesetzt

- Popover-Pfad repariert:
  `rd-popover` übernimmt jetzt seine Redesign-/Theme-Variablen aus der aktiven Tabelleninstanz, obwohl das Menü an `document.body` gerendert wird.
- Popover-Styling von der Root-Kopplung gelöst:
  die produktiven Menüregeln greifen jetzt auf dem tatsächlichen Popover-Element statt nur innerhalb `.is-redesign`.
- Header-/Zeilen-/Rechtsklick-Menüs bleiben damit auf dem bestehenden `window.RdPopover`-Pfad, aber mit real wirksamer Positionierungs- und Styling-Basis.
- Theme-Wirkung repariert:
  die dunkle Variante hängt nicht mehr pauschal am globalen Body-Theme, sondern an der lokalen Tabelleninstanz (`data-rd-theme`).
- Editor-Dismiss ergänzt:
  `ESC` schließt offenen Edit/Create-Zustand, Klick außerhalb der Tabelleninstanz schließt offenen Edit/Create-Zustand ebenfalls.
- Row-Actions nachgeschärft:
  Hover-Actions wurden auf sticky/viewport-nähere Verankerung im Tabellenkontext umgestellt.
- Hover-Kontrast nachgeschärft:
  Zelltext bleibt in Hover-/Selected-Zuständen lesbarer.

### Was real behoben werden sollte

1. `rd-popover` darf nicht mehr effektiv als `position: static` am Seitenende erscheinen.
2. Hell/Dunkel soll sichtbar unterschiedliche Zustände liefern.
3. ESC und Klick-außen sollen den Editor wirklich schließen.
4. Row-Actions sollen auch in breiter Tabellenansicht erreichbar bleiben.
5. Hover-Zustände sollen lesbar bleiben.

### Bewusst offen geblieben

- Keine neue Menüarchitektur
- Keine neue Tabellenkomponente
- Kein globales Theme-System
- Kein Umbau außerhalb der produktiven Inline-Data-Table v2
