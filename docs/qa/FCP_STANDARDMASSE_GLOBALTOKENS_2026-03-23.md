# FCP Standardmasse / Global Tokens / Basiskomponenten

Stand: 2026-03-23
Zweck: Board-Antwort auf die Frage nach den globalen Standardmaßen vor weiterer UI-/UX-Diagnose

## Kurzfazit

Die eigentliche globale Standardmaß-Datei ist:

- `public/css/ui-standards.css`

Die wichtigsten Verbraucher-Regeln sitzen in:

- `public/css/main.css`

Wichtige Erkenntnis:

- Das System hat eine klare globale Basis fuer `control-height`, Spacing und einen Standardradius.
- Es gibt derzeit **keine echte globale Desktop-/Mobile-Trennung fuer Form-Controls**.
- Viele Screens ziehen dieselben globalen Tokens, aber ihre Verdichtung wird lokal pro Screen oder Modul geloest.
- `radius-lg` kommt nicht aus `ui-standards.css`, sondern aus `public/style.css` und wirkt damit eher wie ein zweiter, aelterer Token-Block.

## 1. Globale Token-Quelle

Quelle:

- `public/css/ui-standards.css`

Definierte Standards dort:

- `--touch-target-min: 48px`
- `--icon-size: 24px`
- `--control-height: 48px`
- `--bottom-nav-height: 60px`
- `--side-rail-width: 68px`
- `--radius-md: 12px`
- `--font-family-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- `--font-body: 16px`
- `--font-secondary-rem: 0.875rem`
- `--space-1: 8px`
- `--space-2: 16px`
- `--space-3: 24px`
- `--space-4: 32px`

Interpretation:

- Das System ist klar auf einem 8px-Raster aufgebaut.
- `48px` ist das zentrale globale Interaktionsmaß fuer Controls.
- `12px` ist der globale Standardradius fuer normale Controls und kleinere Container.
- Typografisch basiert vieles auf `16px` Body und `14px` Secondary Text.

## 2. Zusaetzliche / abweichende Token-Quelle

Quelle:

- `public/style.css`

Dort definiert:

- `--radius: 12px`
- `--radius-lg: 18px`
- `--max-content: 1200px`

Einordnung:

- `public/style.css` wirkt wie ein zusaetzlicher, teils aelterer Stilblock.
- Fuer die aktuelle App-/Portal-UI ist `public/css/main.css` plus `public/css/ui-standards.css` wichtiger.
- `radius-lg` ist global verfuegbar, aber nicht in `ui-standards.css` zentral dokumentiert.

## 3. Globale Ableitungen in `main.css`

Quelle:

- `public/css/main.css` `:root`

Dort werden aus den Kern-Tokens weitere Bibliotheks-/Layout-Werte abgeleitet:

- `--radius: var(--radius-md)`
- `--shell-content-max: 1050px`
- `--shell-inline-pad: var(--space-2)`
- `--lib-btn-height: var(--control-height)`
- `--lib-btn-pad-x: var(--space-2)`
- `--lib-btn-radius: var(--radius-md)`
- `--lib-btn-font-size: 1rem`
- `--lib-btn-font-weight: 600`

Einordnung:

- Buttons ziehen global direkt dieselbe Hoehe wie Inputs.
- `space-2` = `16px` ist das zentrale horizontale Standardpadding fuer Controls und viele Container.
- Shell-/Containerbreite ist im Hauptsystem auf `1050px` gesetzt.

## 4. Globale Basiskomponenten

Quelle:

- `public/css/main.css`

### Card

Globale Regel:

- `.card`
  - Border: `1px solid var(--line)`
  - Radius: `var(--radius)` -> effektiv `12px`
  - Shadow: `var(--shadow)`

- `.card__body`
  - `padding: var(--space-2)` -> `16px`

Konsequenz:

- Jede Card startet global mit `16px` Innenabstand.
- Wenn Screens dann eigene innere Steps oder Sub-Cards bauen, addiert sich dieser Abstand schnell.

### Standard-Inputs / Select / Textarea / Button

Globale Regel:

- `input:not([type="checkbox"]):not([type="radio"])`
- `button`
- `textarea`
- `select`

Standardwerte:

- `border-radius: var(--radius-md)` -> `12px`
- `padding: 0 var(--space-2)` -> `0 16px`
- `min-height: var(--control-height)` -> `48px`

Textarea:

- `min-height: calc(var(--control-height) * 2)` -> `96px`
- `padding: var(--space-1) var(--space-2)` -> `8px 16px`

Label:

- `gap: var(--space-1)` -> `8px`
- `margin: var(--space-1) 0` -> `8px 0`

Konsequenz:

- Die globale Formlogik ist deutlich touch-orientiert.
- Bereits ohne Screen-spezifische Regeln entstehen relativ hohe, luftige Formstrecken.
- Der groesste globale Hebel fuer Desktop-Dichte ist aktuell:
  - `48px` Control-Hoehe
  - `16px` horizontales Control-Padding
  - `8px` Label-Gap
  - `8px` Label-Margin

### Primary Button

Globale Regel:

- `button.primary`

Standardwerte:

- `min-height: var(--lib-btn-height)` -> `48px`
- `padding: 0 var(--lib-btn-pad-x)` -> `0 16px`
- `border-radius: var(--lib-btn-radius)` -> `12px`
- `font-size: 1rem`
- `font-weight: 700`

### Feed Button

Globale Regel:

- `.feed-btn`

Standardwerte:

- `min-height: var(--lib-btn-height)` -> `48px`
- `padding: 0 var(--lib-btn-pad-x)` -> `0 16px`
- `border-radius: var(--lib-btn-radius)` -> `12px`
- `font-size: 1rem`
- `font-weight: 600`

Ghost-Variante:

- `.feed-btn--ghost`
  - nur Farb-/Hintergrundvariation
  - kein eigener kompakteres Maß

Konsequenz:

- Primary und Ghost ziehen global praktisch dieselbe Groesse.
- Visuelle Hierarchie wird damit eher farblich als geometrisch geloest.

## 5. Container / Shell / allgemeine Layoutmasse

Quelle:

- `public/css/main.css`

Wichtige Standardwerte:

- `.container`
  - `max-width: 1050px`
  - `padding-inline: 16px`

- `.container--admin-wide`
  - volle Breite
  - `padding-inline: 16px`

- `.grid`
  - `gap: 16px`

- `.grid.cols2`
  - ab `900px`: `1fr 1fr`

Einordnung:

- `16px` ist auch im Layout das Standardmaß.
- Viele Screens starten mit `container + card + card__body + grid`, was schnell zu summierter Luft fuehrt.

## 6. Dialog / Panel / Sidepanel

Quelle:

- `public/css/main.css`

### Catch Dialog / Sheet

- `--dialog-sheet-width: min(92vw, 560px)`
- mobil: `--dialog-sheet-width: 100vw`

Dialog-Form:

- Desktop padding:
  - `16px` rundum, safe-area-beruecksichtigt
- Mobile padding:
  - `14px 14px max(16px, safe-area-bottom)`

Mobile Form-Controls im Dialog:

- `min-height: 46px`
- `font-size: 16px`
- `textarea min-height: 104px`

Einordnung:

- Hier gibt es bereits eine lokale mobile Sonderbehandlung.
- Das ist aber **kein globales Desktop-/Mobile-Formsystem**, sondern nur ein modulspezifischer Dialog-Fix.

### Portal Quick Panel / Drawer

- Breite:
  - `width: min(400px, calc(100vw - var(--space-3)))`
- Padding:
  - `var(--space-2)` -> `16px`
- Gap:
  - `var(--space-1)` -> `8px`

Fazit:

- Panels/Drawer haben kompaktere vertikale Logik als manche Formularscreens, aber ohne eigenen generellen Komponentenstandard fuer Desktop vs. Mobile.

## 7. Tabellen / Tabellenzeilen

Quelle:

- `public/css/main.css`

### Catch Table

Header:

- `.catch-table__head`
  - padding: `10px 12px`
  - gap: `12px`
  - font-size: `.82rem`

Rows:

- `.catch-table__row`
  - padding: `12px`
  - gap: `12px`

### Work Part Table

- `.work-part-table th, .work-part-table td`
  - `padding: 8px 10px`

Einordnung:

- Tabellen arbeiten bereits kompakter als die globalen Form-Controls.
- Das bestaetigt die Vermutung, dass das „zu gross“-Gefuehl vor allem im globalen Formsystem und in Card-Stacking entsteht, weniger in allen UI-Bloecken gleich stark.

## 8. Desktop / Mobile Trennung heute

Aktueller Stand:

- Es gibt viele lokale `@media`-Regeln in `main.css`.
- Es gibt **keine zentrale globale Trennung** fuer:
  - Desktop-Forms
  - Mobile-Forms
  - Dialog-Forms
  - Table-Forms

Was heute global existiert:

- allgemeine Breakpoints, z. B.:
  - `900px`
  - `720px`
  - `640px`
  - `980px`
  - `1024px`

Aber:

- Diese Breakpoints werden lokal pro Bereich genutzt.
- Es gibt keinen globalen Token wie:
  - `--control-height-desktop`
  - `--control-height-mobile`
  - `--card-padding-desktop`
  - `--card-padding-mobile`

Board-relevante Aussage:

- Das System ist global eher **touch-first / one-size-fits-most**.
- Desktop-Dichte wird aktuell nicht tokenbasiert global geregelt, sondern lokal auf einzelnen Screens nachkorrigiert.

## 9. Welche Klassen / Variablen Komponenten wirklich ziehen

### Forms

Direkte globale Abhaengigkeiten:

- `--control-height`
- `--radius-md`
- `--space-1`
- `--space-2`
- `--lib-btn-height`
- `--lib-btn-pad-x`
- `--lib-btn-radius`

### Cards

Direkte globale Abhaengigkeiten:

- `--radius`
- `--line`
- `--shadow`
- `--space-2`

### Panels / Quick Panel / Dialog

Direkte globale Abhaengigkeiten:

- `--space-1`
- `--space-2`
- `--radius-md`
- `--shadow`
- `--touch-target-min`

### Tabellen

Nur teilweise tokenisiert:

- Padding oft direkt in px
- Gaps oft direkt in px
- Borders/Farben via globale Farben

Einordnung:

- Tabellen sind bereits kompakter, aber weniger token-konsequent als Forms.

## 10. Was das Board daraus ableiten kann

### Wahrscheinliche globale Ursache fuer „zu gross / zu luftig“

Die Hauptursache liegt sehr wahrscheinlich in dieser Kombination:

- `--control-height: 48px`
- Label-Gap `8px`
- Label-Margin `8px 0`
- Card-Body-Padding `16px`
- Grid-Gap `16px`
- Buttons und Inputs teilen sich dieselbe hohe Standardhoehe

Das ist robust und touchfreundlich, aber auf Desktop schnell schwer und „kioskhaft“.

### Was eher global geprueft werden sollte

- Brauchen wir getrennte Token fuer Desktop vs. Mobile Controls?
- Sollen Secondary/Ghost-Aktionen geometrisch kleiner werden?
- Soll `label` global weniger Margin tragen?
- Soll `grid` fuer Formkontexte kleiner sein als fuer inhaltliche Layouts?
- Sollen Cards je nach Kontext andere Standardpaddings bekommen?

### Was eher lokal pro Screen bleiben sollte

- Hero-Hoehen
- Schritt-Inszenierung
- Legal-Block-Gewichtung
- Screen-spezifische CTA-Hierarchie
- Spezialdialoge / spezielle Workflows

## 11. Vorstandstaugliches Kurzfazit

Die Verdichtungsprobleme kommen nicht nur von einzelnen Screens, sondern aus einem global eher touch-first ausgelegten Maßsystem:

- `48px` Controls
- `16px` Standardpadding
- `8px` Basisspacing
- `12px` Standardradius

Es gibt aktuell keine zentrale Desktop-/Mobile-Differenzierung fuer Formkomponenten. Das erklaert, warum mehrere Screens auf Desktop aehnlich „zu gross“ wirken und lokal nachverdichtet werden muessen.
