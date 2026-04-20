# Project One — Fuehrungsdefizite Masterboard

Stand: 2026-04-20

## Zweck

Dieses Dokument verdichtet die bestaetigten Fuehrungsdefizite des aktuellen Masterboards in eine belastbare Matrix.

Es dient als operative Grundlage fuer spaetere Umsetzungsplanung.

Die Matrix trennt:

- beobachtetes Problem
- reale Auswirkung
- Schweregrad
- spaetere Ziel-Ebene

Ziel-Ebenen:

- `A Board`
- `B Workspace`
- `C Relation`
- `D Spezialmaske`

---

## Fuehrungsdefizit-Matrix

| Bereich | Problem | Auswirkung | Schweregrad | Ziel-Ebene |
|---|---|---|---|---|
| Header / Intro | Header informiert nur ueber Systemcharakter und Technik | Nutzer weiss, was die Maske ist, aber nicht, was jetzt priorisiert bearbeitet werden muss | mittel | A Board |
| Topbar / Stats / Filter | Filter steuern Sichtbarkeit, aber keine Arbeit | Die Oberflaeche laesst sich reduzieren, fuehrt aber nicht in den naechsten sinnvollen Bearbeitungspfad | mittel | A Board |
| Topbar / Stats / Filter | Stats bleiben global statt sichtbarkeitsbezogen | Kennzahlen und aktuelle Arbeitsansicht driften auseinander | mittel | A Board |
| Topbar / Stats / Filter | Keine relationale Filterung nach Prozess, Screen, Datei oder Folgeflaeche | Relevanz bleibt flach und nicht arbeitsnah | hoch | C Relation |
| Fuehrungsbereich | Top-3-Blocker sind nicht klickbar | Priorisierung endet ohne Uebergang in die Bearbeitung | hoch | A Board |
| Fuehrungsbereich | Priorisierung ist hart codiert statt transparent aus dem State ableitbar | Fuehrung ist fuer Folge-Agenten und Nutzer nicht sauber nachvollziehbar | mittel | A Board |
| Fuehrungsbereich | `Next` ist nur textheuristisch | Der angezeigte naechste Schritt ist nicht belastbar genug fuer operative Steuerung | hoch | B Workspace |
| Masterboard-Karten | Karten zeigen keine expliziten Prozess-, Screen- oder Datei-Beziehungen | Ein Node bleibt isoliert statt als Arbeitsobjekt fuehrbar zu werden | hoch | C Relation |
| Masterboard-Karten | `Type` und `Owner` sind teils heuristisch oder hart gesetzt | Die Oberflaeche vermittelt Stellenweise Scheingenauigkeit statt belastbarer Systemwahrheit | mittel | A Board |
| Masterboard-Karten | Nur eine Kurznotiz ist sichtbar | Beweisgrad, Pruefstand und Folgeflaechen bleiben unsichtbar | hoch | A Board |
| Ops-/Process-Liste | `related_nodes` sind nur Text | Prozesse sind sichtbar mit dem Board verbunden, aber nicht navigierbar verbunden | hoch | C Relation |
| Ops-/Process-Liste | Screens erscheinen nur als Anzahl oder JSON-Inhalt | Prozesskontrolle bleibt abstrakt statt handlungsleitend | hoch | C Relation |
| Ops-/Process-Liste | Einzelne Prozesspfade sind repo-seitig nicht mehr sauber aufloesbar | Kontrollboard kann von realen UI-Flaechen wegdriften | hoch | C Relation |
| Drawer / Detailbereich | Node-Drawer ist ein Rohpflege-Editor | Knoten koennen gepflegt, aber nicht gefuehrt bearbeitet werden | hoch | B Workspace |
| Drawer / Detailbereich | Process-Drawer arbeitet fuer Kerndaten mit JSON-Textareas | Hohe Pflegehuerde, geringe Arbeitsfuehrung, schwache Replizierbarkeit | hoch | B Workspace |
| Drawer / Detailbereich | Keine Folgeflaechen, keine betroffenen Dateien, keine Zielmasken | Auswirkungen einer Aenderung bleiben im Bearbeitungskontext unsichtbar | sehr hoch | C Relation |
| Drawer / Detailbereich | Keine Verzweigung in Spezialmasken | Komplexe Themen bleiben in einer unpassenden Universalmaske stecken | sehr hoch | D Spezialmaske |

---

## Zusammenfassung der Defizitlage

Das aktuelle Masterboard zeigt bereits:

- Zustand
- Risiko
- Gaps
- Prozesse
- Pruefstand
- Pflegefaehigkeit

Das reicht aber noch nicht fuer MasterControl.

Der Grund ist nicht primar fehlender Datenbestand.

Der Grund ist die fehlende Fuehrungslogik zwischen:

- Wichtigkeit
- Beziehung
- Arbeitsziel
- Folgeflaeche
- Vertiefungsmaske

Heute ist das System vor allem:

- Statusboard
- Kontrollboard
- Pflegeoberflaeche

Noch nicht ausreichend vorhanden sind:

- Board als fuehrendes Prioritaetssystem
- Drawer als Workbench
- Relationsebene zwischen Board, Prozess, Screen und Datei
- Spezialmasken fuer tiefe Bearbeitung

---

## Warum das aktuelle Board noch kein MasterControl ist

### 1. Es priorisiert, aber fuehrt nicht konsequent weiter

Der Nutzer sieht, was wichtig sein koennte, wird aber nicht sauber in die richtige Bearbeitungsrichtung geleitet.

### 2. Es zeigt Beziehungen an, aber macht sie nicht nutzbar

Node-, Prozess- und Screen-Zusammenhaenge sind teilweise textlich vorhanden, aber nicht navigierbar.

### 3. Es erlaubt Pflege, aber keine echte Workbench-Nutzung

Der Drawer ist datenorientiert, nicht arbeitsorientiert.

### 4. Es kennt keine saubere Eskalationstiefe

Wenn ein Thema ueber die Universalmaske hinausgeht, gibt es keinen klaren Uebergang in eine Spezialmaske.

### 5. Es bildet Folgeflaechen nicht ausreichend ab

Die Oberflaeche macht nicht sichtbar, welche Aenderungen weitere Knoten, Prozesse, Screens oder Dateien nach sich ziehen.

---

## Konsequenz fuer Folge-Agenten

Jede weitere MasterControl-Arbeit muss diese Defizite nicht nur kosmetisch verbessern, sondern systemisch adressieren.

Pflichtfragen fuer jede kuenftige Umsetzung:

1. Wird Prioritaet dadurch fuehrender?
2. Werden Beziehungen dadurch sichtbarer und klickbar?
3. Wird der Drawer dadurch mehr Workbench und weniger Rohpflege?
4. Werden Folgeflaechen dadurch explizit sichtbar?
5. Entsteht dadurch ein sauberer Pfad in eine Spezialmaske, wenn der Drawer nicht reicht?
