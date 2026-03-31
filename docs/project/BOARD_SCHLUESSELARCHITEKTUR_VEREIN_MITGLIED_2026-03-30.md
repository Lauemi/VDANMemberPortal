# BOARD: Schlüsselarchitektur Verein und Mitglied

Stand: 2026-03-30

## Ziel

Die Vereins- und Mitgliedsidentität wird technisch strikt von den sichtbaren Kurzkennungen getrennt. Dadurch bleiben RLS, Datenintegrität und Betriebsfähigkeit stabil, auch wenn Vereine ihren sichtbaren Code später ändern.

## Verbindliche Schlüsselreihenfolge

### 1. Verein: `club_id`

- `club_id` ist die PPUID des Vereins.
- `club_id` ist global eindeutig.
- `club_id` ist unveränderlich.
- `club_id` ist der technische Primäranker für alle Relationen, Policies und Rechte.
- `club_id` darf niemals an ein einzelnes User-Konto gebunden sein.

### 2. Verein: `club_code`

- `club_code` ist der sichtbare Vereins-Kurzcode.
- `club_code` ist global eindeutig.
- `club_code` besteht aus genau 4 alphanumerischen Zeichen.
- Der Code muss mindestens 2 Buchstaben und 2 Ziffern enthalten.
- Gültige Beispiele: `VD01`, `AA03`, `V0D1`
- `club_code` ist änderbar durch berechtigte Vereinsadmins.
- `club_code` ist der kommunikative Zweitschlüssel, nicht der technische Primäranker.

### 3. Mitglied: `member_no`

- `member_no` ist die interne, stabile, unveränderliche Mitglieds-ID.
- `member_no` dient der technischen Verknüpfung innerhalb des Vereinskontexts.
- `member_no` ist nicht für die Vereinskommunikation gedacht.
- `member_no` darf sich nach Anlage nicht mehr ändern.

### 4. Mitglied: `club_member_no`

- `club_member_no` ist die sichtbare Vereins-Mitgliedsnummer.
- `club_member_no` wird durch den Verein vergeben oder gepflegt.
- `club_member_no` ist innerhalb eines Vereins eindeutig.
- Der Unique Key lautet fachlich: `(club_id, club_member_no)`.
- `club_member_no` ist änderbar, solange die Eindeutigkeit im Verein erhalten bleibt.

## Verbindliche Architekturregeln

### RLS und Relationen

- Alle fachlichen und technischen Relationen laufen über `club_id`.
- Keine RLS-Regel darf sich primär auf `club_code` verlassen.
- `club_code` darf für Lookup, Kommunikation und UX genutzt werden, nicht für die eigentliche Isolation.

### Mitgliedsverknüpfungen

- Interne Verknüpfungen laufen über stabile IDs.
- Sichtbare Vereinsnummern dürfen nie der alleinige technische Anker für Identität oder Berechtigung sein.
- `club_member_no` ist Vereinslogik, nicht Systemlogik.

### QR, Invite und Login

- QR- und Invite-Flows dürfen `club_code` für Kommunikation und Einstieg nutzen.
- Die endgültige Auflösung muss intern immer auf `club_id` und interne Mitgliedsidentität gehen.
- Eine Änderung des `club_code` darf laufende Zugangs- und Rechteketten nicht brechen.

## Folge für Club-Code-Änderungen

Wenn ein Verein seinen `club_code` ändert, gilt:

- die Vereinsidentität bleibt unverändert, weil `club_id` konstant bleibt
- neue QR-Links, Invite-Links und sichtbare Anzeigen verwenden den neuen `club_code`
- RLS, Mitgliedsidentitäten und Rechte bleiben stabil
- das Mapping `club_code -> club_id` muss atomar aktualisiert werden
- Alt-Codes dürfen nicht zu stillen Inkonsistenzen führen

## Folge für Mitgliedsanlage

Bei neuen Mitgliedern gilt verbindlich:

- `member_no` ist die interne System-ID
- `club_member_no` ist die sichtbare Vereinsnummer
- `club_member_no` darf nicht automatisch mit `club_code + laufende Nummer` gleichgesetzt werden
- Wenn der Verein keine sichtbare Nummer vorgibt, wird nur die vereinsinterne Nummer generiert, z. B. `0004`
- Der sichtbare Wert darf nicht automatisch `VD01-0004` oder `AA03-0004` werden

## Warum diese Trennung notwendig ist

Diese Trennung löst drei Kernprobleme:

1. RLS-Sicherheit

- Rechte und Isolation hängen an der unveränderlichen Vereinsidentität `club_id`
- nicht an einem später änderbaren Kurzcode

2. Betriebsfähigkeit

- Vereine können mit kurzen Codes wie `VD01` oder `AA03` kommunizieren
- Fehler, Support und Debugging bleiben alltagstauglich

3. Datenstabilität bei Änderungen

- Änderungen an Vereinscode oder sichtbarer Mitgliedsnummer brechen keine technischen Beziehungen
- QR, Einladungen, Termine, Gewässer, Helfereinsätze, Arbeitsstunden, Fanglisten und Rechte bleiben stabil

## Geltung für weitere Fachbereiche

Die Trennung gilt nicht nur für Mitglieder, sondern für alle vereinsbezogenen Fachobjekte, insbesondere:

- Termine
- Helfer-Events
- Arbeitsstunden
- Mitgliedsdaten
- Fanglisten
- Gewässer
- Gewässerrechte
- Rollen und Berechtigungen

In allen diesen Bereichen bleibt `club_id` der echte technische Vereinsanker.

## Technische Leitlinie für die Umsetzung

### Zwingend

- `club_id` bleibt Primary Tenant Anchor
- `club_code` bleibt global unique, aber änderbar
- `member_no` bleibt intern und unveränderlich
- `club_member_no` bleibt sichtbar und unique je Verein

### Nicht mehr zulässig

- Vermischung von `club_code` und sichtbarer Mitgliedsnummer in einem einzigen operativen Feld
- RLS- oder Join-Logik, die primaer auf `club_code` basiert
- automatische Gleichsetzung von interner `member_no` und sichtbarer `club_member_no`

## Board-Entscheidung

Das Projekt richtet die Vereins- und Mitgliedsidentität verbindlich auf folgendes Modell aus:

- `club_id` = absolute, unveränderliche Vereins-PPUID
- `club_code` = global eindeutiger 4-stelliger Vereins-Kurzcode
- `member_no` = interne, stabile Mitglieds-ID
- `club_member_no` = sichtbare vereinsinterne Mitgliedsnummer

Damit wird die Plattform:

- tenant-stabil
- RLS-sicher
- supportfähig
- änderungsfest bei späteren Code- und Nummernwechseln
