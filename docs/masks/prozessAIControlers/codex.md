FCP CODEX PIPELINE – MASK READ / CONNECT / REPAIR

ZIEL
Eine neue oder korrigierte Maske nie frei neu erfinden.
Immer:
1. lesen
2. gegen Contract pruefen
3. an Bestand andocken
4. Luecken sichtbar machen
5. nur das Fehlende bauen

GRUNDLAGE
- DB / SQL / RPC / Edge / RLS = technische und sicherheitliche Wahrheit
- JSON = Struktur und Maskenwahrheit
- Reader = Validierung / RenderPlan
- Resolver = Daten / Binder
- Renderer = UI
- CSS = Optik

ADM-first-Zusatz:
- fuer den aktiven Workspace-Standard ist `ADM_*.json` die Primaerquelle
- wiederholte ADM-Muster werden als Standard gelesen
- Runtime-Sonderlogik ist sichtbar, aber nicht automatisch Standard
- Referenz: `docs/masks/standards/ADM_STANDARDMATRIX_V1.md`

Regeln:
- Backend entscheidet Prozesszustaende, Rechte, Freigaben und Security
- Renderer zeigt nur an und interpretiert nicht frei
- JSON definiert nie allein Sicherheit oder Prozessfreigabe
- `QFM_*.json` und `ADM_*.json` duerfen nur echte, reader-valide Masken sein
- Hybrid-Dateien mit Analyse + halber Maske sind keine echten Masken
- neue oder korrigierte Masken immer zuerst gegen die festen Basisvorlagen lesen:
  - `docs/masks/templates/QFM_mask.template.json`
  - `docs/masks/templates/ADM_mask.template.json`

AKTUELLES SYSTEMBILD
- Wenn der Nutzer eine neue Maske sauber bearbeitet haben will, brauche ich mindestens:
  - bei `QFM`: die konkrete `QFM_*.json`
  - bei `ADM`: die konkrete `ADM_*.json`
  - plus die festen Basisvorlagen:
    - `docs/masks/templates/QFM_mask.template.json`
    - `docs/masks/templates/ADM_mask.template.json`
- zusaetzlich helfen:
  - DB-Schema / SQL / RPC / Edge-Wahrheit
  - bestehende Route / Page
  - aehnliche Bestandsmaske

Das System arbeitet aktuell so:
- JSON beschreibt Inhalt, Struktur, Feldtypen, Bindings und Prozess-/Routing-Meta
- `scripts/fcp-mask-reader.mjs` liest und validiert die JSON
- `scripts/check-mask-jsons.mjs` prueft echte `QFM_*.json` / `ADM_*.json`
- `public/js/fcp-mask-data-resolver.js` verbindet `loadBinding`, `saveBinding`, Hydration und Runtime-Events
- `public/js/quick-flow-pattern.js` rendert QFM-/OFM-Inhalte
- `public/js/fcp-mask-page-loader.js` bootet die Runtime an einem Seiten-Container

Merksatz:
- JSON = was die Maske ist und kann
- Runtime = wie sie im Browser ausgefuehrt wird

Wichtig:
- was die JSON nicht kennt, erscheint nicht als echter Maskeninhalt
- Seitengeruest, Theme, Auth-Bruecke oder kleine Routing-Huellen koennen ausserhalb der JSON leben
- Sicherheit bleibt serverseitig

KOMPONENTEN / DOM / CSS MITDENKEN
- Ich muss den vorhandenen Rendererbestand kennen, nicht nur die JSON-Struktur

Aktuelle Runtime-Bausteine:
- `public/js/quick-flow-pattern.js`
  - QFM-/OFM-Inhaltsrenderer
- `public/js/admin-panel-mask.js`
  - ADM-Workspace-Renderer
- `public/js/fcp-inline-data-table-v2.js`
  - `inline-data-table`
- `public/js/fcp-data-table.js`
  - `data-table`

Aktuelle CSS-Bindung:
- `public/css/ofmMask.css`
  - QFM-/OFM-Formsprache: Inputs, Selects, Textareas, Toggle, Buttons, Readonly, Mixed
- `src/styles/app-shell.css`
  - ADM-Workspace und Spezialscreen-Umfelder

Relevante DOM-Anker:
- QFM-/OFM:
  - `.qfp-shell`
  - `.qfp-card`
  - `.qfp-form-grid`
  - `.qfp-form-field`
  - `.qfp-field-label`
  - `.qfp-field-help`
  - `.qfp-toggle-row`
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

Merksatz:
- `ADM` ist der Workspace-Rahmen
- `QFM` kann innerhalb von `ADM` der Inhaltsstil sein
- keine dritte JSON-Familie einfuehren, solange bestehende ADM-/QFM-Renderer den Block tragen
- wenn ein Block keinen echten Anschluss an DOM, CSS, Load/Save oder Runtime hat, ist das ein `renderer_gap`

LOAD / SAVE / RENDER MITDENKEN
- `loadBinding` sagt, woher Daten kommen
- `saveBinding` sagt, wohin geschrieben wird
- `renderMode` sagt, welche Inhaltsart gerendert wird
- `componentType` sagt, welcher FCP-Standardblock benutzt wird

Wenn der Nutzer will, dass eine Maske "voll funktioniert", muss ich immer mitpruefen:
- ist `loadBinding` belegbar
- ist `saveBinding` belegbar
- tragen `valuePath` und `payloadKey` die Runtime
- passt `renderMode` zur beabsichtigten Maske
- fehlen Route, Page, Loader oder Resolver-Anschluss

-----------------------------------
PHASE 0 – INPUT KLARSTELLEN
-----------------------------------
Input:
- konkrete Datei
- Maskenfamilie aus Prefix
- fachlicher Zweck
- optional: erwarteter Prozess / Screen / Use Case

Codex fragt nicht zuerst:
- "Wie soll es idealerweise sein?"

Codex prueft zuerst:
- "Was ist diese Datei?"
- "Was will sie fachlich?"
- "Welche Wahrheit existiert schon?"

Output Phase 0:
- mask path
- mask family
- fachlicher Zweck
- vermuteter Zielkontext
- ist die Datei als finale Maske oder als Zwischenstand gemeint?

-----------------------------------
PHASE 1 – FORM / CONTRACT CHECK
-----------------------------------
1. Datei lesen
2. JSON parsebar?
3. Prefix korrekt?
4. Reader-/Contract-Pruefung
5. Hybrid-/Review-Schluessel pruefen
6. ist es echte QFM / ADM oder eine Review-Datei?

Pruefen gegen:
- `scripts/fcp-mask-reader.mjs`
- `scripts/check-mask-jsons.mjs`
- `docs/masks/templates/QFM_mask.template.json`
- `docs/masks/templates/ADM_mask.template.json`

Entscheidung:
A) reader-valid
B) formal kaputt
C) Hybrid-Datei
D) falsche Familie / falscher Prefix

Output Phase 1:
- was formal korrekt ist
- was formal verletzt ist
- ob Datei ueberhaupt als echte Maske weiterbearbeitet werden darf

-----------------------------------
PHASE 2 – MASKENVERSTAENDNIS
-----------------------------------
Codex liest die Maske inhaltlich.

Pruefen:
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

Bei process-Masken zusaetzlich:
- `process`
- `steps`
- `stateBinding`
- `advanceBinding`
- `resumeKey`
- `terminalStates`

Fragen:
- Was will diese Maske fachlich abbilden?
- Read? Edit? Prozess? Tabelle? Workspace?
- Ist die aktuelle Struktur dafuer stimmig?

Output Phase 2:
- fachlicher Maskenzweck
- aktuell abgebildeter Umfang
- erste offensichtliche Fehlstellen

-----------------------------------
PHASE 3 – BESTANDSSUCHE
-----------------------------------
Codex durchsucht aktiv den Bestand nach Anschlussstellen.

Suche nach:
- aehnlichen QFM-/ADM-Masken
- Tabellen
- Views
- RPCs
- Edge Functions
- Prozesszustands-Funktionen
- Resolver-/Reader-Verhalten
- Renderer-Erwartungen
- CSS-/Blocktypen
- Security-/RLS-Mustern

Immer suchen nach:
- existierendem Read-Pfad
- existierendem Write-Pfad
- existierenden Statusfeldern
- existierenden Permissions-/Role-Mustern
- existierender Prozesslogik

Output Phase 3:
- vorhandene Anschlussstellen
- wiederverwendbare Bausteine
- nur angenommene / nicht sicher belegte Stellen

-----------------------------------
PHASE 4 – WAHRHEITSMAP
-----------------------------------
Codex trennt jetzt sauber in 3 Klassen:

1. EXISTIERT SCHON
- direkt anschlussfaehig
- belegte Wahrheit

2. EXISTIERT TEILWEISE
- z. B. Read da, Write fehlt
- Security-Hinweis da, finale Masken-Wahrheit fehlt
- Prozessstatus da, Step-Mapping fehlt

3. FEHLT
- kein RPC
- kein Binding
- kein `valuePath`
- kein `payloadKey`
- keine Consent-Wahrheit
- keine Terminaldefinition

Wichtig:
- nicht vermischen
- keine "wahrscheinlich"-Wahrheit als sicher behandeln

Output Phase 4:
- exists
- partial
- missing

-----------------------------------
PHASE 5 – ENTSCHEIDUNGSMATRIX
-----------------------------------
Codex trifft genau eine von 4 Entscheidungen:

A) FINAL ANSCHLIESSEN
Voraussetzung:
- Form valide
- Read-/Write-/Security-/Bindings ausreichend belegt

Dann:
- Datei final sauberziehen
- echte Maske liefern

B) EHRLICH EINSCHRAENKEN
Voraussetzung:
- nur Teilwahrheit vorhanden

Dann:
- z. B. readonly statt editierbar
- actions aus
- `saveBinding = none`
- nur sichere Felder zeigen

C) FEHLENDEN BAUSTEIN BAUEN
Voraussetzung:
- Luecke ist klein, klar und systemisch sauber ergaenzbar
- der Baustein passt in die bestehende Architektur

Dann:
- gezielt RPC / Edge / Resolver / JSON-Teil bauen
- nicht das ganze System umbauen

D) BLOCKEN
Voraussetzung:
- kritische Wahrheit fehlt
- kein sauberer eingeschraenkter Zustand moeglich

Dann:
- keine finale Maske vortaeuschen
- Luecke sauber benennen

Output Phase 5:
- `decision = final | restricted | build_missing | blocked`

-----------------------------------
PHASE 6 – KONKRETE AKTION
-----------------------------------
Je nach Entscheidung:

Wenn FINAL:
- Datei korrigieren
- validieren
- Reader pruefen
- `check:masks` pruefen

Wenn RESTRICTED:
- Datei auf ehrlichen Zustand bringen
- readonly / no save / sichere Bindings
- `specialCases` fuer offene Vertragsluecken

Wenn BUILD_MISSING:
- fehlenden Baustein genau dort bauen, wo er hingehoert:
  - JSON
  - RPC
  - Edge
  - Resolver
  - Renderer
  - CSS

Wenn BLOCKED:
- keine `QFM_`-/`ADM_`-Hybriddatei erzeugen
- Review / Blocker separat ausgeben

Output Phase 6:
- konkret geaenderte Datei oder
- konkret gebauter fehlender Baustein oder
- saubere Blocker-Liste

-----------------------------------
PHASE 7 – VALIDIERUNG
-----------------------------------
Nach jeder Aenderung immer:

1. JSON parsebar?
2. Reader valid?
3. `check-mask-jsons` gruen?
4. Familie / Prefix korrekt?
5. keine Hybrid-Top-Level?
6. keine frei erfundenen Bindings?
7. keine Security im Frontend statt Backend?
8. bei Prozessmasken:
   - keine freien `current_step_id`
   - keine frei erfundenen `step statuses`

Output Phase 7:
- `valid` / `invalid`
- falls invalid: genaue Ursache

-----------------------------------
PHASE 8 – OUTPUT-FORMAT
-----------------------------------
Codex antwortet immer in dieser Reihenfolge:

A) Was ist korrekt?
- was ist schon anschlussfaehig

B) Was ist falsch oder riskant?
- Contract-Verletzungen
- Hybrid-Risiken
- freie Annahmen
- fehlende Wahrheit

C) Wo kann angeschlossen werden?
- RPCs
- Tabellen
- Prozesszustand
- bestehende Masken
- Security-Muster

D) Was fehlt noch?
- exakte Luecken
- wo sie hingehoeren

E) Was wurde getan?
- Datei korrigiert
- readonly eingeschraenkt
- Binding angeschlossen
- fehlenden Baustein gebaut
- oder sauber blockiert

F) Validierungsstatus
- Reader valid / invalid
- `check:masks` pass / fail

-----------------------------------
KURZFORMEL
-----------------------------------
1. Lesen
2. Validieren
3. Bestand suchen
4. Wahrheit mappen
5. Entscheiden
6. Nur noetiges tun
7. Wieder validieren

-----------------------------------
GRUNDSATZ
-----------------------------------
Erst Bestand nutzen.
Dann Luecken sichtbar machen.
Dann nur das Fehlende bauen.

Nie:
- blind neu erfinden
- fehlende Wahrheit ueberspielen
- halbe Ideen als fertige Masken ausgeben
