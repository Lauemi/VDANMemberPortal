# Project One — IST-Analyse Masterboard / MasterControl

## Zweck dieser Datei

Diese Datei zerlegt den **aktuellen Ist-Zustand** des bestehenden Masterboards / MasterControl.

Sie dient nicht der Beschreibung des Wunschbilds, sondern der ehrlichen Bestandsaufnahme.

Ziel ist:

- die aktuelle Oberfläche fachlich und UI-seitig sauber zu bewerten,
- Stärken und Schwächen klar zu benennen,
- Symptome von Ursachen zu trennen,
- festzuhalten, was übernommen werden darf,
- festzuhalten, was grundsätzlich neu gedacht werden muss.

Diese Datei ist die Grundlage dafür, dass Codex oder eine andere KI nicht „irgendwas verbessert“, sondern gezielt umbaut.

---

## Ausgangslage

Der aktuelle Zustand liefert **Informationen**, aber keine ausreichende **Führung**.

Das Problem ist nicht, dass das Board leer oder funktionslos wäre.

Das Problem ist, dass es in seiner aktuellen Form nicht als **operative Steuerungsoberfläche** funktioniert.

Es gibt bereits:

- Board-Daten
- Statusfelder
- Hinweise / Warnmarker
- Drawer / Detaildialog
- JSON-Artefakte
- Prozessbezug
- erste Strukturierung

Aber:

- die Oberfläche erklärt sich nicht,
- die Symbolik ist nicht verständlich,
- Relevanz wird nicht geführt,
- Relationen sind nicht sichtbar,
- Auswirkungen von Änderungen sind nicht greifbar,
- der Drawer ist informativ, aber kaum arbeitsfähig,
- das System ist nicht als Betriebssystem nutzbar.

---

## Ehrlicher Kernbefund

## Das aktuelle Board ist eine Statusanzeige mit Editiermöglichkeit — aber noch kein MasterControl.

Das ist der zentrale Befund.

Es ist nicht wertlos.

Es ist aber in seiner aktuellen Form noch kein Werkzeug, mit dem ein Operator sicher arbeiten, priorisieren, navigieren und steuern kann.

---

## Positiv — Was am aktuellen Stand bereits tragfähig ist

## 1. Es existiert bereits eine fachliche Struktur

Das Board ist nicht chaotisch im Sinne von völlig ungeordnet.

Es gibt bereits:

- Lanes / Ebenen
- Node-Status
- Risiko
- Launch-Klasse
- last_verified_at
- Fortschritt sichtbar
- Fortschritt unsichtbar
- Gaps
- Entscheidungen offen
- Referenzen

### Bewertung

Das ist eine starke Basis.

Denn die inhaltliche Sprache des Systems ist schon da.

Das Problem liegt weniger in der Existenz der Felder, sondern in ihrer **operativen Nutzbarkeit**.

---

## 2. Es existiert bereits eine Trennung zwischen Strategie und operativer Kontrolle

Mit

- `fcp_masterboard_state.json`
- `fcp_process_control_state.json`

ist schon eine wichtige Zweiteilung angelegt:

- strategische Board-Ebene
- operative Kontroll-/Smoke-/Bug-Ebene

### Bewertung

Das ist richtig gedacht.

Es fehlt nicht die Strukturidee.

Es fehlt die **erlebbare Verknüpfung** dieser Ebenen in der Oberfläche.

---

## 3. Es existiert bereits ein Fortschrittsgedanke

Die Unterscheidung zwischen:

- sichtbarer Fortschritt
- unsichtbarer Fortschritt
- Gaps
- offenen Entscheidungen

ist inhaltlich stark.

### Bewertung

Diese Denkweise ist Gold wert und darf nicht verloren gehen.

Sie muss aber UI-seitig so umgesetzt werden, dass man daraus auch schnell etwas entnehmen kann.

---

## 4. Es existiert bereits ein Änderungs- und Closing-Bewusstsein

Im System ist bereits angelegt, dass Dinge nicht einfach „fertig“ sind, sondern verifiziert, bewertet und rückgebunden werden müssen.

### Bewertung

Auch das ist eine Stärke.

Aber aktuell wird diese Haltung noch nicht ausreichend von der UI getragen.

---

## Negativ — Was aktuell fundamental nicht funktioniert

## 1. Keine verständliche visuelle Führung

Die Oberfläche nutzt Warnmarker, Symbole oder Statushinweise, die nicht selbsterklärend genug sind.

Es fehlt eine **klare Legende**.

### Wirkung

Der Nutzer sieht Markierungen, versteht aber nicht sicher:

- was sie bedeuten,
- wie kritisch sie sind,
- ob sie handlungsrelevant sind,
- ob sie nur Hinweis oder echter Blocker sind.

### Ergebnis

Das Board erzeugt Unsicherheit statt Führung.

### Schwere

**kritisch**

Denn ein Masterboard ohne eindeutige Symbolik verliert sofort seine Führungsfunktion.

---

## 2. Alles wirkt gleich wichtig

Das aktuelle Board transportiert nicht klar genug:

- was zuerst relevant ist,
- was blockiert,
- was nur dokumentiert ist,
- was operativ offen ist,
- was nur später relevant wird.

### Wirkung

Der Nutzer muss selbst interpretieren.

Dadurch entsteht mentale Last.

### Ergebnis

Das Board ist eher eine Informationsfläche als eine Priorisierungsmaschine.

### Schwere

**kritisch**

---

## 3. Der Drawer ist informationsreich, aber operativ fast unbrauchbar

Der aktuelle Drawer zeigt viele Felder, aber die Darstellung erzeugt keinen klaren Arbeitsfluss.

### Beobachtbare Probleme

- Felder stehen nebeneinander, ohne echte Priorisierung
- der Blick wird nicht geführt
- es ist nicht klar, was Kerninformation und was Kontext ist
- es ist nicht klar, was ich als Nächstes tun soll
- der Drawer ist textlastig, aber nicht handlungsstark

### Wirkung

Man kann Informationen lesen, aber schlecht mit ihnen arbeiten.

### Ergebnis

Der Drawer ist eher Datenlager als Arbeitsoberfläche.

### Schwere

**kritisch**

---

## 4. Keine sichtbaren Relationen

Das Board zeigt Knoten, aber nicht ausreichend deren Verbindungen.

Es ist nicht klar genug sichtbar:

- welcher Prozess hinter einem Node steckt,
- welche Screens dazugehören,
- welche Smoke Checks anhängen,
- welche Bugs zugeordnet sind,
- welche Dateien betroffen sind,
- welche Folgeflächen entstehen.

### Wirkung

Der Nutzer sieht isolierte Themen statt ein Wirknetz.

### Ergebnis

Das Board verliert Systemtiefe.

### Schwere

**kritisch**

---

## 5. Keine echte Pfadführung bei Problemen

Ein gutes MasterControl müsste bei einem Problem nicht nur sagen:

> Hier ist ein Gap.

Sondern auch:

> Das betrifft diese Prozesse, diese Dateien, diese Folgeflächen, diese Kontrollpunkte.

Das aktuelle Board tut das noch nicht ausreichend.

### Wirkung

Der Nutzer muss sich den Bearbeitungspfad selbst zusammensuchen.

### Ergebnis

Das System ist nicht führend genug.

### Schwere

**hoch**

---

## 6. Keine ausreichende Dateiwahrheit in der Oberfläche

Referenzen sind zwar teilweise eingetragen, aber nicht so eingebunden, dass daraus ein echter Navigationsvorteil entsteht.

### Wirkung

Man weiß nicht sofort:

- welche Datei Primärdatei ist,
- welche Datei Folgeänderung braucht,
- welche Datei nur Doku ist,
- welche Datei UI / Logik / Wahrheit ist.

### Ergebnis

Code-Navigation bleibt außerhalb des Systems.

### Schwere

**hoch**

---

## 7. Kein sauberer Übergang von Überblick zu Tiefe

Das Board selbst ist zu grob.

Der Drawer ist zu roh.

Aber dazwischen fehlt die sauber gedachte mittlere Ebene.

### Es fehlt oft ein Übergang wie:

- Überblick
- fokussierter Knoten-Workspace
- Spezialmaske / Detailarbeitsraum

### Wirkung

Alles landet im Drawer, obwohl nicht alles in einen Drawer gehört.

### Ergebnis

Das System wirkt überladen und gleichzeitig unterstrukturiert.

### Schwere

**hoch**

---

## 8. Das Board ist noch nicht als Betriebssystem modelliert

Der Nutzer will damit nicht nur lesen.

Er will damit:

- steuern,
- priorisieren,
- prüfen,
- navigieren,
- ändern,
- Relationen sehen,
- Maßnahmen ableiten.

Das aktuelle Board bildet diese Rolle noch nicht vollständig ab.

### Ergebnis

Die Oberfläche bleibt unter ihrem Anspruch.

### Schwere

**kritisch**

---

## Die wichtigsten Symptom-Ursache-Paare

## Symptom 1

> „Ich kann ihm nichts entnehmen.“

### Ursache

Nicht zu wenig Daten, sondern zu wenig visuelle Verdichtung und zu wenig Priorisierungslogik.

---

## Symptom 2

> „Alles wirkt gleich wichtig.“

### Ursache

Fehlende Hierarchie aus Relevanz, Blockierung, Risiko, Nächster Aktion.

---

## Symptom 3

> „Ich weiß nicht, welcher Flow dahinter steckt.“

### Ursache

Fehlende Relationsebene zwischen Board-Knoten und Prozess-/Datei-/Flow-Wahrheit.

---

## Symptom 4

> „Der Dialog ist fast völlig unbrauchbar.“

### Ursache

Der Drawer ist als Feldcontainer gedacht, nicht als geführter Arbeitsraum.

---

## Symptom 5

> „Das liefert Infos, aber nicht geführt.“

### Ursache

Masterboard wurde bisher eher als Anzeige + Editor gedacht, nicht als operatives System.

---

## Was beibehalten werden sollte

Die aktuelle Lösung ist nicht zu verwerfen.

Beibehalten werden sollten insbesondere:

## 1. Die fachlichen Felder

Die vorhandene inhaltliche Sprache ist stark.

Behalten:

- Status
- Risiko
- Launch-Klasse
- Fortschritt sichtbar
- Fortschritt unsichtbar
- Gaps
- Entscheidungen offen
- Referenzen
- last_verified_at

---

## 2. Die Zweiteilung Masterboard / Process-Control

Diese Trennung ist richtig.

Sie muss nicht entfernt, sondern besser gekoppelt werden.

---

## 3. Die Idee der Kontrolllogik

Smoke Checks, Bugs, Review Notes und Prozessstatus sind wertvoll.

Sie müssen sichtbarer und führender mit der Oberfläche verbunden werden.

---

## 4. Die Änderungsdisziplin

Das bestehende Denken in Review, Verification und Closing ist richtig.

Es braucht eine stärkere operative Oberfläche dafür.

---

## Was grundsätzlich neu gedacht werden muss

## 1. Das Board muss von Anzeige zu Steuerung werden

### Heute
Board mit Informationen

### Ziel
Board als Priorisierungs- und Navigationssystem

---

## 2. Der Drawer muss von Datencontainer zu Arbeitsraum werden

### Heute
Felder lesen und ändern

### Ziel
Geführte, priorisierte, verständliche Bearbeitung

---

## 3. Relationen müssen sichtbar und bedienbar werden

### Heute
implizit oder in Text versteckt

### Ziel
sichtbar, anklickbar, nachvollziehbar

---

## 4. Nicht alles darf im Drawer bleiben

### Heute
zu viel Tiefe landet in einem einzigen UI-Container

### Ziel
klare Übergänge zu Spezialflächen / Masken / Kontrollansichten

---

## 5. Symbolik und Legende müssen systemisch werden

### Heute
Warnungen wirken nicht klar genug erklärbar

### Ziel
jede Markierung ist eindeutig lesbar und handlungslogisch verankert

---

## Erste Umbauprinzipien, die sich aus der Ist-Analyse ableiten

## Prinzip 1

Keine UI-Änderung ohne Führungsgewinn.

## Prinzip 2

Kein Node ohne sichtbare Relationen.

## Prinzip 3

Kein Warnsymbol ohne Legende und Bedeutung.

## Prinzip 4

Kein Drawer ohne klare Arbeitslogik.

## Prinzip 5

Kein Masterboard ohne erkennbaren Übergang in tiefere Arbeitsräume.

## Prinzip 6

Keine Änderung ohne Rückbindung an Masterboard + Process-Control.

---

## Ergebnis dieser Datei in einem Satz

Das bestehende Masterboard hat bereits eine starke fachliche Basis, scheitert aktuell aber vor allem an fehlender visueller Führung, fehlender Relationstransparenz und einem Drawer, der noch kein echter operativer Arbeitsraum ist.
