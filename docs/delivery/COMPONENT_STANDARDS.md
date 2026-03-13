# Component Standards

Stand: 2026-03-13

Diese Datei ist die kanonische Standardbibliothek fuer den Umbau.
Sie dient nicht als rein visuelle Sammlung, sondern als Referenz fuer Codex-Audits.

## Klassifikation

Jedes sichtbare Element einer Maske bekommt genau eine Einstufung:

- `standard`
  Eindeutiger Match gegen einen definierten Standardbaustein
- `standard-abweichung`
  basiert auf einem Standard, weicht aber sichtbar oder funktional ab
- `spezialkomponente`
  bewusst eigener Baustein mit legitimer Sonderfunktion

Wenn kein sauberer Match moeglich ist, ist das standardmaessig ein `standard-abweichung`- oder Rueckbaukandidat, nicht automatisch eine Spezialkomponente.

## Audit-Felder

Pro geprueftem Element muessen diese Felder befuellt werden:

1. Komponentenname
2. Position in der Maske
3. Standard-ID vorhanden
4. Klassifikation
5. Basisstandard
6. Abweichung visuell
7. Abweichung funktional
8. Abweichung strukturell
9. Begruendung
10. Empfehlung

## Empfehlungen

- `beibehalten`
- `angleichen`
- `standard erweitern`
- `spezialkomponente offiziell machen`
- `ersetzen / rueckbauen`

## Pflicht fuer Studio-Markierung

Ein Standard gilt erst dann als sauber uebernommen, wenn er an der realen Fundstelle auch als Studio-Match sichtbar ist.

Pflichtfelder an der Fundstelle, soweit sinnvoll:

- `data-studio-component-type`
- `data-studio-library-id`
- `data-studio-component-id`
- `data-table-id` bei Tabellen/Listenshells

Interpretation:

- `standard`
  Muss im Code als Studio-Match sichtbar sein.
- `standard-abweichung`
  Darf auf einen Basisstandard verweisen, aber nicht stillschweigend als voller Match ausgegeben werden.
- `spezialkomponente`
  Bekommt keinen falschen Standard-Match, sondern nur eigene Komponentenreferenzen.

## Kernstandards

### STD-BTN-01 - Primary Button

- Zweck: primaere Hauptaktion
- Erwartetes Verhalten: klar hervorgehoben, 48px Touch-Target, enabled/disabled/loading konsistent
- Zulaessige Varianten: Text, optional Icon
- Typische Pattern: `.feed-btn`, `button.primary`
- Nicht dafuer gedacht: destruktive Zweitaktion

### STD-BTN-02 - Secondary Ghost Button

- Zweck: sekundare Aktion
- Erwartetes Verhalten: geringere visuelle Prioritaet, gleicher Interaktionsraum
- Zulaessige Varianten: Text, optional Icon
- Typische Pattern: `.feed-btn.feed-btn--ghost`, `.feed-btn--ghost`

### STD-BTN-03 - Icon Button

- Zweck: Menue, Quick Action, Kontextwerkzeug
- Erwartetes Verhalten: icon only, klares ARIA-Label, 48x48 Ziel
- Zulaessige Varianten: Header, Toolbar, Portal Quick
- Typische Pattern: `.burger-toggle`, `.portal-quick-toggle`
- Status: Standard in enger Kontrolle, Erweiterungen nur bewusst

### STD-FORM-01 - Text Input

- Zweck: freie einzeilige Eingabe
- Erwartetes Verhalten: Label, Fokusrahmen, konsistente Hoehe
- Zulaessige Varianten: Name, Ort, ID, Mail lokal separat
- Typische Pattern: `input[type=text]`

### STD-FORM-02 - Search Input

- Zweck: Filtern und Suchen in Listen, Tabellen, Cockpits
- Erwartetes Verhalten: schnell reagierend, keine Seiteneffekte ausser Filterung
- Zulaessige Varianten: Toolbar, Filterleiste
- Typische Pattern: `input[type=search]`

### STD-FORM-03 - Select

- Zweck: gefuehrte Auswahl
- Erwartetes Verhalten: definierte Optionen, mobile-safe
- Zulaessige Varianten: Rolle, Status, Verein, Modus
- Typische Pattern: `select`

### STD-FORM-04 - Textarea

- Zweck: mehrzeilige Freitexte
- Erwartetes Verhalten: lesbar, fokusierbar, laengere Eingaben
- Zulaessige Varianten: Notiz, Beschreibung, Kommentar
- Typische Pattern: `textarea`
- Status: Standard, aber noch visuell pruefbeduerftig

### STD-LAYOUT-01 - Filter Row

- Zweck: horizontale Steuerleiste fuer Suche, Filter, Aktionen
- Erwartetes Verhalten: responsive Umbruchlogik, Labels sichtbar
- Zulaessige Varianten: Suche+Filter, Suche+Ansicht, Suche+Aktionen
- Typische Pattern: `.ui-filter-row`

### STD-LAYOUT-02 - View Toggle

- Zweck: Wechsel zwischen Zeilen- und Kartenansicht
- Erwartetes Verhalten: genau ein aktiver Zustand, klare Sichtbarkeit
- Zulaessige Varianten: `zeile/karte`, `table/cards`
- Typische Pattern: `.ui-view-toggle`

### STD-TABLE-01 - Data Table Shell

- Zweck: tabellarische Listenansicht
- Erwartetes Verhalten: Kopfzeile, scanbare Spalten, definierte Leerzustaende
- Zulaessige Varianten: einfache Tabelle, filterbare Tabelle, umschaltbar mit Kartenansicht
- Typische Pattern: `.work-part-table`, `.catch-table`
- Mindestbestandteile: Kopf, Datenbereich, Leerzustand oder Ladezustand

### STD-CARD-01 - Data Card

- Zweck: Kartenansicht fuer mobile oder kompakte Datensaetze
- Erwartetes Verhalten: gleiche Kerndaten wie Zeilenansicht
- Zulaessige Varianten: Listenkarte, KPI-Karte, Modulkarte
- Typische Pattern: `.card`, `.admin-card`, `.demo-data-card`

### STD-DIALOG-01 - Standard Dialog

- Zweck: Details, Bestaetigung, Bearbeitung
- Erwartetes Verhalten: definierte Action-Zone, fokusierbar, sauber schliessbar
- Zulaessige Varianten: native `dialog`, panel/dialog-shell
- Typische Pattern: `.catch-dialog`

### STD-DIALOG-02 - Panel Dialog / Sheet

- Zweck: mobile-nahe Bearbeitung oder Detailansicht
- Erwartetes Verhalten: gleiche inhaltliche Regeln wie Dialog, aber panelartig
- Zulaessige Varianten: Side panel, bottom sheet, create/edit sheet
- Typische Pattern: `.catch-dialog--panel`

### STD-NAV-01 - Admin Side Navigation

- Zweck: Bereichsumschaltung innerhalb von Admin-/Cockpitmasken
- Erwartetes Verhalten: aktiver Zustand klar, Sections eindeutig
- Zulaessige Varianten: Registry, Admin Board, Cockpit-Switch
- Typische Pattern: `.admin-board__nav`, `.admin-nav-btn`

### STD-NAV-02 - Portal Quick Navigation

- Zweck: schneller Einstieg in Module und Favoriten
- Erwartetes Verhalten: rollenbasiert, favorisierbar, mobil nutzbar
- Zulaessige Varianten: Toggle, Rail, Drawer
- Typische Pattern: `#portalQuickToggle`, `#portalQuickDrawer`, `#portalRail`
- Hinweis: als Systemstandard behandeln, nicht als Einzelmasken-Spezialfall

## Spezialkomponenten mit vorlaeufigem Vorbehalt

Diese Bausteine sind aktuell eher Spezialfaelle und muessen im Audit sauber begruendet werden:

- `GoFishing Dialog`
- `Scanner / Kamera-Scanbereich`
- `Radar-/Wetter-Karte`
- `Template Studio Live Preview`
- `Component Library Editor`

Sie sind nicht automatisch falsch, aber muessen bei jeder betroffenen Maske bewusst als Spezialkomponente bestaetigt werden.

## Quellen

- `src/pages/app/component-library/index.astro`
- `docs/design/ui_inventory.md`
- reale Pattern im produktiven App-Code
