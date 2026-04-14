# ADM Standardmatrix v1

Diese Datei definiert den aktuellen ADM-first-Standard des FCP-Maskensystems.

Ziel:
- keine neue Maskenwelt erfinden
- keine zweite Wahrheit neben ADM bauen
- sichtbare ADM-Muster als offiziellen Standard festziehen
- Luecken von Altlasten und Baustellen trennen

Grundregel:
- aktive `ADM_*.json` sind die Primaerquelle fuer den Workspace-Standard
- Runtime, Resolver und Renderer fuehren diesen Standard aus
- Runtime-Sonderlogik bleibt sichtbar, ist aber nicht automatisch JSON-Standard

Nicht Ziel dieser Version:
- kompletter Renderer-Rewrite
- sofortige Vereinheitlichung aller Altpfade
- Rueckzug jeder JS-Logik in JSON
- erzwungene Abschaffung jeder zweiten Tabellenfamilie in einem Schritt

## ADM-first-Regel

Was in aktiven ADM-Masken mehrfach, aktiv und konsistent vorkommt, gilt als Standard.

Was fuer die Bedienqualitaet oder Vertragsklarheit gebraucht wird, in ADM aber noch nicht sauber oder nicht durchgaengig steckt, wird als neuer Standard markiert.

Was nur historisch, lokal, experimentell oder als Baustelle existiert, ist kein Standard.

Statusklassen:
- `bereits Standard`
- `neu als Standard einzufuehren`
- `Altlast / deprecated`
- `Baustelle / nicht Standard`

## 1. Panel-Standard

### Bereits Standard
- `ADM` ist der Workspace-Rahmen fuer Admin-/Board-Kontexte
- Panels leben in `sections[].panels[]`
- `renderMode` steuert den Inhaltsmodus
- `componentType` konkretisiert den Blocktyp
- reale Panel-Typen im aktiven Bestand:
  - `ReadonlyPanel`
  - `FormPanel`
  - `inline-data-table`
  - `data-table`
- Panel-Metadaten im aktiven ADM-Bestand:
  - `permissions`
  - `securityContext`
  - `meta.sourceTable`
  - `meta.sourceKind`
  - `meta.sourceOfTruth`
  - `meta.sqlContract`
  - `loadBinding`
  - `saveBinding`

### Neu als Standard einzufuehren
- explizite Panel-Gewichtung fuer Standard-Offenheit / Reihenfolge
- saubere Norm, wann ein Panel standardmaessig offen, eingeklappt oder dialogisch ist
- explizite Unterscheidung zwischen ADM-Panelstandard und Runtime-Sonderbehandlung

### Altlast / deprecated
- leere `componentType`-Felder in produktiven Panels
- implizite Bedeutungen ohne expliziten Paneltyp

### Baustelle / nicht Standard
- Panels, die nur lokal oder als vorbereitete Flaeche existieren
- Panels mit `gap`, `preview`, `partial`, wenn kein durchgaengiger Runtime-Vertrag existiert

## 2. Form-Standard

### Bereits Standard
- Form-Panels nutzen `renderMode: "form"` plus `componentType: "FormPanel"`
- Felder tragen im ADM-Bestand real:
  - `name`
  - `label`
  - `type`
  - `componentType`
  - `valuePath`
  - `payloadKey`
  - `required`
  - `readonly`
  - `validationRules`
  - `options` bei Selects
- reale Editor-Typen im aktiven ADM-Bestand:
  - `input`
  - `email`
  - `number`
  - `select`
  - `toggle`
  - `textarea`
- Formgruppen mit eigener Gruppierung / Accordion sind im ADM-Bestand vorhanden

### Neu als Standard einzufuehren
- sichtbare und einheitliche Form-States fuer `dirty`, `saving`, `success`, `error`
- expliziter Standard fuer Readonly-Boolean vs Edit-Boolean
- einheitliche Checkbox-/Toggle-Norm fuer Label, Abstand und Readonly-Anzeige

### Altlast / deprecated
- freie Boolean-Darstellungen je Renderer ohne feste Norm

### Baustelle / nicht Standard
- lokal vorbereitete Formflaechen ohne finalen Write-Vertrag

## 3. Table-Standard

### Bereits Standard
- es gibt zwei aktive Tabellenfamilien:
  - `inline-data-table`
  - `data-table`
- reale `tableConfig`-Bausteine im ADM-Bestand:
  - `tableId`
  - `rowKeyField`
  - `gridTemplateColumns`
  - `rowInteractionMode`
  - `selectionMode`
  - `viewMode`
  - `sortKey`
  - `sortDir`
  - `filterFields`
  - `showToolbar`
  - `showCreateButton`
  - `showResetButton`
  - `rowActions`
  - `utilityActions`
- reale Row-Interaktionen:
  - `inline`
  - `dialog`

### Neu als Standard einzufuehren
- klare Norm, wann `inline-data-table` und wann `data-table` verwendet wird
- ein sichtbarer Standard fuer Save-/Delete-Feedback in Tabellen
- eine feste Norm fuer Table-State-Anzeige bei `loading`, `empty`, `error`
- eindeutiger Filterstandard ueber beide Tabellenfamilien

### Altlast / deprecated
- stillschweigende Tabellenabweichungen, die nur aus Runtime-Verhalten entstehen
- Tabellenkonfigurationen, die in JSON stehen, aber von der aktiven Runtime nicht konsumiert werden

### Baustelle / nicht Standard
- Tabellen mit Preview-/Gap-Vertrag
- Tabellen mit nur lokalem Read oder lokalem Write

## 4. State-Standard

### Bereits Standard
- `panelState` ist im ADM-Bestand real vorhanden
- reale sichtbare ADM-Zustaende:
  - `live`
  - `preview`
  - `partial`
  - `gap`
- zugehoerige Metafelder:
  - `panelState`
  - `panelStateLabel`
  - `panelStateHint`
- Runtime leitet fehlende Panelstates teilweise automatisch aus `loadBinding`, `saveBinding` und `sourceOfTruth` ab

### Neu als Standard einzufuehren
- sichtbare UI-Zustaende fuer jede produktive Flaeche:
  - `loading`
  - `empty`
  - `error`
  - `dirty`
  - `saving`
  - `success`
- feste Trennung zwischen:
  - fachlichem Panelstatus
  - technischem Runtime-Status

### Altlast / deprecated
- unsichtbare technische States ohne sichtbare Rueckmeldung

### Baustelle / nicht Standard
- implizite oder nur intern gesetzte States ohne sichtbare ADM-Oberflaechenbindung

## 5. Filter- und Such-Standard

### Bereits Standard
- Such- und Filterlogik existiert real in Tabellen
- `filterFields` existieren real in aktiven ADM-Tabellen
- globale Suche ist in der Inline-Table-Familie real vorhanden
- Text-, Select-, Checkbox- und Date-Filter sind in der Inline-Table-Runtime vorhanden

### Neu als Standard einzufuehren
- fester UI-Standard fuer:
  - Suchfeld
  - Filterposition
  - Reset
  - sichtbaren Filterstatus
- gleiche Bedienlogik fuer beide Tabellenfamilien

### Altlast / deprecated
- isolierte Einzelimplementierungen ohne einheitliche Bedienoberflaeche

### Baustelle / nicht Standard
- Filterdefinitionen, die im JSON stehen, aber von der aktiven Tabellenruntime noch nicht gleichwertig getragen werden

## 6. Action- und Write-Standard

### Bereits Standard
- `saveBinding` und `loadBinding` sind echte Vertragsbausteine
- reale Binding-Arten im ADM-Bestand:
  - `rpc`
  - `edge_function`
  - `local_only`
  - `auth_action`
  - `none`
- reale Tabellenaktionen:
  - `edit`
  - `duplicate`
  - `delete`
- reale Write-Kontexte:
  - Formular-Write
  - Inline-Row-Write
  - Dialog-Write
  - Edge-Workspace-Writes

### Neu als Standard einzufuehren
- sichtbare Erfolgs- und Fehlerbestaetigung fuer jeden Write-Pfad
- feste Norm, wann ein Write optimistisch lokal gespiegelt wird und wann nicht
- feste Norm fuer Delete-Feedback und Reload-Verhalten

### Altlast / deprecated
- Save-/Delete-Pfade ohne sichtbare Rueckmeldung
- implizite Runtime-Sonderpfade ohne klaren ADM-Verweis

### Baustelle / nicht Standard
- lokale Writes ohne finalen Serververtrag
- vorbereitete Actions-Flaechen ohne echten Write-Pfad

## 7. Was kein Standard ist

Diese Dinge gelten in v1 ausdruecklich nicht als offizieller ADM-Standard:
- reine Runtime-Sonderlogik ohne wiederholtes ADM-Muster
- `preview`, `gap`, `partial` als Produktstandard
- historische Einzelpfade, die nur noch aus Rueckwaertskompatibilitaet leben
- CSS-/DOM-Verhalten, das nur zufaellig durch geerbte Klassen entsteht

## 8. Arbeitsregel fuer weitere Schritte

Jede weitere Standardisierung folgt dieser Reihenfolge:
1. aktiven ADM-Bestand lesen
2. wiederholte Muster als Standard bestaetigen
3. echte Luecken getrennt markieren
4. neue Norm nur dort einfuehren, wo ADM sie noch nicht sauber traegt

Merksatz:
- ADM beschreibt den Workspace-Standard
- Renderer und Resolver fuehren ihn aus
- Sonderlogik bleibt sichtbar, aber wird nicht stillschweigend zum Standard erklaert
