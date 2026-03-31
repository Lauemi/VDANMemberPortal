# FCP CSV Onboarding – Architektur Review

Stand: 2026-03-31

## Zielbild

Ziel des MVP ist richtig gesetzt:

> CSV hochladen, kurz pruefen, Mapping bestaetigen, Verein ist arbeitsfaehig.

Wichtig dabei:

- kein Blind-Import
- keine sofortige n:m-Explosion
- kein Perfektionismus im MVP
- aber trotzdem ein fachlich sauberer und spaeter erweiterbarer Pfad

## Empfehlung in einem Satz

Fuer das MVP wuerde ich den Flow so bauen:

1. CSV im Frontend hochladen
2. CSV im Backend parsen und analysieren
3. Backend liefert ein `ImportPreviewDTO`
4. User mappt Rollen / Karten / Gewaesser in einer Preview-Maske
5. Backend importiert erst nach expliziter Bestaetigung

Also:

- Datei-Handling im Frontend
- Parsing, Normalisierung, Preview-Bildung und Write im Backend
- Mapping-Entscheidungen als expliziter DTO-Vertrag dazwischen

## 1. Architektur

### Empfehlung

Nicht komplett im Frontend bauen.

Auch wenn 100 bis 500 Zeilen technisch leicht im Browser zu parsen sind, spricht fuer Backend:

- einheitliche Validierung
- gleiche Regeln fuer spaetere Re-Imports
- saubere Auditierbarkeit
- keine divergierende Logik zwischen UI und Import
- bessere Wiederverwendbarkeit fuer spaetere Batch-/Async-Imports

### Saubere Struktur

Empfohlene Schichten:

1. `CSV Upload UI`
- Datei waehlen
- Separator erkennen oder vorgeben
- Upload starten

2. `CSV Parse Endpoint`
- liest Datei
- validiert Header
- wandelt Rohzeilen in `RawCsvRowDTO`

3. `Normalization Layer`
- trimmt
- normalisiert Leerzeichen
- erkennt Rollen/Karten/Gewaesser-Kandidaten
- erzeugt `ImportPreviewDTO`

4. `Preview / Mapping UI`
- zeigt Zahlen, Kandidaten, Konflikte
- erlaubt Zusammenfuehrung und Mapping

5. `Import Confirm Endpoint`
- bekommt bestaetigtes Mapping
- schreibt Mitglieder
- legt fehlende Rollen/Karten/Gewaesser kontrolliert an

### Empfohlene DTOs

```ts
type RawCsvRowDTO = {
  row_index: number;
  member_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  card_type: string;
  water: string;
  work_hours: string;
};
```

```ts
type NormalizedCsvRowDTO = {
  row_index: number;
  member_id_raw: string;
  member_id_norm: string;
  name_raw: string;
  name_norm: string;
  email_raw: string;
  email_norm: string;
  phone_raw: string;
  phone_norm: string;
  role_raw: string;
  role_norm: string;
  card_type_raw: string;
  card_type_norm: string;
  water_raw: string;
  water_norm: string;
  work_hours_raw: string;
  work_hours_norm: number | null;
  warnings: string[];
  errors: string[];
};
```

```ts
type ImportPreviewDTO = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  members_detected: number;
  role_candidates: Array<{ raw: string; normalized: string; count: number }>;
  card_candidates: Array<{ raw: string; normalized: string; count: number }>;
  water_candidates: Array<{ raw: string; normalized: string; count: number }>;
  duplicate_candidates: Array<{ key: string; row_indexes: number[]; reason: string }>;
  rows: NormalizedCsvRowDTO[];
};
```

```ts
type ImportMappingDTO = {
  role_mapping: Record<string, string>;
  card_mapping: Record<string, string>;
  water_mapping: Record<string, string>;
  duplicate_strategy: "skip" | "update" | "manual";
};
```

## 2. Matching / Normalisierung

### MVP

Fuer das MVP reicht:

- `trim`
- Mehrfach-Leerzeichen reduzieren
- `lowercase`
- Umlaute / Sonderzeichen optional vereinheitlichen

Beispiel:

- `"Rhein"` -> `rhein`
- `"Rhein "` -> `rhein`
- `"  Vorsitzender"` -> `vorsitzender`

Das reicht fuer den ersten Wurf erstaunlich weit.

### Was ich im MVP noch zusaetzlich machen wuerde

- Mehrfachspaces zusammenziehen
- Bindestriche / Unterstriche vereinheitlichen
- leere Strings zu `null`
- Email lowercase
- Telefonnummer grob normalisieren

### Fuzzy Matching?

Nicht als Pflicht im MVP.

Warum:

- erzeugt schnell falsche Automatismen
- ist fachlich schwer erklaerbar
- fuehrt zu Misstrauen im Mapping-Screen

Empfehlung:

- MVP: exact normalized matching
- optionaler spaeterer Komfortmodus:
  - Vorschlaege bei aehnlichen Werten
  - aber nie stillschweigend automatisch

Also:

- `trim + lowercase + whitespace-normalization` = ja
- Levenshtein/Fuzzy = spaeter, nur als Vorschlag

## 3. Datenmodell fuer MVP

### Ziel

`MEMBER -> CARD_TYPE -> WATER` abbilden, ohne die Datenbasis sofort unnoetig komplex zu machen.

### Empfehlung fuer MVP

#### Mitglieder

Ein Mitglied bekommt zunaechst:

- sichtbare CSV-Mitgliedsnummer
- Name
- Email
- Telefon
- Rolle
- einen aktuellen Kartentyp

#### Karten

`CARD_TYPE` nicht sofort als volle n:m-Historie.

Im MVP reicht:

- eine Liste erkannter Kartentypen pro Verein
- Mitglied hat genau **einen aktuellen Kartentyp**

Das passt auch zu eurem aktuellen Registry-Stand mit `fishing_card_type`.

#### Gewaesser

`WATER` ebenfalls zuerst als erkannte Vereinsentitaet:

- Liste erkannter Gewaesser
- optional spaeter Zuordnung Karte -> Gewaesser

### Wichtig

Ich wuerde im MVP **noch nicht** modellieren:

- mehrere Karten pro Mitglied
- mehrere Gewaesser pro Karte
- zeitliche Kartenhistorie

Das ist spaeter fachlich sinnvoll, aber fuer das Onboarding-MVP nicht noetig.

### MVP-Datenvereinfachung

- `member.role` = aktuelle Vereinsrolle
- `member.fishing_card_type` = aktueller Kartentyp
- `club_waters` = erkannte Gewaesserliste
- `club_cards` oder Workspace-Karten = erkannte Kartentypenliste

So bleibt der Verein arbeitsfaehig, ohne dass sofort das volle Beziehungsmodell gebaut werden muss.

## 4. Performance

### 100 bis 500 Zeilen

Synchron ist absolut ausreichend.

Das gilt fuer:

- Upload
- Parse
- Preview
- Mapping
- Confirm-Import

### Ab wann async sinnvoll wird

Nach meiner Einschaetzung erst bei:

- mehreren tausend Zeilen
- sehr vielen Kreuzvalidierungen
- Dateiimporten mit Medien / Anhängen
- mehreren Folgeprozessen nach dem Import

Fuer euer Ziel:

> Verein in wenigen Minuten arbeitsfaehig

ist `sync + preview + confirm` fuer 100 bis 500 Zeilen genau richtig.

## 5. Fehlerhandling / UX

Das darf den Flow nicht zerstoeren.

### Grundregel

Nicht den gesamten Import blockieren, nur weil einzelne Zeilen schlecht sind.

### Gute UX fuer MVP

Drei Ebenen:

1. **Fatal**
- falscher Header
- leere Datei
- unlesbare Datei

Dann Import abbrechen.

2. **Row Errors**
- Pflichtfeld fehlt
- Email ungueltig
- Mitgliedsnummer leer

Diese Zeilen im Preview rot markieren und standardmaessig nicht importieren.

3. **Warnings**
- unbekannte Rolle
- unbekannter Kartentyp
- unbekanntes Gewaesser
- doppelte plausible Mitglieder

Diese im Mapping-Screen loesbar machen.

### Konkrete UX-Empfehlung

Im Preview-Screen anzeigen:

- `423 Zeilen gelesen`
- `401 importierbar`
- `22 Zeilen brauchen Klärung`

Darunter Tabs oder Sektionen:

- Mitglieder
- Rollen
- Karten
- Gewaesser
- Konflikte

### Doppelte Mitglieder

Im MVP wuerde ich eine einfache Prioritaet nehmen:

1. `MEMBER_ID`
2. sonst `EMAIL`
3. sonst Hinweis auf manuellen Konflikt

Nicht im MVP:

- komplexes Personen-Merging
- automatische Dublettenintelligenz

## Risiken

Die groessten Risiken sind nicht Performance, sondern Fachlogik.

### 1. CSV ist fachlich zu arm

Eure V1-Struktur ist bewusst schlank, aber sie bildet noch nicht alles ab, was spaeter im Verein wichtig wird:

- Eintrittsdatum
- Adressdaten
- Statushistorie
- mehrere Karten
- Jugend/Erwachsen

Fuer den Start okay, aber man muss klar sagen:

- das ist ein **Arbeitsfaehig-in-Minuten-Import**
- kein vollstaendiger Vereinsdatenimport

### 2. Rollen werden zu frei erzeugt

Wenn jede CSV-Rolle blind als neue Rolle angelegt wird, zerfasert die ACL.

Deshalb im MVP:

- Rollenmapping auf bestehende Kernrollen
- neue Rollen nur bewusst bestaetigt anlegen

### 3. Gewaesser und Karten werden zu unkontrolliert vervielfacht

Deshalb:

- Kandidaten anzeigen
- Zusammenfuehrung vor Import
- erst nach Bestaetigung anlegen

### 4. Import wird spaeter zur fachlichen Quelle ueberdehnt

CSV-Onboarding ist nur der Einstieg.
Spaetere Aenderungen muessen ueber Registry und kuenftig ueber History laufen.

## Was ich im MVP konkret weglassen wuerde

Bewusst nicht reinnehmen:

- Fuzzy Matching als Automatismus
- mehrere Karten pro Mitglied
- mehrere Gewaesserbeziehungen pro Mitglied
- automatische Dublettenzusammenfuehrung
- Mitgliedschaftshistorie direkt im CSV-Onboarding
- automatische Jugend->Erwachsen-Logik im Import
- Beitragslogik
- Ehrungslogik
- SEPA-/IBAN-Import als Pflicht

## Was ich fuer V1 unbedingt drinlassen wuerde

- CSV Upload
- Header-Pruefung
- Parsing
- Preview
- Mapping fuer Rollen
- Mapping fuer Karten
- Mapping fuer Gewaesser
- Konfliktliste fuer Dubletten
- Import erst nach Bestaetigung
- Audit-Eintrag: wer hat wann welche CSV importiert

## Konkrete MVP-Empfehlung

### CSV V1

```csv
MEMBER_ID;NAME;EMAIL;PHONE;ROLE;CARD_TYPE;WATER;WORK_HOURS
```

### Interne fachliche Wirkung

- `MEMBER_ID` -> `club_member_no`
- `NAME` -> fuer MVP zunaechst `last_name` oder Split-Logik nur falls stabil definierbar
- `EMAIL` -> `email`
- `PHONE` -> `phone`
- `ROLE` -> Rollenmapping
- `CARD_TYPE` -> Kartenmapping
- `WATER` -> Gewaesserkandidat
- `WORK_HOURS` -> optional Vormerkung oder spaeteres Arbeitsstunden-Modul

### Wichtiger Hinweis zu `NAME`

Wenn nur ein einziges Feld `NAME` geliefert wird, ist das fachlich schwach.

Besser waere eigentlich schon fuer V1:

```csv
MEMBER_ID;FIRST_NAME;LAST_NAME;EMAIL;PHONE;ROLE;CARD_TYPE;WATER;WORK_HOURS
```

Wenn ihr bei `NAME` bleibt, braucht ihr fuer MVP eine klare Regel:

- entweder kompletter Name wird als Anzeige-/Nachname uebernommen
- oder Split nur bei eindeutigem Format

Meine Empfehlung:

- wenn moeglich direkt auf `FIRST_NAME` + `LAST_NAME` umstellen

## Empfohlene technische Umsetzung

### Backend Endpoints

- `csv_onboarding_preview`
- `csv_onboarding_confirm`

### Preview Output

- geparste Zeilen
- erkannte Entitaeten
- Mapping-Kandidaten
- Fehler/Warnungen

### Confirm Input

- bestaetigte Mappings
- Importmodus
- optional `skip_invalid_rows = true`

## Abschlussbewertung

Euer MVP ist richtig zugeschnitten, wenn ihr es so baut:

- **kein Blind-Import**
- **kein Vollmodell**
- **klare Preview**
- **explizites Mapping**
- **kontrollierter Confirm-Write**

Damit erreicht ihr genau das Ziel:

> Verein hochladen, kurz pruefen, bestaetigen, arbeitsfaehig sein.

Und gleichzeitig verbaut ihr euch die spaetere Erweiterung auf:

- vollstaendige Mitgliederdaten
- Mitgliedschaftshistorie
- Kartenhistorie
- komplexere Rollen- und Gewaesserlogik
