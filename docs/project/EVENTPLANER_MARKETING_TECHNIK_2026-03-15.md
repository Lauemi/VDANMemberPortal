# Eventplaner und Freigabecenter

Stand: 2026-03-18

## Zweck

Dieses Dokument bündelt die Marketing- und technischen Unterlagen für den Eventplaner im Mitgliederportal.

Ziel ist eine einheitliche Grundlage für:

- Geschäftsführung / CTO / CXO
- Design / UX
- Entwicklung
- internes Produktmarketing

---

# 1. Marketing-Unterlagen

## 1.1 Produktidee

Der Eventplaner ist die zentrale Arbeitsoberfläche für:

- Termine
- Arbeitseinsätze
- Helferplanung
- Freigaben

Statt mehrerer verteilter Cockpits entsteht ein zusammenhängender Verwaltungs-Workflow innerhalb einer Oberfläche.

Leitidee:

> Nicht mehr UI, sondern weniger Reibung.

## 1.2 Kundennutzen

Der größte Nutzen liegt in der Vereinfachung des Tagesgeschäfts.

Vorstand, Admins und Organisatoren sollen:

- Veranstaltungen direkt in einer Tabelle anlegen
- pro Zeile Helfer planen
- Freigaben im selben Modul bearbeiten
- keine Seitenwechsel zwischen mehreren Cockpits mehr brauchen

Das Produktgefühl soll sein:

- direkt
- professionell
- ruhig
- tabellarisch
- verwaltungsnah

Nicht gewünscht:

- Karten-UX
- Formular-Workspaces
- überladene Konfigurationsflächen

## 1.3 Positionierung

Der Eventplaner ist kein dekoratives Zusatzmodul, sondern eine operative Schaltzentrale.

Vergleichbares UX-Muster:

- Airtable
- Notion Tabellen
- Linear
- Admin-Oberflächen mit Master-Detail-Tabellen

Die Stärke ist nicht visuelle Komplexität, sondern Arbeitsfluss.

## 1.4 Kernaussage für interne Kommunikation

Der Eventplaner ersetzt mittelfristig getrennte Cockpits für:

- Termine
- Arbeitseinsätze
- Helferplanung
- Freigabeprozesse

Damit sinken:

- Einarbeitungsaufwand
- Klickwege
- Medienbrüche
- doppelte Pflege
- Abstimmungschaos zwischen Zusage, Helferbedarf und Freigabe

## 1.5 One-Liner

> Der Eventplaner ist die zentrale Tabellenoberfläche für Veranstaltung, Helferplanung und Freigaben im Vereinsportal.

## 1.6 Aktueller Vermarktungsstand

Aus heutiger Sicht kann der Eventplaner nicht mehr nur als Konzept beschrieben werden, sondern als bereits im Portal sichtbare operative Oberfläche mit:

- Manager-Board unter `/app/eventplaner/`
- Mitgliederansicht unter `/app/eventplaner/mitmachen/`
- gemeinsamer Tabelle `Termine / Events` unter `/app/arbeitseinsaetze/`
- Jugend-/Terminoberflächen im öffentlichen Bereich

Damit ist die Story für Marketing belastbarer:

- Planung und Teilnahme sind im selben Produktfeld sichtbar
- Mitglieder und Vorstand sehen unterschiedliche, aber zusammenhängende Pfade
- die Governance- und Rechtebasis ist im Admin-Panel und in Supabase technisch verankert

---

# 2. UX- und Produktprinzipien

## 2.1 Hauptprinzip

Planung erfolgt direkt in Tabellenzeilen, nicht in Formularmasken.

## 2.2 Zielstruktur

### Planungstabelle

Obere Haupttabelle mit Einträgen für:

- Termine
- Arbeitseinsätze

Spaltenbild:

- Datum
- Zeit
- Titel
- Bedarf
- Angemeldet
- Helfer

Interaktion:

- Klick auf Zeile öffnet Detailbereich
- Button `Helfer` bleibt als sekundäre explizite Aktion sichtbar
- roter Mülleimer direkt daneben für Löschen

### Untertabelle je Eintrag

Direkt unter der Zeile:

- Aufgabe
- Datum
- von
- bis
- Helfer
- Hinweis
- Aktionen

Ziel:

- wie optimiertes Excel
- kompakt
- zeilenorientiert
- keine Kartenoptik

### Freigabecenter

Zwei gleich aufgebaute Tabellen:

1. Offene Freigaben
2. Freigegebene

Die zweite Tabelle ist per Akkordeon eingeklappt.

Beide Tabellen zeigen denselben Grundaufbau und denselben Detail-Mechanismus.

## 2.3 Gestaltungsregeln

- Eingabezeilen dürfen nicht wie Formulare wirken
- neue Zeilen bleiben spaltenbasiert
- Meta-Felder nur sekundär
- Freigaben und Minuten direkt im Kontext der Zeile
- Status visuell klar:
  - grün = aktiv / freigegeben
  - rot = gegangen / abgelehnt / beendet je Kontext

---

# 3. Technische Unterlagen

## 3.1 Relevante Frontend-Dateien

### Seiten

- `src/pages/app/eventplaner/index.astro`
- `src/pages/app/eventplaner/mitmachen.astro`
- `src/pages/app/arbeitseinsaetze/index.astro`
- `src/pages/termine.html.astro`
- `src/pages/vdan-jugend.html.astro`

### Logik

- `public/js/event-planner-board.js`
- `public/js/event-planner-member.js`
- `public/js/events-overview.js`
- `public/js/home-feed.js`
- `public/js/admin-board.js`

### Styling

- `src/styles/app-shell.css`

### Referenzen / Altmodule

- `public/js/term-events-cockpit.js`
- `public/js/work-events-cockpit.js`

## 3.2 Aktueller technischer Scope

Der Eventplaner deckt bereits folgende Kernbereiche ab:

- Kalenderansicht
- Planungstabelle für Termine und Arbeitseinsätze
- Inline-Erfassung neuer Basisobjekte
- Helferplanung über aufklappbare Untertabellen
- Freigabecenter mit offenen und freigegebenen Einträgen
- Minutenfreigabe bei Arbeitseinsätzen
- Mitgliederzusage im einfachen Modus
- Mitgliederansicht für Eventplaner unter eigenem Usecase
- Sichtbarkeit im Admin-Board / Governance-Katalog
- gemeinsame Übersichtsseite `Termine / Events`

## 3.3 Datenquellen

### Basisobjekte

- `public.club_events`
- `public.work_events`

### Planungsschicht

- `public.event_planner_configs`
- `public.event_planner_slots`
- `public.event_planner_registrations`

### Freigabe / Teilnahme

- `public.work_participations`
- `public.member_notifications`

## 3.4 Relevante RPCs / Write Paths

### Eventplaner

- `event_planner_upsert_for_base`
- `event_planner_slot_upsert`
- `event_planner_slot_delete`
- `event_planner_registration_approve`
- `event_planner_registration_reject`

### Termine

- `term_event_create`
- direkter `PATCH` / `DELETE` auf `club_events`

### Arbeitseinsätze

- `work_event_create`
- `work_approve`
- `work_reject`
- direkter `PATCH` / `DELETE` auf `work_events`

### Governance / Freischaltung

- Persistenz über `module_catalog`
- Persistenz über `module_usecases`
- Club-Aktivierung über `club_module_usecases`
- ACL über `club_role_permissions`
- Migration: `supabase/migrations/20260318121500_eventplaner_governance_alignment.sql`

## 3.5 Freigabelogik

### Events

Events laufen über die Eventplaner-Registrierungen.

Statusfluss typischerweise:

- `pending`
- `approved`
- `rejected`

### Arbeitseinsätze

Arbeitseinsätze laufen über `work_participations`.

Typische Status:

- `registered`
- `checked_in`
- `submitted`
- `approved`
- `rejected`
- `no_show`

Zusatzfelder:

- `checkin_at`
- `checkout_at`
- `minutes_reported`
- `minutes_approved`

## 3.6 Gelöste UX-/Technikpunkte

Bereits umgesetzt oder angelegt:

- kompaktere Inline-Neuzeile
- getrennte Startaktionen für Termin und Arbeitseinsatz
- Jugend-Checkbox beim Termin-Anlegen
- Symbolik für Speichern / Abbrechen
- roter Mülleimer direkt neben `Helfer`
- Freigabecenter mit zwei Tabellen
- grüner Haken für freigegebene Teilnehmer
- Minutenbearbeitung im Freigabecenter
- Eventplaner als echtes Modul im Admin-Panel ergänzt
- Eventplaner-Usecases im Governance-Katalog ergänzt
- Mitgliederpfad `eventplaner_mitmachen` mit eigener Rechtebasis ergänzt
- Übersichtsseite `Termine / Events` zeigt nur noch heutige und künftige Einträge
- Jugend-/Feedlogik zeigt Termine von heute noch an, ab morgen aber nicht mehr

## 3.7 Governance- und Betriebsstand

Der Eventplaner ist inzwischen nicht nur UI-seitig vorhanden, sondern auch governance-seitig sauber anschließbar.

Aktuell nachgezogen:

- Modul `eventplaner` im Admin-Panel-Katalog
- Usecases:
  - `eventplaner`
  - `eventplaner_mitmachen`
- ACL-Defaults für:
  - `member`
  - `vorstand`
  - `admin`
- Club-Seeding bei neuer Club-Anlage

Wichtig für Betrieb und Kommunikation:

- `member` darf die Mitgliederansicht nutzen, aber nicht das Planer-Board
- `vorstand` und `admin` erhalten den operativen Planungszugang
- damit ist der Rollenübergang fachlich und technisch sauber dokumentierbar

## 3.8 Offene technische Themen

Diese Punkte sind für eine vollständige Ablösung der Alt-Cockpits relevant:

1. Vollständige Delete-Sicherheit

- prüfen, welche FK-/RLS-Ketten beim Löschen von Basisobjekten greifen
- ggf. dedizierten Delete-RPC für Eventplaner-Basisobjekte einführen

2. Saubere Minutenpflege

- prüfen, ob `work_approve` dauerhaft auch für Minuten-Updates freigegebener Teilnahmen genutzt werden soll
- alternativ dedizierte Update-Funktion für Minuten einführen

3. Vollständige Parität zum Arbeitseinsatz-Cockpit

- Nachträge
- Leiter / Zuständigkeiten
- Massenfreigaben
- eventuelle Zusatzaktionen für Anwesenheitskorrekturen

4. Vollständige Parität zum Termin-Cockpit

- Statussteuerung
- Archivierung
- erweiterte Metadaten

5. Runtime-Verifikation nach Deployment

- Migration und Rechtepfade im Zielsystem live prüfen
- Admin-Panel gegen echten DB-Katalog gegenprüfen
- Eventplaner-Mitgliederzugang im Clubkontext live testen

## 3.9 Architekturentscheidung

Empfohlene Richtung:

Der Eventplaner bleibt die zentrale UI-Schicht über bestehenden Tabellen.

Das bedeutet:

- keine konkurrierende Event-Datenbanklogik
- keine doppelte Stammdatenhaltung
- zusätzliche Planungslogik nur als Erweiterungsschicht

Kurz:

> Basisobjekte bleiben Source of Truth, der Eventplaner orchestriert den Workflow darüber.

---

# 4. Empfohlene Roadmap

## Phase 1

- Planungstabelle weiter verdichten
- Delete-Flow absichern
- Freigabecenter stabilisieren
- Governance-/Admin-Panel-Parität live verifizieren

## Phase 2

- Cockpit-Funktionen vollständig in Eventplaner überführen
- Direktbearbeitung für Termine und Arbeitseinsätze abschließen
- Massenaktionen ergänzen
- Mitglieder-Gruppen/Aufgabenfluss vervollständigen

## Phase 3

- alte Cockpits deaktivieren oder nur noch als Fallback bereitstellen
- Navigation vereinfachen
- Eventplaner als Standard-Arbeitsoberfläche etablieren

---

# 5. Management-Fazit

Der Eventplaner ist produktstrategisch die richtige Richtung.

Er reduziert Komplexität nicht durch weniger Funktion, sondern durch:

- bessere Bündelung
- klarere Arbeitsabläufe
- weniger UI-Brüche
- weniger Modulwechsel

Wenn die letzten Altpfade aus Termine-/Arbeitseinsatz-Cockpit sauber übernommen werden, kann daraus die operative Hauptoberfläche des Portals werden.

Kurzfassung:

> Ein Modul, ein Tabellenworkflow, ein Freigabecenter, weniger Pflegeaufwand.

Ergänzung zum Stand 2026-03-18:

- Der Eventplaner ist jetzt nicht nur Produktidee, sondern technisch im Governance-Modell verankert.
- Die Mitgliederseite ist als eigener Usecase berücksichtigt.
- Die Terminlogik in Jugend- und Übersichtsflächen wurde auf "heute sichtbar, morgen raus" korrigiert.
- Das Admin-Panel zeigt den Bereich nun als echten Bestandteil des Modells statt als unsichtbaren Seitenrest.

---

# 6. Soll-Struktur Mitgliedszusage, Gruppen und Aufgaben

Stand: 2026-03-16

## 6.1 Zielbild

Die Mitgliederseite `Termine / Events` bleibt eine schlanke Uebersichts- und Reaktionsliste.

Sie beantwortet fuer Mitglieder nur:

- Was ist der Termin?
- Wann ist er?
- Wo ist er?
- Habe ich schon reagiert?
- Kann ich zusagen oder absagen?

Die Helfer- und Einsatzplanung bleibt dagegen eine organisatorische Schicht fuer Vorstand / Verein.

Kurz:

- Mitgliedersicht = Teilnahme und Aufgabenwahl
- Leitersicht = Bedarf, Planung, Umplanung, Freigabe

## 6.2 Interaktionsmodell in der Mitgliederseite

### Fall A: Event ohne Aufgaben

Klick auf Tabellenzeile:

- Detailbereich klappt unter der Zeile auf
- zeigt nur:
  - Status der eigenen Reaktion
  - Button `Zum Termin zusagen` oder `Zusage zuruecknehmen`

Das ist die einfache Teilnahme auf Event-Ebene.

### Fall B: Event mit Aufgaben

Klick auf Tabellenzeile:

- Detailbereich klappt unter der Zeile auf
- statt nur eines Buttons erscheint ein Container mit Akkordeons
- jedes Akkordeon steht fuer eine Gruppe
- innerhalb der Gruppe liegen die Aufgaben / Taetigkeiten
- pro Aufgabe kann das Mitglied zusagen oder absagen

Beispiel:

- Gruppe `Versorgung`
- Aufgaben:
  - Getraenkeausgabe
  - Kuchenstand
  - Grill

## 6.3 Begriffe und Datenebenen

### Basisobjekt

Bleibt unveraendert:

- `club_events`
- `work_events`

### Planungskonfiguration

Bleibt unveraendert:

- `event_planner_configs`

Diese Ebene sagt weiterhin:

- braucht das Event Planung?
- einfache oder strukturierte Planung?
- wie viele Personen werden benoetigt?
- manuelle oder automatische Freigabe?

### Aufgabe / Slot

Bleibt fachlich das eigentliche Buchungsobjekt:

- `event_planner_slots`

Ein Slot ist weiterhin:

- eine konkrete Aufgabe / Taetigkeit
- mit Titel
- mit Start und Ende
- mit benoetigten Personen

### Neue Ordnungsebene: Gruppe

Neu benoetigt wird eine sichtbare Gruppierung fuer Slots.

Empfehlung:

- `event_planner_slots.group_name text null`

Optional spaeter:

- `group_sort_order integer`

Damit bleiben wir technisch schlank:

- keine neue Tabelle noetig
- Gruppen sind zunaechst reine Darstellungs- und Ordnungslogik
- ein Slot gehoert genau zu einer Gruppe oder zu keiner Gruppe

Beispiel:

- `group_name = "Aufbau"`
- `group_name = "Versorgung"`
- `group_name = "Ordner"`

## 6.4 Buchungslogik

### Einfache Teilnahme

Wenn ein Event keine Slots hat oder `planning_mode = simple`:

- Registrierung erfolgt auf `event_planner_configs`
- `slot_id = null`

Bestehender Write Path:

- `event_planner_register`
- `event_planner_unregister`

### Aufgabenbezogene Teilnahme

Wenn ein Event strukturierte Planung mit Slots hat:

- Registrierung erfolgt auf einen konkreten Slot
- `slot_id != null`

Auch hier bleibt der bestehende Write Path gleich:

- `event_planner_register`
- `event_planner_unregister`

Der Unterschied ist nur:

- Mitglieder buchen dann nicht das Event pauschal
- sondern eine konkrete Aufgabe

## 6.5 Regel fuer Ueberschneidungen

Bei Zusage auf Aufgabenebene muss eine Ueberschneidungspruefung stattfinden.

Regel:

- ein Mitglied darf keine aktive Zusage fuer zwei Aufgaben mit ueberschneidendem Zeitfenster haben

Aktive Zusagen sind mindestens:

- `pending`
- `approved`

Die Pruefung muss gegen alle eigenen aktiven Registrierungen laufen.

Wenn eine Ueberschneidung erkannt wird:

- keine Buchung speichern
- klare Fehlermeldung anzeigen:
  - `Zusage überschneidet sich zeitlich mit einer bereits zugesagten Aufgabe`

Optional spaeter:

- Name der kollidierenden Aufgabe
- Datum / Uhrzeit der Kollision

Empfehlung:

- diese Logik in `event_planner_register` auf DB-Ebene absichern
- nicht nur im Frontend pruefen

## 6.6 Umplanung durch den Verein

Der Verein muss Mitglieder innerhalb einer Veranstaltung umplanen koennen.

Wichtige Restriktion:

- Umplanung nur in der Taetigkeit
- nicht in Datum
- nicht in Uhrzeit

Erlaubt:

- Wechsel von Aufgabe A zu Aufgabe B
- wenn `starts_at` und `ends_at` identisch sind

Nicht erlaubt:

- Wechsel in eine Aufgabe mit anderem Zeitfenster
- verdeckte Zeitverschiebung ohne aktive neue Zusage

## 6.7 Benachrichtigung bei Umplanung

Wenn der Verein ein Mitglied auf eine andere Aufgabe umsetzt, braucht es eine eigene Benachrichtigungsart.

Empfehlung:

- neuer Notification-Typ `activity_changed`

Inhalt:

- altes Event
- neue Taetigkeit
- Datum / Uhrzeit
- Hinweis, dass nur die Aufgabe geaendert wurde

Textbeispiel:

> Deine Tätigkeit wurde aktualisiert. Du bist jetzt für `Getränkeausgabe` eingeplant.

Das ist wichtig, damit Umplanung nicht still geschieht.

## 6.8 Empfohlene DB-Erweiterungen

Kleinste sinnvolle Erweiterung:

1. `event_planner_slots.group_name text`
2. optional `event_planner_slots.group_sort_order integer default 100`
3. neue RPC fuer Umplanung, z. B.:
   - `event_planner_registration_reassign_same_window`
4. Erweiterung von `event_planner_register` um Ueberschneidungspruefung
5. neuer Notification-Typ fuer Taetigkeitsaenderung

## 6.9 Empfohlene RPC-Verantwortung

### Bestehend weiterverwenden

- `event_planner_register`
- `event_planner_unregister`
- `event_planner_registration_approve`
- `event_planner_registration_reject`
- `event_planner_slot_upsert`

### Neu ergaenzen

#### `event_planner_registration_reassign_same_window`

Zweck:

- verschiebt bestehende Registrierung von Slot A auf Slot B

Serverpruefungen:

- gleicher `planner_config_id`
- altes und neues Zeitfenster identisch
- Zielslot existiert
- Zielslot noch zulaessig
- ausfuehrender User ist Vorstand / Admin im Club

Nebenwirkung:

- erzeugt Benachrichtigung `activity_changed`

## 6.10 UI-Soll fuer Mitglieder

### Tabelle `Termine / Events`

Bleibt kompakt.

Klick auf Zeile:

- ohne Aufgaben:
  - nur Zusagebereich
- mit Aufgaben:
  - Gruppen-Akkordeons
  - darin Aufgabenliste
  - Zusagen / Absagen direkt an der Aufgabe

Wichtig:

- keine Dialogpflicht
- keine zweite Maske
- alles inline unter der Tabellenzeile

## 6.11 UI-Soll fuer Verein / Eventplaner

Im Eventplaner bleibt die Planungsansicht die operative Steuerungsflaeche.

Zusaetzlich kommt dort spaeter:

- Gruppennamen pflegen
- Aufgaben einer Gruppe zuordnen
- Mitglieder zwischen Aufgaben umsetzen
- nur gleiche Zeitfenster fuer Umplanung erlauben

Die Leitersicht beantwortet dann:

- wie viele Zusagen gibt es?
- auf welche Gruppen verteilt?
- wo fehlt noch Personal?
- wen kann ich innerhalb desselben Fensters umsetzen?

## 6.12 Implementierungsreihenfolge

Empfohlene Reihenfolge:

1. `group_name` an Slots ergaenzen
2. Mitgliederansicht fuer strukturierte Events auf Gruppen-Akkordeons umstellen
3. Ueberschneidungspruefung in `event_planner_register`
4. Admin-Umplanung innerhalb gleicher Zeitfenster einfuehren
5. Notification `activity_changed` ergaenzen

## 6.13 Architekturentscheidung

Wichtig:

- keine zweite Teilnehmerdatenbank
- keine zweite Eventlogik
- keine Trennung zwischen "Mitglieder-Zusage-System" und "Planungssystem"

Stattdessen:

- ein Basisobjekt
- eine Planungslogik
- zwei Sichten darauf

Kurz:

> Mitglieder reagieren einfach. Der Verein plant strukturiert. Beides basiert auf denselben Registrierungen.

## 6.14 Kapazitaet und Vorstand mitzaehlen

### Event-Ebene

Im Erfassungsbereich fuer Termin oder Arbeitseinsatz wird der bisherige numerische Bedarf um eine fachliche Bedeutung ergaenzt.

Unterhalb des Zahlenfeldes `Bedarf` kommt eine Checkbox:

- `Max Teilnehmer`

Bedeutung:

- `false` = Bedarf ist nur ein Sollwert / Indikator
- `true` = Bedarf ist eine harte Obergrenze

Technische Empfehlung:

- `event_planner_configs.max_participants_enabled boolean default false`

Die harte Blockade bei Zusagen greift nur, wenn dieses Feld aktiv ist.

### Helfer-/Aufgaben-Ebene

In jeder Helferzeile bzw. jedem Slot wird das Zahlenfeld `Helfer` um eine zweite fachliche Regel ergaenzt.

Unterhalb des Zahlenfeldes `Helfer` kommt eine Checkbox:

- `Vorstand mitzaehlen`

Bedeutung:

- `false` = Rollen `admin` und `vorstand` reduzieren den offenen Helferbedarf nicht
- `true` = Rollen `admin` und `vorstand` zaehlen normal in die Bedarfsdeckung hinein

Technische Empfehlung:

- `event_planner_slots.leaders_count_towards_capacity boolean default false`

Wichtig:

- die Registrierung des Vorstands bleibt bestehen
- es aendert sich nur die Deckungs- und Kapazitaetslogik

### Bestehende Projektlogik

Aktuell gilt bereits:

- Vorstand = Rolle `admin` oder `vorstand`
- belegte Kapazitaet = `pending + approved`

Diese Regeln bleiben Grundlage fuer die Erweiterung.
