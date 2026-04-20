# Project One — Interaktionswahrheit Masterboard

Stand: 2026-04-20

## Zweck

Dieses Dokument beschreibt die reale Interaktionslogik der aktuellen produktiven Masterboard-Oberflaeche.

Es beantwortet:

- welche Elemente heute klickbar sind
- was bei Klick real passiert
- ob daraus Fuehrung oder nur Bearbeitung entsteht
- welche wichtige Navigation aktuell fehlt

Grundlage:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`

---

## Klickbare Elemente heute

### Topbar / Aktionen

#### `Neu laden`

Bei Klick:

- setzt die Quellenanzeige auf `Lade…`
- ruft `loadState()` auf
- laedt Nodes und Prozesse live ueber RPC neu
- schreibt eine Statusmeldung in `#masterboardPageMsg`

Art der Interaktion:

- Datenreload
- keine Fuehrung

#### `Bootstrap uebernehmen`

Bei Klick:

- ruft `seedFromBootstrap()` auf
- uebergibt die Bootstrap-JSON-Daten an `fcp_masterboard_seed`
- laedt danach den State erneut live
- schreibt eine Statusmeldung

Art der Interaktion:

- operatives Seeding / Pflege
- keine Fuehrung

#### `Master export`

Bei Klick:

- exportiert `state.master` als JSON-Datei

Art der Interaktion:

- Export
- keine Fuehrung

#### `Ops export`

Bei Klick:

- exportiert `state.ops` als JSON-Datei

Art der Interaktion:

- Export
- keine Fuehrung

---

## Modus- und Tab-Interaktion

### `Führung`

Bei Klick:

- setzt `state.mode = "lead"`
- rendert Top-3-Blocker, Masterboard und Prozessliste neu

Art der Interaktion:

- Sichtbarkeitssteuerung
- eingeschraenkte Fuehrungsverdichtung

Bewertung:

Es entsteht nur indirekte Fuehrung, weil Elemente ausgeblendet oder priorisiert werden.
Es entsteht keine direkte navigierbare Arbeitsfuehrung.

### `Detail`

Bei Klick:

- setzt `state.mode = "detail"`
- rendert die Ansichten neu

Art der Interaktion:

- Sichtbarkeitssteuerung
- keine direkte Fuehrung

### Tab `Masterboard`

Bei Klick:

- aktiviert den Master-View
- blendet den Ops-View aus

Art der Interaktion:

- Ansichtswechsel
- keine Fuehrung

### Tab `Operatives Kontrollboard`

Bei Klick:

- aktiviert den Ops-View
- blendet den Master-View aus

Art der Interaktion:

- Ansichtswechsel
- keine Fuehrung

---

## Karten- und Zeileninteraktion

### Masterboard-Karte

Bei Klick:

- wird `openMasterDrawer(node.node_id)` aufgerufen
- der Node-Drawer wird geoeffnet

Im Drawer erscheinen:

- Titel
- Ebene
- Status
- Launch-Klasse
- Risiko
- Last Verified
- Fortschritt sichtbar
- Fortschritt unsichtbar
- Gaps
- Entscheidungen offen
- Referenzen

Art der Interaktion:

- Bearbeitung / Pflege
- keine relationale Fuehrung

Bewertung:

Der Klick fuehrt nicht zu Prozess, Screen oder Datei, sondern nur in einen Pflegeeditor.

### Prozesszeile

Bei Klick:

- wird `openOpsDrawer(proc.process_id)` aufgerufen
- der Process-Drawer wird geoeffnet

Im Drawer erscheinen:

- Titel
- Owner
- Status
- Prioritaet
- letztes Review
- Related Nodes
- Summary
- Review-Notiz
- Screens als JSON
- Smoke Checks als JSON
- Bugs als JSON

Art der Interaktion:

- Bearbeitung / Pflege
- keine gefuehrte Prozessnavigation

Bewertung:

Auch hier fuehrt der Klick nicht in reale operative Flaechen, sondern in einen Editor.

---

## Drawer-Interaktion

### Node-Drawer `In DB speichern`

Bei Klick:

- wird aus den Formularfeldern ein Payload gebaut
- `fcp_masterboard_node_upsert` wird aufgerufen
- danach wird der State live neu geladen
- der Drawer wird erneut fuer denselben Node geoeffnet
- eine Statusmeldung wird geschrieben

Art der Interaktion:

- Persistenz
- Pflege

### Process-Drawer `In DB speichern`

Bei Klick:

- wird aus den Formularfeldern ein Payload gebaut
- `fcp_process_control_upsert` wird aufgerufen
- danach wird der State live neu geladen
- der Drawer wird erneut fuer denselben Prozess geoeffnet
- eine Statusmeldung wird geschrieben

Art der Interaktion:

- Persistenz
- Pflege

### Drawer `Schließen`

Bei Klick:

- Drawer wird geschlossen
- Overlay wird entfernt
- Fokus springt zum letzten aktiven Element zurueck

Art der Interaktion:

- UI-Steuerung

### Overlay

Bei Klick:

- Drawer wird geschlossen

Art der Interaktion:

- UI-Steuerung

---

## Nicht klickbar trotz Fuehrungsrelevanz

Die folgenden Elemente sind heute sichtbar, aber nicht als echte Fuehrungsnavigation ausgebaut:

### Top-3-Blocker

Sie sind sichtbar, aber nicht klickbar.

Folge:

- Priorisierung endet ohne Handlungsuebergang.

### `related_nodes` in der Prozessliste

Sie werden als Text angezeigt, aber nicht verlinkt.

Folge:

- Prozess -> Board-Beziehung ist sichtbar, aber nicht nutzbar.

### `refs` eines Nodes

Sie erscheinen nur im Node-Drawer als Textarea-Inhalt.

Folge:

- Board -> Datei / DB / RPC bleibt nicht navigierbar.

### Screen-Informationen eines Prozesses

Im Listenmodus ist nur die Anzahl sichtbar.
Im Drawer stehen die Screen-Daten als JSON.

Folge:

- Prozess -> Screen -> reale Maske bleibt nicht direkt navigierbar.

---

## Entsteht heute Fuehrung oder nur Bearbeitung?

### Reale Fuehrung heute

Es gibt nur begrenzte Fuehrungsansaetze:

- `Führung`-Modus reduziert den Sichtbereich
- Top-3-Blocker verdichten Prioritaet
- `Next` versucht einen naechsten Schritt textlich anzudeuten

### Reale Bearbeitung heute

Der ueberwiegende Interaktionskern ist Bearbeitung:

- Kartenklick = Node-Editor
- Prozessklick = Prozess-Editor
- Save = DB-Pflege
- Seed/Reload/Export = Datenoperation

### Gesamtbewertung

Das aktuelle System ist interaktiv, aber nicht gefuehrt.

Die Interaktion fuehrt den Nutzer heute vor allem:

- in Pflege
- in Korrektur
- in Datenoperation

nicht aber sauber in:

- die naechste Arbeitsflaeche
- die naechste relevante Datei
- den naechsten verbundenen Prozess
- die richtige Spezialmaske

---

## Fehlende Navigation

Die folgenden Navigationsformen fehlen aktuell komplett oder nahezu komplett:

### Board -> Process

Es gibt keine klickbare Zuordnung vom Node zu seinen betroffenen Prozessen.

### Process -> Board

`related_nodes` sind nicht klickbar.

### Board / Process -> Screen

Es gibt keine direkte Navigation zu den betroffenen Screens oder Masken.

### Screen -> Repo-Datei

Es gibt keine operative Verbindung von Prozess- oder Board-Sicht zur realen Datei.

### Board -> `refs`

Referenzen sind nicht als klickbare technische Anker ausgefuehrt.

### Blocker -> Arbeitsziel

Top-3-Blocker fuehren nicht weiter.

### Drawer -> Spezialmaske

Es gibt keine Verzweigung in:

- Prozessdetailmaske
- Dateikontextmaske
- Mappingmaske
- Smoke-Check-Maske
- andere Vertiefungsflaechen

### Aenderung -> Folgeflaechen

Die UI sagt heute nicht:

- welche Folgeflaechen mit betroffen sind
- welche weiteren Knoten mitgedacht werden muessen
- welche Prozesse bei einer Aenderung nachgezogen werden muessen

---

## Interaktionsfazit

Das aktuelle Masterboard ist interaktiv und schreibend, aber die Interaktion ist ueberwiegend eine Pflegeinteraktion.

Fuer MasterControl reicht das nicht.

MasterControl braucht nicht nur klickbare Elemente, sondern Fuehrungsinteraktionen, die den Nutzer von:

- Prioritaet
- ueber Beziehung
- zur richtigen Arbeitsflaeche
- bis zur betroffenen Datei

tragen.
