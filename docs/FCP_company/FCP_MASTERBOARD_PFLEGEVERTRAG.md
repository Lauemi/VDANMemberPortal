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
2. betroffener Board-State aktualisiert

Ohne aktualisierten Board-State gilt eine Aenderung nicht als abgeschlossen.

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

Codex darf den Status niemals nur im HTML aendern, ohne die operative Datenquelle mitzupflegen.

## 3. Wann Codex den Board-State aktualisieren MUSS

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

## 4. Pflichtregel: Done Definition

Eine Aufgabe ist nur dann DONE, wenn alle drei Bedingungen erfuellt sind:

1. Code-/Strukturaenderung ist umgesetzt
2. betroffene Board-Knoten sind aktualisiert
3. `last_verified_at` wurde gesetzt

Fehlt einer dieser Punkte, ist die Aufgabe nicht abgeschlossen.

## 5. Pflichtfelder im Masterboard-State

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

## 6. Pflichtfelder im operativen Kontrollboard-State

Codex muss betroffene Eintraege im operativen Kontrollboard-State pflegen:

- Prozessstatus
- Screenstatus
- Smoke-Check-Status
- UI-Check-Status
- Build-/Stand-Referenz
- offene Bugs
- Review-Status
- Review-Datum

## 7. Unsichtbare Fortschritte sind Pflicht

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

## 8. Keine stillen Aenderungen

Codex darf keine stillen Architektur- oder Statusaenderungen durchfuehren.

Wenn bei einer Umsetzung eine dieser Situationen entsteht:

- neue Luecke erkannt
- Modellbruch entdeckt
- offene Entscheidung sichtbar
- Launch-Risiko veraendert sich

dann muss Codex den Board-State entsprechend ergaenzen.

## 9. Pflichtablauf bei jeder relevanten Umsetzung

Codex arbeitet bei jeder relevanten Aenderung in dieser Reihenfolge:

1. betroffenen Knoten / Prozess identifizieren
2. technische Aenderung umsetzen
3. Status im Board-State aktualisieren
4. sichtbaren oder unsichtbaren Fortschritt eintragen
5. `refs` ergaenzen
6. `gaps` entfernen oder ergaenzen
7. `decisions_open` pruefen
8. `launch_class` und `risk_level` neu bewerten
9. `last_verified_at` setzen

## 10. Verbot

Nicht erlaubt ist:

- nur Code aendern
- nur HTML aendern
- Board-Update spaeter machen
- Fortschritt nur im Chat erwaehnen
- Risiken stillschweigend mitziehen
- Bugs schliessen, ohne Kontrollboard zu pflegen

## 11. Fuehrungsregel

Das Board soll kuenftig den aktuellen Stand zeigen, ohne dass Michael den Status aktiv nachfragen muss.

Deshalb gilt:

Wenn Codex etwas Relevantes baut, muss der Board-State direkt mitgezogen werden.

## 12. Kurzregel fuer Codex

```text
Code ohne Board-Update ist nicht fertig.
HTML ohne Board-Update ist nicht gueltig.
Statusaenderung ohne last_verified_at ist unvollstaendig.
Unsichtbarer Fortschritt darf nicht verloren gehen.
```

## 13. Zielbild

Wenn dieser Vertrag eingehalten wird, dann gilt:

- Board = aktueller Stand
- DB = Wahrheit
- HTML = Sichtbarkeit
- Codex = pflegt den Zustand mit jeder relevanten Aenderung

Damit wird das Board zu einem echten Steuerungssystem statt zu einer huebschen Momentaufnahme.

## 14. UI ist schreibende Quelle

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
