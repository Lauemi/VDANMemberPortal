# Smoketest-Anweisung-inline-data-table-v2

Version: v2
Stand: 2026-04-22
Status: aktiv
Bereich: Mitgliederverwaltung / Inline-Data-Table

## ZIEL

Dieser Smoke-Test prüft die Inline-Data-Table vollständig auf:
- Funktion
- Inline-Edit
- Context-Menü (Hauptproblem)
- ADM/QFM-Verhalten

## WICHTIG

Vor Test:
- Repo prüfen (keine Chat-Interpretation)
- relevante Dateien lesen

## REPO-CHECK (PFLICHT)

Dateien:
- public/js/fcp-inline-data-table-v2.js
- public/js/redesign.js
- public/css/redesign.css
- public/css/main.css

Ziel:
- verstehen, was laut Code funktionieren müsste

## TESTZUGANG

URL:
http://127.0.0.1:4321/app/mitgliederverwaltung/

User:
fcp_demoadmin@fishing-club-portal.de

Passwort:
FCP1admin

## TEST

### 1. Kontextmenü (KRITISCH)

Prüfen:
- 3-Punkte öffnet Menü
- Menü sitzt direkt am Button
- Rechtsklick öffnet Menü an Mausposition
- Menü wirkt lokal verankert

Aktionen im Menü:
- sort asc
- sort desc
- hide column
- reset width

Bewertung:
- wirkt es wie echtes Produktmenü?
- oder globales Popup?

### 2. Inline Edit

Prüfen:
- Klick → öffnet Editor unter Zeile
- bleibt Row-Struktur erhalten
- kein Formularblock

### 3. Funktion

Prüfen:
- Sort
- Suche
- Spalten
- Cards

### 4. ADM/QFM

Prüfen:
- Daten kommen korrekt
- Write logisch eingebunden

## ERWARTUNG

- Menü ist lokal verankert
- Inline Edit ist sauber row-basiert
- keine Dev-UI sichtbar

## ERGEBNISSTRUKTUR (CLAUDE)

Claude liefert:
1. Was funktioniert
2. Was nicht funktioniert
3. Wo genau das Problem liegt
4. Ob Blocker oder nicht
