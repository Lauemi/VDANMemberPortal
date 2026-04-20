# Project One — Zielbild MasterControl

## Warum dieses Projekt existiert

Das bestehende Masterboard liefert bereits Informationen, aber es führt operative Arbeit noch nicht sauber.

Aktuell zeigt es:

- Status
- Hinweise
- Gaps
- Risiken
- Meta-Informationen

Aber es beantwortet noch nicht zuverlässig die eigentlich wichtigen Arbeitsfragen:

- **Was ist gerade wirklich wichtig?**
- **Was ist wirklich blockiert?**
- **Welche Datei ist betroffen?**
- **Welcher Flow steckt dahinter?**
- **Welche Folgeflächen muss ich mitdenken?**
- **Welche nächste sinnvolle Aktion gibt es?**
- **Wann reicht der Drawer nicht mehr und ich muss in eine Spezialmaske verzweigen?**

MasterControl existiert, damit aus einem reinen Board eine **geführte operative Steueroberfläche** wird.

---

## Ziel in einem Satz

MasterControl ist die **führende Bedien- und Kontrolloberfläche** für operative Steuerung im FCP-Kontext — mit klarer Priorisierung, sichtbaren Relationen, nachvollziehbaren Folgen und gezielten Arbeitsaktionen.

---

## Was MasterControl sein soll

MasterControl soll gleichzeitig fünf Rollen erfüllen:

### 1. Überblickssystem
Es muss auf einen Blick zeigen:

- wo es brennt,
- was blockiert,
- was bereits sauber ist,
- was nur teilweise erfüllt ist,
- und welche Bereiche launch-kritisch sind.

### 2. Führungssystem
Es darf nicht nur anzeigen, sondern muss den Nutzer führen:

- nächste sinnvolle Aktion,
- nächste betroffene Maske,
- nächste betroffene Datei,
- nächste betroffene Relation,
- nächster prüfbarer Schritt.

### 3. Workbench
Der Nutzer muss damit arbeiten können.

Das bedeutet:

- nicht nur lesen,
- sondern Werte verändern,
- Zustände setzen,
- Knoten pflegen,
- Relationen sehen,
- Entscheidungen dokumentieren,
- und bei Bedarf in tiefere Spezialmasken wechseln.

### 4. Kontrollsystem
MasterControl muss sichtbar machen:

- ob eine Aussage geprüft ist,
- ob ein Zustand nur behauptet oder wirklich bewiesen ist,
- ob betroffene JSON-Artefakte synchron sind,
- ob Code-/UI-/DB-Wahrheiten zusammenpassen.

### 5. Replikationssystem
Das Projekt muss so beschrieben und gebaut werden, dass ein anderes Team oder eine andere KI das System später anhand dieses Ordners erneut aufbauen kann.

---

## Was MasterControl ausdrücklich NICHT sein soll

MasterControl darf **nicht** sein:

### Kein schöner Datenfriedhof
Also keine Oberfläche, die nur viele Felder zeigt, aber keine echte Arbeitsführung bietet.

### Kein Roh-JSON-Editor in hübsch
Der Nutzer soll nicht primär Textblöcke pflegen, sondern mit einer geführten Logik arbeiten.

### Kein isoliertes Board ohne Relationen
Ein Knoten ohne verknüpfte Dateien, Prozesse, Screens, Masken und Folgen ist unzureichend.

### Kein "alles gleich wichtig"
MasterControl muss Gewichtung sichtbar machen.

### Kein Blindflug-System
Es darf nicht unklar bleiben, ob etwas eine Idee, ein bestätigter Stand oder ein bewiesener Zustand ist.

---

## Kernprobleme des aktuellen Zustands

Das aktuelle Board hat funktionalen Wert, aber noch mehrere systemische Schwächen:

### 1. Symbolik ohne ausreichend klare Führung
Hinweise und Warnsymbole sind nicht selbsterklärend genug.

### 2. Drawer ohne Arbeitslogik
Der aktuelle Dialog ist vor allem Datenerfassung, aber noch keine echte Workbench.

### 3. Fehlende Beziehungsführung
Es ist nicht klar genug sichtbar:

- welcher Flow betroffen ist,
- welche Masken dazugehören,
- welche Dateien betroffen sind,
- welche Folgeänderungen nötig werden.

### 4. Zu wenig operativer Kontext
Das Board sagt zu oft **dass** etwas offen ist, aber nicht **wie** ich es bearbeite.

### 5. Kein sauberer Eskalationspfad
Wenn ein Thema zu groß für den Drawer ist, fehlt eine klare Weiterleitung in spezialisierte Bearbeitungsmasken.

---

## Das gewünschte Zielbild

### A. Das Board selbst
Das Board soll ein echtes Führungsboard sein.

Es muss sichtbar machen:

- Priorität
- Reifegrad
- Beweisgrad
- Launch-Relevanz
- Blockerstatus
- Relationen
- nächste Aktionen

Die Oberfläche muss schnell erfassbar sein.

Nicht jede Information ist gleich wichtig.

### B. Der Knoten
Ein Node ist nicht nur ein Datensatz, sondern ein Arbeitsobjekt.

Ein Node braucht mindestens:

- fachliche Einordnung
- technische Einordnung
- Status
- Risiko
- Launch-Klasse
- Beweisgrad
- betroffene Dateien
- betroffene Prozesse
- betroffene Screens
- betroffene Knoten
- Folgeflächen
- nächste Aktion
- Zielmaske / Vertiefungsziel

### C. Der Drawer / die Workbench
Der Drawer soll von einer Rohpflege-Maske zu einer Workbench werden.

Nicht nur große Textfelder, sondern strukturierte Bearbeitung:

- klare Sektionen,
- klare Gewichtung,
- geführte Auswahl,
- erkennbare Relationen,
- direkte Aktionen,
- Übergänge in Spezialmasken.

### D. Spezialmasken
Wenn ein Thema zu komplex wird, muss MasterControl in die richtige Maske weiterleiten können.

Beispiele:

- Prozessdetailmaske
- Dateikontext-/Auswirkungsmaske
- Smoke-Check-Maske
- Beziehungs-/Mappingmaske
- Entscheidungslogik-Maske

Das Board muss also nicht alles selbst fassen — aber wissen, **wann** es übergeben muss.

---

## Arbeitsleitfragen für jede zukünftige Umsetzung

Jede künftige Änderung an MasterControl muss sich an diesen Leitfragen messen lassen:

1. Wird die Oberfläche dadurch geführter?
2. Wird klarer, was wirklich wichtig ist?
3. Wird klarer, welche Dateien / Prozesse / Screens betroffen sind?
4. Werden Folgeänderungen besser sichtbar?
5. Wird die Bedienung arbeitsfähiger?
6. Wird die Replizierbarkeit verbessert?
7. Wird eine spätere Spezialmaske sinnvoll vorbereitet?

Wenn eine Änderung diese Fragen nicht verbessert, ist sie für MasterControl wahrscheinlich nicht zielrelevant.

---

## Erfolgskriterien

MasterControl ist dann fachlich auf Zielkurs, wenn ein Nutzer an einem Knoten sofort erkennen kann:

- warum er relevant ist,
- wie kritisch er ist,
- was davon bewiesen ist,
- welche Dateien betroffen sind,
- welche Prozesse betroffen sind,
- welche Folgeflächen betroffen sind,
- was die nächste Aktion ist,
- und ob der Drawer ausreicht oder eine Spezialmaske geöffnet werden muss.

---

## Minimalziel für Phase 1

Phase 1 ist erreicht, wenn:

- das Board Priorität und Blocker klarer führt,
- die Symbolik verständlich ist,
- die Knoten sichtbar mit Prozessen/Dateien/Flows verbunden sind,
- der Drawer nicht mehr nur Rohpflege ist,
- und Codex daraus sauber ein umsetzbares UI-Paket ableiten kann.

---

## Langfristiges Ziel

Langfristig wird MasterControl zu einem echten operativen Betriebssystem für Projektsteuerung:

- Board als Überblick
- Workbench als Bearbeitung
- Spezialmasken als Tiefe
- JSON/DB/Masken als führende Wahrheiten
- KIs als Operatoren innerhalb klarer Regeln

Dann ist MasterControl nicht nur ein Board, sondern die steuernde Oberfläche des Systems.
