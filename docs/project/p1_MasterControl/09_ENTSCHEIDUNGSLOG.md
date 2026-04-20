# Project One — Entscheidungslog

Stand: 2026-04-20

## Zweck

Dieses Dokument ist das fuehrende Entscheidungslog fuer `p1_MasterControl`.

Hier werden keine beliebigen Diskussionen gesammelt, sondern nur Entscheidungen mit struktureller Wirkung auf:

- Einstiegskette
- Dokumentationsfuehrung
- Architektur
- Arbeitsregeln
- Umsetzungslogik

Grundsatz:

- keine stillen Richtungswechsel
- keine nur im Chat bekannten Entscheidungen
- jede relevante Projektentscheidung muss hier nachvollziehbar festgehalten werden

---

## Verwendung

Ein Eintrag in dieses Log ist notwendig, wenn mindestens einer dieser Punkte zutrifft:

- die fuehrenden Dateien des Projektordners aendern sich
- die Einstiegskette fuer Folge-Agenten aendert sich
- eine alte Datei wird funktional abgewertet oder archiviert
- Zielbild, Soll-Architektur oder Umsetzungslogik verschieben sich
- eine neue Pflichtregel fuer Folge-Agenten eingefuehrt wird

Rein operative Kleinaenderungen ohne Richtungswirkung gehoeren statt hier in `10_AENDERUNGSLOG.md`.

---

## Eintragsformat

Jeder neue Eintrag soll mindestens enthalten:

- Datum
- Titel
- Status
  - `entschieden`
  - `offen`
  - `ueberholt`
- Kontext
- Entscheidung
- Konsequenzen
- Betroffene Dateien

---

## Eintraege

## 2026-04-20 — Fuehrende Einstiegskette 00 bis 07 festgelegt

Status:

- `entschieden`

Kontext:

- Der Projektordner enthielt urspruenglich nur `00` und `01`.
- Danach wurden verifizierte Phase-0-/Phase-1-Dokumente `02` bis `07` aufgebaut.
- Parallel existieren weiterhin aeltere oder anders geschnittene Dateien wie `02_SYSTEMKONTEXT_UND_DATEILANDKARTE.md`, `04_IST_ANALYSE_MASTERBOARD.md`, `05_SOLL_ARCHITEKTUR_MASTERCONTROL.md` und `06_UMSETZUNGSPLAN_MASTERCONTROL.md`.

Entscheidung:

- Die verpflichtende Einstiegskette fuer Folge-Agenten ist:
  - `00_README_PROJECT_ONE_MASTERCONTROL.md`
  - `01_ZIELBILD_MASTERCONTROL.md`
  - `02_IST_ANALYSE_MASTERBOARD.md`
  - `03_UI_WAHRHEIT_MASTERBOARD.md`
  - `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
  - `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
  - `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
  - `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Konsequenzen:

- Diese Dateien haben Vorrang fuer jede neue Analyse, Planung oder Umsetzung.
- Parallele aeltere Dateien bleiben vorerst bestehen, sind aber nachgeordnet.

Betroffene Dateien:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

## 2026-04-20 — Vierfach-Pflicht fuer Folge-Agenten festgelegt

Status:

- `entschieden`

Kontext:

- Es bestand das Risiko, Produkt-, Relations-, Status- und Dokumentationsarbeit voneinander zu trennen.
- Dadurch waeren stille Inkonsistenzen zwischen UI, Board-State und Projektordner wahrscheinlich geworden.

Entscheidung:

- Jede relevante MasterControl-Aenderung muss immer gemeinsam mitdenken:
  - Produkt
  - Relation
  - Status
  - Projektdokumentation

Konsequenzen:

- Teilfortschritte ohne Mitpruefung der anderen drei Ebenen gelten nicht als sauber abgeschlossen.
- Diese Regel ist in `07_UMSETZUNGSREGELN_MASTERCONTROL.md` verbindlich verankert.

Betroffene Dateien:

- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`
- `00_README_PROJECT_ONE_MASTERCONTROL.md`

## 2026-04-20 — Strukturharmonisierung Alt vs Neu nachrangig geloest

Status:

- `entschieden`

Kontext:

- Der Ordner enthaelt sowohl neue verifizierte Einstiegstexte als auch aeltere Paralleltexte.
- Eine sofortige Umbenennung oder Loeschung haette Informationsverlust oder unnoetige Unruhe erzeugen koennen.

Entscheidung:

- Aeltere Paralleltexte werden vorerst nicht geloescht.
- Sie werden funktional nachrangig eingeordnet.
- `08_UMSETZUNGSPAKETE_CODEX.md` dient kuenftig als operative Paketdatei.

Konsequenzen:

- Der Ordner bleibt lesbar und replizierbar.
- Eine spaetere Archivierung oder Zusammenfuehrung bleibt moeglich.

Betroffene Dateien:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `08_UMSETZUNGSPAKETE_CODEX.md`

## 2026-04-20 — Phase 2 / Phase 1A wird auf bestehender Masterboard-UI aufgebaut

Status:

- `entschieden`

Kontext:

- Die verifizierte Phase-0-/Phase-1-Basis hat gezeigt, dass das bisherige Board Zustand anzeigt und Rohpflege erlaubt, aber noch keine gefuehrte Arbeit aus Klicks erzeugt.
- Gleichzeitig sind reale DB-/RPC-Pfade und die bestehende Masterboard-Implementierung bereits im Repo vorhanden.

Entscheidung:

- Phase 2 / Phase 1A wird nicht als neue Produktarchitektur begonnen.
- Die bestehende Masterboard-UI bleibt der Tragrahmen.
- Fuehrungslogik wird direkt in den vorhandenen Board-, Process- und Drawer-Flaechen ausgebaut:
  - klickbare Top-Blocker
  - sichtbare Legende und Signalerklaerung
  - sichtbare Board-Process-UI-File-Relationen
  - Drawer als Workbench statt Rohpflege

Konsequenzen:

- Umsetzung bleibt repo-wahr und respektiert bestehende RPCs, Bootstrap-Daten und Statusstrukturen.
- Produkt, Relation, Status und Projektdokumentation bleiben auch in der Umsetzungsphase gekoppelt.

Betroffene Dateien:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`
- `10_AENDERUNGSLOG.md`

---

## Offene Entscheidungsfelder

Die folgenden Strukturthemen bleiben offen und muessen spaeter bewusst entschieden werden:

1. Ob `04_IST_ANALYSE_MASTERBOARD.md` explizit in ein Archiv verschoben wird
2. Ob `06_UMSETZUNGSPLAN_MASTERCONTROL.md` komplett in `08_UMSETZUNGSPAKETE_CODEX.md` ueberfuehrt wird
3. Ob fuer historische Paralleltexte ein eigener Archiv-Unterordner angelegt wird
