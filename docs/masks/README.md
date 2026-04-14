# FCP Mask JSON Layout

Dieser Ordner ist der feste Ablageort fuer alle maskensteuernden JSON-Dateien des FCP-Maskensystems.

## Struktur

```txt
docs/masks/
  README.md
  standards/
  qfm/
  adm/
  templates/
```

## Regel

- Echte Quickflow-Masken liegen in `docs/masks/qfm/`
- Echte Admin-Panel-Masken liegen in `docs/masks/adm/`
- Standarddefinitionen fuer das Maskensystem liegen in `docs/masks/standards/`
- Vorlagen und Authoring-Schablonen liegen in `docs/masks/templates/`

## Namenskonvention

- `docs/masks/qfm/QFM_<mask_name>.json`
- `docs/masks/adm/ADM_<mask_name>.json`

Beispiele:

- `docs/masks/qfm/QFM_einstellungen.json`
- `docs/masks/qfm/QFM_fangliste.json`
- `docs/masks/adm/ADM_admin-panel.json`

Wichtige Zusatzregel:

- Nur echte, reader-validierbare Masken duerfen `QFM_*.json` oder `ADM_*.json` heissen.
- Blocker-, Analyse- oder Review-Dateien duerfen diese Prefixe nicht als finale Maskendatei verwenden.
- Keine Hybrid-Dateien:
  - also nicht oben Analyse / unten halbe Maske in derselben `QFM_*.json`.
- Fuer Blocker-/Review-Ausgaben stattdessen z. B.:
  - `*.review.md`
  - `*_blocked.review.json`
  - `*_analysis.md`

## Warum hier

Dieser Ort ist bewusst getrennt von:
- `docs/contracts/` fuer Regeln und Systemvertraege
- `docs/design/` fuer optische Referenzen und Mockups
- `src/` fuer echte Renderer-Implementierung

Damit gilt:
- Contract beschreibt die Regeln
- Design zeigt das Zielbild
- Mask JSON beschreibt die konkrete Maske
- Sicherheitskontext wird in JSON beschrieben, aber serverseitig durch SQL, RLS und RPCs durchgesetzt

## Authoring-Regel

Die JSON-Datei ist die technische Maskenreferenz.

Der Renderer darf nicht:
- Struktur raten
- Komponenten frei waehlen
- Save-/Load-Pfade frei interpretieren

## Schablonen

Vorlagen liegen in:

- `docs/masks/templates/QFM_mask.template.json`
- `docs/masks/templates/ADM_mask.template.json`

Diese Templates enthalten:
- Pflichtfelder
- normierte Feldwerte
- Hinweise fuer Fehler / Warnung / Feedback bei der spaeteren Validierung
- standardisierte `securityContext`-Bloecke fuer Tenant-, Membership- und Rollenbezug

## Standards

Die aktuelle Primaerreferenz fuer den Workspace-Standard liegt in:

- `docs/masks/standards/ADM_STANDARDMATRIX_V1.md`

Diese Matrix definiert:
- was im aktiven ADM-Bestand bereits Standard ist
- was neu als Standard einzufuehren ist
- was Altlast / deprecated bleibt
- was nur Baustelle und nicht offizieller Standard ist

## Reader

Das gemeinsame Leserohr fuer Mask-JSON liegt in:

- `scripts/fcp-mask-reader.mjs`

Verwendung:

- `node scripts/fcp-mask-reader.mjs docs/masks/qfm/QFM_<mask_name>.json`
- `node scripts/fcp-mask-reader.mjs docs/masks/adm/ADM_<mask_name>.json`

Der Reader:
- liest Prefix und `maskFamily`
- prueft den Contract
- normalisiert Sections, Panels, Fields und Bindings
- liefert ein `resolvedMaskConfig`
- erzeugt einen `renderPlan`, damit Renderer und Umsetzer nicht neu interpretieren muessen

## Validator

Zusatzpruefung fuer alle echten Masken-Dateien:

- `node scripts/check-mask-jsons.mjs`

Der Validator:
- prueft alle `QFM_*.json` und `ADM_*.json` unter `docs/masks/`
- meldet ungültige Reader-Dateien
- meldet Hybrid-/Review-Schluessel auf Top-Level
- verhindert, dass Analyse-Dateien still wie echte Masken aussehen
