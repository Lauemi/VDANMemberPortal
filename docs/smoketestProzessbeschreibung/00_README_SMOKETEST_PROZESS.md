# Smoke-Test Prozessbeschreibung

Version: v1
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
- eindeutige Trennung zwischen Testanweisung, Testergebnis und Ableitung.

REPO IST WAHRHEIT.

Wenn Repo-Zugriff fehlt, muss dieser ausdrücklich angefordert werden.
Wenn zusätzliche Informationen aus der DB oder Laufzeitlogik benötigt werden, muss das ausdrücklich sichtbar angefordert werden.
Für DB-nahe Klärungen ist Claude zuständig.

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

## Ordnerstruktur

Jeder Smoke-Test-Bereich liegt unter:

`docs/Smoke-Tests/<bereich>/`

Beispiel:

`docs/Smoke-Tests/inline-data-table/`

Darin liegen immer mindestens diese drei Dateien:

1. `Smoketest-Anweisung-<bereich>-vX.md`
2. `Smoketest-Ergebnis-<bereich>-vX.md`
3. `Smoketest-Ableitung-<bereich>-vX.md`

## Standardrollen

### Rolle 1 – Repo-Agent
Aufgabe:
- aktuelles Repo prüfen
- relevante Dateien / Konfiguration / Pfade identifizieren
- klar benennen, was laut Repo getestet werden muss

### Rolle 2 – Claude als Browser-Tester
Aufgabe:
- die repo-wahre Testanweisung ausführen
- Browser-Test dokumentieren
- Screenshots, Beobachtungen, Fehlerbilder, Abweichungen und Blocker liefern

### Rolle 3 – ChatGPT / Ableitung
Aufgabe:
- das abgelegte Testergebnis lesen
- daraus klare Ableitungen schreiben
- unterscheiden:
  - Entscheidungen,
  - Bugs,
  - Prozess-/Masken-/Closing-Relevanz

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
- welche drei Dateien je Bereich erwartet werden
- dass zuerst repo-wahr vorbereitet wird

## Prompt-Nutzung / spätere Promptsammlung

Ein Standard-Prompt muss künftig immer aus diesem Pfad ableitbar sein:

`docs/smoketestProzessbeschreibung/`

Dort muss für jeden Agenten klar findbar sein:
- wie ein Smoke-Test aufgebaut sein muss
- welche Reihenfolge gilt
- welche Artefakte abgelegt werden müssen
- welche Rolle Claude, Repo-Agent und Ableitung jeweils haben

## Beispielbereich

Als erster Beispielbereich wird angelegt:

`docs/Smoke-Tests/inline-data-table/`

mit:
- `Smoketest-Anweisung-inline-data-table-v1.md`
- `Smoketest-Ergebnis-inline-data-table-v1.md`
- `Smoketest-Ableitung-inline-data-table-v1.md`

## Wenn du mit einem Smoke-Test weitermachen willst

Der Standardablauf ist dann:

1. Repo-Agent liest diesen Ordner hier
2. Repo-Agent erstellt / prüft die Anweisung
3. Claude liefert das Ergebnis
4. Ergebnis wird im Repo abgelegt
5. ChatGPT erstellt die Ableitung

## Merksatz

Repo ist Wahrheit.
Ohne Repo keine saubere Vorbereitung.
Ohne abgelegtes Ergebnis keine saubere Ableitung.
Ohne Ableitung keine konsistente Weiterarbeit.
