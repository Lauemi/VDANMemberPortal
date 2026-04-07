# FCP Masterboard – Pflegemodell

Stand: 2026-03-31

## Zweck

Dieses Dokument beschreibt, wie das FCP-Masterboard laufend aktuell gehalten werden soll, ohne dabei zu schwer, zu teuer oder zu unzuverlaessig zu werden.

Ziel:

- wenig Tokenverbrauch
- sichtbare und unsichtbare Fortschritte erfassen
- Launch-Naehe und Gesamtrisiko regelmaessig bewerten
- Board als belastbares Steuerungsinstrument pflegen

## Grundsatz

Das interaktive HTML-Board ist die sichtbare Fuehrungsoberflaeche.

Der operative Live-Stand liegt jetzt primaer in der Datenbank.

Empfohlenes Modell:

1. DB-Tabellen als operative Wahrheit pflegen
2. HTML-/App-Board daraus aktualisieren
3. JSON-Dateien nur fuer Bootstrap, Export oder Fallback nutzen
4. tiefe Architektur bleibt in Fachdokumenten und Migrations-/Code-Referenzen
5. bei jeder relevanten Umsetzung einen direkten SQL-Pflegeblock fuer die DB mitliefern

## Warum das wichtig ist

Wenn das Board nur direkt im HTML oder nur in losen JSON-Dateien gepflegt wird, entstehen schnell diese Probleme:

- zu hohe Pflegekosten pro Aenderung
- unsichtbare Fortschritte werden vergessen
- Status driften von der echten Repo-Lage weg
- Codex muss fuer kleine Updates zu viel Kontext laden

## Empfohlene Statuslogik pro Knoten

Jeder Board-Knoten sollte nur wenige, klare Felder haben:

- `status`
  - `offen`
  - `teilweise`
  - `erfuellt`
- `launch_blocker`
  - `ja`
  - `nein`
- `risk_level`
  - `niedrig`
  - `mittel`
  - `hoch`
- `progress_visible`
  - sichtbarer Nutzerfortschritt
- `progress_invisible`
  - Policy-/RLS-/Logik-/Writepath-/Schema-Haertung
- `refs`
  - Tabellen
  - RPCs
  - Edge Functions
  - UI-Dateien
- `gaps`
- `decisions_open`
- `last_verified_at`

## Unsichtbare Fortschritte

Diese Fortschritte muessen explizit ins Board, auch wenn sie keine neue Seite erzeugen:

- RLS-Haertung
- Policy-Schaerfung
- Trigger-/Constraint-Fix
- Writepath-Haertung
- Tenant-Isolation
- Invite-/Claim-/Auth-Fix
- Runtime-/Config-Haertung
- Datenmodell-Klarstellungen

Dafuer sollte jeder betroffene Knoten ein eigenes Feld haben:

- `progress_invisible`

Beispiel:

- `Mitglieder`
  - sichtbarer Fortschritt: Inline Registry v2
  - unsichtbarer Fortschritt: interne ID von sichtbarer Vereinsnummer entkoppelt

## Token-sparendes Pflegemodell

Damit Codex das Board nebenbei zuverlaessig pflegen kann, sollte die laufende Pflege ueber eine kleine, zentral gespeicherte Statusquelle laufen.

Empfohlen:

- DB-Tabellen fuer Masterboard und Kontrollboard
- JSON nur noch als Bootstrap-/Exportformat
- HTML bleibt Darstellungsziel

Minimaler Inhalt pro Knoten:

- `id`
- `title`
- `lane`
- `status`
- `launch_blocker`
- `risk_level`
- `progress_visible`
- `progress_invisible`
- `gaps`
- `refs`

Das spart Token, weil bei Updates nicht jedes Mal das ganze HTML semantisch neu gelesen werden muss.

## Pflichtausgabe fuer Codex

Zu jeder relevanten Umsetzung gehoert kuenftig nicht nur Code, sondern auch ein operativer Pflegeblock fuer die DB.

Minimal:

- `insert ... on conflict ... do update`
- oder `update ...`

Ziel:

- `public.system_board_nodes` direkt aktualisierbar
- `public.system_process_controls` direkt aktualisierbar
- kein rein beschreibender Chat ohne nachziehbaren DB-Pflegeblock

## Launch-Sicht

Das Board sollte nicht nur Modulstatus zeigen, sondern auch Launch-Relevanz.

Jeder Knoten braucht deshalb gedanklich zwei Fragen:

1. Blockiert das den Launch?
2. Wie hoch ist das Risiko, wenn wir mit diesem Zustand live gehen?

### Launch-Klassen

- `L0`
  - kein Launch-Blocker
- `L1`
  - relevant, aber umgehbar
- `L2`
  - starker Launch-Risikotreiber
- `L3`
  - echter Launch-Blocker

### Typische L3-Kandidaten aktuell

- CSV-Onboarding fehlt noch
- Kartenmodell ist nicht sauber genug
- Mitgliedschaftshistorie fehlt fuer spaetere Fachlogik
- Rollenpfad fuer importierte Mitglieder ist noch nicht sauber

## Gesamt-Risiko

Fuer die Fuehrung reicht eine einfache Ampel-Logik:

- `gruen`
  - keine offenen L3-Punkte, nur begrenzte L2-Risiken
- `gelb`
  - Golden Path laeuft, aber mehrere L2-Punkte offen
- `rot`
  - Golden Path oder zentrale Datenpfade noch instabil

## Was Codex bei jeder Umsetzung tun soll

Nach jeder relevanten Aenderung:

1. betroffenen Knoten identifizieren
2. `status` pruefen
3. SQL-Block fuer den operativen Board-State schreiben
4. `progress_visible` oder `progress_invisible` aktualisieren
5. neue Referenzen eintragen
6. `gap` entfernen oder neu markieren
7. `launch_blocker` und `risk_level` neu einschaetzen
8. `last_verified_at` setzen

## Praktische Arbeitsregel

Nicht jede Kleinigkeit braucht ein sichtbares Board-Update.

Board-relevant sind Aenderungen, die mindestens eines davon betreffen:

- neuer Systempfad
- neues Modul
- neue Tabelle / RPC / Edge Function
- geschlossener Gap
- neue offene Entscheidung
- verringerter oder erhoehter Launch-Risikograd
- unsichtbare, aber strukturell wichtige Haertung

## Meine Bewertung der aktuellen Idee

Die Idee ist stark und richtig.

Warum:

- sie reduziert Statusblindheit
- sie macht Architekturarbeit sichtbar
- sie hilft bei Priorisierung
- sie verbindet Repo-Wahrheit mit Fuehrungssicht

Was ich daran schaerfen wuerde:

- HTML nicht als einzige Pflegequelle
- unsichtbare Fortschritte als eigenes Pflichtfeld
- Launch-Blocker und Risiko explizit pro Knoten
- kleine, regelmaessig gepflegte Statusquelle als Basis

## Aktuelle Gesamteinschaetzung

Nach heutigem Stand ist das FCP deutlich naeher an einem kontrollierten Launch als noch vor wenigen Wochen, aber nicht ganz im risikofreien Bereich.

Aktuelle Einschaetzung:

- Launch-Reife:
  - `mittel`
- Gesamtrisiko:
  - `gelb`

Hauptgruende:

- Golden Path ist erkennbar
- Auth, Onboarding, Registry und zentrale Vereinsmodule sind substanziell vorhanden
- aber CSV-Onboarding, Kartenmodell und einige Mitgliedschafts-/Rollenfragen sind noch offene Systembaustellen

## Verlaesslichkeitsversprechen

Wenn wir dieses Pflegemodell einhalten, kann Codex das Board tatsaechlich nebenbei mitpflegen.

Das setzt aber voraus:

- Board-Aenderungen gehoeren fest zum Abschluss einer Umsetzung
- wichtige unsichtbare Fortschritte werden nicht als "zu technisch" weggelassen
- Launch-Risiko wird ehrlich und nicht optimistisch gepflegt
