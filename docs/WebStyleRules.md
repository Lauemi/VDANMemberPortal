# Web Style Rules

Stand: 2026-03-23
Zweck: Zentrale Arbeitsgrundlage fuer Web-UI-Systemlogik, Density-Entscheidungen und Rollout-Regeln

## Status

Diese Datei fuehrt die aktuell gueltige Logik fuer die Web-Oberflaechen zusammen.
Sie ist kein Design-Marketing-Dokument, sondern eine technische und produktive Regelbasis.

## Leitprinzip

Das Web-UI-System bleibt grundsaetzlich bestehen, wird aber kontrolliert weiterentwickelt.

Nicht das Ziel:

- globale Werte blind verkleinern
- Screens einzeln mit Sonderhacks zusammendruecken
- pro Maske eine eigene visuelle Physik bauen

Das Ziel:

- ein konsistentes, steuerbares Web-System
- touch-tauglich, aber nicht kioskhaft auf Desktop
- klare Trennung zwischen Layout-Tokens und Arbeits-/Form-Dichte

## Grundannahme

Das aktuelle System ist global eher `touch-first`.

Praegende globale Standards heute:

- `--control-height: 48px`
- `--space-1: 8px`
- `--space-2: 16px`
- `--space-3: 24px`
- `--space-4: 32px`
- `--radius-md: 12px`

Das fuehrt auf Desktop bei Formularen und Arbeitsstrecken schnell zu:

- zu viel Hoehe
- zu viel Luft pro Information
- zu starker Card-in-Card-Wirkung
- gleich schwerer Gewichtung von primaeren und sekundaeren Aktionen

## Wichtige Systementscheidung

Wir fuehren keine globale Verkleinerung der bestehenden Layout-Tokens ein.

Das heisst:

- `--space-*` bleiben global unberuehrt
- Shell-/Header-/Nav-/Drawer-/Layout-Abstaende werden nicht pauschal verkleinert
- Verdichtung passiert nicht ueber ein Umdrehen des gesamten Systems

Stattdessen:

- eigener semantischer Density-Layer fuer Form-, Card- und Arbeitsbereiche

## Density-Prinzip

Es gibt zwei gueltige Modi:

1. `comfortable`
2. `compact`

`comfortable` bleibt der sichere Standard.
`compact` ist fuer Desktop-orientierte Arbeits- und Formularstrecken gedacht.

## Semantische Density-Tokens

Neue oder fortgefuehrte Density-Tokens sollen semantisch sein, nicht generisch:

- `--form-control-height`
- `--form-gap`
- `--field-gap`
- `--card-padding`
- `--section-gap`
- optional:
  - `--button-font-size`
  - `--legal-block-gap`
  - `--secondary-action-opacity`

Nicht als Density-Tokens verwenden:

- `--space-1`
- `--space-2`
- `--space-3`
- `--space-4`

## Aktivierung

Wenn Density aktiviert wird, dann ueber:

```html
<html data-density="compact">
```

Nicht ueber:

```html
<body data-density="compact">
```

Wenn CSS auf `:root` bzw. `html` basiert, muss die Aktivierung auch dort sitzen.

## Komponenten, die Density-Tokens ziehen duerfen

Diese UI-Bausteine duerfen an den Density-Layer angebunden werden:

- `input`
- `select`
- `textarea`
- `button.primary`
- `.feed-btn`
- `label`
- `.card__body`
- Form-Sektionen
- Arbeits-/Form-Container

## Komponenten, die NICHT automatisch ueber Density umgebaut werden

Diese Bereiche sollen nicht ueber den ersten Density-Pass global veraendert werden:

- Header
- Navigation
- Shell-/Container-Layout
- globale Seitenabstaende
- Drawer / Quick Panels
- Spezialdialoge
- Hero-Inszenierungen
- Tabellenlayout im ersten Schritt

Wenn dort spaeter Verdichtung noetig ist, dann als eigener Ausbauschritt.

## CSS-Regel fuer kuenftige Arbeit

Neue Verdichtungsanforderungen sollen zuerst ueber Systemtokens geprueft werden.

Nur wenn das nicht reicht, sind lokale Screen-Regeln erlaubt.

Reihenfolge:

1. Systemtoken pruefen
2. Komponente pruefen
3. Screen-spezifisch nur dort nachziehen, wo die Informationsarchitektur es verlangt

## Verbotene Abkuerzungen

Nicht tun:

- globale `--space-*` fuer Desktop kleiner machen
- pro Screen harte px-Werte ohne Systembezug streuen
- Ghost-/Sekundaerbuttons nur farblich statt auch geometrisch differenzieren
- Desktop-Dichte ueber zufaellige Einzelfixes herstellen

## Screen-spezifische Ausnahmen

Lokale Screen-Ausnahmen sind erlaubt, wenn mindestens einer dieser Punkte zutrifft:

- Hero-/Brand-Inszenierung ist bewusst eigenstaendig
- juristische oder systemische Hinweise muessen anders gewichtet werden
- Screen ist ein Sonderfall fuer Onboarding oder Admin-Flow
- Dialog-/Drawer-Mechanik hat mobile Sonderanforderungen

Aber:

Diese Ausnahmen muessen auf dem bestehenden System aufbauen, nicht es ersetzen.

## Aktuelle Produktlogik fuer Form-Dichte

Form-Strecken auf Desktop sollen sich anfuehlen wie:

- praezise
- ruhig
- direkt
- arbeitsorientiert

Nicht wie:

- Kiosk
- Tablet-App
- uebergrosser Wizard
- gestapeltes Formular-Panel

## Aktuelle UX-/Board-Ableitung

Die Arbeit an `/registrieren/` hat gezeigt:

- das erste Problem war Flow-Struktur
- das zweite Problem war visuelle Dichte

Daraus folgt fuer kuenftige Screens:

- erst Flow sauber machen
- dann Gewichtung und Dichte ueber das System regeln

## Pilot-Rollout fuer Density

Phase 1:

- `Registrieren`
- `Login`

Phase 2:

- weitere Formular- und Arbeitsstrecken
- z. B. Fangliste / operative Admin- und Formularscreens

Phase 3:

- pruefen, welche Komponenten oder Module compact als Standard erhalten

## Erste Anwendung: Fangliste als Compact-Arbeitsscreen

Die Fangliste ist der erste bewusst definierte Arbeitsscreen im `compact`-Modus.

Sie wird nicht als Card-Stack verstanden, sondern als operativer Arbeitsbereich.

Fuer die Fangliste gilt daher diese Hierarchie:

- Tabelle = Zentrum
- Filter / Suche = Werkzeugleiste
- Stats = Zusatzinformation
- Sidepanel = Werkzeug

Das bedeutet:

- der Tabellenbereich ist visuell dominant
- Filter werden kompakt und werkzeugartig behandelt
- Stats werden heruntergestuft und nicht zum Hauptfokus gemacht
- das Sidepanel fuehlt sich wie ein schnelles Arbeitswerkzeug an, nicht wie ein eigener Screen

Zielwirkung:

- weniger Scrollen
- weniger Reibung
- schnellerer Einstieg
- klarer Arbeitsfokus

## Density-Zuordnung

`compact` ist gedacht fuer:

- Formulare
- Login- und Registrierungsstrecken
- Admin- und Setup-Screens
- Arbeits- und Tabellenscreens
- Sidepanels mit Eingaben oder operativer Nutzung

`comfortable` bleibt gedacht fuer:

- Landingpages
- oeffentliche Einstiegsseiten
- Marketing- und Brand-Flaechen
- Hero-Bereiche
- Seiten, bei denen Inszenierung wichtiger ist als Eingabedichte

Wenn unklar:

- Default bleibt `comfortable`
- `compact` wird bewusst aktiviert, nicht pauschal verteilt

## Prioritaetsregel

Density darf niemals:

- die visuelle Hierarchie zerstoeren
- primaere und sekundaere Aktionen gleich stark machen
- Orientierung verschlechtern
- Klarheit gegen Platzgewinn eintauschen

`compact` bedeutet:

- weniger Raum
- kuerzere Wege
- schnellere Arbeitsdichte

Nicht:

- weniger Klarheit
- weniger Fuehrung
- weniger Produktprioritaet

## Definition of Done fuer Systemarbeit

Ein Density-Schritt ist erst dann fertig, wenn:

- keine globalen Kollateralschaeden in Header / Nav / Layout entstehen
- Formstrecken sichtbar kompakter sind
- die UI nicht nur kleiner, sondern klarer wird
- `comfortable` weiter stabil funktioniert
- `compact` nicht auf lokalen Hacks basiert

## Pflegehinweis

Diese Datei wird bei folgenden Entscheidungen aktualisiert:

- neue Density-Tokens
- neue globale Form-/Card-Regeln
- bewusst freigegebene Ausnahmen
- neue Rollout-Phasen fuer kompakte Desktop-Dichte
