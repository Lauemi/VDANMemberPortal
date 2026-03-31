# Mitglieder Registry Feldmatrix

Stand: 2026-03-31

## Zweck

Diese Matrix definiert fuer die Mitglieder-Registry:

- welche Felder fachlich relevant sind
- welche Felder in der Registry sichtbar sein sollten
- welche Felder in der Registry editierbar sein sollen
- welche Felder fuer eine `Import.csv` sinnvoll sind
- welche Felder Pflicht, optional oder reine Systemfelder sind

Ziel:

- gleiche Sprache fuer UI, CSV-Import und Datenpflege
- keine Sonderlogik pro Maske
- saubere Stammdatenpflege pro Mitglied

## Kategorien

- `Pflicht`
  Ohne dieses Feld ist ein Mitglied fachlich unvollstaendig oder nicht sinnvoll nutzbar.
- `Optional`
  Feld ist sinnvoll und pflegbar, aber nicht fuer jedes Mitglied zwingend.
- `System`
  Feld wird technisch gebraucht oder abgeleitet, ist aber kein primaeres manuelles CSV-/Pflegefeld.

## Feldmatrix

| Feld | Bedeutung | In Registry sichtbar | In Registry editierbar | Fuer CSV sinnvoll | Kategorie | Hinweis |
| --- | --- | --- | --- | --- | --- | --- |
| `club_member_no` | Vereins-Mitgliedsnummer | Ja | Ja | Ja | Pflicht | Primaere sichtbare Mitgliedsnummer im Verein |
| `first_name` | Vorname | Ja | Ja | Ja | Pflicht | Kern-Stammdatum |
| `last_name` | Nachname | Ja | Ja | Ja | Pflicht | Kern-Stammdatum |
| `role` | Vereinsrolle | Ja | Ja | Ja | Pflicht | Abhaengig von `Rollen / Rechte`; mindestens `member`, ggf. `admin`, `vorstand`, weitere Rollen |
| `status` | Mitgliedsstatus | Ja | Ja | Ja | Pflicht | Z. B. `aktiv`, `passiv`, `inaktiv` |
| `email` | E-Mail-Adresse | Ja | Ja | Ja | Pflicht | Wichtig fuer Invite, Login, Kommunikation |
| `street` | Strasse / Hausnummer | Ja | Ja | Ja | Pflicht | Kern-Adressdatum |
| `zip` | Postleitzahl | Ja | Ja | Ja | Pflicht | Kern-Adressdatum |
| `city` | Ort | Ja | Ja | Ja | Pflicht | Kern-Adressdatum |
| `fishing_card_type` | aktuelle Angelkarte / Kartentyp | Ja | Ja | Ja | Pflicht | Solange noch keine vollstaendige Multi-Kartenlogik greift, ist dies das zentrale Kartenfeld |
| `phone` | Telefon Festnetz | Ja | Ja | Ja | Optional | Sinnvoll fuer Rueckfragen und Vereinsbetrieb |
| `mobile` | Mobilnummer | Ja | Ja | Ja | Optional | Fuer schnelle Kontaktaufnahme oft relevanter als Festnetz |
| `birthdate` | Geburtsdatum | Ja | Ja | Ja | Optional | Wichtig fuer Jugend-/Alterslogik |
| `guardian_member_no` | Bezugsperson / Erziehungsberechtigung | Ja | Ja | Ja | Optional | Relevant bei Jugendmitgliedern |
| `sepa_approved` | SEPA-Freigabe | Ja | Ja | Ja | Optional | Verwaltungsrelevant, aber nicht bei allen Vereinen sofort noetig |
| `iban_last4` | letzte 4 Stellen der IBAN | Ja | Eingeschraenkt | Eher nein | Optional | Eher Kontroll-/Abgleichfeld, keine vollstaendige Bankdatenpflege in CSV |
| `club_code` | Vereinscode | Ja | Nein | Optional | System | Anzeige-/Kontextfeld, nicht technischer Schluessel fuer Pflege |
| `member_no` | interne FCP-ID | Ja | Nein | Nein | System | Interne stabile technische ID, nicht die sichtbare CSV-Hauptnummer |
| `club_id` | technischer Vereinsanker | Optional | Nein | Nein | System | Tenant-Schluessel, kommt aus Kontext, nicht aus manueller Pflege |
| `login_dot` | Login vorhanden ja/nein | Ja | Nein | Nein | System | Abgeleitet aus Benutzer-/Login-Kontext |
| `last_sign_in_at` | letzter Loginzeitpunkt | Ja | Nein | Nein | System | Reines Anzeigefeld |

## Mindestumfang fuer saubere Vereins-Stammdaten

Ein Mitglied ist fachlich sauber eingepflegt, wenn mindestens diese Felder vorhanden sind:

- `club_member_no`
- `first_name`
- `last_name`
- `role`
- `status`
- `email`
- `street`
- `zip`
- `city`
- `fishing_card_type`

## Empfohlener CSV-Kernumfang

Fuer eine gute `Import.csv` sollte mindestens enthalten sein:

- `club_member_no`
- `first_name`
- `last_name`
- `role`
- `status`
- `email`
- `street`
- `zip`
- `city`
- `phone`
- `mobile`
- `birthdate`
- `guardian_member_no`
- `fishing_card_type`
- `sepa_approved`

## Nicht als primaere CSV-Pflegefelder verwenden

Diese Felder sollen nicht die fachliche Hauptquelle im Import sein:

- `member_no`
- `club_id`
- `login_dot`
- `last_sign_in_at`
- `club_code`

## Registry-Sollbild

Die Mitglieder-Registry soll mittelfristig alle fachlich relevanten Felder inline pflegbar machen, mindestens:

- Mitgliedsnummer
- Name
- Vorname
- Rolle
- Status
- E-Mail
- Strasse
- PLZ
- Ort
- Angelkarte / Kartentyp
- Telefon
- Mobil
- Geburtstag
- Bezugsperson
- SEPA

Systemfelder bleiben sichtbar, aber nicht frei editierbar:

- interne FCP-ID
- Club-ID
- Login-Status
- letzter Login

## Rollen-Sonderregel

Die Rollenanzeige in der Registry darf nicht nur den statischen Membership-Wert zeigen.

Sie muss fachlich wirksam aus dem Rollen-/Rechtesystem aufgeloest werden, insbesondere:

- `admin` muss als `admin` sichtbar sein
- `vorstand` muss als `vorstand` sichtbar sein
- `member` ist nur Fallback
- neue Rollen aus `Rollen / Rechte` muessen in der Registry waehlbar und sichtbar werden

## Naechster sinnvoller Folgeschritt

Auf Basis dieser Matrix sollte als naechstes eine `MITGLIEDER_IMPORT_CSV_SPEZIFIKATION.md` definiert werden mit:

- Spaltenname
- Datentyp
- Pflicht / Optional
- Beispielwert
- Validierungsregel
- Mapping auf Registry-Feld
