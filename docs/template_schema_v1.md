# Template Schema V1

## Zweck
`Template Schema V1` ist das Export-/Import-Format fuer den Template-Studio-Editor. Es dient als stabile JSON-Basis fuer spaetere Maskengenerierung.

## Struktur
```json
{
  "version": "1.0",
  "generated_at": "2026-03-07T13:00:00.000Z",
  "layout": {
    "mask_path": "/app/",
    "viewport": "web",
    "slots": {
      "header": { "columns": 12 },
      "main": { "columns": 12 },
      "footer": { "columns": 12 }
    }
  },
  "components": [
    {
      "id": "members-table",
      "type": "table",
      "slot": "main",
      "props": {
        "label": "Mitglieder Tabelle",
        "variant": "standard",
        "span": 12,
        "minHeight": 220,
        "notes": "Row click oeffnet Dialog"
      }
    }
  ]
}
```

## Pflichtfelder
- `version`: muss `"1.0"` sein
- `layout.mask_path`: String, beginnt mit `/`
- `layout.viewport`: `web | tablet | phone`
- `layout.slots`: Objekt vorhanden
- `components`: Array

## Komponenten-Regeln
Jede Komponente braucht:
- `id`: nicht leer
- `type`: einer von
  - `table`
  - `card`
  - `dialog`
  - `button`
  - `input`
  - `list`
  - `section`
  - `header`
  - `footer`
- `slot`: einer von
  - `header`
  - `main`
  - `sidebar`
  - `footer`
- `props`: Objekt (optional, aber falls vorhanden als Objekt)

## Validierung im Studio
Beim Laden via `JSON laden` gilt:
1. Wenn `layout + components` vorhanden sind, wird V1 validiert.
2. Bei Fehlern wird Import abgebrochen und Fehlermeldung ausgegeben.
3. Bei Erfolg wird V1 intern in das Editor-Arbeitsmodell transformiert.
4. Legacy-Format (`slots`-basiert) bleibt kompatibel.

## Export Contract
Der sichtbare JSON-Export im Studio ist V1.
