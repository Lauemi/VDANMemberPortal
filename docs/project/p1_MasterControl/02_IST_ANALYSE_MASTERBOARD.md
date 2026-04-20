# Project One — Ist-Analyse Masterboard

Stand: 2026-04-20

## Zweck

Dieses Dokument beschreibt den aktuell real vorhandenen Systemzustand des FCP-Masterboards im Repo.

Es dient als belastbare Ist-Basis fuer jede weitere MasterControl-Arbeit.

Grundsatz:

- repo-wahr
- dateibasiert
- ohne Annahmen
- keine Ableitung aus Wunschbild oder Chat allein

---

## Bestaetigte reale Dateien

### Produktive Masterboard-Dateien

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`

### Operative Board-Artefakte

- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`
- `docs/FCP_company/fcp_masterboard_interaktiv.html`
- `docs/FCP_company/FCP_MASTERBOARD_PFLEGEMODELL.md`
- `docs/FCP_company/FCP_MASTERBOARD_PFLEGEVERTRAG.md`
- `docs/FCP_company/FCP_CLOSING_AGENT_CONTEXT.md`

### DB-/RPC-Grundlage

- `supabase/migrations/20260331153000_fcp_masterboard_db_foundation.sql`
- `supabase/migrations/20260331161500_fcp_masterboard_process_priority_normal.sql`
- `docs/supabase/fcp_masterboard_seed_current_state.sql`

### Relevante Projektdateien in diesem Ordner

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `01_ZIELBILD_MASTERCONTROL.md`

Wichtig:

Zum Zeitpunkt dieser Ist-Analyse lagen im Projektordner urspruenglich nur `00_` und `01_` real vor. Die Analyse- und Arbeitsdateien ab `02_` werden jetzt erstmals als Repo-Dokumentation materialisiert.

---

## Reale Systemstruktur heute

Das aktuelle Masterboard besteht aus vier Schichten:

1. Produktive UI
2. Client-Logik
3. operative Board-Artefakte
4. DB-/RPC-Schicht

### 1. Produktive UI

Die Route `src/pages/app/masterboard/index.astro` ist die reale Einstiegsmasken-Datei des Masterboards.

Sie liefert:

- Seitenrahmen
- Intro / Statushinweis
- Topbar mit Suche, Filtern und Aktionen
- Fuehrungsbereich mit Moduswechsel und Top-3-Blockern
- Tab-Umschalter fuer Masterboard und operatives Kontrollboard
- einen gemeinsamen Drawer fuer Detail- und Pflegeeingaben

### 2. Client-Logik

`public/js/masterboard-app.js` enthaelt die operative Frontend-Logik.

Dort passieren heute real:

- Laden des Live-States ueber Supabase-RPC
- Bootstrap-Fallback bei Live-Fehler
- Normalisierung der Node- und Prozessdaten
- Rendering von Lanes und Karten
- Rendering der Prozessliste
- Heuristische Priorisierung fuer den Fuehrungsmodus
- Oeffnen und Speichern der Drawer-Inhalte
- Export des aktuellen Zustands als JSON

### 3. Operative Board-Artefakte

Die beiden JSON-Dateien unter `docs/FCP_company/` enthalten den repo-sichtbaren Board- und Prozessstand.

- `fcp_masterboard_state.json` enthaelt die Masterboard-Nodes
- `fcp_process_control_state.json` enthaelt die Prozesse des operativen Kontrollboards

Diese Dateien dienen heute nicht mehr als alleinige Live-Wahrheit, sondern als:

- Bootstrap-Quelle
- Fallback-Quelle
- Export-/Repo-Referenz
- agentische Arbeitsgrundlage

### 4. DB-/RPC-Schicht

Die operative Wahrheit liegt in der Datenbank.

Die Migration `20260331153000_fcp_masterboard_db_foundation.sql` definiert:

- `public.system_superadmins`
- `public.system_board_nodes`
- `public.system_process_controls`
- `public.fcp_is_superadmin()`
- `public.fcp_masterboard_nodes_get()`
- `public.fcp_process_controls_get()`
- `public.fcp_masterboard_node_upsert(...)`
- `public.fcp_process_control_upsert(...)`
- `public.fcp_masterboard_seed(...)`

Damit ist das aktuelle Masterboard kein reines statisches Repo-Board, sondern eine DB-schreibende Pflegeoberflaeche.

---

## Datenfluss heute

## 1. Bootstrap-Injektion in die UI

In `src/pages/app/masterboard/index.astro` werden beim Rendern serverseitig beide JSON-Dateien gelesen und in das Fensterobjekt geschrieben:

- `window.__FCP_MASTERBOARD_BOOTSTRAP__`
- `window.__FCP_PROCESS_CONTROL_BOOTSTRAP__`

Das heisst:

- die Route hat immer einen repo-basierten Startzustand zur Verfuegung
- dieser Zustand wird dem Client als Fallback und Seed-Material mitgegeben

## 2. Live-Laden per RPC

Beim Start versucht `public/js/masterboard-app.js`, den echten Zustand ueber RPC zu laden:

- `fcp_masterboard_nodes_get`
- `fcp_process_controls_get`

Wenn das erfolgreich ist:

- Quelle = `Live DB`
- Board rendert auf Basis der DB-Daten

## 3. Fallback bei Fehler

Wenn der RPC-Ladevorgang scheitert:

- der Client faellt auf die Bootstrap-Daten zurueck
- Quelle = `Bootstrap`
- im Hinweistext wird auf fehlende Superadmin-Berechtigung oder nicht erreichbare Live-DB hingewiesen

## 4. Schreiben aus der UI

Wenn im Drawer gespeichert wird:

- Node-Drawer schreibt via `fcp_masterboard_node_upsert`
- Process-Drawer schreibt via `fcp_process_control_upsert`

Die UI ist damit heute real eine schreibende Board-Pflegeoberflaeche.

## 5. Seed aus JSON in die DB

Der Button `Bootstrap uebernehmen` ruft `fcp_masterboard_seed` auf.

Damit koennen die beiden JSON-Zustaende einmalig oder erneut in die DB geschrieben werden.

---

## DB / JSON / UI / RPC-Wahrheit

### DB-Wahrheit

Die operative Wahrheit ueber den aktuellen Board-Zustand liegt in:

- `public.system_board_nodes`
- `public.system_process_controls`

Das wird durch Pflegemodell, Pflegevertrag und die Migration selbst gestuetzt.

### RPC-Wahrheit

Die produktive UI spricht nicht direkt Tabellen an, sondern die dedizierten RPCs.

Diese RPCs sind der reale Write- und Read-Pfad der produktiven Board-Oberflaeche.

### JSON-Wahrheit

Die JSON-Dateien unter `docs/FCP_company/` sind heute:

- keine alleinige Live-Wahrheit
- aber weiterhin fuehrende repo-sichtbare Referenzartefakte
- Bootstrap- und Fallback-Quelle
- wichtige Synchronisations- und Replikationsquelle fuer Folge-Agenten

### UI-Wahrheit

Die UI ist heute Darstellung plus Pflegeoberflaeche.

Sie ist nicht die Wahrheit ueber den Zustand selbst, sondern:

- Anzeigeziel
- Interaktionsschicht
- schreibende Eingabeschicht fuer DB-Updates

Die UI darf daher nicht ueber DB-/RPC-Wahrheit gestellt werden.

---

## Abgrenzung Bootstrap vs Live-DB

### Bootstrap

Bootstrap bedeutet heute:

- serverseitig eingelesene JSON-Dateien aus `docs/FCP_company`
- Start-/Fallback-Daten
- Seed-Material fuer die DB

Bootstrap ist wichtig fuer:

- Repo-Replizierbarkeit
- Fallback ohne Live-Zugriff
- initiales Aufsetzen der Boardtabellen

Bootstrap ist nicht automatisch gleich aktueller Live-Stand.

### Live-DB

Live-DB bedeutet heute:

- die Tabellen `public.system_board_nodes` und `public.system_process_controls`
- geladen ueber die RPCs
- schreibbar ueber die Drawer-Speicheraktionen

Live-DB ist die operative Pflichtquelle.

### Konsequenz fuer Folge-Agenten

Jeder Folge-Agent muss unterscheiden zwischen:

- repo-sichtbarer Referenzlage in den JSON-Artefakten
- aktuell operativem DB-Stand

Wenn Aenderungen am Masterboard vorgenommen werden, muessen immer beide Ebenen mitgedacht werden:

- DB-/RPC-Wahrheit
- JSON-/Repo-Referenz

---

## Bestaetigte Ist-Fakten zur aktuellen Boardgroesse

Zum Analysezeitpunkt wurden repo-seitig bestaetigt:

- 41 Masterboard-Nodes
- 9 Prozesse im operativen Kontrollboard
- 7 Lanes:
  - `marketing`
  - `flow`
  - `onboarding`
  - `config`
  - `operations`
  - `system`
  - `legal`

---

## Wichtige Ist-Abgrenzung

Das aktuelle System ist bereits mehr als ein statisches Statusboard.

Es ist heute real:

- eine produktive Superadmin-Maske
- mit DB-Lesezugriff
- mit DB-Schreibzugriff
- mit Bootstrap-/Fallback-Logik
- mit getrenntem Masterboard- und Prozesskontrollteil

Es ist aber noch nicht das Zielbild `MasterControl`.

Der zentrale Grund dafuer ist nicht die fehlende Datenbasis, sondern die noch unzureichende Fuehrungs-, Relations- und Workbench-Logik in der UI.
