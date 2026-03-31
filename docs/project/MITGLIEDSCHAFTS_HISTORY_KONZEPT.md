# Mitgliedschafts-History Konzept

Stand: 2026-03-31

## Problem

Die aktuelle Mitglieder-Registry pflegt heute vor allem den **aktuellen Zustand** eines Mitglieds:

- Status
- Angelkarte / Kartentyp
- Rolle
- Stammdaten

Das reicht fuer operative Pflege, aber **nicht** fuer die fachliche Vereinshistorie.

Sobald ein Feld einfach ueberschrieben wird, geht wichtige Information verloren:

- Ein Mitglied war von `aktiv` auf `passiv` und spaeter wieder `aktiv`
- Ein Jugendmitglied wurde automatisch zum Erwachsenenmitglied
- Ein Mitglied hatte frueher zwei Karten und spaeter nur noch eine
- Eine Karte wurde gekuendigt, umgestellt oder erweitert
- Das Eintrittsdatum muss fuer Ehrungen und Vereinszugehoerigkeit nachvollziehbar bleiben

Wenn diese Aenderungen nur im aktuellen Mitgliedsdatensatz ueberschrieben werden, muss man sich die Historie spaeter "aus den Rippen schneiden".

Das ist fachlich nicht tragfaehig.

## Harte fachliche Regel

Die Mitglieder-Registry braucht **zwei Ebenen**:

1. **Mitglieds-Stammsatz**
2. **Mitgliedschafts-Historie**

Der Stammsatz beschreibt:

- wer die Person ist
- wie sie aktuell erreichbar ist
- welcher aktuelle Zustand im Verein gilt

Die Historie beschreibt:

- wann welcher Mitgliedschaftszustand galt
- wann Karten gewechselt wurden
- wann Statuswechsel stattgefunden haben
- wann Jugend zu Erwachsen wurde
- welche Vereinszugehoerigkeit fuer Ehrungen und Jubiläen zaehlt

## Was der Stammsatz bleiben sollte

Im aktuellen Mitgliedssatz bleiben weiterhin die **aktuellen Live-Werte**:

- `club_member_no`
- `first_name`
- `last_name`
- `email`
- `street`
- `zip`
- `city`
- `phone`
- `mobile`
- `birthdate`
- `guardian_member_no`
- `role`
- `status` als aktueller Zustand
- `fishing_card_type` oder kuenftig aktuelle Karten-Zusammenfassung

Diese Felder sind fuer die operative Arbeit gedacht.

## Was in die History gehoert

Eine eigene History-Ebene muss mindestens diese Aenderungen abbilden:

- Eintritt in den Verein
- Austritt aus dem Verein
- Wechsel von `aktiv` zu `passiv`
- Wechsel von `passiv` zu `aktiv`
- Wechsel der Karten / Angelberechtigungen
- Wechsel von Jugend zu Erwachsen
- Wechsel der Rolle, wenn fachlich relevant
- Sonderfaelle wie Ruhemitgliedschaft, Ehrenmitgliedschaft, Wiederaufnahme

## Mindestfelder fuer eine Mitgliedschafts-History

Jeder History-Eintrag sollte mindestens enthalten:

- `id`
- `club_id`
- `member_no`
- `event_type`
- `valid_from`
- `valid_until`
- `status`
- `membership_kind`
- `card_state`
- `role_snapshot`
- `source`
- `note`
- `changed_by`
- `changed_at`

## Empfohlene Event-Typen

Beispielhafte `event_type`-Werte:

- `join`
- `reactivation`
- `status_change`
- `card_change`
- `membership_kind_change`
- `role_change`
- `adult_transition`
- `leave`
- `correction`

## Fachlich wichtige abgeleitete Werte

Aus der Historie muessen spaeter ableitbar sein:

- **Eintrittsdatum**
  Das erste wirksame `join`- oder `reactivation`-Datum, je nach Vereinsregel
- **Dauer der Vereinszugehoerigkeit**
  Fuer Ehrungen und Jubiläen
- **aktuelle Mitgliedschaft**
  Der derzeit gueltige offene History-Eintrag
- **Phasen passiv/aktiv**
  Fuer Verwaltungs- und Abrechnungsfragen
- **Kartenentwicklung**
  Welche Angelkarten wann galten
- **Jugend -> Erwachsen**
  Zeitpunkt des Uebergangs und daraus resultierende Karten-/Beitragsaenderung

## Jugend -> Erwachsen

Das ist kein Randfall, sondern ein Standardprozess.

Deshalb braucht das Modell eine klare Regel:

- Ein Jugendmitglied bleibt nicht einfach fachlich "Jugend", nur weil es so einmal eingetragen wurde.
- Mit Volljaehrigkeit muss ein Uebergang nachvollziehbar sein.
- Wenn keine Kuendigung erfolgt, wird die Mitgliedschaft fachlich weitergefuehrt.
- Nur der Mitgliedschaftstyp, Kartenzustand oder Beitragskontext kann sich aendern.

Das sollte **nicht** durch stilles Ueberschreiben passieren, sondern als History-Eintrag:

- `event_type = adult_transition`
- mit Datum
- altem Zustand
- neuem Zustand

## Kartenwechsel

Auch Kartenwechsel duerfen nicht nur den aktuellen Wert ueberschreiben.

Beispiele:

- von zwei Karten auf eine
- von einer Karte auf zwei
- Jugendkarte auf Erwachsenenkarte
- Zusatzkarte gekuendigt

Dafuer braucht es ebenfalls History:

- vorheriger Kartenstand
- neuer Kartenstand
- wirksam ab
- optional Grund / Notiz

## Warum das fuer CSV wichtig ist

Eine Import-CSV kann den **Startbestand** liefern:

- Stammdaten
- aktueller Status
- aktuelle Karten
- aktueller Mitgliedschaftstyp
- Eintrittsdatum

Aber:

- CSV allein ist kein gutes History-System
- spaetere Aenderungen muessen als fachliche Events gespeichert werden

Deshalb gilt:

- CSV = Initialdaten / Massenimport
- Registry = operative Pflege
- History = fachliche Nachvollziehbarkeit

## Konsequenz fuer die Mitglieder-Registry

Die Registry sollte kuenftig nicht nur Stammdaten bearbeiten, sondern auch kontrolliert History erzeugen.

Das bedeutet:

### Direkt editierbar im Stammsatz

- Name
- Vorname
- E-Mail
- Adresse
- Telefon
- Mobil
- Geburtstag
- Rolle

### Nicht nur stumpf ueberschreiben, sondern History-ausloesend

- Status
- Karten / Angelberechtigungen
- Mitgliedschaftstyp
- Eintritt / Austritt / Wiederaufnahme
- Jugend -> Erwachsen

## Empfohlene UI-Regel

In der Mitglieder-Registry sollte es kuenftig zwei Bearbeitungsarten geben:

1. **Stammdaten bearbeiten**
2. **Mitgliedschaft aendern**

`Mitgliedschaft aendern` sollte kein normales Textfeld-Edit sein, sondern ein gefuehrter Change-Flow:

- wirksam ab
- alter Zustand
- neuer Zustand
- optional Grund / Notiz

Dadurch entsteht automatisch ein History-Eintrag.

## Mindest-Soll fuer die Plattform

Damit die Plattform fachlich tragfaehig wird, brauchen wir mittelfristig:

- ein Feld `join_date` oder ein ableitbares Eintrittsdatum aus History
- eine `member_membership_history` oder gleichwertige Verlaufstabelle
- eine Karten-History oder ein History-Feld fuer Kartenwechsel
- einen fachlichen Uebergang Jugend -> Erwachsen
- Auswertbarkeit fuer:
  - Ehrungen
  - Vereinszugehoerigkeit
  - Statusphasen
  - Kartenwechsel

## Klare Schlussfolgerung

Der aktuelle Mitgliedersatz allein reicht **nicht** fuer saubere Vereinsverwaltung.

Er ist nur der aktuelle Schnappschuss.

Wenn wir:

- Statuswechsel
- Kartenwechsel
- Jugend-Erwachsen-Uebergaenge
- Vereinszugehoerigkeit
- Ehrungen

wirklich sauber abbilden wollen, brauchen wir eine eigenstaendige Mitgliedschafts-History.

Ohne diese History verlieren wir bei jeder Aenderung genau die Informationen, die spaeter fachlich wichtig werden.
