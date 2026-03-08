# Studio Build Report
Datum: 2026-03-07
Repo Commit: Working tree (lokal, nicht committed)

## Phase 1 – Component Contract
Ziel: stabile Identitaet je editorrelevanter Komponente.

Umgesetzt:
- Neue Attribute an Kernmasken:
  - `data-studio-component-id`
  - `data-studio-component-type`
  - `data-studio-slot`
- Kernmasken:
  - `/app/`
  - `/app/fangliste/`
  - `/app/arbeitseinsaetze/`
  - `/app/mitglieder/`

Beispiel-IDs:
- `/app/`: `app-home-shell`, `app-home-app-grid`
- `/app/fangliste/`: `fangliste-main-card`, `fangliste-list-table`, `fangliste-detail-dialog`
- `/app/arbeitseinsaetze/`: `work-upcoming-table`, `work-mine-table`, `work-member-detail-dialog`
- `/app/mitglieder/`: `members-main-table`, `members-detail-dialog`

## Phase 2 – Table Contract
Ziel: Tabellen vereinheitlichen.

Umgesetzt:
- Pflichtattribute eingefuehrt:
  - `data-table-id`
  - `data-row-click="dialog"`
- Tabellenkontrakt auf Zielseiten:
  - Mitglieder: `members`
  - Fangliste: `fangliste`
  - Arbeitseinsaetze: `work-upcoming`, `work-mine`

Status je Tabelle:
- `members`: row-click ja, filter/search ueber Masken-Toolbar vorhanden
- `fangliste`: row-click ja, filter/search vorhanden, view-toggle vorhanden
- `work-upcoming`/`work-mine`: row-click ja, search vorhanden

## Phase 3 – Export Contract
Ziel: sauberer Picker-Export ohne Debug-Reste.

Umgesetzt:
- Picker-Bridge filtert Debug-Klassen aus Selektor:
  - `studio-inspector-hover`
  - `studio-inspector-selected`
  - `debug`
  - `temp`
- Exportfelder erweitert/vereinheitlicht:
  - `COMPONENT_ID`
  - `COMPONENT_TYPE`
  - `SLOT`
  - `TABLE_ID`
  - `SELECTOR`

Beispieltypen:
- table, card, dialog, button werden als V1 Pick-Lines exportiert.

## Phase 4 – JSON Schema
Ziel: maskenfaehiges, validierbares JSON.

Umgesetzt:
- Dokumentation: `docs/template_schema_v1.md`
- Export im Editor auf `Template Schema V1` umgestellt.
- Validator implementiert (`validateTemplateSchemaV1`):
  - `version`-Check (`1.0`)
  - `layout.mask_path` / `layout.viewport`
  - `components[]`-Checks fuer `id`, `type`, `slot`, `props`
- Importpfade:
  - V1 (`layout + components`) wird validiert und transformiert
  - Legacy (`slots`) bleibt kompatibel

## Phase 5 – Role Simulation
Ziel: Studio-Preview fuer Rollenverhalten ohne Reload.

Umgesetzt:
- Preview-Audience-Schalter:
  - `live`, `guest`, `member`, `manager`, `admin`, `superadmin`
- Sichtbarkeits-Simulation ueber Guard-Attribute:
  - `data-guest-only`
  - `data-member-only`
  - `data-manager-only`
  - `data-admin-only`
  - `data-superadmin-only`
  - `data-admin-or-superadmin-only`
- Ruecksetzung auf Originalzustand bei `live`.

## Phase 6 – Studio Overview
Ziel: schneller Systemstatus im Studio.

Umgesetzt:
- Statuspanel im Template Studio:
  - erkannte Komponenten (`data-studio-component-id`)
  - Tabellen (`data-table-id`)
  - exportierbare Elemente (voller Contract)
- Update bei Audience-Wechsel und Frame-Load.

## Zusatzfixes
- Rechter Inspector im `Masken Editor` ist nun sticky und bleibt beim Scrollen sichtbar.
- Meta-Tag `mobile-web-app-capable` ergaenzt (Deprecated-Warnung reduziert).

## Open Issues
- Einige aeltere Masken ausserhalb der vier Kernseiten haben noch keine expliziten `data-studio-*` IDs.
- Sidebar-Slot ist im Schema erlaubt, aktuell aber noch nicht als eigener Canvas-Slot gerendert.

## Architektur-Risiken
- Solange nicht alle produktiven Masken den Component-Contract tragen, bleibt Picker-Ausgabe teils auto-generiert.
- Fuer spaeteren Full-Editor braucht es serverseitige Persistenz fuer Schema-Versionierung.

## Empfehlungen naechste Schritte
1. Contract-Rollout auf restliche `/app/*`-Masken abschliessen.
2. Sidebar-Slot im Editor-Canvas aktivieren.
3. Persistenz fuer Schema V1 (DB/Storage) inkl. Revisionen aufbauen.
4. Contract als CI-Check (lint/test) erzwingen.
