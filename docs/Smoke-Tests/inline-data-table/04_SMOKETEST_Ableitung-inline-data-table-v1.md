# 04_SMOKETEST_Ableitung-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: aktiv
Projekt: `Lauemi/VDANMemberPortal`
Bezug:
- `docs/Smoke-Tests/inline-data-table/01_AGENT_Repo-Analyse-inline-data-table-v1.md`
- `docs/Smoke-Tests/inline-data-table/03_SMOKETEST_Ergebnis-inline-data-table-v1.md`

---

## 1. KURZFAZIT

Der Smoke-Test bestätigt, dass in der geprüften Oberfläche die **richtige Komponente** aktiv ist: der **Inline-Data-Table v2** im Redesign-Modus.

Die Grundkomponente ist also nicht nur konzeptionell vorhanden, sondern real im UI sichtbar und nutzbar.

Der Hauptfehler liegt nicht im allgemeinen Table-Aufbau, sondern in der **Menü-/Overlay-Positionierung**.

Repo-wahrer und browserseitig bestätigter Kernbefund:

1. **Inline-Edit funktioniert grundsätzlich sauber**
2. **Das 3-Punkte-Menü ist funktional vorhanden, aber falsch positioniert**
3. **Das Rechtsklick-Menü greift nicht wie erwartet**
4. **Die Row-Action-Erreichbarkeit ist durch Layout/Positionierung beeinträchtigt**
5. **Dismiss-Verhalten des Editors ist unvollständig**

---

## 2. URSACHE

### A. Komponente selbst ist aktiv und grundsätzlich funktionsfähig

Das Testergebnis bestätigt:
- v2-Komponente ist real aktiv
- Redesign-Modus ist aktiv
- Inline-Edit arbeitet im Kern wie gewünscht

Damit ist die Ursache **nicht**:
- falsche Oberfläche
- komplett falscher Screen
- fehlender Einbau der v2-Komponente
- allgemeiner Totalausfall der Tabellenlogik

### B. Hauptursache liegt in der Popover-/Menüschicht

Der zentrale Fehler ist, dass das `rd-popover` im Test **nicht lokal am Trigger verankert** wurde, sondern mit `position: static` im normalen DOM-Fluss am Seitenende erschien.

Das spricht stark für einen Fehler in genau einer der folgenden Klassen:

1. **Popover-Element wird zwar erzeugt, aber nicht korrekt positioniert**
   - `positionPopover(...)` / `positionPopoverAtPoint(...)` greift nicht korrekt
   - Popover bekommt keine finale `fixed`/`absolute`-Position im sichtbaren Viewport

2. **Popover wird in einen falschen DOM-Kontext gerendert**
   - z. B. korrekt erzeugt, aber nicht aus einem Layout-/Flow-Kontext gelöst
   - dadurch normales Fließen am Seitenende statt Overlay-Verhalten

3. **Anchor-/Bounding-Logik bricht im realen Grid-/Scroll-Kontext**
   - Trigger existiert
   - Menüinhalt existiert
   - Verankerung am Button schlägt aber fehl

### C. Zweitursache liegt wahrscheinlich in der Row-Actions-Positionierung

Die Buttons sitzen laut Test extrem weit rechts (`left: 3268px`).

Das deutet auf einen Fehler in mindestens einer der folgenden Richtungen:

- falscher Bezugskontext der absoluten Positionierung
- Grid-/Width-/Overflow-Kombination im Row-Action-Container
- Berechnungsfehler zwischen Tabellenbreite, Scrollcontainer und Action-Layer

### D. Das Rechtsklick-Menü ist nicht verlässlich aktiv

Obwohl die Repo-Analyse eine Rechtsklick-Logik ausweist, wurde sie im Browser nicht wirksam bestätigt.

Das bedeutet praktisch:
- entweder greift der Handler im realen Screen nicht
- oder Redesign-/Popover-Verhalten ist an dieser Stelle ebenfalls gebrochen
- oder die konkrete sichtbare Instanz nutzt diesen Pfad nicht wie erwartet

### E. Editor-Dismiss ist nur teilweise fertig

Da ESC und Klick-außen den Editor nicht schließen, ist die Editor-Logik funktional brauchbar, aber im Interaktionsabschluss noch nicht sauber geschlossen.

Das ist **kein Primärblocker**, aber ein echter Qualitätsmangel.

---

## 3. FIX-RICHTUNG

### PRIORITÄT 1 – Kontextmenü korrekt verankern

Zuerst muss die Popover-/Menülogik repariert werden.

Zielzustand:
- Zeilen-`⋯` öffnet ein Menü direkt am Trigger
- Menü bleibt im Viewport sichtbar
- Menü ist nicht im normalen Dokumentfluss
- Menü verhält sich stabil bei Scrollen und Randlage

Prüffokus im Code:
- `public/js/redesign.js`
- `public/js/fcp-inline-data-table-v2.js`
- `public/css/redesign.css`

Zu prüfen/fixen:
- wie `rd-popover` erzeugt und in den DOM gehängt wird
- ob `positionPopover(...)` / `positionPopoverAtPoint(...)` wirklich greifen
- ob das Popover final `fixed` oder äquivalent overlay-fähig gesetzt wird
- ob ein falscher Reset / falsche CSS-Klasse / falscher Container die Overlay-Logik neutralisiert

### PRIORITÄT 2 – Row-Actions lokal an die Zeile binden

Die Hover-Action-Leiste muss im realen Layout stabil innerhalb des sichtbaren Zeilenkontexts liegen.

Zielzustand:
- `⋯`-Button ist ohne absurdes Seitenscrollen erreichbar
- Action-Layer bleibt visuell an der Zeile
- keine Überlagerung kritischer Edit-Controls

Prüffokus im Code:
- `.rd-row-actions` in `public/css/redesign.css`
- zugehörige Markup-/Renderlogik in `public/js/fcp-inline-data-table-v2.js`

### PRIORITÄT 3 – Rechtsklick-Menü real schließen oder bewusst ausnehmen

Der Repo-Pfad und das reale Browser-Ergebnis müssen zusammengeführt werden.

Zielzustand:
- entweder Rechtsklick-Menü funktioniert stabil
- oder der Rechtsklick-Pfad wird für diese Instanz bewusst deaktiviert / nicht erwartet

Das muss nach dem Fix klar entschieden und dokumentiert werden.

### PRIORITÄT 4 – Editor-Dismiss nachziehen

Nach dem Primärfix:
- ESC schließt Edit sauber
- Klick außerhalb schließt Edit definiert oder bleibt bewusst deaktiviert

Das ist UX-/Interaktionsqualität, aber nicht der erste Blocker.

---

## 4. WAS DAS NICHT IST

Wichtig zur Abgrenzung:

Dieser Befund bedeutet **nicht**:
- dass der Inline-Data-Table v2 grundsätzlich gescheitert ist
- dass die Mitgliederansicht die falsche Testoberfläche war
- dass Inline-Edit als Prinzip falsch ist
- dass der gesamte Redesign-Umbau verworfen werden muss

Im Gegenteil:

Der Test bestätigt ausdrücklich, dass:
- die richtige Komponente läuft
- Inline-Edit strukturell funktioniert
- der Fehler lokal auf Menü-/Overlay-/Positionierungsschicht konzentriert ist

Das ist ein **guter** Befund, weil die Reparatur dadurch fokussierbar bleibt.

---

## 5. ENTSCHEIDUNGSBEDARF MICHAEL

Aktuell kein großer Architekturentscheid nötig.

Allenfalls zwei kleine Produktentscheidungen, falls relevant:

1. **Soll Rechtsklick zwingend offizieller Teil der Bedienung sein?**
   - Ja → aktiv mitfixen und im Smoke-Test halten
   - Nein → Fokus auf `⋯`-Menü und Rechtsklick als optional markieren

2. **Soll Edit bewusst nur per Button / explizit geschlossen werden oder auch per ESC / Outside-Click?**
   - Für Produktqualität wäre ESC mindestens sinnvoll

Das sind aber nachgelagerte Entscheidungen. Der Hauptfehler ist technisch, nicht strategisch.

---

## 6. CODEX-TASK

### Titel
Fix popover anchoring and row action positioning for inline data table v2 in member registry

### Aufgabe
Prüfe und repariere im VDANMemberPortal die Menü-/Overlay-Logik des Inline-Data-Table v2 in der Mitglieder-Registry.

### Pflichtquellen
- `docs/Smoke-Tests/inline-data-table/01_AGENT_Repo-Analyse-inline-data-table-v1.md`
- `docs/Smoke-Tests/inline-data-table/03_SMOKETEST_Ergebnis-inline-data-table-v1.md`
- `public/js/fcp-inline-data-table-v2.js`
- `public/js/redesign.js`
- `public/css/redesign.css`
- `public/js/member-registry-admin.js`

### Ziel
Behebe die real im Smoke-Test bestätigten Fehler:

1. Zeilen-`⋯`-Menü muss lokal am Trigger öffnen
2. `rd-popover` darf nicht mit `position: static` im Seitenfluss landen
3. Row-Action-Leiste muss im sichtbaren Zeilenkontext liegen
4. Rechtsklick-Verhalten prüfen und entweder stabil herstellen oder bewusst sauber begrenzen
5. optional danach: ESC-/Outside-Dismiss des Editors nachziehen

### Arbeitsregeln
- repo-wahr arbeiten
- keine neue Tabellenarchitektur bauen
- keine Parallel-Komponente einführen
- keine allgemeine UI-Neuerfindung
- gezielt die vorhandene v2-/Redesign-Logik reparieren

### Erwartetes Ergebnis
Nach dem Fix muss ein erneuter Smoke-Test mindestens bestätigen:
- `⋯`-Menü öffnet korrekt am Trigger
- Menü bleibt im sichtbaren Bereich
- Row-Actions sind normal erreichbar
- Inline-Edit bleibt funktional intakt

---

## 7. NÄCHSTER OPERATIVER SCHRITT

1. Codex / Umsetzungsagent auf den Fix der Menü-/Overlay-Schicht ansetzen
2. danach denselben Smoke-Test-Bereich erneut laufen lassen
3. Ergebnisdatei `03_SMOKETEST_Ergebnis-inline-data-table-v1.md` aktualisieren
4. diese Ableitung nur dann erweitern, wenn neue Befunde über den aktuellen Primärfehler hinaus auftauchen
