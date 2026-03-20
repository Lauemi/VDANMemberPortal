User:
`NEW -> AUTH -> NO_CLUB / SINGLE / MULTI`

Club:
`PENDING_SETUP -> PENDING_PAYMENT -> ACTIVE -> SUSPENDED`

Membership:
`INVITED -> ACTIVE -> BLOCKED`

Invite:
`ACTIVE -> USED / EXPIRED / REVOKED`

Subscription:
`NONE -> CHECKOUT_OPEN -> ACTIVE -> PAST_DUE / CANCELED`

Keine Abkuerzungen.

## Harte Begriffsdefinitionen

### User

- `NEW`
  Auth-Identitaet existiert noch nicht.

- `AUTH`
  User ist authentifiziert, aber fachlicher Club-Kontext ist noch nicht final fuer Routing aufgeloest.

- `NO_CLUB`
  User hat keinen aktiven, nutzbaren Club-Bezug in Rollen oder Membership.

- `SINGLE`
  User hat genau einen aktiven Club-Bezug oder einen explizit gewaehlten aktiven Club-Kontext.

- `MULTI`
  User hat mehrere aktive Club-Bezuege und muss vor fachlichen Club-Aktionen einen Kontext waehlen.

### Club

- `PENDING_SETUP`
  Club ist technisch angelegt, aber fachlich noch nicht betriebsfaehig.

- `PENDING_PAYMENT`
  Pflicht-Setup ist abgeschlossen, Billing-Aktivierung steht noch aus.

- `ACTIVE`
  Club ist fachlich betriebsfaehig und billingseitig serverseitig freigeschaltet.

- `SUSPENDED`
  Club war aktiv, ist aber aufgrund Billing oder Governance aktuell nicht nutzbar.

### Membership

- `INVITED`
  Ein gueltiger Invite existiert oder wurde erfolgreich validiert, aber der User ist noch nicht vollstaendig in Rollen und Mapping ueberfuehrt.

- `ACTIVE`
  User ist einem Club fachlich zugeordnet, Rollen sind gesetzt und der Club-Zugriff ist erlaubt.

- `BLOCKED`
  Die Club-Mitgliedschaft ist bewusst gesperrt und gewaehrt keinen normalen Zugriff.

### Invite

- `erstellt`
  Invite wurde erzeugt und gespeichert, ist aber fachlich nur dann verwendbar, wenn `status=ACTIVE`.

- `validiert`
  Token wurde geprueft und als aktuell nutzbar erkannt. Dies erzeugt noch keinen Membership-Endzustand.

- `genutzt`
  Ein authentifizierter User hat den Invite erfolgreich eingelost. Die Nutzungsverbuchung ist erfolgt.

- `ACTIVE`
  Invite darf verwendet werden.

- `USED`
  Invite wurde durch den konkreten User bereits wirksam verwendet.

- `EXPIRED`
  `expires_at` ist abgelaufen.

- `REVOKED`
  Invite wurde serverseitig deaktiviert.

### Billing

- `CHECKOUT_OPEN`
  Ein Checkout kann oder konnte abgeschlossen werden, aber noch kein gueltiges Aktivierungsereignis ist persistiert.

- `ACTIVE`
  Verifiziertes Billing erlaubt produktive Nutzung.

- `PAST_DUE`
  Billing hat ein Problem, der Club ist potenziell eingeschraenkt.

- `CANCELED`
  Abo ist final beendet.

### Betriebsfaehig

Ein Club gilt als `betriebsfaehig`, wenn:
- Stammdaten-Pflichtfelder vorhanden sind
- mindestens ein nutzbares Gewaesser vorhanden ist
- mindestens eine nutzbare Kartenregel oder Standardkarte vorliegt
- Mitgliederbasis entweder importiert oder bewusst initial leer bestaetigt ist
- Rollen, Module und ACL fuer den Club bestehen

`betriebsfaehig` ist nicht gleich `ACTIVE`.
`ACTIVE` erfordert zusaetzlich erfolgreiches Billing.
