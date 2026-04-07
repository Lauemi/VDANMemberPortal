# FCP MASTERBOARD PFLEGEVERTRAG

Stand: 2026-03-31

## Verbindliche Regel zwischen Codex, Code-Aenderung und Board-State

## Zweck

Dieser Vertrag stellt sicher, dass das FCP-Masterboard und das operative Kontrollboard jederzeit den realen Systemstand abbilden.

Die operative Pflichtquelle liegt jetzt in der Datenbank.

JSON-Dateien bleiben fuer Bootstrap, Export und Fallback wichtig, sind aber nicht mehr die alleinige Live-Wahrheit.

## 1. Grundsatz

Jede relevante Aenderung im Projekt hat zwei verpflichtende Ergebnisse:

1. Code / Struktur / Dokumentation geaendert
2. passender SQL-Block fuer den betroffenen Board-State liegt vor

Ohne SQL-Block zur Pflege des operativen Board-Standes gilt eine Aenderung nicht als abgeschlossen.

## 2. Single Source of Truth

Die Wahrheit ueber den aktuellen Systemzustand liegt in den Board-Tabellen der Datenbank.

### Operative Pflichtquellen

- `public.system_board_nodes`
- `public.system_process_controls`
- `public.system_superadmins`

### Bootstrap-/Exportquellen

- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`

### Anzeige

- HTML-/App-Boards sind Darstellung
- DB ist Pflegequelle
- JSON ist Bootstrap/Export

Codex darf den Status niemals nur im HTML oder nur in JSON aendern, ohne die operative Datenquelle mitzupflegen.

## 3. Was Codex zusaetzlich liefern MUSS

Wenn Codex etwas Relevantes umsetzt, muss am Ende immer zusaetzlich ein DB-Pflegeblock mitgeliefert werden:

- fuer Architektur-/Masterboard-Aenderungen:
  - SQL fuer `public.system_board_nodes`
- fuer Prozess-/Kontrollboard-Aenderungen:
  - SQL fuer `public.system_process_controls`

Empfohlene Form:

- `insert ... on conflict ... do update`
- alternativ `update ...`

## 4. Wann Codex den Board-State aktualisieren MUSS

Codex muss den Board-State aktualisieren, wenn mindestens einer dieser Punkte zutrifft:

- neuer Systempfad
- neue Tabelle / neue Migration
- neue Edge Function / RPC / UI-Datei
- bestehender Gap geschlossen
- neuer Gap erkannt
- Status eines Knotens geaendert
- sichtbarer Fortschritt entstanden
- unsichtbarer Fortschritt entstanden
- Launch-Risiko gesunken oder gestiegen
- Screen / Prozess wurde geprueft
- Smoke Test wurde durchgefuehrt
- Bug wurde geschlossen oder neu eroeffnet
- Review-Stand wurde veraendert

## 5. Pflichtregel: Done Definition

Eine Aufgabe ist nur dann DONE, wenn alle drei Bedingungen erfuellt sind:

1. Code-/Strukturaenderung ist umgesetzt
2. passender SQL-Block fuer die Board-Pflege liegt vor
3. `last_verified_at` wird im DB-Update mitgefuehrt

Fehlt einer dieser Punkte, ist die Aufgabe nicht abgeschlossen.

## 6. Pflichtfelder im Masterboard-State

Codex muss betroffene Knoten im Masterboard-State pflegen:

- `status`
- `launch_class`
- `risk_level`
- `progress_visible`
- `progress_invisible`
- `gaps`
- `decisions_open`
- `refs`
- `last_verified_at`

## 7. Pflichtfelder im operativen Kontrollboard-State

Codex muss betroffene Eintraege im operativen Kontrollboard-State pflegen:

- Prozessstatus
- Screenstatus
- Smoke-Check-Status
- UI-Check-Status
- Build-/Stand-Referenz
- offene Bugs
- Review-Status
- Review-Datum

## 8. Unsichtbare Fortschritte sind Pflicht

Codex darf Fortschritt nicht nur dann pflegen, wenn neue UI sichtbar wird.

Auch diese Aenderungen muessen zwingend eingetragen werden:

- RLS-Haertung
- Policy-Fix
- Constraint-Fix
- Trigger-Fix
- Writepath-Haertung
- Rollenbereinigung
- Identitaetslogik
- Multi-Tenant-Fix
- Runtime-/Config-Haertung
- Datenmodell-Klarstellung

Diese Aenderungen gehoeren in:

- `progress_invisible`

## 9. Keine stillen Aenderungen

Codex darf keine stillen Architektur- oder Statusaenderungen durchfuehren.

Wenn bei einer Umsetzung eine dieser Situationen entsteht:

- neue Luecke erkannt
- Modellbruch entdeckt
- offene Entscheidung sichtbar
- Launch-Risiko veraendert sich

dann muss Codex den Board-State entsprechend ergaenzen.

## 10. Pflichtablauf bei jeder relevanten Umsetzung

Codex arbeitet bei jeder relevanten Aenderung in dieser Reihenfolge:

1. betroffenen Knoten / Prozess identifizieren
2. technische Aenderung umsetzen
3. passenden SQL-Block fuer die DB-Pflege schreiben
4. Status im Board-State aktualisieren
5. sichtbaren oder unsichtbaren Fortschritt eintragen
6. `refs` ergaenzen
7. `gaps` entfernen oder ergaenzen
8. `decisions_open` pruefen
9. `launch_class` und `risk_level` neu bewerten
10. `last_verified_at` setzen

## 11. Verbot

Nicht erlaubt ist:

- nur Code aendern
- nur HTML aendern
- SQL-Board-Update spaeter machen
- Fortschritt nur im Chat erwaehnen
- Risiken stillschweigend mitziehen
- Bugs schliessen, ohne Kontrollboard zu pflegen

## 12. Fuehrungsregel

Das Board soll kuenftig den aktuellen Stand zeigen, ohne dass Michael den Status aktiv nachfragen muss.

Deshalb gilt:

Wenn Codex etwas Relevantes baut, muss der Board-State direkt mitgezogen werden und der passende SQL-Block am Ende vorliegen.

## 13. Kurzregel fuer Codex

```text
Code ohne DB-Board-Update ist nicht fertig.
JSON ist nicht mehr die operative Wahrheit.
Die DB ist die Wahrheit.
Am Ende jeder relevanten Umsetzung ist ein SQL-Update fuer den Board-State mitzuliefern.
```

## 14. Zielbild

Wenn dieser Vertrag eingehalten wird, dann gilt:

- Board = aktueller Stand
- DB = Wahrheit
- HTML = Sichtbarkeit
- Codex = pflegt den Zustand mit jeder relevanten Aenderung

Damit wird das Board zu einem echten Steuerungssystem statt zu einer huebschen Momentaufnahme.

## 15. UI ist schreibende Quelle

Das Masterboard ist nicht nur Anzeige, sondern aktive Eingabeoberflaeche.

### Grundsatz

Alle Aenderungen, die ueber das Board erfolgen, zum Beispiel Klicks, Statusaenderungen oder Notizen, muessen:

1. in den Board-State geschrieben werden
2. dauerhaft in der DB gespeichert werden, nicht nur in `localStorage`
3. fuer Codex sichtbar sein

### Nicht erlaubt

- Speicherung nur im Browser
- UI-Aenderungen ohne DB-Synchronisation
- manuelle Uebertragung von Board-Zustaenden

### Zielzustand

Ein Klick im Board:

- aendert den Zustand
- schreibt in die DB
- die DB ist sofort die neue Wahrheit

### Technische Mindestloesung V1

Falls noch kein DB-Sync existiert:

- Export-Button muss verpflichtend genutzt werden
- JSON wird als Datei im Projekt gespeichert
- Codex liest diese Datei als temporaeren Fallback

### Ziel V2

- Board schreibt direkt ueber API / Supabase
- zentraler Board-State liegt in DB-Tabellen
- Codex arbeitet immer auf diesem Stand

### Kurzregel

```text
UI ohne DB-Schreibzugriff = nur Demo
UI mit DB-Schreibzugriff = Steuerungssystem
```
