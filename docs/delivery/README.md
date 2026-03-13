# Delivery Workspace

Diese Ablage ist die gemeinsame Arbeitsoberflaeche fuer Umsetzung, Uebergaben und Priorisierung.

## Zweck

- Ein Ort fuer offene Punkte mit Prioritaet und Status
- Ein Ort fuer Modulstatus mit Definition of Done
- Ein Ort fuer konkrete Uebergaben von dir an Codex
- Ein Ort fuer Entscheidungen, damit sie nicht in Chats verloren gehen

## Dateien

- `BACKLOG.md`
  Zentrales Arbeitsboard. Jede Aufgabe bekommt eine ID, Prioritaet, Status, Besitzer und Akzeptanzkriterien.
- `MODULES.md`
  Fachliche Uebersicht pro Modul: Status, offene Luecken, technische Fundstellen, Abnahmezustand.
- `COMPONENT_STANDARDS.md`
  Kanonische Standardbibliothek fuer UI-Bausteine mit Standard-ID, Verhalten und Varianten.
- `MASK_AUDIT_TEMPLATE.md`
  Vorlage fuer die Pruefung einer einzelnen Maske auf zwei Ebenen: Workflow und Komponenten-Architektur.
- `FCP_KONTROLL_ABARBEITUNG.md`
  Druckbare Wellenliste fuer die operative Audit-Abarbeitung mit Checkboxen fuer Workflow, Komponenten und Smoke.
- `SESSION_LOG.md`
  Kurzes Journal laufender Sessions. Nur Fakten: was wurde geprueft, gebaut, blockiert.
- `DECISIONS.md`
  Knappe Architektur- und Produktentscheidungen mit Datum und Auswirkung.
- `HANDOFF_TEMPLATE.md`
  Vorlage fuer deine Uebergaben an mich.

## Arbeitsweise

1. Neue Arbeit startet immer in `BACKLOG.md`.
2. Jede Maskenpruefung hat ab jetzt zwei Ebenen:
   - fachlicher Workflow
   - Komponenten-Audit gegen `COMPONENT_STANDARDS.md`
3. Wenn ein Punkt ein konkretes App-Modul betrifft, wird `MODULES.md` mit aktualisiert.
4. Wichtige Entscheidungen kommen nach `DECISIONS.md`.
5. Nach einer Session wird `SESSION_LOG.md` in 3-10 Zeilen aktualisiert.

## Statuswerte

- `todo`
- `ready`
- `doing`
- `blocked`
- `review`
- `done`

## Prioritaeten

- `P0` kritisch / blockiert Release oder Kernworkflow
- `P1` wichtig / naechster sinnvoller Ausbau
- `P2` sinnvoll / spaeter

## Wie du mir Aufgaben geben kannst

Nutze `HANDOFF_TEMPLATE.md` oder schreibe mir kompakt:

- Ziel
- betroffene Route oder Modul
- was heute fertig sein soll
- was explizit nicht angefasst werden soll
- wie wir "fertig" erkennen

Dann kann ich direkt gegen diese Struktur arbeiten, statt jedes Mal neu zu rekonstruieren.

## Neuer Delivery-Standard pro Maske

Jede sichtbare Maske wird kuenftig immer in zwei Kanaelen geprueft:

1. Workflow-Audit
- Zweck der Maske
- States
- Rollen
- RPCs, Tabellen, Datenmodelle

2. Komponenten-Audit
- sichtbare UI-Elemente
- Match gegen `COMPONENT_STANDARDS.md`
- Kennzeichnung je Element als:
  - `standard`
  - `standard-abweichung`
  - `spezialkomponente`
- Begruendung, Abweichung und Empfehlung

Ohne diese zweite Ebene ist eine Maske fachlich vielleicht korrekt, aber technisch nicht wartbar.

## Studio-Sync Pflicht

Audit, Studio und reale Maske muessen dieselbe Aussage treffen.

Wenn ein Element als echter Standard-Match akzeptiert wird, wird es direkt an der Fundstelle im Code markiert, soweit technisch sinnvoll:

- `data-studio-component-type`
- `data-studio-library-id`
- `data-studio-component-id`
- bei Tabellen zusaetzlich `data-table-id`

Regel:

- `standard` => im Markup als Studio-Standard markieren
- `standard-abweichung` => Basisstandard benennen, aber Abweichung offen halten
- `spezialkomponente` => keinen falschen Standard-Match setzen

Damit bleiben Komponenten-Audit, Studio-Analyse und reale Implementation synchron.
