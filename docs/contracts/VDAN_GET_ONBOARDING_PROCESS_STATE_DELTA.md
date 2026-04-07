# VDAN Get Onboarding Process State Delta

Dieses Dokument beschreibt das Delta zwischen:
- dem gewuenschten neuen Onboarding-Prozessvertrag
- und dem, was in [02_04_26_DB_V4.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/02_04_26_DB_V4.json) fuer `public.get_onboarding_process_state` bereits sicher sichtbar ist

Wichtig:
- Die V4-Datei zeigt nur Metadaten, nicht den SQL-Body der Funktion.
- Dieses Delta trennt deshalb strikt zwischen:
  - `bestaetigt`
  - `wahrscheinlich vorbereitet`
  - `noch offen`

## 1. Sicher bestaetigt

### Die Funktion existiert bereits
In [02_04_26_DB_V4.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/02_04_26_DB_V4.json) ist `public.get_onboarding_process_state` als echte DB-Funktion vorhanden.

Sicher bestaetigt:
- Name:
  - `get_onboarding_process_state`
- Schema:
  - `public`
- Sprache:
  - `sql`
- Rueckgabe:
  - `jsonb`
- Signatur:
  - `p_club_id uuid`
  - `p_invite_token text`
  - `p_include_debug boolean`
- `security definer`:
  - ja
- `rpcHint`:
  - ja

Das bedeutet:
- wir arbeiten nicht mehr nur gegen ein Zielbild
- der zentrale RPC ist im Bestand schon angelegt

## 2. Sicher bestaetigte Datenquellen im Bestand

Diese Bausteine sind in V4 vorhanden und passen zur neuen Prozesslogik:

### Identity / Membership
- `public.club_member_identities`
- `public.club_members`
- `public.profiles`

### Club / Setup / Billing
- `public.club_onboarding_requirements`
- `public.club_onboarding_snapshot`
- `public.club_billing_subscriptions`

### Rollen / Rechte
- `public.club_user_roles`
- `public.user_roles`

### Consent / Legal
- `public.user_policy_acceptances`
- `public.legal_acceptance_events`

### Invite / Claim Umfeld
- `public.app_secure_settings`

Das bestaetigt:
- der neue Spec haengt an den richtigen Tabellen/Funktionen
- das bisherige SQL-Skelett baut auf den richtigen Relation-Familien auf

## 3. Sicher bestaetigte Korrekturen aus V4

V4 bestaetigt einige wichtige Entscheidungen:

### `club_members` ist kein Profilersatz
`club_members` fuehrt weiterhin keine `email`-Spalte.

Folge:
- `email` gehoert im State-RPC an `profiles`
- nicht an `club_members`

### `club_member_identities` ist der bessere Identity-Link-Anker
V4 zeigt:
- `user_id`
- `club_id`
- `member_no`
- `identity_id`
- `tenant_id`
- `canonical_membership_id`

Folge:
- fuer Claim-/Identity-/Membership-Zustand ist `club_member_identities` die stabilere Verknuepfung als freies Raten ueber `profiles.club_id`

### Consent ist versionsfaehig
V4 zeigt bei `user_policy_acceptances`:
- `policy_key`
- `policy_version`
- Unique auf:
  - `(user_id, policy_key, policy_version)`

Folge:
- `consent_complete` muss spaeter versionshart modelliert werden
- bloßes Vorhandensein eines Keys reicht fachlich nicht

## 4. Was V4 noch nicht beweist

Die Metadaten bestaetigen nicht den Inhalt des SQL-Bodies.

Deshalb weiterhin offen:

### Payload-Struktur
Nicht bestaetigt ist, ob die bestehende Funktion bereits liefert:
- `process`
- `actor`
- `axes`
- `context`
- `requirements`
- `steps`

### Multi-Club-Logik
Nicht bestaetigt ist:
- ob `MULTI` bereits serverseitig erkannt wird
- ob Kontextwahl bereits blockierend modelliert ist
- ob `available_clubs` schon geliefert wird

### Invite-Wahrheit
Nicht bestaetigt ist:
- ob `p_invite_token` wirklich gegen bestehende Invite-Logik geprueft wird
- ob `ACTIVE / USED / EXPIRED / REVOKED / INVALID` serverseitig schon unterschieden werden

### Membership-State-Mapping
Nicht bestaetigt ist:
- ob `club_members.status` bereits auf die erlaubte Prozessachse
  - `NONE | INVITED | ACTIVE | BLOCKED`
  gemappt wird

### Consent-Versionslogik
Nicht bestaetigt ist:
- ob die Funktion bereits gegen aktuelle Pflichtversionen prueft
- oder nur historische Acceptances einsammelt

### Billing-/Club-State-Uebersetzung
Nicht bestaetigt ist:
- ob `club_state` und `billing_state` bereits sauber getrennt und uebersetzt werden

## 5. Wahrscheinlich bereits vorbereitet

Durch Signatur und vorhandene Tabellen/Funktionen ist wahrscheinlich vorbereitet:
- Club-Kontext via `p_club_id`
- Invite-Kontext via `p_invite_token`
- Dev-/Debug-Ausgabe via `p_include_debug`
- serverseitige Prozessableitung statt reinem Frontend-State

Aber:
- ohne SQL-Body bleibt das nur wahrscheinlich, nicht bestaetigt

## 6. Praezises Delta zum neuen Spec

### Bereits passend
- Funktionsname passt
- Signatur passt
- Rueckgabetyp `jsonb` passt
- `security definer` passt
- Datenquellenfamilien passen

### Hohe Wahrscheinlichkeit, aber unbestaetigt
- Club-/Invite-/Debug-Kontext
- Nutzung der vorhandenen Club-Onboarding- und Billing-Bausteine

### Noch als Implementierungsziel offen
- exakte Payload-Form aus dem Spec
- explizite `steps[]`
- explizite `axes.*`
- Multi-Club-Blocking
- Invite-Statusmodell
- Consent-Versionshaertung
- serverseitig normierte Membership-States

## 7. Empfehlung

Der naechste saubere Schritt ist jetzt nicht mehr:
- neue Funktion erfinden

sondern:
- den echten SQL-Body von `public.get_onboarding_process_state` aus der DB holen
- gegen [VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md) abgleichen
- und dann nur das Delta haerten

Kurz:
- Architektur: passt
- Bestand: vorbereitet
- Wahrheit ueber den echten Body: noch ausstehend
