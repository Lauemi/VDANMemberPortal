# Design Handoff Struktur

Ziel: Figma und Code ohne Missverständnisse abstimmen.

## Dateien

- `docs/design/figma_handoff.md`
  - Pro Screen/Flow: Link, Maße, States, Verhalten.
- `docs/design/token_map.md`
  - Verbindliche Design-Tokens (Farben, Typo, Spacing, Radius, Shadow).
- `docs/design/ui_inventory.md`
  - Ist-Zustand der wichtigsten Seiten/Module.
- `docs/design/decisions_log.md`
  - Kurzprotokoll für Designentscheidungen und Scope-Änderungen.

## Workflow

1. Du ergänzt/änderst in `figma_handoff.md`.
2. Ich setze exakt danach um.
3. Abweichungen oder Tradeoffs landen in `decisions_log.md`.
4. Token-Änderungen nur in `token_map.md` und dann Code.
