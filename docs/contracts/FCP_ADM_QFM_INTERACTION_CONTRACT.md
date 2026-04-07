# FCP ADM / QFM Interaction Contract

## Zweck

Dieser Vertrag beschreibt die bereits kanonisierten Interaktions- und Action-Standards im FCP-Maskensystem.

Ergaenzt werden damit:

- SQL-Vertragslogik
- JSON-Kopplung
- sichtbare Runtime-Faehigkeiten

Damit gilt:

- vorhandene Funktionen werden nicht uebersehen
- fehlende Funktionen werden explizit sichtbar
- neue Parallelarchitekturen werden vermieden

## Grundsatz

- `ADM` und `QFM` nutzen denselben Vertragsbaukasten.
- `data-table` und `inline-data-table` sind standardisierte Ausdrucksformen.
- Dialoge sind kein eigenes System, sondern ein abgeleiteter Interaktionspfad.
- Bestehende `loadBinding`-, `saveBinding`- und Action-Pfade bleiben fuehrend.

## Kanonische Renderer

- `ReadonlyPanel`
  - Standard fuer reine Anzeige
- `FormPanel`
  - Standard fuer feldbasierte Read-/Write-Flaechen
- `MixedPanel`
  - Standard fuer kombinierte Inhaltsflaechen
- `data-table`
  - tabellarische Uebersicht
- `inline-data-table`
  - direkt bearbeitbare Tabellenflaeche

## Kanonische RenderModes

- `readonly`
- `form`
- `mixed`
- `table`
- `stats`

## Table-Standards

### data-table

- Standard: `rowInteractionMode = dialog`
- Row-Klick oeffnet Detail-/Dialogpfad
- geeignet fuer:
  - Uebersichten
  - Detailanzeige
  - spaetere editierbare Dialoge

### inline-data-table

- Standard: `rowInteractionMode = inline`
- Create/Edit direkt in der Tabelle
- nur Spezialfall:
  - `dialog`
  - `custom`
  - `none`

## Kanonische rowInteractionMode-Werte

- `dialog`
  - Standard fuer `data-table`
- `inline`
  - Standard fuer `inline-data-table`
- `custom`
  - Spezialfall; Runtime wird extern ergaenzt
- `none`
  - keine Standardinteraktion

## Kanonische Table-Actions

- `edit`
- `duplicate`
- `delete`

## Kanonische Table-Action-Vertragskeys

- `tableConfig.deletePayloadDefaults`
- `tableConfig.deleteConfirmMessage`
- `tableConfig.deleteConfirmLabel`
- `tableConfig.duplicatePayloadDefaults`
- `tableConfig.duplicateConfirmMessage`
- `tableConfig.duplicateConfirmLabel`

## Kanonische Runtime-Events

- `fcp-mask:table-row-click`
- `fcp-mask:table-row-edit-request`
- `fcp-mask:table-row-action`
- `fcp-mask:table-row-create`
- `fcp-mask:table-row-save`
- `fcp-mask:table-row-duplicate`
- `fcp-mask:table-row-delete-request`

## Confirm-Standard

- Confirm laeuft ueber den zentralen App-Dialog
- kein separater Ad-hoc-Dialog pro Maske
- wenn kein Dialog verfuegbar ist, existiert nur ein einfacher Fallback

## Was bereits standardisiert ist

- `rowInteractionMode`
- Table-Create/Edit/Delete/Duplicate-Anschluss
- Confirm-Dialog
- Row-Klick-Eventpfad
- Table-Dialog-Ableitung aus Spalten
- Save ueber bestehenden `saveBinding`-/`savePanel`-Pfad

## Was dadurch NICHT automatisch erledigt ist

- neue Businesslogik
- neue Edge-/RPC-Write-Vertraege
- neue Spezial-Dialoge
- neue Fachmodule

## Was bei neuen Fachfaellen zuerst zu pruefen ist

1. Gibt es schon einen passenden Renderer?
2. Gibt es schon einen passenden Interaktionsmodus?
3. Gibt es schon einen passenden Action-Vertrag?
4. Fehlt wirklich Funktionalitaet oder nur ein SQL-/Binding-/Payload-Vertrag?

## Verboten

- neue Parallel-Dialogsysteme
- neue Table-Action-Systeme neben dem bestehenden Vertrag
- UI-Sicherheitslogik statt Backend-Vertrag
- neue Write-Pfade, obwohl ein bestehender Pfad genutzt werden kann

