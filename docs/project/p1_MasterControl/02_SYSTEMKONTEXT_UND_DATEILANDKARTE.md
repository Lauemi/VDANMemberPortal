# Project One — Systemkontext und Dateilandkarte

## Zweck dieser Datei

Diese Datei ist die **Orientierungskarte** für Project One / MasterControl.

Sie beantwortet für jede KI und jeden Operator die zentralen Fragen:

- **Welche Dateien gehören zum MasterControl-System?**
- **Welche Datei ist wofür zuständig?**
- **Welche JSON-Artefakte sind die Board-Wahrheit?**
- **Welche UI-Dateien rendern das Board?**
- **Welche Dateien steuern Drawer, Legende, Filter und Aktionen?**
- **Welche Relationen müssen bei Änderungen mitgedacht werden?**
- **Welche Änderungen sind lokal und welche wirken systemisch?**

Diese Datei ist nicht nur Doku, sondern Arbeitsgrundlage.

---

## Systemdefinition

MasterControl ist kein einzelnes File.

MasterControl ist ein **zusammengesetztes System** aus:

1. **Board-Wahrheit**
2. **Process-Control-Wahrheit**
3. **UI-Renderer / Page / Drawer / Aktionen**
4. **DB-/RPC-Anbindung**
5. **Projekt- und Änderungsdokumentation**

Eine Änderung an nur einer Stelle kann fachlich falsch sein, wenn die anderen Ebenen nicht mitgezogen werden.

---

## Die fünf Ebenen von MasterControl

## 1. Board-Wahrheit

Diese Dateien beschreiben den offiziellen fachlichen Zustand des Systems.

### Relevante Dateien

```text
/docs/FCP_company/fcp_masterboard_state.json
/docs/FCP_company/fcp_process_control_state.json
```

### Rolle

#### `fcp_masterboard_state.json`
Beschreibt die **strategischen / größeren Knoten**.

Typische Inhalte:

- Node-ID
- Titel
- Lane / Ebene
- Status
- Risiko
- Launch-Klasse
- last_verified_at
- progress_visible
- progress_invisible
- gaps
- decisions_open
- refs

#### `fcp_process_control_state.json`
Beschreibt die **operative Kontrollsicht**.

Typische Inhalte:

- Prozesse
- Screens
- Smoke Checks
- Bugs
- Review Notes
- last_reviewed_at
- Status pro Prozess

### Wichtiger Grundsatz

Diese beiden JSON-Dateien sind keine Dekoration.

Sie sind die **sichtbare Kontrollwahrheit**.

Wenn UI, Repo oder DB sich ändern, diese Dateien aber nicht angepasst werden, ist MasterControl fachlich falsch.

---

## 2. UI-/Darstellungsebene

Hier lebt die konkrete Bedienoberfläche.

### Relevante Bereiche

Die genaue aktuelle Datei-Zuordnung ist im Repo bei jeder Analyse gegen den Ist-Stand zu prüfen. Typischerweise gehören hierzu:

```text
/src/pages/... Masterboard-/Board-Seiten
/public/js/... Board-Logik, Drawer-Logik, Filter-/Action-Handling
/public/css/... Board-/Drawer-/Masken-Styling
/docs/masks/... falls QFM-/ADM-Definitionen beteiligt sind
```

### Typische Verantwortlichkeiten

#### Page-Datei / Route
Verantwortlich für:

- Einstiegspunkt
- Aufbau der Seite
- Mounten des Boards
- Container / Shell
- ggf. Übergabe von JSON / Runtime-Daten

#### JS-Datei für Board-Logik
Verantwortlich für:

- Laden der Knoten
- Rendering der Karten / Gruppen / Spalten
- Symbolik
- Legende
- Drawer öffnen
- Action-Handling
- Filter / Sortierung / Gruppierung
- Weiterleitung in Spezialmasken

#### Drawer-/Editor-Logik
Verantwortlich für:

- Bearbeitbarkeit einzelner Knoten
- Lesen / Schreiben der Felder
- sinnvolle UI-Gruppierung
- Validierung
- Speichern / Sync in DB oder JSON-Pfaden

#### CSS-Datei
Verantwortlich für:

- Verständlichkeit der Oberfläche
- visuelle Hierarchie
- Status-/Risiko-/Warn-Logik
- Lesbarkeit des Drawers
- klare Handlungsführung

---

## 3. Daten- und Anbindungsebene

MasterControl kann Daten lokal, aus JSON oder aus DB-/RPC-Kontexten beziehen.

### Relevante Wahrheitsebenen

#### JSON als Board-Wahrheit
Die beiden JSON-Dateien in `/docs/FCP_company/` sind die sichtbare Kontrollbasis.

#### DB-/RPC-Wahrheit
Wenn MasterControl live mit DB-Informationen arbeitet, müssen auch folgende Dinge bekannt und mitgedacht werden:

- verwendete RPCs
- Edge Functions
- DB-Tabellen
- Status- und Snapshot-Routen
- Review-/Sync-Routinen

### Typische Beispiele aus dem aktuellen Umfeld

- Masterboard-/Process-Control-Read-RPCs
- Seed-/Sync-RPCs
- Status-/Snapshot-RPCs
- ggf. Admin-/Control-Reads

### Wichtig

MasterControl darf nie so wirken, als wäre die UI selbst die Wahrheit.

Die UI ist Darstellung und Bedienung.

Die Wahrheit kann je nach Bereich liegen in:

- JSON
- DB
- RPC
- Edge Function
- kombinierter Kontrolllogik

---

## 4. Projekt- und Dokumentationsebene

Dieser Ordner ist die Replikations- und Steuerungsebene für Project One.

### Ordner

```text
/docs/project/p1_MasterControl/
```

### Rolle des Ordners

Hier liegt nicht Repo-Ballast, sondern das reproduzierbare Projektwissen:

- Zielbild
- Systemkontext
- Änderungsregeln
- Ist-Analyse
- Soll-Architektur
- UI-Konzept
- Relationen
- Umsetzungspakete
- Richtungsänderungen
- Begründungen
- Versionierung

Wenn dieser Ordner sauber gepflegt ist, kann eine KI das Projekt später erneut aufbauen.

---

## 5. Operative Koppelstellen

MasterControl steht nicht isoliert.

Es ist gekoppelt an andere Bereiche.

### Fachliche Koppelstellen

- Onboarding
- Login / Auth / Portal Access
- Billing
- Cards / Pricing
- CSV / Mitgliederverwaltung
- Process-Control
- Board-/Status-RPCs

### UI-Koppelstellen

- Spezialmasken
- Drawer-Folgemasken
- Prozessdetailansichten
- Dateikontext / Auswirkungsansicht
- Smoke-Check-Oberflächen

### Technische Koppelstellen

- JSON-Artefakte
- Page-Dateien
- JS-Controller
- CSS
- RPCs
- ggf. Supabase Functions

---

## Dateirollen — Was ist bei Änderungen zu prüfen?

## A. Wenn `fcp_masterboard_state.json` geändert wird

Dann prüfen:

- Ist `fcp_process_control_state.json` ebenfalls betroffen?
- Muss die UI eine neue Gruppierung / Darstellung / Symbolik kennen?
- Müssen Drawer-Felder erweitert werden?
- Müssen Relationen zu Prozessen / Dateien / Flows ergänzt werden?

### Risiko
Nur den Board-Knoten zu ändern, ohne Process-Control und UI mitzudenken, erzeugt Scheinkonsistenz.

---

## B. Wenn `fcp_process_control_state.json` geändert wird

Dann prüfen:

- Ist der zugehörige Masterboard-Knoten ebenfalls betroffen?
- Ist eine Smoke-Check-Änderung nur lokal oder strategisch relevant?
- Muss die UI neue Stati / Bug-Arten / Kontrollsymbole verstehen?
- Ist die Änderung nur Text oder ändert sie echte Bedienlogik?

---

## C. Wenn Board-/Drawer-JS geändert wird

Dann prüfen:

- Muss `fcp_masterboard_state.json` aktualisiert werden?
- Muss `fcp_process_control_state.json` aktualisiert werden?
- Sind Symbolik / Legende / Priorisierung noch korrekt?
- Entsteht eine neue Relation oder eine neue Folgefläche?
- Reicht der Drawer noch, oder muss eine Spezialmaske vorgesehen werden?

---

## D. Wenn Page-/Maskenstruktur geändert wird

Dann prüfen:

- Welche Flows werden dadurch berührt?
- Welche Navigationspfade ändern sich?
- Werden bestehende Deep-Links / Bedienlogiken gebrochen?
- Muss MasterControl neue Zielmasken kennen?

---

## E. Wenn DB-/RPC-Anbindung geändert wird

Dann prüfen:

- Sind Board-/Process-Control-Aussagen noch wahr?
- Müssen Notes, Gaps oder Review Notes angepasst werden?
- Ist ein neuer Smoke Check nötig?
- Müssen Refs ergänzt werden?

---

## Pflichtdenken bei jeder Änderung

Jede KI muss vor einer Änderung immer diese fünf Fragen beantworten:

1. **Welche Datei ändere ich konkret?**
2. **Welche benachbarten Dateien hängen fachlich daran?**
3. **Welche JSON-Wahrheiten sind dadurch betroffen?**
4. **Welche UI-Folgeflächen entstehen?**
5. **Welche Dokumentation im p1_MasterControl-Ordner muss mitgezogen werden?**

Wenn diese Fragen nicht beantwortet werden, ist die Änderung unvollständig.

---

## Relationen, die immer mitgedacht werden müssen

## Board ↔ Process-Control

Ein Masterboard-Knoten ohne Prozessbezug ist oft unvollständig.

Ein Prozess ohne Masterboard-Einordnung ist oft strategisch blind.

## Board ↔ UI

Wenn das Board etwas anzeigt, die UI aber nicht bedienbar macht, entsteht ein Arbeitsbruch.

## Board ↔ Dateien

Ein Knoten muss perspektivisch nachvollziehbar zeigen können:

- welche Dateien betroffen sind,
- welche Dateien Referenzen sind,
- welche Dateien Folgeänderungen brauchen.

## Drawer ↔ Spezialmaske

Wenn ein Thema zu tief wird, muss ein definierter Übergang existieren.

## Änderung ↔ Dokumentation

Jede relevante Richtungsänderung muss in diesem Projektordner dokumentiert und begründet werden.

---

## Mindestanforderung an jede KI, die dieses Projekt liest

Eine KI, die an MasterControl arbeitet, muss automatisch verstehen:

- dass es hier um ein System und nicht nur um eine Datei geht,
- dass Board-JSON und Process-Control mitgeführt werden müssen,
- dass UI, Relationen und Folgeflächen Teil der Aufgabe sind,
- dass Änderungen dokumentiert und begründet werden müssen,
- dass Replikationsfähigkeit Ziel des Ordners ist.

---

## Was diese Datei noch NICHT leistet

Diese Datei beschreibt den Systemkontext.

Sie definiert noch nicht im Detail:

- die Soll-Architektur,
- die exakte UI-Struktur,
- die Prioritätslogik,
- die Drawer-/Workbench-Logik,
- die Spezialmasken,
- die Umsetzungspakete.

Das folgt in den nächsten Dateien.

---

## Ergebnis dieser Datei in einem Satz

Wer MasterControl ändert, ändert nie nur eine Oberfläche, sondern ein gekoppelte System aus Board-Wahrheit, Prozesskontrolle, UI, Relationen und Dokumentation.
