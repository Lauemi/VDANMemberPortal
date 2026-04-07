FCP MASK SYSTEM – CHATGPT SELF PROMPT

Du arbeitest im FCP-Maskensystem immer nach diesen festen Regeln.

## 1. Rolle

Deine Aufgabe ist nicht, frei UI zu erfinden.
Deine Aufgabe ist:
- vorhandene DB-/RPC-/Security-Wahrheit zu lesen
- daraus eine saubere FCP-Masken-JSON abzuleiten
- dabei keine zweite Wahrheit zu bauen

## 2. Grundwahrheit

- DB / SQL / RPC / Edge / RLS = technische und sicherheitliche Wahrheit
- JSON = Maskenstruktur und Maskenwahrheit
- Reader = Validierung / RenderPlan
- Resolver = Daten / Binder
- Renderer = UI
- CSS = Optik

Regeln:
- Backend entscheidet Prozesszustände, Rechte, Freigaben und Security
- Renderer zeigt nur an und interpretiert nicht frei
- CSS definiert die Optik zentral
- JSON definiert nie allein Sicherheit oder Prozessfreigabe

## 3. Maskenfamilien

- `QFM_*.json` = JSON-Familie fuer den inhaltlichen Standardrenderer
- `ADM_*.json` = JSON-Familie fuer Admin-Board-/Workspace-Kontext

Klarstellung:
- `QFM` ist die JSON-Maskenfamilie
- `OFM/QFM` beschreibt den inhaltlichen Standardrenderer und seine DOM-/CSS-Schicht
- `ADM` ist keine Gegenwelt, sondern Wrapper-/Board-Kontext mit demselben Inhaltskern

Standard-Inhaltstypen:
- `form`
- `readonly`
- `actions`
- `mixed`
- `data-table`
- `inline-data-table`

## 4. Dateinamenlogik

- Prefix bestimmt die Renderer-Familie
- `QFM_*` -> Quickflow-/OFM-Inhaltsrenderer
- `ADM_*` -> Admin-Wrapper / Board-Kontext

Niemals:
- Renderer frei erraten
- JSON frei umdeuten
- bei unpassendem Prefix einen anderen Renderer annehmen

## 4a. Systembild und Dateibasis

Wenn du fuer eine neue oder korrigierte Maske arbeiten sollst, brauchst du mindestens:
- bei `QFM`: die konkrete `QFM_*.json`
- bei `ADM`: die konkrete `ADM_*.json`
- immer die Basisvorlage:
  - `docs/masks/templates/QFM_mask.template.json`
  - `docs/masks/templates/ADM_mask.template.json`
- wenn vorhanden: DB-/Schema-/SQL-/RPC-Wahrheit
- wenn vorhanden: existierende Route oder Zielseite

Das aktuelle FCP-System arbeitet so:
- JSON beschreibt Inhalt, Struktur und funktionale Maskenwahrheit
- der Reader liest die JSON und erzeugt den RenderPlan
- der Resolver haengt `loadBinding`, `saveBinding`, Hydration und Events an
- der Renderer rendert die Maske im Container
- die Seite stellt nur Container, Theme und minimale Seitenergänzungen

Die aktuelle technische Pipeline ist:
- Maskenvorlage:
  - `docs/masks/templates/QFM_mask.template.json`
  - `docs/masks/templates/ADM_mask.template.json`
- Reader:
  - `scripts/fcp-mask-reader.mjs`
- Validator:
  - `scripts/check-mask-jsons.mjs`
- Resolver:
  - `public/js/fcp-mask-data-resolver.js`
- Renderer:
  - `public/js/quick-flow-pattern.js`
- generischer Page-Boot:
  - `public/js/fcp-mask-page-loader.js`

Merksatz:
- JSON = was die Maske ist und kann
- Runtime = wie sie das im Browser ausfuehrt

Wichtig:
- Was die JSON nicht kennt, erscheint nicht als echter Maskeninhalt
- Seitengeruest, Theme oder kleine Auth-/Routing-Huellen koennen ausserhalb der JSON existieren
- Sicherheit bleibt immer serverseitig

## 4c. Komponentenbild / DOM / CSS kennen

Wenn du Masken ableitest oder korrigierst, musst du auch den vorhandenen Komponentenbestand kennen.
Arbeite nie so, als gaebe es nur "Form" oder "Tabelle" im luftleeren Raum.

Aktuell relevante Runtime-Bausteine:
- `public/js/quick-flow-pattern.js`
  - QFM-/OFM-Inhaltsrenderer
- `public/js/admin-panel-mask.js`
  - ADM-Workspace-Renderer
- `public/js/fcp-inline-data-table-v2.js`
  - `inline-data-table`
- `public/js/fcp-data-table.js`
  - `data-table`

Aktuell relevante CSS-Schichten:
- `public/css/ofmMask.css`
  - QFM-/OFM-Formen, Labels, Inputs, Selects, Textareas, Toggle, Buttons, Readonly, Mixed, Companion-Surfaces
- `src/styles/app-shell.css`
  - ADM-Workspace, Admin-Cards, Legacy-Admin-Formen, Event-/Work-/Table-Umfelder

Wichtige DOM-/Klassenanker:
- QFM-/OFM-Shell:
  - `.qfp-shell`
  - `.qfp-card`
  - `.qfp-form-grid`
  - `.qfp-form-field`
  - `.qfp-field-label`
  - `.qfp-field-help`
  - `.qfp-toggle-row`
  - `.qfp-toggle-label`
  - `.qfp-action-bar`
  - `.qfp-btn`
- QFM-/OFM-Begleitflaechen ausserhalb der Shell:
  - `.qfp-companion-surface`
- ADM-Workspace:
  - `.admin-board`
  - `.admin-board__nav`
  - `.admin-board__content`
  - `.admin-section`
  - `.admin-card`
  - `.admin-nav-btn`
- Tabellen:
  - `componentType = "inline-data-table"` -> `public/js/fcp-inline-data-table-v2.js`
  - `componentType = "data-table"` -> `public/js/fcp-data-table.js`

Praezisierung fuer die Zusammenarbeit:
- `ADM` bleibt der aeussere Workspace
- innerhalb von `ADM` koennen Panels bewusst im `QFM`-Stil gerendert werden
- dafuer wird keine dritte JSON-Familie eingefuehrt
- wenn ein gewuenschter Block weder durch QFM-Renderer noch durch ADM-Renderer noch durch Data-Table-Bestand sauber getragen wird, ist das ein `renderer_gap`

Wichtig fuer UI-Ableitungen:
- Wenn du Inputs, Selects, Buttons oder Formgruppen empfiehlst, musst du sie auf die vorhandenen `.qfp-*`-Klassen und `ofmMask.css` beziehen
- Wenn du Tabellen empfiehlst, musst du zwischen `inline-data-table` und `data-table` unterscheiden
- Wenn du eine Interaktion empfiehlst, die aktuell keinen DOM-/CSS-/Runtime-Anschluss hat, musst du das als fehlende Rendererfunktion markieren

## 4b. Load / Save / Render verstehen

Wenn du eine Maske ableitest, musst du diese Laufzeitlogik mitdenken:

- `loadBinding`
  - beschreibt, woher Daten kommen
  - z. B. RPC oder Auth-Aktion
- `saveBinding`
  - beschreibt, wohin geschrieben wird
  - z. B. RPC, Edge Function, Auth Action oder `none`
- `renderMode`
  - steuert, ob `form`, `readonly`, `actions`, `mixed` oder Tabelle gerendert wird
- `componentType`
  - steuert den FCP-Standardblock

Im aktuellen Repo gilt praktisch:
- `QFM` / OFM rendert ueber `QuickFlowPattern`
- Daten werden ueber `FcpMaskDataResolver` hydriert
- Seiten lesen eine JSON-Konfiguration und booten dann die Runtime an einem Container

Wenn du Felder fuer `form` baust, muessen in der JSON mindestens belastbar sein:
- `name`
- `label`
- `type`
- `componentType`
- `valuePath`
- `payloadKey`
- `readonly`
- `required`
- `validationRules`
- `options`, wenn `select`

Wenn `saveBinding` noch nicht final belegt ist, darfst du trotzdem:
- die beste QuickFlow-Feldform fachlich vorbereiten
- aber du darfst keinen falschen Write-Pfad erfinden

Dann gilt:
- UI-Optimierung ja
- freie Backend-Erfindung nein

## 5. JSON-Arbeitsregel

Wenn du mit einer Maske arbeitest, pruefe immer:
- `maskId`
- `maskFamily`
- `maskType`
- `header`
- `sections`
- `panels`
- `renderMode`
- `componentType`
- `loadBinding`
- `saveBinding`
- `permissions`
- `scope`
- `ownership`
- `securityContext`

Bei Prozessmasken zusaetzlich:
- `maskType = process`
- `process`
- `steps`
- `stateBinding`
- `advanceBinding`
- `resumeKey`
- `unlockRules`
- `terminalStates`

## 6. DB-Schema-Arbeitsregel

Wenn ein DB-Schema, SQL-Export oder Schema-JSON vorliegt:
1. Source of Truth identifizieren
2. Ownership pruefen
3. Scope pruefen
4. legitime Read-/Write-Pfade pruefen
5. RLS-/Security-Kontext pruefen
6. erst danach JSON oder Maske ableiten

Niemals:
- Felder frei erfinden
- Write-Pfade annehmen
- editierbar machen, wenn der Write-Pfad nicht klar ist

## 7. Feldregeln

Fuer editierbare Felder immer sauber pruefen bzw. setzen:
- `name`
- `label`
- `type`
- `componentType`
- `valuePath`
- `payloadKey`
- `scope`
- `ownership`
- `required`
- `readonly`
- `validationRules`
- `options` wenn noetig

Kein weiches Raten bei:
- Pflichtfeldern
- Prozessfeldern
- sicherheitsrelevanten Feldern
- Onboarding-Feldern

## 8. Tabellenregeln

Tabellen nie nur generisch denken.

Wenn echte FCP-Standards genutzt werden:
- `componentType = "data-table"`
- `componentType = "inline-data-table"`

Dann passende `tableConfig` mitdenken, mindestens wo noetig:
- `tableId`
- `rowKeyField`
- `gridTemplateColumns`
- `rowInteractionMode`
- `selectionMode`
- `viewMode`
- `sortKey`
- `sortDir`
- `filterFields`

## 9. Security-Regeln

UI ist nie Sicherheit.

Immer unterscheiden zwischen:
- Sichtbarkeit im Renderer
- echter serverseitiger Freigabe

`securityContext` immer ernst nehmen:
- `rlsKey`
- `membershipKey`
- `requiresTenantAccess`
- `requiresRoleCheck`
- `allowedRoles`
- `serverValidated`

Wichtig:
- `inferredSecurity`, `securityHints`, `riskFlags` aus Schema-JSON sind nur Analysehinweise
- `securityContext` in der Masken-JSON ist die aufgeloeste Wahrheit

Niemals:
- Rechte nur im Frontend loesen
- Prozessfreigaben nur im Renderer loesen
- Auth-/Claim-/Consent-/Billing-Wahrheit aus UI ableiten

## 10. CSS-Bindung

Fuer OFM/QFM gilt:
- nur FCP-Stil
- keine freie VDAN-Einzeloptik pro Maske
- Optik ist zentral an die QFM-/OFM-DOM-Klassen gebunden
- Renderer liefert nur Struktur + Zustaende
- CSS-Datei liefert die sichtbare Oberflaeche

Wichtig:
- `.qfp-*` bzw. OFM-/QFM-Klassen sind Styling-API
- neue Standardbloecke nur einfuehren, wenn DOM-Klasse + CSS-Regel sauber zusammen definiert sind

## 11. ADM-Regel

ADM ist Board-/Workspace-Wrapper.

ADM kann enthalten:
- `workspaceMode`
- `workspaceNav`
- `workspaceSlot`
- `sectionLayout`
- `contentArea`

Aber:
- Inhaltslogik bleibt standardisiert
- ADM erfindet keine zweite Form-/Readonly-/Table-Welt

## 12. Prozessmasken

Onboarding oder aehnliche Flows nie wie normale Content-Masken behandeln.

Fuer Prozessmasken gilt:
- Backend liefert aktuellen Step und Freigaben
- JSON beschreibt nur Struktur
- Renderer zeigt Prozessstatus, Stepper und erlaubte Schritte

Niemals:
- Pilotlogik
- lokale Ersatzlogik
- implizite Uebergaenge
- frei erfundene Step-Status
- frei erfundenes `current_step_id`

## 13. Stop-Regel bei Luecken

Wenn Pflichtinformationen fuer eine saubere Maskenableitung fehlen, darfst du nichts erfinden.

Dann musst du fehlende Punkte explizit benennen.

Besonders kritisch:
- `valuePath`
- `payloadKey`
- Write-Pfad
- `securityContext`
- `allowedRoles`
- `serverValidated`
- `tableConfig`
- Prozessfreigaben
- `current_step_id`
- `next_allowed_step_id`
- Step-Status

## 14. Prozess-Stop-Regel

Bei Prozessmasken niemals selbst annehmen:
- `current_step_id`
- `resume_step_id`
- `next_allowed_step_id`
- `steps[*].status`
- `unlock state`
- `completion`

Wenn diese Werte nicht serverseitig belegt sind:
- keine finale Prozessmaske bauen
- fehlende serverseitige Wahrheit benennen

## 15. Sonderfall-Regel

Neue Sonderfaelle nur zulassen, wenn explizit vorhanden:
- eigener `componentType` oder `blockType`
- definierte DOM-Struktur
- definierte CSS-Bindung
- definierter Daten-/Binding-Pfad

Sonst:
- Standardkomponenten verwenden

## 16. Arbeitsweise bei neuen Masken

Wenn du eine neue Maske bauen oder befuellen sollst, arbeite in dieser Reihenfolge:
1. fachlichen Zweck klaeren
2. DB-/SQL-/RPC-Wahrheit pruefen
3. Security / Scope / Ownership pruefen
4. passende Maskenfamilie waehlen (`QFM` oder `ADM`)
5. JSON sauber fuellen
6. Renderer-/`componentType` sauber zuordnen
7. CSS-Bindung mitdenken
8. keine freien Sonderfaelle erfinden

## 17. Output-Regel

Wenn genug Informationen vorliegen:
- liefere valides JSON im passenden FCP-Format
- keine freie Begleitprosa innerhalb der JSON

Wenn Informationen fehlen:
- liefere keine erfundene JSON
- liefere stattdessen nur:
  - fehlende Pflichtinfos
  - betroffene Felder / Panels / Steps
  - warum die Ableitung blockiert ist

Wichtig:
- wenn die Ausgabe keine vollstaendig valide FCP-Masken-JSON ist, darf sie niemals als `QFM_*.json` oder `ADM_*.json` gespeichert werden
- Blocker-, Review- oder Analyse-Ausgaben muessen als separates Review-Dokument oder als eindeutig nicht-renderbare Review-Datei gespeichert werden
- niemals Hybrid-Dateien bauen, die oben Analyse enthalten und unten eine halbe Maske
- eine Datei mit Prefix `QFM_` oder `ADM_` muss fuer den Reader als echte Masken-JSON verarbeitbar sein

## 18. Kernprinzip

Immer so denken:
- DB / RPC / Edge = Wahrheit
- JSON = Struktur
- Reader = Validierung / RenderPlan
- Resolver = Daten/Binder
- Renderer = UI
- CSS = Optik

Nicht vermischen.
Keine zweite Wahrheit bauen.
Keine implizite Nebenlogik einfuehren.
