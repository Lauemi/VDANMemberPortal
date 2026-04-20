# Project One — MasterControl

## Zweck

`p1_MasterControl` ist der **führende Projektordner** für die Planung, Weiterentwicklung und Replizierung des FCP-Masterboards als **MasterControl-System**.

Dieser Ordner dient **nicht** nur der Dokumentation eines einzelnen Features, sondern als:

- Projektcontainer
- Zielbildspeicher
- Arbeitsgrundlage für KIs
- Änderungs- und Entscheidungslogik
- Replikationsbasis für spätere ähnliche Systeme

Der Ordner muss so gepflegt werden, dass **jede KI** nach dem Lesen sofort versteht:

1. worum es im Projekt geht,
2. welche Repo-Dateien betroffen sind,
3. welche Relationen berücksichtigt werden müssen,
4. welche Folgen Änderungen haben,
5. wie Änderungen dokumentiert und versioniert werden,
6. wie das System bei Bedarf in einem anderen Repo erneut aufgebaut werden kann.

## Verbindlicher Einstieg

Diese Datei ist ab jetzt der **verpflichtende Startpunkt fuer jeden Folge-Agenten**.

Arbeitsregel:

1. zuerst `00_README_PROJECT_ONE_MASTERCONTROL.md`
2. danach `01_ZIELBILD_MASTERCONTROL.md`
3. danach die verifizierten Ist-/Pflichtdateien `02_` bis `07_`

Ohne diese Lesereihenfolge darf keine relevante Analyse, Planung oder Umsetzung als vollstaendig gelten.

---

## Grundprinzipien

### 1. Replizierbar
Dieser Ordner muss ausreichen, um das Projekt später in einem anderen Kontext erneut bauen zu können.

### 2. Prinzipiengesteuert
MasterControl wird nicht nur visuell, sondern entlang klarer Prinzipien entwickelt:

- geführt
- priorisiert
- relational
- bedienbar
- dokumentiert
- versioniert
- auslagerbar in Spezialmasken
- reproduzierbar

### 3. Repo-wahrheitsbasiert
Alle Aussagen müssen auf echten Repo-Dateien oder real belegbaren Zuständen beruhen.

### 4. Änderungsfolgen mitdenken
Wer eine betroffene Datei ändert, muss prüfen, welche Folgeflächen ebenfalls betroffen sind.

### 5. Richtungswechsel dokumentieren
Wenn sich Zielbild, Architektur oder Bedienphilosophie ändern, wird das nicht stillschweigend gemacht, sondern begründet dokumentiert.

---

## Aktueller Scope

MasterControl betrifft aktuell insbesondere das bestehende FCP-Masterboard.

### Primär betroffene Repo-Dateien

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`
- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`

### Derzeitiger Ist-Zustand

Repo-seitig ist bereits vorhanden:

- Board-Ansicht
- Operatives Kontrollboard
- Filter
- Legende
- Top-3-Blocker
- Drawer
- Bootstrap-/Live-Board-Anbindung

Die aktuelle Schwäche ist jedoch:

- der Drawer ist überwiegend Rohpflege statt Workbench
- Relationen sind UI-seitig kaum geführt
- Auswirkungen/Folgepfade sind nicht klar sichtbar
- Priorisierung und Bedienführung sind nicht ausreichend
- das System liefert Informationen, aber noch keine echte operative Steuerung

MasterControl ist daher die Weiterentwicklung:

> von einem Statusboard
> zu einer geführten Bedienoberfläche / Workbench / Systemsteuerung.

---

## Projektziel

Das Ziel ist ein System, das nicht nur Zustand anzeigt, sondern aktiv beim Arbeiten hilft.

MasterControl soll:

- Überblick geben
- Priorität klarmachen
- Zusammenhänge zeigen
- nächste Schritte führen
- Änderungen ermöglichen
- in Spezialmasken verzweigen können
- für KIs und Menschen gleichermaßen verständlich bleiben

---

## Arbeitsregel für jede KI

Jede KI, die in diesem Projekt arbeitet, muss vor Änderungen mindestens folgende Dateien prüfen:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `01_ZIELBILD_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Diese Reihenfolge ist verpflichtend:

1. `00_README_PROJECT_ONE_MASTERCONTROL.md`
2. `01_ZIELBILD_MASTERCONTROL.md`
3. `02_IST_ANALYSE_MASTERBOARD.md`
4. `03_UI_WAHRHEIT_MASTERBOARD.md`
5. `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
6. `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
7. `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
8. `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Wenn Umsetzungspakete betroffen sind zusätzlich:

- `08_UMSETZUNGSPAKETE_CODEX.md`

---

## Pflichtverhalten bei Änderungen

Vor jeder Änderung:

1. betroffene Dateien identifizieren
2. betroffene Relationen identifizieren
3. Folgeflächen prüfen
4. prüfen, ob Projekt-Docs angepasst werden müssen

Nach jeder Änderung:

1. betroffene Projektdateien aktualisieren
2. Entscheidungslog prüfen
3. Änderungslog ergänzen
4. falls nötig Umsetzungslogik anpassen

Wenn **keine** Projektdatei angepasst wurde, obwohl ein relevanter Systemteil geändert wurde, muss das explizit begründet werden.

---

## Projektstruktur

Dieser Ordner ist absichtlich als kleiner Projektkern aufgebaut.

### Fuehrende Dateien ab jetzt

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `01_ZIELBILD_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`
- `08_UMSETZUNGSPAKETE_CODEX.md`
- `09_ENTSCHEIDUNGSLOG.md`
- `10_AENDERUNGSLOG.md`

### Aktuelle Ist-Lage des Ordners

Repo-real verankert sind aktuell:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `01_ZIELBILD_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Die Dateien `08_` bis `10_` bleiben weiterhin vorgesehene Folgeartefakte, sind aber nicht Voraussetzung fuer das Verstehen des jetzt dokumentierten Ist-Standes.

### Historische oder parallele Dateien im Ordner

Im Ordner existieren zusaetzlich bereits weitere Dateien wie:

- `02_SYSTEMKONTEXT_UND_DATEILANDKARTE.md`
- `04_IST_ANALYSE_MASTERBOARD.md`
- `05_SOLL_ARCHITEKTUR_MASTERCONTROL.md`
- `06_UMSETZUNGSPLAN_MASTERCONTROL.md`

Diese Dateien koennen weiterhin fachlich nuetzlich sein, sind aber **nicht** die fuehrende verifizierte Phase-0-/Phase-1-Basis.

Fuer die aktuell belastbare Einstiegskette gelten vorrangig:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `01_ZIELBILD_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Wenn parallele Dateien inhaltlich abweichen, haben diese acht Dateien Vorrang fuer Folge-Agenten.

### Startkette fuer Folge-Agenten

Ein Folge-Agent muss den Ordner isoliert in dieser Reihenfolge lesen:

1. `00_README_PROJECT_ONE_MASTERCONTROL.md`
2. `01_ZIELBILD_MASTERCONTROL.md`
3. `02_IST_ANALYSE_MASTERBOARD.md`
4. `03_UI_WAHRHEIT_MASTERBOARD.md`
5. `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
6. `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
7. `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
8. `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Erst danach duerfen ergaenzende Soll-/Plan-Dokumente oder historische Paralleltexte herangezogen werden.

### Templates

- `templates/TEMPLATE_ENTSCHEIDUNG.md`
- `templates/TEMPLATE_AENDERUNGSPAKET.md`
- `templates/TEMPLATE_UI_PRUEFUNG.md`
- `templates/TEMPLATE_HANDOFF_KI.md`

---

## Replikationsregel

Wenn später ein ähnliches Board / Steuerungssystem gebaut werden soll, muss dieser Ordner als **Projekt-Basiscontainer** verwendbar sein.

Das bedeutet:

- keine zufälligen Repo-Hilfsdateien
- keine irrelevanten Build-/Systemartefakte
- nur inhaltlich notwendige Projektdateien
- klare Begriffe
- klare Struktur
- klare Änderungsdisziplin

---

## Definition von Erfolg

MasterControl ist erfolgreich, wenn:

- das Zielbild klar beschrieben ist,
- jede Änderung sauber geführt wird,
- Relationen und Folgen berücksichtigt werden,
- das System repo-nah weiterentwickelt werden kann,
- Codex/Claude/ChatGPT denselben Projektstand schnell verstehen,
- und der gesamte Projektordner als replizierbare Vorlage taugt.
