# Project One — Aenderungslog

Stand: 2026-04-20

## Zweck

Dieses Dokument ist das fuehrende Aenderungslog fuer den Projektordner `p1_MasterControl`.

Es dokumentiert konkrete Repo-Aenderungen am Projektordner selbst:

- neue Dateien
- nachgeschaerfte Regeln
- geaenderte Einstiegskette
- nachgezogene Analysedokumente

Grundsatz:

- nachvollziehbar
- knapp, aber konkret
- repo-wahr
- ohne Chat-Abhaengigkeit

---

## Unterschied zu 09_ENTSCHEIDUNGSLOG.md

- `09_ENTSCHEIDUNGSLOG.md` dokumentiert Richtungs- und Strukturentscheidungen
- `10_AENDERUNGSLOG.md` dokumentiert konkrete Aenderungen am Projektordner

Wenn beides betroffen ist:

- Entscheidung in `09`
- konkrete Durchfuehrung in `10`

---

## Eintragsformat

Jeder Eintrag soll mindestens enthalten:

- Datum
- Kurzbeschreibung
- geaenderte oder neue Dateien
- Wirkung fuer Folge-Agenten

---

## Eintraege

## 2026-04-20 — Verifizierte Phase-0-/Phase-1-Basis im Repo materialisiert

Geaenderte oder neue Dateien:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Wirkung fuer Folge-Agenten:

- Die bestaetigte Phase-0-/Phase-1-Analyse ist nicht mehr nur Chat-Wissen.
- Folge-Agenten koennen den Projektordner isoliert lesen und den Ist-Stand belastbar verstehen.

## 2026-04-20 — Einstieg und Regeln nachgeschaerft

Geaenderte Dateien:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Wirkung fuer Folge-Agenten:

- Der README ist jetzt verpflichtender Startpunkt.
- Die Einstiegskette `00` bis `07` ist klar festgelegt.
- Die Vierfach-Pflicht Produkt / Relation / Status / Projektdokumentation ist explizit verankert.

## 2026-04-20 — Fehlende Fuehrungsdateien 08 bis 10 angelegt

Neue Dateien:

- `08_UMSETZUNGSPAKETE_CODEX.md`
- `09_ENTSCHEIDUNGSLOG.md`
- `10_AENDERUNGSLOG.md`

Wirkung fuer Folge-Agenten:

- Umsetzungspakete koennen kuenftig strukturiert vorbereitet werden.
- Richtungsentscheidungen haben einen festen Ort.
- Projektordner-Aenderungen koennen versioniert und nachvollziehbar nachgezogen werden.

## 2026-04-20 — Phase 2 / Phase 1A in der Masterboard-UI aufgebaut

Geaenderte Dateien:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`
- `09_ENTSCHEIDUNGSLOG.md`

Wirkung fuer Folge-Agenten:

- Das Masterboard fuehrt jetzt aus dem UI heraus in echte Arbeitskontexte statt nur in Rohpflege.
- Top-Blocker sind klickbar.
- Node- und Prozess-Relationen sind gegenseitig sichtbar und klickbar.
- Screens, betroffene Dateien, Folgeflaechen und Zielmasken sind im Drawer als Workbench strukturiert sichtbar.
- Die bestehende DB-/RPC-Wahrheit bleibt der Tragrahmen; es wurden keine neuen Statusdateien als Produktquelle eingefuehrt.

## 2026-04-20 — UI-/UX-Nachschaerfung fuer Lesbarkeit und Fuehrung umgesetzt

Geaenderte Dateien:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`

Wirkung fuer Folge-Agenten:

- Die bestehende Masterboard-Struktur bleibt erhalten, ist aber visuell klarer gefuehrt.
- Kontrastfehler im dunklen Masterboard-/Drawer-Kontext sind gezielt bereinigt.
- Karten, Top-Blocker, Ops-Liste und Drawer staffeln wichtige Arbeitssignale jetzt deutlicher.
- Fuehrungs- und Detailmodus sind optisch klarer unterscheidbar, ohne neue Produktlogik einzufuehren.

---

## Offene Folgearbeiten am Projektordner

Die folgenden Punkte sind noch nicht umgesetzt, aber als naechste Strukturarbeiten vorbereitet:

1. Nachrangige Alt-Dateien ggf. explizit als Archiv markieren
2. `06_UMSETZUNGSPLAN_MASTERCONTROL.md` spaeter gegen `08_UMSETZUNGSPAKETE_CODEX.md` konsolidieren
3. Archivierungs- oder Zusammenfuehrungsregel fuer Paralleltexte final entscheiden
