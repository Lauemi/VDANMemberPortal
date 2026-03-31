# FCP_INLINE_DATA_TABLE_V2_MASTER_CONTRACT

Stand: 2026-03-30

## Zweck

`fcp-inline-data-table-v2` ist ein starres Standard-Template fuer FCP-Adminmasken.

Es ist keine frei interpretierbare Komponentenfamilie.

Ziel:
- immer gleiche Shell
- immer gleiche Tabellenlogik
- immer gleiche Toolbar-Struktur
- immer gleiche Actions-Logik
- Fachdomänen nur noch per Konfiguration einsetzen

Diese Komponente ist die verbindliche Standardbasis fuer:
- Mitglieder
- Gewaesser
- Angelkarten
- Regeln
- weitere administrative Inline-Pflegemasken

## 1. Harte Grundregel

Es gibt genau eine verbindliche Source of Truth fuer die Shell von `fcp-inline-data-table-v2`:

- das finale HTML-Template
- die finale CSS-Struktur
- das finale JS-Verhalten

Dieses Template darf nicht kreativ interpretiert werden.

Es darf nur ueber definierte Slots und Domain-Config befuellt werden.

Nicht erlaubt:
- alternative Toolbar-Anordnung
- alternative Card-Struktur
- alternative Button-Philosophie
- alternative Editorlogik
- zusaetzliche Panels oder Meta-Bloecke
- Fachlogik, die die Shell veraendert

## 2. Unverhandelbare Struktur

Die Shell ist fest.

### Feste DOM-Hierarchie

```html
<section class="data-table-shell">
  <div class="data-table-shell__toolbar"></div>
  <div class="filter-panel"></div>
  <div class="data-table-wrap">
    <div class="data-table">
      <div class="data-table__head"></div>
      <div class="data-table__row--create"></div>
      <div class="data-table__row"></div>
      <div class="data-table__row--editor"></div>
    </div>
  </div>
  <div class="cards-view"></div>
</section>
```

### Verboten

- keine zusaetzliche Meta-Zeile zwischen Title und Toolbar
- keine zusaetzliche Card innerhalb des Table-Bereichs
- keine Untertabelle
- kein Formularpanel unter der Tabelle
- keine zweite alternative Toolbar
- keine Textbutton-Leiste in Zeilenaktionen

## 3. Feste Slot-Definition

Nur diese Slots duerfen befuellt werden.

### Erlaubte Slots

- `card_title`
- `card_description`
- `search`
- `primary_action`
- `quick_filters`
- `utility_actions`
- `filter_fields`
- `columns`
- `row_rendering`
- `row_editor`
- `create_row`
- `card_rendering_mobile`

### Regel

Was nicht in diesen Slots definiert ist, darf die Komponente nicht selbst erfinden.

## 4. Harte Layout-Regeln

Diese Regeln sind fix.

### Shell

- Shell bleibt innerhalb der Host-Card
- keine Layoutsprengung nach rechts
- nur `.data-table-wrap` darf horizontal scrollen

### Toolbar

- immer 2 Zonen:
  - links = Suche
  - rechts = Primary Action + Quick Filter + Utility Actions
- keine dritte Toolbar-Zone
- keine zweite Toolbar-Reihe fuer Standard-Buttons

### Filterpanel

- immer direkt unter Toolbar
- nie ueber dem Titel
- nie innerhalb der Zeilen

### Table

- Header immer sticky
- Datenzeilen, Create-Row und Editor-Row immer im selben Raster
- Actions immer rechts
- Actions immer icon-only
- Row-Editor immer direkt unter der zugehoerigen Row
- Create-Row immer oben innerhalb des Tabellenrasters

### Wrap / Overflow

- Header-Texte duerfen abgeschnitten werden
- Table bleibt rasterbasiert
- kein freies Umbrechen von Zellen, wenn dadurch das Raster bricht
- lieber horizontal scrollen als Layout zerstoeren

### Buttons

- in Zeilen nur Icons
- fuer Save / Cancel / Edit / Delete / Reset standardisierte Icons
- keine grossen Textbuttons in Daten- oder Editor-Zeilen

## 5. Interaktionsregeln

### Allgemein

- nur eine Create-Row gleichzeitig offen
- nur eine Editor-Row gleichzeitig offen

### Create

- Primary Action oeffnet Create-Row
- Create-Row zeigt nur:
  - Save
  - Cancel

### Edit

- Edit erfolgt nur ueber Edit-Action
- nicht automatisch durch Row-Klick, ausser Fachdomäne verlangt das explizit

### Members-Sonderregel

Fuer `members` gilt verbindlich:

- Row-Klick oeffnet nicht direkt den Editor
- erst Klick auf Edit-Icon oeffnet Editor
- im Editor sichtbar:
  - Save
  - Cancel
  - optional Reset nur wenn sinnvoll
- im Read-Modus sichtbar:
  - Edit
  - optional Delete

### New Member

Fuer neue Mitglieder gilt:

- Create-Row oben
- Actions:
  - Save
  - Cancel

## 6. Domain-Config-Vertrag

Fachdomänen duerfen nur ueber Konfiguration eingesetzt werden.

Beispiel:

```json
{
  "component": "fcp-inline-data-table-v2",
  "mount": "section[data-registry-panel='members']",
  "title": "Mitglieder",
  "description": "Registry-Ansicht mit Suche, Filtern, Paging und Stammdatenpflege.",
  "primary_action": {
    "label": "Mitglied anlegen",
    "mode": "create-row"
  },
  "interaction_mode": {
    "row_click": "none",
    "edit_open": "action-edit"
  },
  "columns": [],
  "filters": [],
  "actions": {
    "read": ["edit"],
    "edit": ["save", "cancel"],
    "create": ["save", "cancel"]
  }
}
```

### Grundregel

- Shell bleibt identisch
- nur Inhalt, Spalten und Fachfelder werden konfiguriert

## 7. Members-spezifische Regeln

Das bestehende Members-DOM ist die fachliche Vorlage fuer Inhalte, nicht fuer neue Shell-Interpretationen.

### Uebernehmen

- Suche
- Statusfilter
- Clubfilter
- Loginfilter
- Zeilenanzahl
- Paging
- Stats
- Column Toggles
- Datenfelder / Sortlogik

### Nicht uebernehmen

- alte Tabellenstruktur als neue Basis
- alte Sonderabstände
- freie Row-Interpretation

### Members Inline v2 muss koennen

- read-only table
- Edit nur per Icon
- Create-Row fuer neues Mitglied
- Column Toggle wirkt auf sichtbare Spalten
- Paging bleibt erhalten
- Filter bleiben erhalten
- Login-Dot bleibt visuell
- FCP-ID bleibt readonly
- sichtbare Fachfelder editierbar nach Regel

## 8. Read/Write-Datenregeln

Diese Komponente darf die Facharchitektur nicht verletzen.

### Tenant / Schluessel

- `club_id` bleibt technischer Tenant-Anker
- `club_code` nur Lookup / Anzeige
- `member_no` interne stabile ID
- `club_member_no` sichtbare Vereinsnummer

### Verboten

- `club_code` als technischer Rechte- oder Isolationsanker
- sichtbare Nummern als primaere Join-Logik
- Umgehung kanonischer Write-Pfade

### Fuer Members

Writes nur ueber freigegebene Write-Pfade, nicht ueber spontane Direktpfade.

## 9. Abnahmekriterien

Die Umsetzung gilt nur als bestanden, wenn alles hiervon erfuellt ist.

### Bestanden / Nicht bestanden

1. DOM-Struktur entspricht dem Master-Template
2. Toolbar-Struktur ist identisch
3. Filterpanel sitzt an derselben Stelle
4. Create-Row sitzt im Tabellenraster
5. Editor-Row sitzt direkt unter der Datenzeile
6. Actions sind icon-only
7. keine zusaetzlichen Panels / Meta-Zeilen / Hybrid-Bloecke
8. Host-Card wird nicht gesprengt
9. nur `.data-table-wrap` scrollt horizontal
10. Members oeffnet Edit nicht per Row-Klick, sondern nur per Edit-Icon
11. Create bei Members zeigt nur Save + Cancel
12. Column Toggles funktionieren auf die neue Komponente
13. Filter / Paging / Stats bleiben erhalten
14. Shell sieht gleich aus wie Master-Template
15. nur diese Teile duerfen je Fachdomäne variieren:
   - Titel
   - Beschreibung
   - Filterfelder
   - Spalten
   - Daten
   - Actions nach Domain-Regel

Wenn einer dieser Punkte nicht erfuellt ist, ist die Umsetzung nicht abgenommen.

## 10. Verbindliche Arbeitsanweisung

Ab jetzt gilt:

Es wird nicht mehr

- eine flexible Tabellenkomponente gebaut,

sondern

- ein starres Standard-Template mit konfigurierbaren Slots.

Der Entwickler baut daher:

1. `fcp-inline-data-table-v2` als starres Master-Template
2. danach `members` als erste Domain-Config
3. danach weitere Fachdomänen nur noch per Konfiguration

Keine neue Interpretation der Shell.
Keine neuen Sonderlayouts.
Keine freie Annaeherung.
Nur noch Standard + Config.
