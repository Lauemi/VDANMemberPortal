# Project One — Soll-Architektur MasterControl

## Zweck dieser Datei

Diese Datei definiert die **Soll-Architektur** des MasterControl-Systems.

Sie ist die direkte Fortsetzung aus:

- `01_ZIELBILD_MASTERCONTROL.md`
- `02_SYSTEMKONTEXT_UND_DATEILANDKARTE.md`
- `04_IST_ANALYSE_MASTERBOARD.md`

Diese Datei beschreibt nicht nur, **wie das Board aussehen soll**, sondern vor allem:

- wie es geführt werden muss,
- welche UI-Ebenen es geben muss,
- welche Relationen sichtbar sein müssen,
- wann eine Information im Board bleibt,
- wann in einen Workspace verzweigt werden muss,
- wie operatives Arbeiten tatsächlich möglich wird.

Diese Datei ist die Architekturgrundlage für Codex / Claude / GPT, damit Umbauten nicht ästhetisch, sondern systemisch korrekt erfolgen.

---

## Grundsatz

## MasterControl ist kein Dashboard.

MasterControl ist ein **operatives Steuerungssystem**.

Es dient nicht primär dazu, hübsch Informationen anzuzeigen, sondern dazu, dem Operator zu ermöglichen:

- Prioritäten zu erkennen,
- Blocker zu verstehen,
- Relationen zu sehen,
- gezielt in Arbeitsebenen zu wechseln,
- Änderungen kontrolliert vorzunehmen,
- Auswirkungen einschätzen zu können,
- Status sauber nachzuführen.

---

## Architektursatz

## MasterControl besteht aus vier UI-Ebenen

### Ebene A — Überblick / Steuerungsboard
Die verdichtete Sicht auf das Gesamtsystem.

### Ebene B — Knotenfokus / Node Workspace
Die fokussierte Arbeitsansicht für genau einen Knoten.

### Ebene C — Relationsebene / Kontextnetz
Die Sicht auf Prozesse, Dateien, Bugs, Smoke Checks, Folgeflächen und Abhängigkeiten.

### Ebene D — Spezialmaske / Facharbeitsraum
Eine tiefe Arbeitsoberfläche für Teilprobleme, die der Node-Workspace nicht sinnvoll fassen kann.

---

## Warum diese vier Ebenen notwendig sind

Das aktuelle System leidet vor allem daran, dass zu viel in zwei Ebenen gepresst wird:

- Board
- Drawer

Das reicht nicht.

Denn:

- der Überblick darf nicht zu schwer werden,
- Detailarbeit darf nicht im Überblick explodieren,
- Relationen brauchen eine eigene Lesbarkeit,
- komplexe Bearbeitung darf nicht in einem Drawer ersticken.

Darum muss die Soll-Architektur explizit mit vier UI-Ebenen arbeiten.

---

# Ebene A — Überblick / Steuerungsboard

## Ziel der Ebene A

Die Board-Ebene beantwortet in Sekunden:

- Wo brennt es?
- Was blockiert Launch / Betrieb?
- Was ist nur Hinweis?
- Was ist in Bewegung?
- Was ist stabil?
- Wo muss ich als Nächstes rein?

## Ebene A darf NICHT leisten wollen

Sie darf nicht die komplette Detailarbeit enthalten.

Das Board ist keine Textsammlung und kein Vollformular.

---

## Kernelemente der Ebene A

## 1. Legende ist Pflicht

Jede Symbolik muss sofort erklärbar sein.

Mindestens:

- Status-Symbolik
- Risiko-Symbolik
- Verifikationshinweise
- Blocker / Warnung / Hinweis
- Relation vorhanden / fehlt
- externe Folgefläche / interner Folgepfad

### Regel

Kein Symbol ohne sichtbare Legende.

---

## 2. Relevanz-Hierarchie ist Pflicht

Das Board muss klar priorisieren.

Ein Node muss mindestens visuell erkennbar machen:

- operative Relevanz
- Launch-Relevanz
- Blockierungsgrad
- Aktualität
- Handlungsbedarf

### Konsequenz

Nicht jeder Node darf gleich aussehen.

---

## 3. Node-Karten müssen verdichtet sein

Ein Node zeigt im Überblick nur die Informationen, die für Steuerung nötig sind.

### Minimaler Node-Inhalt

- Titel
- Ebene / Lane
- Status
- Risiko
- Launch-Klasse
- letzte Verifikation
- 1 zentrale Aussage zum Zustand
- Anzahl / Zustand von offenen Gaps / Bugs / Smoke Checks
- klarer Einstieg in Workspace

### Nicht direkt im Node anzeigen

- lange Fließtexte
- vollständige Referenzlisten
- komplette Entscheidungsprotokolle
- rohe Feldmassen

---

## 4. Nächste Aktion muss erkennbar sein

Jeder Node braucht eine maschinenlesbare und nutzerlesbare Aussage:

- Was ist der nächste sinnvolle Schritt?

Beispiele:

- `Smoke-Test ausführen`
- `Stripe live prüfen`
- `Process-Control angleichen`
- `Relationen ergänzen`
- `Spezialmaske öffnen`

### Regel

Kein relevanter Node ohne nächsten operativen Schritt.

---

## 5. Einstiegspfade müssen eindeutig sein

Von jedem Node aus muss klar möglich sein:

- Node Workspace öffnen
- Relationsebene öffnen
- Spezialmaske öffnen (falls vorhanden)
- betroffene Dateien / Referenzen sehen

---

# Ebene B — Node Workspace

## Ziel der Ebene B

Der Node Workspace ersetzt den heutigen rein formularartigen Drawer als primären Arbeitsraum.

Er beantwortet:

- Worum geht es hier wirklich?
- Was ist der Kernzustand?
- Was blockiert?
- Welche Relationen gibt es?
- Was muss jetzt konkret bearbeitet werden?
- Welche Änderungen haben Folgen?

## Grundsatz

Der Node Workspace ist **kein Feldfriedhof**.

Er ist ein geführter Arbeitsraum.

---

## Struktur des Node Workspace

Ein Node Workspace soll in klaren Abschnitten aufgebaut sein.

## Abschnitt 1 — Kurzlage

Verdichtete Knotenlage:

- Titel
- Board-Zuordnung
- Status
- Risiko
- Launch-Klasse
- letzte Verifikation
- operative Bewertung
- nächster Schritt

## Abschnitt 2 — Was ist sichtbar erreicht?

Kurze, schnell lesbare Punkte.

## Abschnitt 3 — Was ist unsichtbar erreicht?

Technische / strukturelle Fortschritte, die man UI-seitig nicht sofort sieht.

## Abschnitt 4 — Was blockiert?

Gaps, Bugs, fehlende Verifikation, offene Folgeflächen.

## Abschnitt 5 — Was hängt daran?

Relationen zu:

- Prozessen
- Smoke Checks
- Bugs
- Dateien
- Spezialmasken
- abhängigen Knoten

## Abschnitt 6 — Entscheidungen

- offene Entscheidungen
- getroffene Richtungsänderungen
- Begründungen

## Abschnitt 7 — Änderungen / Pflege

- Bearbeiten
- Status umstellen
- Folgeänderungen prüfen
- Writeback anstoßen

---

## Was der Node Workspace zusätzlich können muss

## 1. Folgen einer Änderung sichtbar machen

Wenn ein Feld geändert wird, muss sichtbar sein:

- welche JSON betroffen sein können,
- welche Prozesse mitgezogen werden müssen,
- welche Folgeflächen wahrscheinlich betroffen sind.

### Beispiel

Wenn `Status` geändert wird, dann Hinweis:

- `Masterboard-State betroffen`
- `Process-Control prüfen`
- `Smoke-Check-Bezug prüfen`
- `Review Note aktualisieren`

---

## 2. Relationsblöcke müssen klickbar sein

Nicht nur lesbar, sondern navigierbar.

---

## 3. Feldtypen müssen arbeitsfähig sein

Wenn etwas Read/Write oder aktiv/passiv ist, muss das UI diese Entscheidung schnell fassbar machen.

Nicht als reiner Text, sondern als kontrollierte Bedienung.

---

# Ebene C — Relationsebene / Kontextnetz

## Ziel der Ebene C

Die Relationsebene beantwortet:

- Welche Prozesse hängen an diesem Knoten?
- Welche Smoke Checks sind relevant?
- Welche Bugs sind offen?
- Welche Dateien sind Primärdateien?
- Welche Folgeänderungen sind zu erwarten?
- Welche anderen Knoten beeinflusst das?

Das ist die Ebene, die heute fast komplett fehlt.

---

## Darstellung der Relationsebene

Die Darstellung kann als strukturierte Liste oder als Netz-/Clusteransicht beginnen.

Wichtig ist nicht zuerst die Optik, sondern die Lesbarkeit.

## Relationstypen

Mindestens:

- **Prozessrelation**
- **Dateirelation**
- **UI-Relation**
- **DB-/RPC-Relation**
- **Bug-Relation**
- **Smoke-Check-Relation**
- **Board-Node-Relation**

---

## Beispielhafte Relationseinträge

### Prozess
- `p-onboarding`
- `sc-on-4`
- `b-on-3`

### Dateien
- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`
- `public/js/masterboard.js`
- `src/pages/app/masterboard/index.astro`

### Folgeflächen
- Node Workspace
- Spezialmaske CSV
- Billing Detailmaske

---

## Regeln für die Relationsebene

## 1. Primärdatei vs Folge-Datei unterscheiden

Nicht jede Datei ist gleich wichtig.

Die UI muss sichtbar machen:

- Primärwahrheit
- Folge-Datei
- Doku-Datei
- UI-Datei
- DB-/Logik-Datei

## 2. Auswirkungen klassifizieren

Änderungen müssen markiert werden als:

- lokal
- systemisch
- datenwirksam
- UI-wirksam
- writeback-pflichtig

## 3. Keine Relation ohne Typ

Jede Verbindung braucht eine Bedeutung.

---

# Ebene D — Spezialmaske / Facharbeitsraum

## Ziel der Ebene D

Nicht jede Aufgabe darf im Node Workspace gelöst werden.

Wenn ein Thema operativ zu tief wird, muss in eine eigene Fachmaske verzweigt werden.

Beispiele:

- Billing Live-Prüfung
- CSV Import-Arbeitsraum
- Process-Control Editor
- Relation Inspector
- Node-History / Change-Log
- Feldschema / Read-Write-Editor

---

## Regel für Spezialmasken

Eine Spezialmaske ist nötig, wenn mindestens einer dieser Punkte erfüllt ist:

- zu viele Zustände / Kontrollen in einem Thema
- mehrere abhängige Änderungen nötig
- Inline-Bearbeitung wird unübersichtlich
- Detailarbeit braucht Fachsicht
- Prüfen und Bearbeiten müssen kombiniert werden

---

## Was eine Spezialmaske enthalten kann

- geführte Prüfpfade
- Datei-/Flow-Zuordnung
- konkrete Statusumschaltung
- Referenzinspektor
- Smoke-Test-Ausführung / Dokumentation
- Änderungsbegründung / Direction-Log

---

# Bedienprinzipien des gesamten MasterControl

## Prinzip 1 — Führung vor Vollständigkeit

Nicht alles sofort zeigen.

Zuerst führen, dann vertiefen.

## Prinzip 2 — Bedeutung vor Dekoration

Jedes visuelle Element braucht eine fachliche Funktion.

## Prinzip 3 — Relationen sind Pflicht

Ein Node ohne Kontext ist nur eine Karteikarte.

## Prinzip 4 — Änderungen brauchen Folgenbewusstsein

Keine Änderung ohne sichtbaren Hinweis auf Folgeflächen.

## Prinzip 5 — Drawers nur für Leichtarbeit

Sobald echte operative Tiefe entsteht, muss in Workspace oder Spezialmaske verzweigt werden.

## Prinzip 6 — Writeback gehört zur Bedienung

Der Nutzer muss sehen, dass eine Änderung erst dann sauber ist, wenn Board / Process / Review-Status mitgezogen wurden.

---

# Konkrete Soll-Elemente, die das System künftig enthalten muss

## 1. Legendenbereich im Board

Pflichtbestandteil.

## 2. Node Quick Summary

Jeder Knoten braucht eine 1-Zeilen-Wahrheit.

## 3. Nächster Schritt / CTA

Jeder relevante Knoten braucht eine klare nächste Aktion.

## 4. Relationseinstieg

Jeder Knoten braucht einen Zugang zu seinen Abhängigkeiten.

## 5. Workspace statt bloßem Drawer

Detailarbeit darf nicht im alten Drawer-Modell hängen bleiben.

## 6. Facharbeitsräume für tiefe Themen

MasterControl darf in Spezialmasken verzweigen.

## 7. Dateirollen-Anzeige

Primärdatei / Folge-Datei / UI-Datei / DB-Datei / Doku-Datei sichtbar machen.

## 8. Änderungsfolgen-Hinweis

Vor dem Speichern muss klar sein, was mitgezogen werden muss.

---

# Architekturentscheidung für die Umsetzung

## Umsetzung erfolgt nicht als blindes Redesign.

Sondern in dieser Reihenfolge:

1. vorhandene Board-Wahrheit respektieren
2. vorhandene Process-Control-Wahrheit respektieren
3. vorhandene UI-Dateien analysieren
4. UI-Ebenen neu schneiden
5. Relationsebene ergänzen
6. Drawer zu Workspace transformieren
7. Spezialmasken nur dort bauen, wo wirklich nötig

---

# Ergebnis dieser Datei in einem Satz

MasterControl muss als vierstufiges Steuerungssystem aus Überblick, Node Workspace, Relationsebene und Spezialmasken gebaut werden, damit aus der heutigen Statusanzeige eine wirklich geführte operative Bedienoberfläche wird.
