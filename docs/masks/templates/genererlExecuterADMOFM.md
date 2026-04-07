FCP GENERAL EXECUTER – UI ENTRY TO QFM / ADM MASK

ZIEL
Wenn ein UI-Einstieg definiert wird, zum Beispiel:

```html
<a class="feed-btn fcp-brand-btn--primary" href="/verein-anfragen/">Verein anfragen</a>
```

und gesagt wird:

- diese Route soll zu einer bestimmten Maske fuehren
- z. B. `docs/masks/templates/Onboarding/QFM_clubEntryBillingSignIn.json`

dann wird die Aufgabe nicht frei neu erfunden.
Sie wird im bestehenden FCP-QFM-/ADM-Rahmen sauber angeschlossen.

-----------------------------------
KERNPRINZIP
-----------------------------------
UI-Einstieg -> Route -> Seiten-Entry -> Maskenfamilie -> Maskendatei -> Renderer -> Validierung

Nicht:
- UI direkt an beliebige Logik haengen
- Route ohne Maskenfamilie erraten
- QFM und ADM vermischen
- Sonderpfade ausserhalb des FCP-Systems bauen

-----------------------------------
PHASE 0 – INPUT LESEN
-----------------------------------
Input kann sein:
- ein Button / Link / CTA
- eine Route
- eine Zielmaske
- ein Screen / Prozess / Use Case

Fragen:
- Welche Route wird angesprochen?
- Welche Maske soll dort geladen werden?
- Ist das QFM oder ADM?
- Ist die Maske final, eingeschraenkt oder noch lueckig?

Output:
- `entryElement`
- `targetRoute`
- `targetMaskPath`
- `maskFamily`
- `fachlicher Zweck`

-----------------------------------
PHASE 1 – ROUTE PRUEFEN
-----------------------------------
Codex prueft:
- existiert die Route schon?
- existiert eine Astro-Page oder ein anderer Seiteneinstieg?
- ist sie schon an FCP / QFM / ADM angeschlossen?
- gibt es schon Legacy- oder Redirect-Logik?

Suche nach:
- `src/pages/...`
- `src/config/static-web-pages.ts`
- vorhandenen Route-Refs im Repo
- Redirect-/Navigationseintraegen

Entscheidung:
- Route existiert und kann angepasst werden
- Route fehlt und muss als neuer FCP-Einstieg angelegt werden

Output:
- vorhandene Route / Page
- fehlende Route
- relevante Redirects / Legacy-Kontexte

-----------------------------------
PHASE 2 – MASKE PRUEFEN
-----------------------------------
Codex prueft:
- ist die Maskendatei reader-valid?
- ist sie QFM oder ADM?
- ist sie final anschlussfaehig?
- ist sie nur readonly / restricted?
- fehlen noch Bindings oder Prozesslogik?

Pruefen gegen:
- `scripts/fcp-mask-reader.mjs`
- `scripts/check-mask-jsons.mjs`
- QFM-/ADM-Template

Wichtig:
- nur echte `QFM_*.json` / `ADM_*.json` anschliessen
- keine Hybrid- oder Review-Datei als Zielroute verwenden

Output:
- `maskStatus = final | restricted | blocked`
- relevante Luecken
- Anschlussfaehigkeit

-----------------------------------
PHASE 3 – MASKENFAMILIE KLAR ZUORDNEN
-----------------------------------
Regeln:
- `QFM_*.json` -> inhaltlicher Standardrenderer
- `ADM_*.json` -> Admin-Board-/Workspace-Wrapper

Wenn `QFM`:
- Seite muss QFM/Quickflow-Inhalt rendern

Wenn `ADM`:
- Seite muss Admin-Board-Kontext rendern
- ADM bleibt Wrapper, nicht zweite Inhaltswelt

Nie:
- QFM als ADM behandeln
- ADM als freie Sonderseite bauen

Wichtige Praezisierung:
- `ADM` bleibt die aeussere Maskenfamilie und der Workspace-Rahmen
- innerhalb von `ADM` duerfen Inhaltsbloecke bewusst im `QFM`-Stil gerendert werden
- dafuer wird keine dritte JSON-Familie wie `InnerQFMForADM` eingefuehrt, solange der bestehende ADM-Renderer QFM-artige Form- und Content-Bloecke sauber tragen kann
- wenn dafuer eine neue DOM-/CSS-/Load-/Save-Logik noetig waere, ist das kein neuer Family-Prefix, sondern ein expliziter `renderer_gap`

Output:
- `rendererFamily`
- erwarteter Seitenaufbau

-----------------------------------
PHASE 3A – KOMPONENTEN / DOM / CSS PRUEFEN
-----------------------------------
Bevor ein Block angeschlossen oder empfohlen wird, muss Codex pruefen, ob der vorhandene Bestand ihn ueberhaupt tragen kann.

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
  - QFM-/OFM-Formsprache, Inputs, Selects, Textareas, Toggle, Buttons, Readonly und Mixed
- `src/styles/app-shell.css`
  - ADM-Workspace, Admin-Cards, Tabellenumfelder und Spezialscreens

Wichtige DOM-Anker:
- QFM-/OFM:
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
  - `.qfp-companion-surface`
- ADM:
  - `.admin-board`
  - `.admin-board__nav`
  - `.admin-board__content`
  - `.admin-section`
  - `.admin-card`
  - `.admin-nav-btn`

Regel:
- `ADM` bleibt der Workspace-Rahmen
- `QFM` kann innerhalb von `ADM` der innere Inhaltsstil sein
- dafuer wird keine dritte JSON-Familie eingefuehrt

Wenn ein gewuenschter Block:
- keinen passenden Renderer hat
- keine vorhandenen DOM-Klassen nutzt
- keine CSS-Bindung besitzt
- oder keine echte Load-/Save-/State-Logik im Bestand hat

dann ist das:
- kein stiller JSON-Wunsch
- sondern ein expliziter `renderer_gap`

-----------------------------------
PHASE 4 – BESTANDSSUCHE FUER PAGE-WIRING
-----------------------------------
Codex sucht nach vorhandenen Mustern fuer:
- QFM-Seiteneinstieg
- ADM-Seiteneinstieg
- Maskenladen in Astro
- Resolver-/Renderer-Initialisierung
- CSS-/Script-Einbindung

Suche im Bestand nach:
- bestehenden Maskenpages
- `renderQuickflowMask`
- `renderAdminPanelMask`
- `Quick-flow-Pattern.js`
- Masken-Loadern
- vorhandenen FCP-Webseiten

Output:
- wiederverwendbares Page-Muster
- benoetigte Scripts
- benoetigte CSS
- benoetigte JSON-Anbindung

-----------------------------------
PHASE 5 – ENTSCHEIDUNG
-----------------------------------
Codex trifft genau eine von 3 Entscheidungen:

A) DIREKT ANSCHLIESSEN
Voraussetzung:
- Route ist vorhanden oder leicht anlegbar
- Maske ist valid
- Rendererfamilie ist klar

Dann:
- Seite / Route sauber an Maske haengen

B) EHRLICH EINGESCHRAENKT ANSCHLIESSEN
Voraussetzung:
- Maske ist nur restricted / readonly

Dann:
- trotzdem sauber anschliessen
- aber nicht so tun, als sei es ein finaler Vollprozess

C) BLOCKEN
Voraussetzung:
- Zielmaske ist keine echte Maske
- oder zentrale Anschlusslogik fehlt

Dann:
- Route nicht blind anbinden
- erst Masken- oder Page-Luecke benennen

Output:
- `decision = connect | connect_restricted | blocked`

-----------------------------------
PHASE 6 – KONKRETE UMSETZUNG
-----------------------------------
Wenn angeschlossen wird, dann sauber in dieser Reihenfolge:

1. Zielroute/Page identifizieren oder anlegen
2. passende Maskendatei einhaengen
3. richtige Rendererfamilie nutzen
4. benoetigte Scripts / CSS anbinden
5. keine freie Nebenlogik einbauen
6. keine Maskenwahrheit in der Seite erraten

Wichtig:
- Seite ist nur Entry / Huelle
- JSON bleibt Maskenwahrheit
- Renderer bleibt UI
- Resolver bleibt Daten-/Binding-Schicht

-----------------------------------
PHASE 7 – VALIDIERUNG
-----------------------------------
Nach dem Wiring immer pruefen:

1. Route vorhanden?
2. Zielmaske reader-valid?
3. `check-mask-jsons` gruen?
4. QFM/ADM-Familie korrekt?
5. Scripts / CSS passend?
6. keine Hybrid-Datei angeschlossen?
7. keine freie Renderlogik ausserhalb des FCP-Rahmens?

Output:
- `route valid / invalid`
- `mask valid / invalid`
- konkrete Restluecken

-----------------------------------
LEARNING – THEME VOR MASK CSS PRUEFEN
-----------------------------------
Wichtige Erfahrung:
- Wenn eine QFM-/OFM-Maske optisch "falsch" aussieht, liegt der Fehler nicht automatisch in `ofmMask.css`
- zuerst pruefen, welche Theme-Tokens die Seite ueberhaupt bekommt

Warum:
- `ofmMask.css` arbeitet auf bestehenden Token-Variablen wie
  - `--panel`
  - `--surface`
  - `--surface-2`
  - `--text`
- diese kommen aus der Seiten-/Theme-Schicht unterhalb der Maske

Wichtiger FCP-Fall:
- oeffentliche FCP-Seiten ausserhalb von `/app/` laufen leicht mit `fcp_brand`
- App-Maskenseiten unter `/app/` laufen haeufig mit `fcp_tactical`
- dieselbe QFM-Maske kann dadurch auf zwei Seiten sehr unterschiedlich aussehen, obwohl der Masken-DOM korrekt ist

Darum immer pruefen:
1. Ist der QFM-/ADM-DOM korrekt?
2. Welche `data-app-theme`-Werte liegen auf `body`?
3. Welche Theme-Tokens kommen dadurch real an?
4. Erst danach `ofmMask.css` anfassen

Merksatz:
- erst Theme
- dann Token
- dann Mask-CSS

Nicht umgekehrt.

-----------------------------------
KONKRETE DENKSTUETZE FUER CTA-AUFGABEN
-----------------------------------
Wenn gesagt wird:

"Dieser Button soll zu Maske X fuehren"

dann bedeutet das nicht nur:
- Linkziel aendern

sondern:
- Route pruefen
- Seiten-Entry pruefen
- Maskenfamilie pruefen
- Zielmaske validieren
- vorhandenes FCP-Muster nutzen
- dann erst anbinden

Kurzformel:

1. CTA lesen
2. Route lesen
3. Zielmaske validieren
4. QFM/ADM zuordnen
5. vorhandene Page-Struktur nutzen
6. sauber anschliessen
7. validieren

-----------------------------------
LEARNING – ADM KANN QFM-INHALT TRAGEN
-----------------------------------
Merksatz:
- `ADM` ist der Workspace
- `QFM` kann der innere Inhaltsstil sein

Das bedeutet:
- keine dritte Maskenfamilie fuer innere Formbloecke aufmachen
- keine Prefix-Welt wie `InnerQFMForADM` einfuehren
- stattdessen in `ADM_*.json` sauber markieren, welche Panels oder Bloecke QFM-artig gerendert werden sollen

Nur wenn der bestehende ADM-/QFM-Bestand den Block nicht tragen kann, gilt:
- `renderer_gap` offen benennen
- fehlenden DOM-/CSS-/Binding-Vertrag nachziehen
- erst danach live anschliessen

-----------------------------------
LEARNING – LIVE-BINDINGS GEGEN PREVIEW-BLOCKS ABSICHERN
-----------------------------------
Wichtige Erfahrung aus `ADM_clubSettings`:
- nicht jeder Block mit `sourceOfTruth = edge` oder `sql` soll sofort live angebunden werden
- besonders Preview-, Snapshot- und Vergleichsflaechen duerfen nicht blind an bestehende Edge-Functions gehaengt werden

Typische Fehlbilder:
- `action_invalid`, wenn eine Edge-Function einen Pflicht-`action` erwartet, der Preview-Block aber keinen echten Live-Vertrag hat
- `club_id_required`, wenn ein Vergleichsblock ohne finalen Club-Read-Vertrag versehentlich wie ein echter Workspace-Reader behandelt wird
- scheinbar leere Tabellen, wenn Platzhalter-`content.rows` echte Runtime-Daten ueberdecken

Darum immer pruefen:
1. Ist der Block wirklich `live_contract`?
2. Oder ist er bewusst `preview_contract` / `contract_gap`?
3. Hat die Edge-/RPC-Quelle genau den erwarteten Payload-Vertrag?
4. Verdecken JSON-Defaults (`content.rows`, `content.fields`) echte Runtime-Daten?

Merksatz:
- nur echte Live-Bloecke an RPC / Edge haengen
- Preview-Bloecke ehrlich `local_only` lassen
- Platzhalter nie so bauen, dass sie echte Rows oder Feldwerte maskieren

-----------------------------------
LEARNING – META.RESOLVER DARF NICHT VERLOREN GEHEN
-----------------------------------
Wichtige Runtime-Erfahrung:
- wenn `meta.resolver` im Reader abgeschnitten oder nicht weitergereicht wird, brechen zentrale Vertragsbestandteile still:
  - `loadPayloadDefaults`
  - `savePayloadDefaults`
  - `rowsPath`
  - `requiresClubContext`
  - `missingClubContextMessage`

Folge:
- Edge-Calls laufen mit leerem Payload
- Club-Kontext wird nicht korrekt durchgereicht
- Form- und Tabellenblocks wirken "kaputt", obwohl die JSON fachlich stimmt

Darum bei Reader-/Normalisierungsarbeit immer pruefen:
1. bleibt `meta.resolver` voll erhalten?
2. kommen `payloadDefaults` wirklich bis in den Resolver?
3. werden `rowsPath` und `valuePath` tatsaechlich aus dem normalisierten Objekt gelesen?

Merksatz:
- `meta.resolver` ist kein optionaler Deko-Block
- er ist ein zentraler Laufzeitvertrag zwischen JSON und Resolver

-----------------------------------
BEISPIEL
-----------------------------------
CTA:

```html
<a class="feed-btn fcp-brand-btn--primary" href="/verein-anfragen/">Verein anfragen</a>
```

Ziel:
- Route: `/verein-anfragen/`
- Zielmaske: `docs/masks/templates/Onboarding/QFM_clubEntryBillingSignIn.json`
- Familie: `QFM`

Das bedeutet:
- QFM-Entry-Page fuer `/verein-anfragen/` pruefen
- Maske validieren
- Quickflow-/QFM-Renderer nutzen
- keine ADM-Logik dafuer bauen
- offene Vertragsluecken der Maske respektieren

-----------------------------------
GRUNDSATZ
-----------------------------------
Erst Route lesen.
Dann Maske pruefen.
Dann Familie zuordnen.
Dann an vorhandenes FCP-Muster anschliessen.

Nie:
- UI direkt an halbfertige Masken haengen
- QFM/ADM frei mischen
- Routing als Sonderwelt ausserhalb des FCP-Systems behandeln

-----------------------------------
LEARNING – POST-SUBMIT ROUTING
-----------------------------------
Wenn eine QFM-/ADM-Maske nach erfolgreichem Save weiterleiten soll, dann:

1. Routing zuerst in der Masken-JSON verorten
2. Ergebnisstatus serverseitig auswerten
3. Seite nur als Ausfuehrer dieses Vertrags nutzen

Beispiel:
- `pending` -> `/app/anfrage-offen/`
- `approved` -> `/app/?club_id={club_id}`

Wichtig:
- Post-Submit-Navigation ist kein freies Seitenskript
- sie gehoert semantisch zum Prozessvertrag der Maske
- die Page darf nur die in der JSON definierte Routing-Regel ausfuehren

Merksatz:
- erst Routing-Vertrag in der Maske
- dann Event/Resultat aus Resolver oder Save-Pfad
- erst ganz zum Schluss Navigation in der Page
