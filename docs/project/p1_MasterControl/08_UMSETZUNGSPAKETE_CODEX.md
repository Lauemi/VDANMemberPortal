# Project One — Umsetzungspakete Codex

Stand: 2026-04-20

## Zweck

Diese Datei uebersetzt den verifizierten Ist-Stand, das Zielbild und die Umsetzungsregeln in klar getrennte Umsetzungspakete fuer Folge-Agenten.

Sie ist keine neue Grundsatzanalyse, sondern die operative Bruecke zwischen:

- Einstiegskette `00` bis `07`
- aelteren Soll-/Plan-Dateien im Ordner
- spaeteren konkreten Code- oder UI-Aenderungen

Grundsatz:

- repo-wahr
- prinzipiengesteuert
- keine Produktumsetzung in dieser Datei
- keine verdeckte Erweiterung des Scopes

---

## Trennung der Rollen

Diese Datei ist **keine** neue Analysebasis.

Die Trennung ist verbindlich:

### Analysebasis

Die verifizierte Analysebasis liegt in:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `01_ZIELBILD_MASTERCONTROL.md`
- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
- `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
- `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

### Umsetzungsphase

Diese Datei `08_UMSETZUNGSPAKETE_CODEX.md` beschreibt:

- wie Folgearbeit in Pakete geschnitten werden soll
- in welcher Reihenfolge gearbeitet werden kann
- welche Alt-/Paralleltexte wie einzuordnen sind
- welche Vorbedingungen vor einer spaeteren Umsetzung erfuellt sein muessen

### Was Codex spaeter konkret daraus bauen soll

Ein Folge-Agent darf aus dieser Datei spaeter:

- Umsetzungspakete priorisieren
- Arbeitspakete vorbereiten
- Produktaenderungen in saubere Reihenfolgen schneiden
- Folgepruefungen gegen Relation, Status und Projektdokumentation planen

Ein Folge-Agent darf aus dieser Datei **nicht** ableiten:

- dass die Analysebasis erneut von null erstellt werden muss
- dass Soll-Texte die verifizierte Ist-Kette ersetzen
- dass ein Paket ohne Rueckbindung an `00` bis `07` direkt umgesetzt werden darf

---

## Einordnung im Projektordner

Vor dem Arbeiten mit Umsetzungspaketen muessen Folge-Agenten zuerst lesen:

1. `00_README_PROJECT_ONE_MASTERCONTROL.md`
2. `01_ZIELBILD_MASTERCONTROL.md`
3. `02_IST_ANALYSE_MASTERBOARD.md`
4. `03_UI_WAHRHEIT_MASTERBOARD.md`
5. `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
6. `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
7. `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md`
8. `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

Erst danach darf mit `08_UMSETZUNGSPAKETE_CODEX.md` gearbeitet werden.

Kurzregel:

```text
00 bis 07 sagen, was verifiziert ist.
08 sagt, wie daraus spaetere Umsetzung geschnitten wird.
```

---

## Strukturharmonisierung des Ordners

Die aktuell parallelen Dateien im Ordner sind fachlich unterschiedlich zu behandeln:

### `02_SYSTEMKONTEXT_UND_DATEILANDKARTE.md`

Empfehlung:

- `behalten`
- als ergaenzende Systemlandkarte weiterfuehren
- nicht mehr als fuehrende Phase-0-Basis verwenden

Begruendung:

- die Datei enthaelt weiterhin nuetzlichen Systemkontext
- die verifizierte Ist-Kette liegt inzwischen aber in `02_IST_ANALYSE_MASTERBOARD.md` bis `07_UMSETZUNGSREGELN_MASTERCONTROL.md`

### `04_IST_ANALYSE_MASTERBOARD.md`

Empfehlung:

- `archivieren`
- inhaltlich nicht mehr als fuehrende Ist-Datei verwenden

Begruendung:

- Phase-0-/Phase-1-Ist-Basis ist bereits belastbar in `02`, `03`, `04`, `05`, `06`, `07` aufgeteilt
- die alte Datei ist fachlich verwandt, aber nicht mehr die eindeutig fuehrende Struktur

### `05_SOLL_ARCHITEKTUR_MASTERCONTROL.md`

Empfehlung:

- `behalten`
- als Soll-/Zielarchitektur weiterverwenden
- nicht mit `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md` zusammenlegen

Begruendung:

- Defizit-Analyse und Soll-Architektur sind unterschiedliche Rollen
- die Datei bleibt fuer spaetere Umsetzungspakete wertvoll

### `06_UMSETZUNGSPLAN_MASTERCONTROL.md`

Empfehlung:

- `integrieren`
- spaeter schrittweise gegen `08_UMSETZUNGSPAKETE_CODEX.md` konsolidieren
- vorerst nicht loeschen

Begruendung:

- der alte Umsetzungsplan enthaelt weiterhin sinnvolle Umsetzungslogik
- `08` wird ab jetzt die fuehrende agentische Paketdatei
- dadurch sollte `06_UMSETZUNGSPLAN_MASTERCONTROL.md` spaeter eher in `08` ueberfuehrt als parallel fortgeschrieben werden

---

## Fuehrende Regel fuer die Harmonisierung

Ab jetzt gilt im Projektordner:

- `00` bis `07` = fuehrende verifizierte Einstiegskette
- `08` = fuehrende operative Paket- und Arbeitsdatei fuer Folge-Agenten
- `09` = fuehrendes Entscheidungslog
- `10` = fuehrendes Aenderungslog

Die parallelen aelteren Dateien bleiben vorerst bestehen, werden aber funktional nachgeordnet:

- `02_SYSTEMKONTEXT_UND_DATEILANDKARTE.md` = ergaenzender Kontext
- `04_IST_ANALYSE_MASTERBOARD.md` = Alt-Ist-Analyse, perspektivisch Archiv
- `05_SOLL_ARCHITEKTUR_MASTERCONTROL.md` = Soll-Architektur
- `06_UMSETZUNGSPLAN_MASTERCONTROL.md` = Alt-Plan, perspektivisch in `08` zu konsolidieren

---

## Umsetzungspakete ab jetzt

## Paket 1 — Einstieg und Ordnung sichern

Ziel:

- Folge-Agenten eindeutig in die richtige Startkette schicken
- parallele Alt-/Neu-Struktur nicht stillschweigend vermischen

Betroffene Dateien:

- `00_README_PROJECT_ONE_MASTERCONTROL.md`
- `08_UMSETZUNGSPAKETE_CODEX.md`
- `09_ENTSCHEIDUNGSLOG.md`
- `10_AENDERUNGSLOG.md`

Erfolgskriterium:

- ein neuer Agent weiss nach Lesen des Ordners eindeutig, welche Dateien fuehrend sind

## Paket 2 — Strukturharmonisierung Alt vs Neu

Ziel:

- alte Paralleltexte nicht loeschen, aber klar nachrangig einordnen
- spaetere Archivierungs- oder Zusammenfuehrungsentscheidung vorbereiten

Betroffene Dateien:

- `02_SYSTEMKONTEXT_UND_DATEILANDKARTE.md`
- `04_IST_ANALYSE_MASTERBOARD.md`
- `05_SOLL_ARCHITEKTUR_MASTERCONTROL.md`
- `06_UMSETZUNGSPLAN_MASTERCONTROL.md`
- ggf. spaeter README

Erfolgskriterium:

- keine unklare Doppelfuehrung mehr fuer Folge-Agenten

## Paket 3 — Board-Ebene A sauber neu schneiden

Ziel:

- Prioritaet, Legende, Blockerfuehrung und Node-Verdichtung auf Board-Ebene verbessern

Vorbedingung:

- Einstiegskette `00` bis `07` gelesen
- Relationenlage aus `06_RELATIONEN_BOARD_PROCESS_UI_FILES.md` verstanden

Betroffene Produktdateien voraussichtlich:

- `src/pages/app/masterboard/index.astro`
- `public/js/masterboard-app.js`
- `public/css/masterboard.css`

Erfolgskriterium:

- Board fuehrt klarer, ohne schon komplette Workspace-Tiefe erzwingen zu wollen

## Paket 4 — Drawer zu Workspace entwickeln

Ziel:

- den aktuellen Rohpflege-Drawer in eine gefuehrte Arbeitsflaeche ueberfuehren

Erfolgskriterium:

- Bearbeitung nicht mehr nur ueber Feldsammlung und JSON-Textareas

## Paket 5 — Relationsebene sichtbar machen

Ziel:

- Board -> Process -> UI -> Files in der Oberflaeche sichtbar und nutzbar machen

Erfolgskriterium:

- Nutzer erkennt nicht nur Zustand, sondern auch Zusammenhaenge und Folgeflaechen

## Paket 6 — Spezialmaskenpfad vorbereiten

Ziel:

- definieren, wann Board/Workspace nicht mehr reichen
- Weiterleitung in tiefere Bearbeitungsraeume vorbereiten

Erfolgskriterium:

- kein Themenstau mehr im Universal-Drawer

---

## Arbeitsregel fuer Folge-Agenten

Ein Umsetzungspaket ist erst dann startklar, wenn:

1. Produkt
2. Relation
3. Status
4. Projektdokumentation

gemeinsam betrachtet wurden.

Wenn eines dieser vier Felder ausgeblendet wird, ist das Paket nicht sauber vorbereitet.
