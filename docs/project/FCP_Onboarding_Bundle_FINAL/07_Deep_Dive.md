Kritisch:

Stripe:
- webhook only

Invite:
- idempotent

CSV:
- validation + errors

Multi-Club:
- Auswahl notwendig

## Stripe Deep Dive

### Ziel

Club-Aktivierung darf ausschliesslich serverseitig durch verifizierte Stripe-Webhooks erfolgen.

### Relevante Eventtypen

Mindestens zu beruecksichtigen:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- optional `invoice.paid`
- optional `invoice.payment_failed`

### Zu ignorierende Eventtypen

- alle Events ohne Club-Referenz
- Events ohne verifizierte Signatur
- Events, die keinen Zustandswechsel bewirken
- doppelte Events, die bereits verarbeitet wurden

### Zustandswirkung

- `checkout.session.completed`
  oeffnet noch nicht automatisch `ACTIVE`, wenn keine belastbare Subscription-Zuordnung vorliegt

- `customer.subscription.created` oder `updated`
  kann `PENDING_PAYMENT -> ACTIVE` ausloesen, wenn Status aktiv und Club sauber referenziert ist

- `invoice.payment_failed`
  kann `ACTIVE -> PAST_DUE` ausloesen

- `customer.subscription.deleted`
  fuehrt zu `CANCELED` oder `SUSPENDED`, je nach Geschaeftsentscheidung

### Persistenz aus Stripe

Zu speichern:
- `club_id`
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_checkout_session_id`
- externer Status
- interner Billing-State
- `current_period_end`
- `canceled_at`
- `last_webhook_event_id`
- `updated_at`

### Double-Webhook-Verhalten

- Webhook-Event-IDs werden dedupliziert.
- Wiederholte Events duerfen keine erneute Aktivierung oder Rueckstufung ausloesen.
- Verarbeitung muss idempotent sein.

### Checkout-Abbruch

- Abgebrochener Checkout aendert keinen Club-State.
- Club bleibt `PENDING_PAYMENT`.
- UI bietet Re-Checkout an.

### Retry / Re-Checkout

- Re-Checkout ist erlaubt, solange kein aktives Billing vorliegt.
- Alte offene Checkouts duerfen neue nicht unkontrolliert ueberschreiben.
- Der letzte gueltige serverseitig bestaetigte Zustand gewinnt.

## Invite Deep Dive

### Invite erstellen

- nur `admin` oder `vorstand` im Club
- generiert Zufallstoken
- speichert nur Token-Hash
- setzt `status=active`, `expires_at`, `max_uses`, `used_count`, `used_user_ids`

### Invite speichern

Heute im Bestand:
- `app_secure_settings`
- Key-Muster `club_invite_token:<hash>`
- aktiver Invite zusaetzlich ueber `club_invite_active:<club_id>`

### Invite validieren

- `club-invite-verify` ist read-only
- prueft:
  - Token vorhanden
  - Datensatz vorhanden
  - `status=active`
  - nicht abgelaufen
  - `used_count < max_uses`

### Invite akzeptieren

- User muss authentifiziert sein
- `club-invite-claim` ist der einzige gueltige Verbrauchspfad

### Invite verbrauchen

Reihenfolge:
1. Invite laden und validieren
2. Member-Nummer im Club aufloesen oder erzeugen
3. `club_member_identities` sicherstellen
4. `profiles` sicherstellen
5. `user_roles.member` und `club_user_roles.member` sicherstellen
6. Usage nur dann erhoehen, wenn User noch nicht verbucht war

### Verhalten bei bestehender Membership

- Wenn User bereits demselben Club zugeordnet ist, Erfolg idempotent zurueckgeben.
- Keine doppelte Rollenzuweisung, keine doppelte Usage-Erhoehung.

### Verhalten bei bestehendem User

- vorhandener User ist normalfallfaehig
- `profiles` werden nur ergaenzt, nicht neu erfunden

### Verhalten bei falscher Mail oder Mitgliedsnummer

- E-Mail ist fuer Invite-Claim derzeit nicht harter Primaerschluessel.
- Wenn Club bereits ein Mitgliederverzeichnis hat, muss `member_no` im Club existieren.
- Wenn Club noch kein Mitgliederverzeichnis hat, darf eine lokale Nummer erzeugt werden.

### Verhalten bei Ablauf waehrend des Prozesses

- vor jedem finalen Claim erneut auf Ablauf pruefen
- abgelaufene Invites fuehren zu keinem halbfertigen Zustand

## CSV-Import Deep Dive

### Zielobjekt

Primaeres Ziel fuer Onboarding-Import ist `public.club_members`.

### Pflichtspalten

- `first_name`
- `last_name`
- fuer bestehende Vereinsverzeichnisse: `member_no`

### Optionale Spalten

- `status`
- `membership_kind`
- `fishing_card_type`
- `role`
- `wiso_roles`
- weitere Vereinsspalten nur, wenn sauber gemappt

### Dublettenregeln

- `(club_id, member_no)` muss eindeutig sein
- gleiche `member_no` in anderem Club ist nur zulaessig, wenn das Zielmodell dies bewusst erlaubt; aktuell ist global bei `club_members.member_no` Vorsicht geboten
- doppelte Zeilen innerhalb derselben CSV muessen vor Import erkannt werden

### Teilimport

- Teilimport ist erlaubt und empfohlen
- gueltige Zeilen werden importiert
- fehlerhafte Zeilen werden reportet und nicht still verworfen

### Fehlerformat

Pro fehlerhafter Zeile mindestens:
- Zeilennummer
- Feldname
- Fehlercode
- lesbare Fehlermeldung
- Importstatus

### Rueckmeldung an Admin

Nach Import:
- Anzahl Gesamtzeilen
- Anzahl erfolgreich
- Anzahl uebersprungen
- Anzahl fehlerhaft
- exportierbare Fehlerliste

### Verhalten bei vorhandenen Usern

- Import erzeugt nicht automatisch immer einen App-User
- Import pflegt zunaechst das Vereinsverzeichnis
- Identity-Linking erfolgt spaeter ueber Invite, Matching oder Admin-Prozess

### Verhalten bei fehlender E-Mail

- kein Blocker fuer `club_members`
- Blocker nur dann, wenn ein User-Account unmittelbar erzeugt werden soll

### Verhalten bei doppelter Mitgliedsnummer

- innerhalb desselben Club-Imports blockierend
- bereits vorhandene Nummer im Zielclub:
  - entweder Update-Pfad
  - oder Fehler
- diese Entscheidung muss pro Importmodus explizit sein, Standard ist konservativ: Fehler statt stilles Ueberschreiben

## Edge-Case-Sammlung

### Invite wird angenommen, aber Membership existiert bereits

- Erwartetes Verhalten:
  Erfolg idempotent zurueckgeben.
- Schutz:
  Pruefung auf bestehende Rollen und `club_member_identities`.
- Endzustand:
  bestehende aktive Membership bleibt unveraendert.

### User hat schon einen Club und bekommt neuen Invite

- Erwartetes Verhalten:
  neuer Club-Bezug wird zusaetzlich angelegt.
- Schutz:
  keine Ueberschreibung von bestehendem `profiles.club_id` ohne klare Regel.
- Endzustand:
  User landet fachlich in `MULTI`, wenn mehr als ein aktiver Club besteht.

### Invite laeuft waehrend des Flows ab

- Erwartetes Verhalten:
  finaler Claim scheitert sauber.
- Schutz:
  Ablaufpruefung unmittelbar vor Persistenz.
- Endzustand:
  kein Rollen- oder Mapping-Leak.

### Invite doppelt geklickt oder doppelt abgesendet

- Erwartetes Verhalten:
  zweiter Versuch liefert denselben Erfolg oder einen kontrollierten no-op.
- Schutz:
  idempotenter Claim.
- Endzustand:
  kein doppeltes Counting.

### Stripe-Webhook kommt doppelt

- Erwartetes Verhalten:
  zweites Event ohne zusaetzliche Wirkung ignorieren.
- Schutz:
  Event-Dedupe.
- Endzustand:
  Status bleibt stabil.

### Stripe-Webhook kommt verspaetet

- Erwartetes Verhalten:
  Event nur anwenden, wenn es den aktuellen Zustand gueltig weiterentwickelt.
- Schutz:
  Status- und Zeitvergleich.
- Endzustand:
  kein Ruecksprung in alten Zustand.

### Checkout gestartet, aber nie abgeschlossen

- Erwartetes Verhalten:
  Club bleibt `PENDING_PAYMENT`.
- Schutz:
  keine Frontend-Aktivierung.
- Endzustand:
  Re-Checkout moeglich.

### Club angelegt, Payment nie finalisiert

- Erwartetes Verhalten:
  Setup bleibt erhalten, Produktivzugriff bleibt gesperrt.
- Schutz:
  Billing-Gate.
- Endzustand:
  `PENDING_PAYMENT`.

### Admin bricht Setup in Schritt 2 oder 3 ab und kommt spaeter zurueck

- Erwartetes Verhalten:
  Teilfortschritt bleibt erhalten.
- Schutz:
  modulare Persistenz statt Einmal-Submit.
- Endzustand:
  `PENDING_SETUP`.

### CSV-Import teilweise gueltig, teilweise fehlerhaft

- Erwartetes Verhalten:
  Teilimport mit Fehlerreport.
- Schutz:
  Zeilenweise Validierung.
- Endzustand:
  nur gueltige Datensaetze uebernommen.

### Zwei Admins bearbeiten Setup parallel

- Erwartetes Verhalten:
  letzter gueltiger Write gewinnt nur dort, wo keine Fachkollision entsteht.
- Schutz:
  serverseitige Validierung, moeglichst `updated_at`/Optimistic Locking fuer kritische Bereiche.
- Endzustand:
  konsistenter Setup-Stand.

### User hat mehrere Vereine und loggt sich normal ein

- Erwartetes Verhalten:
  Club-Auswahl erzwingen.
- Schutz:
  keine implizite Global-Freigabe.
- Endzustand:
  `MULTI` bis Auswahl.

### Club wird suspendiert, User hat noch aktive Session

- Erwartetes Verhalten:
  Session bleibt technisch vorhanden, Zugriff wird fachlich blockiert.
- Schutz:
  serverseitige Club-State-Pruefung.
- Endzustand:
  `SUSPENDED` sichtbar, keine produktive Bearbeitung.
