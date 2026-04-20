# Project One — UI-Wahrheit Masterboard

Stand: 2026-04-20

## Zweck

Dieses Dokument beschreibt die aktuelle Oberflaeche des produktiven Masterboards blockweise.

Es beantwortet fuer jeden UI-Bereich:

- welchen Zweck er heute real hat
- was funktional bereits arbeitet
- was nicht arbeitet
- warum der Bereich fuer das Zielbild `MasterControl` noch nicht ausreicht

Grundlage sind ausschliesslich:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`

---

## Header / Intro

### Zweck heute

Der Header beschreibt die Maske als:

- `FCP Masterboard`
- Systemboard fuer Architektur, operative Kontrolle und Launch-Risiko
- ausschliesslich fuer Superadmin
- direkt in die Datenbank schreibend

Zusatzfunktion:

- `#masterboardPageMsg` dient als Status- und Fehlermeldungsbereich

### Was funktioniert

- Die Maske ist eindeutig als interne Superadmin-Oberflaeche gekennzeichnet.
- Der Nutzer bekommt direkt am Anfang technischen Kontext.
- Der Statuskanal zeigt reale Zustandsmeldungen:
  - Live-DB aktiv
  - Bootstrap-Fallback aktiv
  - Save-Fehler
  - Seed-/Reload-Rueckmeldungen

### Was nicht funktioniert

- Der Header fuehrt keine operative Prioritaet.
- Er beantwortet nicht:
  - was jetzt wirklich wichtig ist
  - welcher Blocker aktuell fuehrend ist
  - welche Flaeche als naechstes zu oeffnen ist
- Der sichtbare Statusbereich ist technisch, nicht arbeitsorientiert.

### Warum es fuer MasterControl nicht reicht

Der Bereich informiert ueber Systemcharakter und Technik, aber nicht ueber Arbeit.

Fuer MasterControl muesste der Kopfbereich nicht nur sagen, was die Maske ist, sondern den Nutzer in die naechste sinnvolle Bearbeitungsrichtung fuehren.

---

## Topbar / Stats / Filter

### Zweck heute

Die Topbar ist in drei Bloecke geteilt:

- `titlebox`
- `filterbox`
- `actionbox`

Sie buendelt:

- Systemtitel und Golden Path
- Such- und Filterlogik
- Datenquelle, Kennzahlen und Aktionsbuttons

### Was funktioniert

- Suche ist vorhanden.
- Lane-, Status- und Signalfilter sind vorhanden.
- Die Datenquelle wird sichtbar als:
  - `Lade…`
  - `Live DB`
  - `Bootstrap`
- Die Kennzahlen fuer Knoten, Luecken, Risiken und Prozesse werden berechnet.
- Aktionen sind real verdrahtet:
  - neu laden
  - Bootstrap uebernehmen
  - Export Master
  - Export Ops

### Was nicht funktioniert

- Die Filterlogik reduziert nur Sichtbarkeit, fuehrt aber keine Arbeit.
- Die Stats beziehen sich auf den geladenen Gesamtzustand, nicht auf die aktuell gefilterte Sicht.
- Die Filter wirken nicht als relationale Navigation.
- Die Signale sind reduziert auf:
  - Risiko
  - Gap
  - Golden Path
- Es fehlen Fuehrungsdimensionen wie:
  - Beweisgrad
  - betroffene Prozesse
  - betroffene Screens
  - betroffene Dateien
  - Folgeflaechen

### Warum es fuer MasterControl nicht reicht

Die Topbar ist heute ein Sichtbarkeits- und Datenoperationsbereich, aber kein echter Arbeitsfuehrungsbereich.

MasterControl braucht hier nicht nur Filter, sondern eine Fuehrungslogik, die klar macht:

- warum ein Bereich relevant ist
- wohin der Nutzer als Naechstes gehen muss
- welche Folgeflaechen durch eine Aenderung betroffen sind

---

## Fuehrungsbereich / Top-3-Blocker

### Zweck heute

Der Fuehrungsbereich enthaelt:

- den Modus-Umschalter `Führung` / `Detail`
- eine Legende
- die Top-3-Blocker-Liste

Er soll die Board-Sicht auf fuehrungsrelevante Punkte verdichten.

### Was funktioniert

- Der Modus wirkt real auf die Sichtbarkeit der Inhalte.
- Die Top-3-Blocker werden aus einer Priorisierungslogik berechnet.
- Status, Owner und ein `Next`-Hinweis werden angezeigt.
- Die Legende macht Ampel- und Symbolsprache etwas lesbarer.

### Was nicht funktioniert

- Die Blocker sind nicht klickbar.
- Es gibt keinen direkten Uebergang in die betroffene Arbeitsflaeche.
- Die Priorisierung ist fest im JavaScript verdrahtet, nicht transparent aus dem Board-State erklaert.
- `Next` ist nur heuristisch aus erstem Gap, erster Entscheidung oder erster Kurznotiz abgeleitet.
- Der Bereich fuehrt nicht weiter zu:
  - Prozess
  - Screen
  - Datei
  - Spezialmaske

### Warum es fuer MasterControl nicht reicht

Dieser Bereich produziert Fuehrungssprache, aber keine Fuehrungsinteraktion.

Er signalisiert Wichtigkeit, ersetzt aber noch keine belastbare operative Steuerung.

MasterControl braucht hier:

- klickbare Fuehrungsziele
- nachvollziehbare Priorisierungsgruende
- direkte Uebergaenge in den naechsten Arbeitskontext

---

## Masterboard-Karten

### Zweck heute

Die Karten visualisieren die einzelnen Board-Nodes pro Lane.

Pro Karte werden heute gezeigt:

- Lane-Badge
- Status
- Titel
- Launch-Klasse
- Risiko
- erste Kurznotiz
- `Next`
- heuristisch abgeleiteter `Type`
- harter `Owner`

### Was funktioniert

- Die Lane-Struktur ist visuell sauber.
- Risiko-, Gap- und Fokus-Signale sind sichtbar.
- Karten sind klickbar.
- Klick oeffnet den zugehoerigen Node-Drawer.
- Die Karten funktionieren als kompakte Statusboxen.

### Was nicht funktioniert

- Die Karten zeigen keine expliziten Beziehungen zu:
  - Prozessen
  - Screens
  - Dateien
  - Folgeflaechen
- `Type` wird nur aus Textmustern in `refs` abgeleitet.
- `Owner` ist fuer Nodes aktuell nicht datenwahr, sondern fest gesetzt.
- Es wird nur eine Kurznotiz sichtbar gemacht.
- Wichtige Fuehrungsinformationen fehlen:
  - Beweisgrad
  - Pruefstand
  - Zielmaske
  - Auswirkungen auf andere Knoten

### Warum es fuer MasterControl nicht reicht

Die Karte ist heute ein guter Statuscontainer, aber kein vollwertiges Arbeitsobjekt.

Fuer MasterControl muesste ein Node nicht nur sichtbar, sondern relational und operativ fuehrbar sein.

Heute bleibt der Knoten trotz Klick weitgehend isoliert.

---

## Ops- / Process-Liste

### Zweck heute

Das operative Kontrollboard zeigt Prozesse in tabellarischer Verdichtung.

Sichtbar sind heute:

- Prozessname
- `related_nodes`
- `Next`
- `Type`
- `Owner`
- Status
- Anzahl Screens
- UI-Quote
- Smoke-Quote
- offene Bugs
- Review-Datum

### Was funktioniert

- Prozesse werden real aus dem Prozess-State gerendert.
- Prozesszeilen sind klickbar.
- Die Liste schafft eine schnellere Kontrollsicht als das Masterboard.
- Die Prozesssicht macht pruefungsnahe Felder sichtbar.

### Was nicht funktioniert

- `related_nodes` werden nur als Textliste angezeigt.
- Screens erscheinen in der Listenansicht nicht als konkrete Flaechen, sondern nur als Anzahl.
- UI- und Smoke-Werte sind stark verdichtet.
- Der Uebergang von Prozess zu realer Seite oder Datei fehlt.
- In `Führung` werden Prozesse teils stark weggefiltert, statt erklaert priorisiert zu werden.

### Warum es fuer MasterControl nicht reicht

Die Prozessliste ist heute ein Kontroll- und Review-Board, aber kein Prozessfuehrungssystem.

Fuer MasterControl muesste ein Prozess nicht nur bewertet, sondern bis zu:

- konkreten Screens
- konkreten Dateien
- konkreten offenen Arbeitsschritten

aufgeloest werden koennen.

---

## Drawer / Detailbereich

### Zweck heute

Der Drawer ist die einzige Detail- und Schreiboberflaeche des Masterboards.

Es gibt zwei Varianten:

- Node-Drawer
- Process-Drawer

### Was funktioniert

- Drawer, Overlay und Fokusverhalten sind funktional vorhanden.
- Nodes koennen direkt in die DB gespeichert werden.
- Prozesse koennen direkt in die DB gespeichert werden.
- Die UI ist damit real eine schreibende Board-Maske.

### Was nicht funktioniert

- Der Node-Drawer ist ein Feld-/Textarea-Editor.
- Der Process-Drawer ist ebenfalls ein Editor und nutzt fuer Kernbereiche JSON-Textareas.
- Es gibt keine Workbench-Sektion fuer:
  - betroffene Prozesse
  - betroffene Screens
  - betroffene Dateien
  - Folgeflaechen
  - naechste pruefbare Aktion
  - Zielmaske
- Es gibt keine relationale Navigation aus dem Drawer heraus.
- Komplexe Themen werden nicht an Spezialmasken uebergeben.

### Warum es fuer MasterControl nicht reicht

Der Drawer ist aktuell der klarste Beleg dafuer, dass das System noch kein MasterControl ist.

Er erlaubt Pflege, aber keine gefuehrte Bearbeitung.

Das Zielbild fordert ausdruecklich den Wechsel:

- von Rohpflege
- zu Workbench

Dieser Wechsel ist in der aktuellen UI noch nicht vollzogen.

---

## UI-Gesamteinschaetzung

Die aktuelle Oberflaeche ist repo-wahr:

- eine funktionierende Board-Oberflaeche
- mit Live-DB-Anbindung
- mit Bootstrap-Fallback
- mit getrenntem Master- und Prozessbereich
- mit schreibendem Drawer

Sie ist aber noch keine fuehrende Bedienoberflaeche im Sinn von MasterControl.

Der Hauptgrund liegt nicht in fehlenden Daten, sondern in der fehlenden operativen Fuehrung zwischen:

- Board
- Prozess
- Screen
- Datei
- Folgeflaeche
- Zielmaske
