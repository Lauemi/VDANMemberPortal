# Smoke-Test Prozessbeschreibung

Version: v2
Stand: 2026-04-22
Geltungsbereich: `Lauemi/VDANMemberPortal`
Status: aktiv

## Zweck

Diese Prozessbeschreibung definiert den replizierbaren Standard für Smoke-Tests im VDANMemberPortal.

Ziel ist:
- konsistente Vorbereitung,
- token-sparende Zusammenarbeit,
- klare Ablage,
- Nachverfolgbarkeit,
- eindeutige Trennung zwischen Testanweisung, Testergebnis und Ableitung,
- klare Rollen- und Schreibpflicht,
- lernfähige Weiterentwicklung des Prozesses selbst.

REPO IST WAHRHEIT.

Wenn Repo-Zugriff fehlt, muss dieser ausdrücklich angefordert werden.
Wenn zusätzliche Informationen aus der DB oder Laufzeitlogik benötigt werden, muss das ausdrücklich sichtbar angefordert werden.
Für DB-nahe Klärungen ist Claude zuständig.

---

## Grundprinzip

Jeder Smoke-Test folgt immer dieser Reihenfolge:

1. **Repo-Agent / Voranalyse**
   - zuerst wird repo-wahr geprüft, was laut Code und Konfiguration überhaupt getestet werden muss
   - keine Arbeit aus Chat-Erinnerung
   - keine Arbeit aus Vermutung
   - keine Arbeit nur aus Screenshots

2. **Smoketest-Anweisung erstellen oder verwenden**
   - je Testbereich gibt es eine konkrete Anweisungsdatei
   - sie beschreibt exakt:
     - was getestet wird
     - warum es getestet wird
     - welche Dateien / Pfade im Repo dafür relevant sind
     - welche Erwartungen laut Repo bestehen

3. **Claude führt den Browser-Smoke-Test durch**
   - auf Basis der repo-wahren Anweisung
   - mit Screenshots, klaren Beobachtungen und einem strukturierten Ergebnis

4. **Smoketest-Ergebnis wird im Repo abgelegt**
   - exakt in der vorgesehenen Ergebnisdatei des Testbereichs
   - Ergebnis wird nicht nur im Chat belassen

5. **Ableitung wird erstellt**
   - auf Basis des abgelegten Ergebnisses
   - trennt:
     - Entscheidungsbedarf von Michael
     - reine Umsetzungsbugs
     - Masterboard-/Closing-Relevanz

6. **Fixauftrag wird erstellt**
   - wenn das Ergebnis offene Umsetzungsfehler zeigt
   - auf Basis der abgelegten Ableitung
   - mit klaren Pflichtquellen, Zielzustand und Umsetzungsgrenzen

7. **Umsetzung wird dokumentiert**
   - nach Codex-/Umsetzungsarbeit
   - mit Commitbezug und kurzer Beschreibung, was real behoben werden sollte

8. **Nachtest wird erstellt und durchgeführt**
   - wenn eine Umsetzung stattgefunden hat
   - nicht als Überschreibung, sondern als neue Stufe in der Kette

---

## Ordnerstruktur

Jeder Smoke-Test-Bereich liegt unter:

`docs/Smoke-Tests/<bereich>/`

Beispiel:

`docs/Smoke-Tests/inline-data-table/`

Darin liegen je nach Fortschritt nicht nur drei Dateien, sondern eine nachvollziehbare Kette.

Zusätzlich ist ein Archiv-Unterordner zulässig und empfohlen:

`docs/Smoke-Tests/<bereich>/archive/`

Dort werden ältere Ergebnisstände abgelegt, wenn der aktive Stand fortgeschrieben wird, ohne den historischen Fehlerzustand zu verlieren.

---

## Standardrollen

### Rolle 1 – Repo-Agent
Aufgabe:
- aktuelles Repo prüfen
- relevante Dateien / Konfiguration / Pfade identifizieren
- klar benennen, was laut Repo getestet werden muss
- das Ergebnis nicht nur im Chat, sondern als Datei im Repo ablegen oder schreibfertig liefern

### Rolle 2 – Claude als Browser-Tester
Aufgabe:
- die repo-wahre Testanweisung ausführen
- Browser-Test dokumentieren
- Screenshots, Beobachtungen, Fehlerbilder, Abweichungen und Blocker liefern
- Ergebnisdatei befüllen oder schreibfertig liefern

### Rolle 3 – ChatGPT / Ableitung
Aufgabe:
- das abgelegte Testergebnis lesen
- daraus klare Ableitungen schreiben
- unterscheiden:
  - Entscheidungen,
  - Bugs,
  - Prozess-/Masken-/Closing-Relevanz
- bei Bedarf Fixauftrag als nächste Datei erzeugen

### Rolle 4 – Codex / Umsetzungsagent
Aufgabe:
- offene Produktfehler repo-wahr beheben
- keine unnötige Neuarchitektur bauen
- Umsetzung dokumentieren

### Rolle 5 – Re-Test / Nachtest
Aufgabe:
- den neuen Fixstand gezielt gegen die vorher offene Fehlerliste prüfen
- nicht blind grün bestätigen
- bestätigen, was real behoben ist und was offen bleibt

---

## Pflichtregeln

### 1. Repo zuerst
Wenn kein Zugriff auf das Repo möglich ist, darf kein Smoke-Test „aus Gefühl“ vorbereitet werden.
Dann muss explizit angefordert werden:
- Repo-Zugriff
- oder die relevanten Dateien

### 2. DB / Laufzeitlogik sichtbar anfordern
Wenn für einen Smoke-Test Informationen fehlen, die in der DB oder in externen Systemen liegen, muss das ausdrücklich sichtbar angefordert werden.
Das gilt besonders bei:
- Write-Pfaden
- RPC-/Edge-Funktionen
- DB-gebundener Prozesslogik

### 3. Ergebnisse immer ablegen
Ein Smoke-Test gilt erst dann als sauber dokumentiert, wenn:
- die Anweisung im Repo liegt
- das Ergebnis im Repo liegt
- die Ableitung im Repo liegt

### 4. Versionspflicht
Jede Smoke-Test-Datei braucht:
- Version
- Stand
- Status

### 5. Replizierbarkeit
Ein Prompt oder Agent muss immer wissen können:
- wo die Smoke-Tests liegen
- wie der Prozess abläuft
- welche Rolle gerade aktiv ist
- welche Artefakte je Bereich erwartet werden
- dass zuerst repo-wahr vorbereitet wird

### 6. Schreibpflicht je Rolle
Jede Rolle muss ihren Output in der vorgesehenen Smoke-Test-Struktur ablegen oder exakt schreibfertig liefern.

Das gilt für:
- Repo-Analyse
- Testanweisung
- Ergebnis
- Ableitung
- Fixauftrag
- Umsetzungsdokumentation
- Nachtest
- Nachtestergebnis

Nur Chat-Ausgabe reicht nicht.

### 7. Referenzpflicht
Jede neue Datei in der Smoke-Test-Kette muss auf ihre relevanten Vorgänger verweisen.

Mindestens:
- Bezug auf die direkt vorherige relevante Datei
- Bezug auf Analyse / Ergebnis / Ableitung, falls daraus gearbeitet wird

So bleibt jederzeit nachvollziehbar:
- warum die Datei existiert
- worauf sie reagiert
- wo der Vorgängerzustand liegt

### 8. Nicht überschreiben, sondern weiterzählen
Neue Erkenntnisstufen werden grundsätzlich **nicht** durch stilles Überschreiben historischer Stände dokumentiert.

Standard:
- neue Stufe = neue Nummer in der Smoke-Test-Kette
- historischer Zustand bleibt nachvollziehbar
- bei Bedarf wird ein älterer Ergebnisstand zusätzlich archiviert

### 9. Archivierung alter Ergebnisstände
Wenn ein aktiver Ergebnisstand durch einen neuen Zustand ersetzt oder fortgeführt wird, soll der vorherige relevante Fehlerzustand in den Archivpfad verschoben oder dort zusätzlich abgelegt werden.

Ziel:
- Fehlerzustände nicht verlieren
- Lernweg nachvollziehbar halten
- später vergleichen können, was wirklich behoben wurde

### 10. Nachtest ist eigener Kettenschritt
Wenn eine Umsetzung stattgefunden hat, folgt nicht einfach eine Überschreibung des alten Ergebnisses, sondern:
- neue Nachtest-Anweisung
- neues Nachtest-Ergebnis
- neue Ableitung, falls nötig

Nachtests sind eigenständige Artefakte.

### 11. Token-/Abbruchregel
Wenn ein Smoke-Test, Nachtest oder Agentenlauf wegen Tokenmangel, Laufzeit oder anderer technischer Begrenzung unvollständig bleibt, gilt:
- kein grünes Ergebnis ableiten
- Status als unvollständig / offen markieren
- neuer fokussierter Nachtest oder Teil-Smoke-Test anlegen

Unvollständige Tests schließen keine Kette.

---

## Nummernlogik / Standardkette

Die konkrete Nummerierung kann je Bereich wachsen. Der Standardfluss ist jedoch:

1. Repo-Analyse
2. Testanweisung oder Testvorbereitung
3. Ergebnis
4. Ableitung
5. Umsetzung
6. Nachtest
7. Nachtestergebnis
8. neue Ableitung
9. Fixauftrag
10. weitere Umsetzung
11. weiterer Nachtest

Wichtig:
- Die exakten Dateinamen dürfen Bereichslogik enthalten
- Die Kette muss aber fortlaufend, nachvollziehbar und referenziert bleiben
- Neue Erkenntnisstufen werden angehängt, nicht verloren

---

## Prozesslernen / Systemlernen

Der Smoke-Test-Prozess ist selbst lernfähig.

Wenn im realen Ablauf sichtbar wird, dass:
- ein Agent eine Pflicht nicht erkennt,
- eine Dateiart fehlt,
- eine Rollenbeschreibung zu schwach ist,
- eine Nummern-/Archivregel unklar ist,
- ein Test zu breit oder zu ungenau angelegt wurde,

muss diese Erkenntnis nicht nur im Chat bleiben, sondern in:
- die Prozessbeschreibung,
- die künftigen Bereichsdateien,
- und die daraus abgeleiteten Prompts

zurückgebaut werden.

Grundsatz:

**Erkannte Lücken werden nicht nur besprochen, sondern in die Prozessstruktur eingebaut.**

So lernt die Maschine innerhalb des Prozesses.

---

## Prompt-Nutzung / spätere Promptsammlung

Ein Standard-Prompt muss immer aus diesem Pfad ableitbar sein:

`docs/smoketestProzessbeschreibung/`

Dort muss für jeden Agenten klar findbar sein:
- wie ein Smoke-Test aufgebaut sein muss
- welche Reihenfolge gilt
- welche Artefakte abgelegt werden müssen
- welche Rolle Claude, Repo-Agent, Ableitung, Codex und Re-Test jeweils haben
- dass neue Prompts die Prozessbeschreibung nicht ersetzen, sondern aus ihr abgeleitet werden

Die Prozessbeschreibung ist die Primärwahrheit.
Prompts sind die operative Ausführungsschicht.

---

## Referenzfall: Inline-Data-Table

Der Bereich

`docs/Smoke-Tests/inline-data-table/`

ist der erste vollständige Referenzfall dieser erweiterten Kette.

Dort wurden bereits sichtbar:
- Repo-Analyse
- Ergebnis
- Ableitung
- Umsetzung
- Nachtest
- neues Ergebnis
- neue Ableitung
- Fixauftrag
- weitere Umsetzung
- weiterer Nachtest

Dieser Bereich dient als praktische Referenz dafür,
wie aus realen Fehlern Prozesslernen in die Struktur zurückgeführt wird.

---

## Wenn du mit einem Smoke-Test weitermachen willst

Der Standardablauf ist dann:

1. Prozessbeschreibung lesen
2. Bereichsordner prüfen
3. vorhandene Kette verstehen
4. nächste logische Datei erzeugen oder befüllen
5. Ergebnis nicht im Chat verlieren
6. offene Fehler über Ableitung und Fixauftrag weiterführen
7. nach Umsetzung gezielten Nachtest als neue Stufe anlegen

---

## Merksatz

Repo ist Wahrheit.
Ohne Repo keine saubere Vorbereitung.
Ohne abgelegtes Ergebnis keine saubere Ableitung.
Ohne Kette keine saubere Wiederaufnahme.
Ohne Rückbau erkannter Lücken kein Systemlernen.