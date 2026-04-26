# ADM/QFM Standardisierungsstatus nach MINA-68

Erstellt: 2026-04-24 | Basis: repo-wahr (ADM_clubSettings.json, QFM_einstellungen.json, redesign.css, fcp-inline-data-table-v2.js)

---

## 1. Kurzfazit

MINA-68 hat drei konkrete Systemregeln etabliert: (1) 2-Spalten-Layout für ADM-Formulare via `.fcp-adm-shell .qfp-form-grid`, (2) `inline-data-table` als Standard-componentType für Tabellen-Panels, (3) `cards-view`-Grid-Layout in `redesign.css` für `is-redesign`-aktivierte Roots. Diese Regeln gelten **derzeit nur im ADM-Kontext** (mitgliederverwaltung). QFM-Seiten (einstellungen) nutzen `.qfp-shell`, nicht `.fcp-adm-shell` — die ADM-CSS-Regeln greifen dort nicht. Der zuvor verbliebene `data-table`-Nachzügler (`club_settings_cards_table`) ist auf `inline-data-table` umgestellt.

---

## 2. Übernehmbare Systemregeln

| Regel | Ursprung | Geltungsbereich | Risiko |
|---|---|---|---|
| `componentType: "inline-data-table"` als Tabellenstandard | MINA-68 (Freigaben-Panel-Umstellung) | ADM-Masken mit `renderMode: "table"` | Niedrig — JS-Contract (`fcp-inline-data-table-v2.js`) ist stabil; erfordert passende `columns`-Definitionen |
| `displaySpan: null` (halb) vs `displaySpan: "full"` für Feldbreite | MINA-68 (Vereinsdaten 2-Spalten) | Alle ADM-Formular-Panels via `fcp-adm-qfm-shared-renderers.js` | Niedrig — `.is-full`-Klasse wird sauber durch Renderer gesetzt |
| `.fcp-adm-shell .qfp-form-grid` 2-Spalten-CSS | MINA-68 (redesign.css) | ADM-Familie (mitgliederverwaltung) | Niedrig — Selektor-Spezifität klar begrenzt auf `.fcp-adm-shell`; kein Einfluss auf QFM |
| `.is-redesign .cards-view` Grid-Layout | MINA-68 (redesign.css) | Alle `inline-data-table`-Panels mit aktiviertem `is-redesign` | Mittel — setzt voraus, dass Root-Element `is-redesign`-Klasse trägt (wird von `fcp-inline-data-table-v2.js` gesetzt) |
| `.qfp-btn--primary` rechtsbündig in Action Bar | MINA-68 (redesign.css, ADM-Formulare) | ADM save-Aktionen | Niedrig — Selektor ist `.fcp-adm-shell .qfp-action-bar` |

**Nicht übernehmbar ohne eigene Arbeit:** globales 2-Spalten-Layout für alle QFM-Formulare. Ein erster, bewusst enger Rollout ist jetzt nur für `/app/einstellungen/` via `#settingsQfmRoot .qfp-shell[data-mask-family="QFM"] .qfp-form-grid` umgesetzt.

---

## 3. Betroffene Masken / Bereiche

| Maske | Datei | Seite | componentType Tabellen | data-table-Reste | cards-view aktiv |
|---|---|---|---|---|---|
| ADM Vereinsverwaltung | `ADM_clubSettings.json` | `/app/mitgliederverwaltung/` | 9× `inline-data-table` | Keine | Teilweise — `club_settings_members_registry` + `club_settings_approvals_table` auf `viewMode: "both"` |
| QFM Einstellungen | `QFM_einstellungen.json` | `/app/einstellungen/` | 0 Tabellen-Panels | — | Nein |
| ADM Eventplaner | `ADM_eventplannerWorkspace.json` | `/app/eventplaner-v2/` | Architektur-Doku only | — | — |
| Template ADM | `ADM_mask.template.json` | — | Beide als Beispiel | Vorhanden (Referenz) | Nein |
| Template QFM | `QFM_mask.template.json` | — | Beide als Beispiel | Vorhanden (Referenz) | Nein |

**ADM_clubSettings.json Panel-Übersicht:**

| Panel-ID | Titel | componentType |
|---|---|---|
| `club_settings_club_approvals_inline_preview` | Freigaben im Vereinskontext | `inline-data-table` ✅ |
| `club_settings_members_registry` | Vereinsverwaltung | `inline-data-table` ✅ |
| `club_settings_roles_backend_contract` | Rollen- und Rechtevertrag | `inline-data-table` ✅ |
| `club_settings_waters_table` | Gewässer | `inline-data-table` ✅ |
| `club_settings_rules_table` | Regelwerke | `inline-data-table` ✅ |
| `club_settings_cards_config_table` | Kartenmodell | `inline-data-table` ✅ |
| `club_settings_cards_table` | Ausweise | `inline-data-table` ✅ |
| `club_settings_work_helpers_table` | Helfer und Arbeitseinsätze | `inline-data-table` ✅ |
| `club_settings_approvals_table` | Fangfreigaben | `inline-data-table` ✅ |

---

## 4. Kandidaten für systemweiten Rollout

### P1 — Abgeschlossen (2026-04-24), minimales Risiko

**`club_settings_cards_table` (Ausweise) → `inline-data-table`**
- Vorher einziger verbleibender `data-table`-Rest in `ADM_clubSettings.json`
- Umstellung analog zu Freigaben-Panel umgesetzt
- Datei: `docs/masks/templates/Onboarding/ADM_clubSettings.json`
- Änderung: `"componentType": "data-table"` → `"componentType": "inline-data-table"`

### P2 — Teilweise umgesetzt (2026-04-24), moderat

**QFM-Formulare 2-Spalten-Layout (QFM_einstellungen.json)**
- `global_profile`-Panel hat bereits `displaySpan: "half"` auf mehreren Feldern → 2-Spalten-Intent ist vorhanden
- Problem: CSS unter `.fcp-adm-shell .qfp-form-grid` gilt nicht für `.qfp-shell`-Seiten
- Umgesetzt: Scoped Override in `redesign.css` für `#settingsQfmRoot .qfp-shell[data-mask-family="QFM"] .qfp-form-grid` inkl. Mobile-Breakpoint und `.is-full`-Spaltenverhalten
- Scope: Nur einstellungen-Seite (`/app/einstellungen/`) — minimales Blast-Radius
- Restoffen: globales QFM-Rollout außerhalb von `settingsQfmRoot` bewusst noch nicht aktiviert

**`cards-view` für ausgewählte ADM-Panels aktivieren (umgesetzt 2026-04-25)**
- Technisch funktionsfähig: `fcp-inline-data-table-v2.js` unterstützt `viewMode: "cards"` / `"both"`
- CSS: `redesign.css` hat `.is-redesign .cards-view` Grid-Layout bereits
- Umgesetzt:
  - `club_settings_members_registry`: `viewMode: "both"` + bestehender `primaryColumnKey`
  - `club_settings_approvals_table`: `viewMode: "both"` + `primaryColumnKey`
  - `cardConfig` ist aktuell als future-facing Dokumentationsstruktur hinterlegt; die runtime-wirksame Umschaltung erfolgt ueber `viewMode`.
- Ergebnis: Kartenansicht ist fuer die zwei priorisierten ADM-Panels aktivierbar, ohne globale Nebenwirkungen.

### P3 — Backlog, erst evaluieren

**QFM Onboarding / Anmeldung-Masken**
- Survey abgeschlossen (2026-04-25):
  - Live-Route `/verein-anfragen/` (`QFM_clubEntryBillingSignIn.json`) lädt `ofmMask.css` **und** `redesign.css`
  - Archiv-Route `src/archive/live-hidden-pages/verein-registrieren/index.astro` (`QFM_clubRegister.json`) lädt aktuell nur `ofmMask.css`
- Konsequenz: Globales QFM-Rollout kann auf Live-Routen mit bestehendem `redesign.css` aufbauen; Archivpfade bleiben separat zu behandeln.

---

## 5. Nicht anfassen / erst prüfen

| Bereich | Grund |
|---|---|
| **ADM Eventplaner** | `ADM_eventplannerWorkspace.json` ist Architektur-Doku, kein Runtime-Treiber. Seite nutzt `event-planner-board.js` direkt — ADM-Mask-Loader-Muster nicht anwendbar. |
| **`ofmMask.css`** | Wird von `einstellungen` geladen und definiert QFM-Basis-Styles. Ohne vollständigen Conflict-Check nicht anfassen — Überschneidungen mit `redesign.css` möglich. |
| **QFM-Formular-CSS (`.qfp-shell`)** | Erst ADM-Rollout vollständig abschließen. Dann separaten Task für `.qfp-shell`-Scope aufsetzen. |
| **`cards-view` in ADM_clubSettings** | Fuer `members_registry` und `approvals_table` bereits aktiviert; weitere Panels nur nach fachlichem Mapping umstellen. |
| **Template-Dateien** | `ADM_mask.template.json` und `QFM_mask.template.json` sind Referenz-Doku — nicht als Runtime-Treiber verwendet, kein Rollout nötig. |

---

## 6. Nächste Tasks

| # | Titel | Typ | Abhängigkeit | Aufwand |
|---|---|---|---|---|
| T1 | Ausweise-Panel auf `inline-data-table` umstellen | Code | Keiner | Erledigt (2026-04-24) |
| T2 | QFM-Einstellungen 2-Spalten: CSS-Scope für `.qfp-shell` ergänzen | Code | Conflict-Check `ofmMask.css` vs `redesign.css` | Erledigt (2026-04-24, settings-scope) |
| T3 | Survey: Laden QFM Onboarding-Masken `redesign.css`? | Analyse | Keiner | Erledigt (2026-04-25) |
| T4 | Cards-View für Mitglieder-Registry aktivieren: `cardConfig` definieren + `viewMode: "both"` | Code | Karten-Spalten-Mapping | Erledigt (2026-04-25, inkl. approvals) |
| T5 | ADM-Formular-Standard dokumentieren: `displaySpan`-Konvention in AGENTS-Doku | Doku | T1 + T2 | S |

---

*Dieser Report ersetzt keine PR-Reviews. Alle Code-Änderungen folgen CEO_DONE_DEFINITION: Branch → PR → Review → main.*
