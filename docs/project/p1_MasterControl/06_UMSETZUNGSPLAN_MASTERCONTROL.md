# Project One — Umsetzungsplan MasterControl

## Zweck dieser Datei

Diese Datei übersetzt das Zielbild und die Soll-Architektur des Projekts **MasterControl** in eine konkrete, umsetzbare Reihenfolge.

Sie ist die Arbeitsgrundlage für Codex, Claude, GPT oder jede andere KI, die das System umbauen oder erweitern soll.

Sie verhindert, dass direkt in UI oder Einzelfiles gesprungen wird, ohne:

- das Zielbild zu respektieren,
- bestehende Relationen zu verstehen,
- Folgeänderungen mitzudenken,
- den Writeback auf Board-/Process-Ebene mitzuziehen.

---

## Verbindliche Eingabedateien vor jeder Umsetzung

Vor jeder Umsetzung müssen mindestens diese Dateien gelesen werden:

1. `docs/project/p1_MasterControl/01_ZIELBILD_MASTERCONTROL.md`
2. `docs/project/p1_MasterControl/02_SYSTEMKONTEXT_UND_DATEILANDKARTE.md`
3. `docs/project/p1_MasterControl/04_IST_ANALYSE_MASTERBOARD.md`
4. `docs/project/p1_MasterControl/05_SOLL_ARCHITEKTUR_MASTERCONTROL.md`
5. `docs/FCP_company/FCP_CLOSING_AGENT_CONTEXT.md`
6. `docs/FCP_company/fcp_masterboard_state.json`
7. `docs/FCP_company/fcp_process_control_state.json`

Ohne diese Lektüre darf keine operative Änderung erfolgen.

---

## Grundsatz der Umsetzung

## Nicht redesignen. Systemisch umbauen.

Die Umsetzung erfolgt nicht nach Geschmack, sondern in kontrollierten Stufen.

Jede Stufe muss:

- gegen das Repo geprüft,
- gegen die Board-Wahrheit geprüft,
- gegen die Process-Control-Wahrheit geprüft,
- auf Folgeflächen geprüft,
- dokumentiert und versioniert werden.

---

## Umsetzungsreihenfolge

MasterControl wird in **sechs Phasen** umgesetzt.

---

# Phase 0 — Wahrheits- und Reposchnitt fixieren

## Ziel

Vor jedem Umbau muss eindeutig klar sein:

- welche Dateien heute das Board steuern,
- welche Dateien nur Darstellung sind,
- welche Dateien Prozess-Wahrheit enthalten,
- welche Artefakte zwingend mitzupflegen sind.

## Pflichtaufgaben

### 0.1 Reale Board-Dateien prüfen

Mindestens prüfen:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard.js`
- weitere reale JS-/CSS-/Mask-Dateien des Masterboards

### 0.2 Datenquellen verifizieren

Prüfen:

- Woher kommen die Board-Daten?
- Woher kommt die Process-Control?
- Welche RPCs / Edge-Funktionen / JSON-Dateien speisen die Oberfläche?

### 0.3 Status-Sync-Regel aktiv halten

Bei jeder Änderung muss geprüft werden:

- betroffene Masterboard-Nodes
- betroffene Prozesse
- betroffene Screens
- betroffene Smoke Checks
- betroffene Bugs
- betroffene Dateien

## Ergebnis von Phase 0

Eine KI muss danach exakt sagen können:

- welche Dateien primär geändert werden,
- welche Folge-Dateien mitzuziehen sind,
- welche Wahrheiten nicht verletzt werden dürfen.

---

# Phase 1 — Ist-Oberfläche vollständig vermessen

## Ziel

Bevor etwas neu gebaut wird, muss die aktuelle Oberfläche vollständig verstanden werden.

## Pflichtfragen

- Was zeigt das Board heute wirklich?
- Welche Symbole existieren?
- Welche Legenden fehlen?
- Welche Interaktionen gibt es?
- Was kann der Drawer heute?
- Was kann er nicht?
- Welche Daten liegen im UI schon vor, sind aber schlecht dargestellt?
- Welche Informationen fehlen komplett?

## Pflichtlieferobjekte

### 1.1 DOM-nahe Ist-Beschreibung

Nicht abstrakt. Konkret.

Zum Beispiel:

- welche Kartenbereiche gibt es,
- welche Meta-Elemente fehlen,
- welche Felder der Drawer zeigt,
- was davon ohne Führungswert ist.

### 1.2 UX-Schmerzpunkte mit Fachbezug

Nicht nur „unschön“, sondern:

- nicht priorisiert,
- nicht navigierbar,
- keine Relationen sichtbar,
- keine Handlung geführt,
- keine Folgeänderungen erkennbar.

## Ergebnis von Phase 1

Eine belastbare Ist-Beschreibung, die den Umbau rechtfertigt und strukturell begründet.

---

# Phase 2 — Board-Ebene (Ebene A) neu schneiden

## Ziel

Das Überblicksboard muss von Informationsanhäufung auf Steuerung umgebaut werden.

## Pflichtfunktionen der neuen Board-Ebene

### 2.1 Legendenbereich

Pflicht:

- Status-Legende
- Risiko-Legende
- Warn-/Blocker-/Hinweis-Legende
- Verifikationszustände
- Relation vorhanden / fehlt

### 2.2 Node-Karten verdichten

Jede Karte braucht:

- Titel
- Lane
- Status
- Risiko
- Launch-Klasse
- letzte Verifikation
- kurze Lageaussage
- nächste Aktion
- Anzahl / Zustand von Gaps / Bugs / Smoke Checks

### 2.3 Relevanz-Hierarchie herstellen

Nicht jeder Node gleich.

Board muss visuell klar machen:

- blockiert
- kritisch
- in Arbeit
- nur Hinweis
- stabil

### 2.4 klare Einstiege

Jeder Node braucht mindestens:

- `Workspace öffnen`
- `Relationen ansehen`
- `Details / Spezialmaske öffnen` (falls vorhanden)

## Nicht in Phase 2 tun

- noch keine tiefen Spezialmasken bauen
- keine Relationsebene komplett ausbauen
- keine komplette Prozessbearbeitung in die Karten legen

## Ergebnis von Phase 2

Das Board liefert echten Überblick und nächste Schritte.

---

# Phase 3 — Drawer zu Node Workspace umbauen (Ebene B)

## Ziel

Der alte Drawer wird durch einen geführten Arbeitsraum ersetzt.

## Pflichtstruktur des Node Workspace

### Abschnitt 1 — Kurzlage
- Titel
- Status
- Risiko
- Launch-Klasse
- letzte Verifikation
- operativer Zustand
- nächster Schritt

### Abschnitt 2 — Sichtbarer Fortschritt

### Abschnitt 3 — Unsichtbarer Fortschritt

### Abschnitt 4 — Blocker / Gaps / Bugs

### Abschnitt 5 — Relationen

### Abschnitt 6 — Entscheidungen / Richtungsänderungen

### Abschnitt 7 — Bearbeitung / Speicherung / Writeback

## Pflichtfunktionen

### 3.1 Änderungsfolgen anzeigen

Wenn Felder geändert werden, muss sichtbar sein:

- welche Board-Dateien mitzuziehen sind,
- welche Process-Control-Knoten betroffen sind,
- ob Bugs/Smoke Checks mit betroffen sind.

### 3.2 Dateireferenzen strukturieren

Nicht nur rohe Liste.

Mindestens unterscheiden:

- Primärdatei
- Folge-Datei
- UI-Datei
- DB-/RPC-Datei
- Doku-Datei

### 3.3 Bearbeitung kontrollieren

Feldänderungen müssen geführt sein.

Nicht nur Textarea-Friedhof.

## Ergebnis von Phase 3

Der Benutzer kann mit einem Node wirklich arbeiten statt nur Texte verwalten.

---

# Phase 4 — Relationsebene bauen (Ebene C)

## Ziel

Relationen werden sichtbar und navigierbar.

## Pflichtrelationen

Mindestens:

- Node → Prozess
- Node → Smoke Check
- Node → Bug
- Node → Datei
- Node → Folge-Node
- Node → Spezialmaske

## Pflichtdarstellung

Zu Beginn reicht eine saubere strukturierte Listenansicht.

Wichtiger als Fancy-Netzwerkdarstellung ist:

- Klarheit,
- Filterbarkeit,
- Typisierung,
- Klickbarkeit.

## Pflichtattribute pro Relation

- Relationstyp
- Zielobjekt
- Rolle des Ziels
- Auswirkungsgrad
- Änderungsrelevanz

## Ergebnis von Phase 4

Der Operator versteht endlich:

- welcher Flow dahinter steckt,
- welche Dateien betroffen sind,
- welche Prozesse an einem Knoten hängen.

---

# Phase 5 — Spezialmasken gezielt ergänzen (Ebene D)

## Ziel

Tiefe Arbeit aus Board und Workspace herauslösen, wenn sie dort nicht mehr sauber handhabbar ist.

## Erste Kandidaten für Spezialmasken

### 5.1 Process-Control-Workspace
Für Prozesse, Smoke Checks, Bugs und Reviews.

### 5.2 Billing-Prüfmaske
Für Live-Prüfung von Billing / Checkout / Webhook / State.

### 5.3 CSV-Arbeitsmaske
Für Golden Path, Mapping, Verify, Folgeprüfung.

### 5.4 Relations-Inspector
Für Datei-/Flow-/Node-Verknüpfungen.

## Regel

Spezialmasken nur bauen, wenn:

- Board zu schwer wird,
- Workspace zu tief wird,
- Facharbeit nicht mehr klar führbar ist.

---

# Phase 6 — Writeback, Pflege und Replizierbarkeit absichern

## Ziel

MasterControl muss replizierbar sein.

Nicht nur „funktioniert hier irgendwie“.

Sondern:

- ein anderer Chat,
- eine andere KI,
- ein anderes Repo,
- eine spätere Version

muss mit diesem Projektordner nachvollziehen können, wie es gebaut wurde.

## Pflichtbestandteile

### 6.1 Änderungsprotokoll
Jede Richtungsänderung dokumentieren:

- Was wurde geändert?
- Warum?
- Was war vorher?
- Welche Folge hatte das?

### 6.2 Versionierung
Jede größere Projektphase / Richtungsänderung klar benennen.

### 6.3 Rebuild-Fähigkeit
Jede KI muss aus diesem Ordner allein verstehen können:

- was gebaut werden soll,
- in welcher Reihenfolge,
- welche Dateien betroffen sind,
- welche Prinzipien einzuhalten sind.

### 6.4 Status-Sync verpflichtend
Nach jeder relevanten Umsetzung:

1. betroffene Nodes nennen
2. betroffene Prozesse / Screens / Smoke Checks / Bugs nennen
3. Status-Update ja/nein explizit beantworten
4. geänderte Dateien nennen
5. finalen Status nennen

---

## Was Codex in der Praxis tun soll

## Bei jeder Umsetzungsrunde

### Schritt 1
Diese Projektdateien lesen.

### Schritt 2
Aktuelle Repo-Realität gegen die Projektdateien prüfen.

### Schritt 3
Nur die Phase bearbeiten, die gerade dran ist.

### Schritt 4
Folgeänderungen ausdrücklich mitdenken.

### Schritt 5
Board-/Process-Artefakte nachziehen.

### Schritt 6
Abweichungen zwischen Doku und Realität sofort dokumentieren.

---

## Was NICHT passieren darf

- kein blindes UI-Redesign
- keine Vermischung aller Ebenen in einer Maske
- keine Feldfriedhöfe ohne Führung
- keine Änderung ohne Folgeflächenprüfung
- kein Speichern ohne Writeback-Denken
- keine neue Richtung ohne dokumentierte Begründung

---

## Reihenfolge für den tatsächlichen Start

## Startpaket für Codex

1. Phase 0 prüfen und repo-wahr bestätigen
2. Phase 1 als konkrete Ist-Oberflächenanalyse abschließen
3. Phase 2 als Board-Neuschnitt konzipieren
4. erst danach erste UI-Umsetzung beginnen

### Wichtig

Nicht direkt alles gleichzeitig bauen.

Erst:

- Überblicksebene sauber,
- dann Workspace,
- dann Relationen,
- dann Spezialmasken.

---

## Ergebnis dieser Datei in einem Satz

MasterControl wird in sechs kontrollierten Phasen von einer unklaren Statusoberfläche zu einem replizierbaren, prinzipiengesteuerten, geführten operativen Steuerungssystem ausgebaut.
