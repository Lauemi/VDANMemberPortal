# Web Class Architecture

Stand: 2026-03-23
Zweck: Klassen- und Schichtenarchitektur fuer das Web-UI-System, damit Density, Arbeitsscreens und spaetere Module wie Drag-and-Drop ohne Umbau erweiterbar bleiben

## Ziel

Diese Datei beschreibt, wie CSS-Klassen im Projekt strukturiert werden sollen.

Nicht das Ziel:

- pro Screen neue Einmal-Klassen erfinden
- Verhalten, Layout und Optik in einer Klasse mischen
- Density nur lokal und zufaellig an Seitennamen haengen

Das Ziel:

- klare UI-Schichten
- semantische, wiederverwendbare Bausteine
- zukunftsfeste Grundlage fuer Arbeitsbereiche, Sidepanels und spaetere Interaktionsmodule

## Architekturprinzip

Die CSS-Architektur folgt vier Schichten:

1. Tokens
2. Primitives
3. Patterns
4. Screen-spezifische Klassen

Je weiter unten die Schicht, desto spezieller darf sie werden.

## 1. Tokens

Tokens definieren nur Werte, keine Komponentenlogik.

Beispiele:

- `--form-control-height`
- `--form-gap`
- `--field-gap`
- `--card-padding`
- `--section-gap`
- `--radius-md`
- `--space-*`

Regel:

- Tokens beschreiben Maße, nicht Screens
- keine Tokens wie:
  - `--fangliste-gap`
  - `--login-card-height`

## 2. Primitives

Primitives sind kleine wiederverwendbare UI-Bausteine.
Sie haben eine klare Aufgabe und duerfen in vielen Screens benutzt werden.

Empfohlene Primitive:

- `.ui-card`
- `.ui-card__body`
- `.ui-field`
- `.ui-field__label`
- `.ui-field__control`
- `.ui-toolbar`
- `.ui-toolbar__group`
- `.ui-actions`
- `.ui-section`
- `.ui-meta`
- `.ui-note`

Regel:

- Primitives tragen das Aussehen
- sie tragen nicht die Produktlogik

## 3. Patterns

Patterns setzen Primitives zu typischen Arbeitsmustern zusammen.

Empfohlene Patterns:

- `.workscreen`
- `.workscreen__header`
- `.workscreen__toolbar`
- `.workscreen__main`
- `.workscreen__aside`
- `.workscreen__stats`
- `.data-table-shell`
- `.data-table-shell__toolbar`
- `.data-table-shell__table`
- `.form-shell`
- `.form-shell__section`
- `.form-shell__actions`

Regel:

- Patterns beschreiben Nutzungskontexte
- sie duerfen Density, Hierarchie und Anordnung steuern
- sie bleiben aber screen-uebergreifend

## 4. Screen-spezifische Klassen

Diese Ebene ist nur fuer echte Produktbesonderheiten gedacht.

Beispiele:

- `.catch-screen`
- `.register-flow`
- `.login-shell`

Regel:

- Screen-Klassen duerfen nur das definieren, was nicht bereits als Primitive oder Pattern existiert
- wenn dieselbe Loesung auf mehreren Screens gebraucht wird, muss sie nach oben in Pattern oder Primitive wandern

## Naming-Regeln

Empfohlene Namenslogik:

- `ui-*` fuer generische Bausteine
- `workscreen-*` oder `data-*` fuer Arbeitsmuster
- Screen-Namen nur fuer echte Produktbesonderheiten
- `is-*` fuer Status
- `has-*` nur wenn wirklich noetig

Beispiele:

- `.ui-card`
- `.ui-toolbar`
- `.ui-field`
- `.workscreen`
- `.data-table-shell`
- `.is-compact`
- `.is-active`
- `.is-empty`

Nicht empfehlen:

- `.fangliste-compact-input`
- `.login-small-button`
- `.register-dense-card`

## Density-Regel

Density wird nicht ueber Seitennamen gesteuert.

Nicht:

- `.fangliste input { ... }`
- `.login .card { ... }`

Sondern:

- `html[data-density="compact"]`
- Density-Tokens
- Primitives und Patterns, die diese Tokens ziehen

Regel:

- Density haengt an Bausteinen
- nicht an einem einzelnen Screen-Hack

## Trennung von Verantwortung

### Layout

Layout beschreibt:

- Raster
- Bereiche
- Verhaeltnisse
- Positionierung

Beispiele:

- `.workscreen__main`
- `.workscreen__aside`
- `.ui-toolbar`

### Look

Look beschreibt:

- Farbe
- Radius
- Border
- Shadow
- Padding

Beispiele:

- `.ui-card`
- `.ui-note`
- `.ui-field__control`

### Verhalten

Verhalten beschreibt:

- drag
- drop
- sortable
- open
- collapsed
- selected

Beispiele:

- `.is-dragging`
- `.is-drop-target`
- `.is-open`
- `.is-selected`

Wichtig:

- Verhaltensklassen duerfen nicht das komplette visuelle System tragen
- Drag-and-Drop darf nicht auf Screen-spezifischen Layout-Klassen aufbauen

## Regel fuer kuenftige Drag-and-Drop-Module

Spaetere Module mit Drag-and-Drop, Sortierung oder interaktiven Boards muessen diese Trennung einhalten:

1. Strukturklasse
- z. B. `.sortable-list`

2. Elementklasse
- z. B. `.sortable-item`

3. Zustandsklasse
- z. B. `.is-dragging`, `.is-drop-target`

4. Look ueber Primitives / Patterns
- z. B. `.ui-card`, `.workscreen__aside`

Nicht zulaessig:

- Drag-Verhalten direkt an Screen-Klassen koppeln
- komplette Visuallogik in `.is-dragging` verstecken
- Layout nur fuer ein Modul improvisieren und spaeter nicht wiederverwenden koennen

## Beispiele fuer saubere Anwendung

### Formularscreen

- `.form-shell`
- `.form-shell__section`
- `.ui-field`
- `.ui-actions`

### Arbeitsscreen

- `.workscreen`
- `.workscreen__toolbar`
- `.data-table-shell`
- `.workscreen__stats`
- `.workscreen__aside`

### Sidepanel

- `.ui-panel`
- `.ui-panel__head`
- `.ui-panel__body`
- `.ui-panel__actions`

## Beispiele fuer unsaubere Anwendung

Nicht so:

- `.fangliste-toolbar-card-card`
- `.register-compact-box`
- `.new-drag-table-panel-left`
- `.login-mobile-desktop-button`

Warum nicht:

- koppelt Produkt, Layout und Verhalten zu eng
- ist nicht systemfaehig
- fuehrt spaeter zu Umbauten statt zu Erweiterungen

## Entscheidungshilfe fuer neue Klassen

Vor jeder neuen Klasse fragen:

1. Ist das ein Wert?
  - dann Token

2. Ist das ein allgemeiner UI-Baustein?
  - dann Primitive

3. Ist das ein wiederkehrendes Arbeitsmuster?
  - dann Pattern

4. Ist es wirklich nur fuer genau einen Screen oder Flow?
  - dann screen-spezifische Klasse

## Minimum-Regel fuer neue Screens

Jeder neue Arbeits- oder Formularscreen soll zuerst mit bestehenden Primitives und Patterns gebaut werden.

Nur wenn das nicht reicht:

- neue Pattern
- danach erst neue Screen-Klasse

## Migrationsregel fuer Bestand

Bestehende Klassen muessen nicht sofort umbenannt oder ersetzt werden.

Regel:

- neue Screens folgen der neuen Architektur direkt
- bestehende Screens werden bei Ueberarbeitung schrittweise in Primitives und Patterns ueberfuehrt
- funktionierende Altklassen duerfen vorerst bestehen bleiben, solange sie die neue Systemlogik nicht blockieren

Ziel:

- Evolution statt Big-Bang-Refactor
- technische Ordnung ohne unnoetigen Umbauzwang
- neues System von jetzt an sauber aufbauen, alten Bestand kontrolliert nachziehen

## Bezug zu `WebStyleRules.md`

Diese Datei definiert die Klassenlogik.

`WebStyleRules.md` definiert:

- Systemverhalten
- Density-Logik
- Rollout-Entscheidungen
- Prioritaetsregeln

Beide Dateien gehoeren zusammen:

- `WebStyleRules.md` = was das System tun soll
- `WebClassArchitecture.md` = wie die Klassen dafuer aufgebaut werden sollen
