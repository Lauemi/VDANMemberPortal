# Project One — Umsetzungsregeln MasterControl

Stand: 2026-04-20

## Zweck

Dieses Dokument verankert die Arbeitsregeln fuer jeden Folge-Agenten, der am bestehenden FCP-Masterboard in Richtung MasterControl arbeitet.

Es ist verbindlich fuer:

- Analyse
- Umsetzung
- Refactoring
- UI-Aenderungen
- Board-State-Aenderungen
- Dokumentationspflege

Grundsaetze:

- repo-wahr
- dateibasiert
- replizierbar
- prinzipiengesteuert
- ohne stille Annahmen

---

## Pflichtstart fuer jeden Folge-Agenten

Vor jeder Arbeit an Masterboard / MasterControl muessen mindestens diese Dateien gelesen werden:

- `docs/project/p1_MasterControl/00_README_PROJECT_ONE_MASTERCONTROL.md`
- `docs/project/p1_MasterControl/01_ZIELBILD_MASTERCONTROL.md`
- `docs/project/p1_MasterControl/02_IST_ANALYSE_MASTERBOARD.md`
- `docs/project/p1_MasterControl/03_UI_WAHRHEIT_MASTERBOARD.md`
- `docs/project/p1_MasterControl/04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `docs/project/p1_MasterControl/05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `docs/project/p1_MasterControl/06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `docs/project/p1_MasterControl/07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Zusaetzlich sind bei jeder relevanten Arbeit mitzudenken:

- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`
- `docs/FCP_company/FCP_MASTERBOARD_PFLEGEMODELL.md`
- `docs/FCP_company/FCP_MASTERBOARD_PFLEGEVERTRAG.md`

---

## Primär betroffene Dateien des Systems

Die aktuell fuehrenden Produktdateien sind:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`

Die aktuell fuehrenden Board-/Prozess-Artefakte sind:

- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`

Die aktuell fuehrende DB-/RPC-Grundlage ist:

- `supabase/migrations/20260331153000_fcp_masterboard_db_foundation.sql`

---

## Pflichtpruefung vor jeder Aenderung

Vor jeder Aenderung muss der Folge-Agent mindestens diese Fragen beantworten:

1. Welche reale Datei wird geaendert?
2. Welcher Node oder Prozess ist davon fachlich betroffen?
3. Welche weitere UI-Flaeche ist dadurch mit betroffen?
4. Welche Folgeflaechen entstehen?
5. Muss die Relation Board -> Process -> UI -> Files mit aktualisiert werden?
6. Muss der Board-/Prozesszustand in den FCP-Artefakten nachgezogen werden?

Wenn diese Fragen nicht beantwortet wurden, ist die Aenderung nicht sauber vorbereitet.

## Vierfach-Pflicht bei jeder relevanten Aenderung

Jede relevante MasterControl-Aenderung muss immer vier Ebenen gemeinsam mitdenken:

1. **Produkt**
   - reale UI-Dateien
   - reale Interaktion
   - reale Darstellung
2. **Relation**
   - Node -> Prozess
   - Prozess -> Screen
   - Screen -> Datei
   - Folgeflaechen
3. **Status**
   - Board-State
   - Process-Control-State
   - DB-/RPC-Wahrheit gegen JSON-/Repo-Referenz
4. **Projektdokumentation**
   - verifizierte Ist-Dokumente
   - Arbeitsregeln
   - Folge-Agent-Einstieg

Kurzregel:

```text
Produkt, Relation, Status und Projektdokumentation sind keine getrennten Nacharbeiten.
Sie muessen bei jeder relevanten Aenderung gemeinsam geprueft und gemeinsam nachgezogen werden.
```

---

## Relation- und Folgeflaechenpflicht

Jede relevante Aenderung am Masterboard ist nicht isoliert zu betrachten.

Folge-Agenten muessen immer pruefen:

- betrifft die Aenderung nur die Board-Darstellung
- oder auch den Prozesskontext
- oder auch reale Screens / Masken
- oder auch technische Referenzen / Dateien

Pflicht ist die Mitpruefung der folgenden Beziehungsebenen:

### Board-Ebene

- betroffene Lane
- betroffener Node
- Prioritaets- und Fuehrungswirkung

### Prozess-Ebene

- betroffener Prozess
- `related_nodes`
- Screens
- Smoke-Checks
- Review-/Bug-Sicht

### UI-Ebene

- reale Route oder Screen
- reale Interaktionsaenderung
- Folgewirkung auf Karten, Liste, Drawer, Modus oder Filter

### Dateiebene

- betroffene `src/pages/*`
- betroffene `public/js/*`
- betroffene `public/css/*`
- betroffene `supabase/*`
- betroffene `docs/FCP_company/*`

---

## Status-Sync-Pflicht

Bei jeder relevanten inhaltlichen Aenderung muss geprueft werden, ob der Board-/Prozessstand mitgezogen werden muss.

Pflicht-Sync-Ziele:

- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`

Dabei gilt:

- JSON nicht blind als alleinige Wahrheit behandeln
- DB-/RPC-Wahrheit gegenpruefen
- aber repo-sichtbare FCP-Artefakte nicht veralten lassen

Wenn ein Folge-Agent Board-, Prozess- oder Fuehrungslogik aendert und diese beiden Dateien nicht prueft, ist die Arbeit unvollstaendig.

---

## Pflichtfelder, die bei Statusaenderungen mitzudenken sind

### Im Masterboard-State

- `status`
- `launch_class`
- `risk_level`
- `progress_visible`
- `progress_invisible`
- `gaps`
- `decisions_open`
- `refs`
- `last_verified_at`

### Im Process-Control-State

- Prozessstatus
- Prioritaet
- `related_nodes`
- `screens`
- `smoke_checks`
- `bugs`
- `review_note`
- `last_reviewed_at`

---

## Pflichtpruefung bei UI-Aenderungen

Wenn `src/pages/app/masterboard/index.astro`, `public/js/masterboard-app.js` oder `public/css/masterboard.css` geaendert werden, muss zusaetzlich geprueft werden:

1. Veraendert sich die UI-Wahrheit eines Blocks?
2. Veraendert sich die Interaktionswahrheit?
3. Veraendert sich die relationale Fuehrung?
4. Veraendert sich die Folgeflaechenlage?
5. Muss `03_UI_WAHRHEIT_MASTERBOARD.md` aktualisiert werden?
6. Muss `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md` aktualisiert werden?
7. Muss `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md` angepasst werden?
8. Muss `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md` angepasst werden?

---

## Pflichtpruefung bei Prozess- oder Node-Aenderungen

Wenn sich Node- oder Prozessstrukturen aendern, muss geprueft werden:

1. Ist die Beziehung Node -> Prozess noch korrekt?
2. Sind Screens noch reale Repo-Flaechen?
3. Sind `refs` noch repo-wahr?
4. Sind neue Inkonsistenzen entstanden?
5. Sind Mehrfachzuordnungen oder Folgeflaechen betroffen?

---

## Keine stillen Aenderungen

Nicht erlaubt ist:

- nur UI aendern, ohne Status- und Relationsfolgen zu pruefen
- nur Produkt aendern, ohne Relation, Status und Projektdokumentation mitzudenken
- nur Relation aendern, ohne Produkt- und Statusfolgen mitzudenken
- nur Status aendern, ohne Produkt- und Dokumentationsfolgen mitzudenken
- nur JSON aendern, ohne Produkt- und DB-Folgen zu bedenken
- nur Chat-Analyse liefern, ohne Repo-Dokumentation nachzuziehen
- neue Prozess- oder Screen-Ziele eintragen, ohne reale Repo-Lage zu pruefen
- Inkonsistenzen zu sehen, aber nicht sauber zu dokumentieren

---

## Fuehrungsregel fuer jede kuenftige Umsetzung

Jede kuenftige MasterControl-Aenderung muss mindestens eine dieser Ebenen real verbessern:

### A Board

- Prioritaet
- Blockersicht
- Lesbarkeit der Fuehrung

### B Workspace

- Bearbeitbarkeit
- Arbeitslogik im Drawer oder Nachfolger
- naechste pruefbare Aktion

### C Relation

- Node -> Prozess
- Prozess -> Screen
- Screen -> Datei
- Folgeflaechen

### D Spezialmaske

- sauberer Uebergang aus dem Board in eine tiefere Bearbeitungsmaske

Wenn keine dieser Ebenen verbessert wird, ist die Aenderung fuer MasterControl vermutlich nicht zielrelevant.

---

## Dokumentationspflicht

Wenn sich der verifizierte Ist-Stand aendert, muessen die betroffenen Dokumente in diesem Ordner aktualisiert werden.

Mindestens mitzudenken:

- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`

Der Projektordner soll fuer Folge-Agenten isoliert lesbar sein.

Das bedeutet:

- keine versteckte Wahrheit nur im Chat
- keine impliziten Annahmen
- keine unmarkierten Richtungswechsel

---

## Abschlussregel fuer Folge-Agenten

Eine relevante MasterControl-Aenderung ist erst dann sauber abgeschlossen, wenn:

1. die betroffenen Produktdateien angepasst wurden
2. die Relations- und Folgeflaechenpruefung erfolgt ist
3. der Status-Sync gegen `fcp_masterboard_state.json` und `fcp_process_control_state.json` geprueft wurde
4. die betroffenen Projektdateien in `docs/project/p1_MasterControl` nachgezogen wurden

Kurzregel:

```text
Code allein reicht nicht.
UI allein reicht nicht.
JSON allein reicht nicht.
Jede relevante Aenderung muss Produkt, Relation, Status und Projektdokumentation gemeinsam mitdenken.
```
