# ADM ClubSettings Work / Approvals Contract

## Ziel
Dieses Dokument haelt den aktuellen belastbaren Vertragsstand fuer:
- `Gewaesser`
- `Helfer / Arbeitseinsaetze`
- `Freigaben`

Es ist bewusst:
- kein neues `ADM_*.json`
- keine freie Runtime-Erfindung
- kein impliziter Live-Vertrag
- sondern eine saubere Trennung zwischen:
  - bereits vorhandener Code-/Backend-Wahrheit
  - bereits anschliessbarer Read-Logik
  - noch fehlendem kombinierten Board-Vertrag

## Gepruefte Quellen
- [ADM_clubSettings.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/ADM_clubSettings.json)
- [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js)
- [club-onboarding-workspace/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-onboarding-workspace/index.ts)
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)
- [02_04_26_DB_V4.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/02_04_26_DB_V4.json)

## Kurzurteil
- `Gewaesser`: Code und Read-/Write-Vertrag sind bereits vorhanden.
- `Helfer / Arbeitseinsaetze`: Datenbausteine sind vorhanden, aber kein finaler kombinierter ADM-Read.
- `Freigaben`: fachlicher Zielbereich vorhanden, aber kein finaler eigener Read-/Write-Vertrag im ClubSettings-Board.

## 1. Gewaesser

### Bereits vorhandene Wahrheit
- Alte Live-UI:
  - [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js)
- Edge Function:
  - [club-onboarding-workspace/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-onboarding-workspace/index.ts)

### Belastbarer Vertrag
Read:
- Edge Function `club-onboarding-workspace`
- Payload:
  - `action = "get"`
  - `club_id`
- Rows:
  - `record.workspace.waters`

Write:
- `create_water`
- `update_water`
- `delete_water`
- `toggle_water`

### Bereits vorhandene Felder
- `id`
- `name`
- `area_kind`
- `water_type`
- `water_status`
- `is_youth_allowed`
- `requires_board_approval`
- `water_cards`

### Vertragsstatus
- `Read`: bereits belastbar
- `Write`: bereits im Edge-Code vorhanden
- `ADM-Runtime`: fuer Live-Read anschliessbar
- `ADM-CRUD`: noch nicht final angeschlossen, weil `admin-panel-mask.js` aktuell noch keine Tabellen-Submit-Handler aus dem JSON-Vertrag zieht

## 2. Helfer / Arbeitseinsaetze

### Bereits vorhandene Datenbausteine
Backend-/DB-seitig vorhanden:
- `public.work_events`
- `public.work_participations`
- `public.event_planner_configs`
- `public.event_planner_registrations`

Bestandsquellen:
- [02_04_26_DB_V4.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/02_04_26_DB_V4.json)
- [work-events-cockpit.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/work-events-cockpit.js)
- [work-events-member.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/work-events-member.js)

### Was fehlt
Es gibt aktuell **keinen** belastbaren kombinierten ClubSettings-Read-Vertrag, der fuer einen Admin-Board-Block sauber liefert:
- Event / Einsatz
- Slot / Rolle
- Helferzahl
- Approval-Mode
- Status
- Starts-at
- club-scope-gesichert in genau einer Antwort

### Fehlende Pflichtteile
- fehlender `loadBinding` auf einen echten kombinierten Reader
- fehlender `rowsPath` fuer einen finalen kombinierten Payload
- fehlender dokumentierter `securityContext` fuer den kombinierten Board-Reader
- fehlender Audit-Vertrag fuer Admin-Lesezugriffe auf Helfer-/Teilnahmedaten

### Vertragsstatus
- `DB-Wahrheit`: vorhanden
- `ADM-Board-Read`: noch nicht final belegt
- `JSON-Live-Vertrag`: noch nicht sauber freigebbar

## 3. Freigaben

### Bereits vorhandene fachliche Hinweise
Im Bestand ist der Bereich als eigener Zielbereich vorgesehen:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)

Im aktuellen ADM-Stand gibt es:
- Vergleichsflaeche `Freigaben im Vereinskontext`
- Spezialbereich `Fangfreigaben`

### Was noch nicht belegt ist
Es gibt aktuell **keinen** finalen ClubSettings-Vertrag fuer:
- Fangfreigaben-Read
- Fangfreigaben-Statuswechsel
- Freigabe-Audit
- Zuweisung eines pruefenden Actors

Die bisherige Quelle `catch_approvals_contract_pending` ist ausdruecklich nur ein Platzhaltername.

### Fehlende Pflichtteile
- fehlender echter `sourceTable` / RPC / Edge-Reader
- fehlender `rowsPath` fuer Live-Daten
- fehlender `saveBinding`
- fehlender `securityContext` fuer Admin-Freigabehandlungen
- fehlende serverseitige Prozesswahrheit fuer Statuswechsel

### Vertragsstatus
- `fachlicher Zielbereich`: vorhanden
- `Live-Read-Vertrag`: fehlt noch
- `Write-/Audit-Vertrag`: fehlt noch

## 4. Saubere Anschlussreihenfolge

1. `Gewaesser`
- Live-Read in `ADM_clubSettings.json` anschliessen
- CRUD erst dann live, wenn die ADM-Table-Runtime JSON-seitig Save-/Delete-Handler sauber tragen kann

2. `Helfer / Arbeitseinsaetze`
- eigenen kombinierten Club-Admin-Reader definieren
- erst danach `inline-data-table` live machen

3. `Freigaben`
- eigenen Read-/Write-/Audit-Vertrag definieren
- erst danach Spezialbereich und Vergleichsflaeche live befuellen

## 5. Merksatz

- `Gewaesser` ist bereits Code-Wahrheit und kann gelesen werden.
- `Helfer` und `Freigaben` haben bereits Datenbausteine, aber noch keinen finalen kombinierten ClubSettings-Vertrag.
- Solange dieser Vertrag nicht real belegt ist, bleibt der richtige Output:
  - Contract-Dokument
  - kein freies Live-Binding
