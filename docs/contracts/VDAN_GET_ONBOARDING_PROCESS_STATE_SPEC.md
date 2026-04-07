# VDAN Get Onboarding Process State Spec

Dieses Dokument konkretisiert den allgemeinen Onboarding-Process-State-Contract fuer den VDAN-Bestand.

Es ist die fachlich-technische Referenz fuer:
- `rpc:public.get_onboarding_process_state`
- die serverseitige Ableitung von Step-Status
- die Trennung von Prozesswahrheit und UI-Anzeige

Es baut auf:
- [FCP_ONBOARDING_PROCESS_CONTRACT.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/FCP_ONBOARDING_PROCESS_CONTRACT.md)
- [FCP_ONBOARDING_PROCESS_STATE_CONTRACT.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/FCP_ONBOARDING_PROCESS_STATE_CONTRACT.md)

## 1. Ziel

`public.get_onboarding_process_state` soll fuer einen authentifizierten User genau eine serverseitige Wahrheitsantwort liefern, aus der der Renderer nur noch anzeigen muss:

- welcher Prozess aktiv ist
- welcher Step offen ist
- welcher Step blockiert ist
- welcher Club-/Membership-Kontext gilt
- ob Claim, Identity, Consent und Billing fachlich schon erreicht sind

Regel:
- kein Frontend setzt Step-Freigaben
- kein Renderer leitet Prozesswahrheit selbst ab
- JSON beschreibt nur Struktur und UI

## 2. Empfohlene RPC-Signatur

```sql
public.get_onboarding_process_state(
  p_club_id uuid default null,
  p_invite_token text default null,
  p_include_debug boolean default false
) returns jsonb
```

Bedeutung:
- `p_club_id`
  - optionaler Zielclub fuer Club-Setup oder expliziten Kontext
- `p_invite_token`
  - optionaler Invite-Kontext fuer Claim/Join
  - Invite-Wahrheit darf spaeter ueber sichere Helper-Funktion oder Edge-Orchestrierung kommen
- `p_include_debug`
  - nur fuer Dev/Admin-Diagnose
  - nie fuer normale Client-Entscheidungen notwendig

## 3. Source of Truth im Bestand

Die Wahrheit soll sich aus vorhandenem VDAN-Bestand ableiten, nicht aus neuer Parallelstruktur.

### Actor / Auth
- `auth.uid()`

### Profil / Identity-nahe Basis
- `public.profiles`

### Membership / Identity-Linking
- `public.club_member_identities`
- `public.club_members`

### Rollen / Club-Zugriff
- `public.club_user_roles`
- `public.user_roles`
- `public.current_user_club_id()`
- `public.current_user_has_role_in_club(p_club_id, p_roles)`

### Club-Setup / Club-Onboarding
- `public.ensure_club_onboarding_state(p_club_id)`
- `public.club_onboarding_snapshot(p_club_id)`
- `public.club_onboarding_requirements(p_club_id)`
- `public.club_onboarding_state`

### Billing
- `public.club_billing_subscriptions`

### Consent / Rechtliches
- `public.user_policy_acceptances`
- `public.legal_acceptance_events`

### Invite / Claim
- bestehender Bestand:
  - `club-invite-verify`
  - `club-invite-claim`
  - `app_secure_settings`

Regel:
- Invite-Token-Validierung darf nicht als unsicherer Freitext-Query im Client leben
- `get_onboarding_process_state` darf spaeter intern eine sichere Helper-Funktion oder Edge-Funktion zur Invite-Auswertung aufrufen

## 4. Pflicht-Ausgabe

```json
{
  "process": {},
  "actor": {},
  "axes": {},
  "context": {},
  "requirements": {},
  "steps": []
}
```

## 5. Konkreter Rueckgabe-Payload

```json
{
  "process": {
    "process_id": "vdan_member_onboarding",
    "status": "in_progress",
    "current_step_id": "claim_match",
    "resume_step_id": "claim_match",
    "next_allowed_step_id": "claim_match",
    "blocking_reason_code": null,
    "blocking_reason_message": null,
    "failure_code": null,
    "failure_message": null,
    "retry_allowed": true
  },
  "actor": {
    "auth_user_id": "uuid",
    "email": "user@example.org",
    "profile_id": "uuid",
    "display_name": "Max Mustermann",
    "profile_complete": false
  },
  "axes": {
    "user_state": "AUTH",
    "invite_state": "ACTIVE",
    "membership_state": "INVITED",
    "club_state": "PENDING_SETUP",
    "billing_state": "NONE",
    "claim_state": "claim_pending_match"
  },
  "context": {
    "resolved_club_id": "uuid-or-null",
    "resolved_tenant_id": "uuid-or-null",
    "canonical_membership_id": "uuid-or-null",
    "active_club_count": 1,
    "available_clubs": [
      {
        "club_id": "uuid",
        "tenant_id": "uuid-or-null",
        "club_name": "VDAN Ottenheim",
        "membership_state": "INVITED",
        "selected": true
      }
    ]
  },
  "requirements": {
    "auth_present": true,
    "invite_claimable": true,
    "identity_bound": false,
    "profile_complete": false,
    "consent_complete": false,
    "billing_ready": false,
    "membership_active": false
  },
  "steps": [
    {
      "id": "auth_presence",
      "status": "completed",
      "visible": true,
      "editable": false,
      "completed": true,
      "blocked_reason": null,
      "server_unlock": true
    },
    {
      "id": "claim_match",
      "status": "active",
      "visible": true,
      "editable": true,
      "completed": false,
      "blocked_reason": null,
      "server_unlock": true
    }
  ]
}
```

## 6. Zustandsachsen

Diese Achsen sind serverseitig Pflicht und duerfen nicht nur implizit zusammengeraten werden.

### `axes.user_state`
Erlaubte Werte:
- `NEW`
- `AUTH`
- `NO_CLUB`
- `SINGLE`
- `MULTI`

Ableitung:
- `NEW`
  - nur theoretischer Vorzustand ausserhalb des eingeloggten RPC-Pfads
- `AUTH`
  - User ist eingeloggt, aber fachlicher Clubkontext noch nicht final
- `NO_CLUB`
  - keine aktive nutzbare Clubbeziehung
- `SINGLE`
  - genau ein aktiver oder explizit gewaehlter Clubkontext
- `MULTI`
  - mehrere aktive Clubbezuege, Auswahl erforderlich

### `axes.invite_state`
Erlaubte Werte:
- `NONE`
- `ACTIVE`
- `USED`
- `EXPIRED`
- `REVOKED`
- `INVALID`

Ableitung:
- aus sicherer Invite-Pruefung
- nie aus Frontend-Freitext

### `axes.membership_state`
Erlaubte Werte:
- `NONE`
- `INVITED`
- `ACTIVE`
- `BLOCKED`

Ableitung:
- primaer aus `club_member_identities` und `club_members`

### `axes.club_state`
Erlaubte Werte:
- `NONE`
- `PENDING_SETUP`
- `PENDING_PAYMENT`
- `ACTIVE`
- `SUSPENDED`

Ableitung:
- primaer aus `club_onboarding_snapshot.setup_state`
- mit Billing-/Portal-Kontext serverseitig uebersetzt

### `axes.billing_state`
Erlaubte Werte:
- `NONE`
- `CHECKOUT_OPEN`
- `ACTIVE`
- `PAST_DUE`
- `CANCELED`

Ableitung:
- `club_billing_subscriptions.billing_state`
- optional `checkout_state` als Zusatzsignal

### `axes.claim_state`
Erlaubte Werte:
- `auth_present_unclaimed`
- `claim_pending_match`
- `claim_matched_unverified`
- `identity_verified_membership_pending`
- `consent_pending`
- `billing_pending`
- `membership_active`
- `blocked`

Regel:
- `claim_state` ist die verdichtete Prozessachse fuer den Renderer
- sie ersetzt nicht die Detailachsen

## 7. Ableitungsregeln fuer Steps

Die Step-Logik muss serverseitig an einer Stelle deterministisch gebaut werden.

### 1. `auth_presence`
- `completed = auth.uid() is not null`
- `active`, wenn kein Auth-User vorhanden ist
- im normalen eingeloggten RPC praktisch immer `completed`

### 2. `claim_match`
- `completed`, wenn Invite bereits wirksam eingelost oder Membership bereits idempotent vorhanden ist
- `active`, wenn Invite claimable ist oder Club-/Member-Match offen ist
- `blocked`, wenn Invite `EXPIRED`, `REVOKED` oder `INVALID`

### 3. `identity_binding`
- `completed`, wenn `club_member_identities.identity_id` und/oder `canonical_membership_id` sauber gesetzt sind
- `active`, wenn Claim erfolgreich war, aber Identity-Bindung noch nicht final
- `blocked`, wenn Claim-Kontext fehlt

### 4. `profile_completion`
- `completed`, wenn Pflichtfelder im Zielprofil vorhanden sind
- Pflichtfelder fuer VDAN mindestens:
  - `first_name`
  - `last_name`
  - `email` sofern fachlich erforderlich
- spaetere Erweiterung moeglich, aber serverseitig normieren

### 5. `consent`
- `completed`, wenn geforderte Policy-Keys / Legal-Dokumente akzeptiert sind
- primaer aus:
  - `user_policy_acceptances`
  - optional `legal_acceptance_events`

### 6. `billing_enablement`
- nur sichtbar, wenn der User in einer Club-Setup-/Gruenderrolle ist
- fuer normales Mitglieder-Joining standardmaessig `skipped`
- `completed`, wenn Billing serverseitig aktiv ist

### 7. `membership_activation`
- `completed`, wenn Membership `ACTIVE` und Club fachlich nutzbar ist
- `blocked`, wenn Club `SUSPENDED` oder Membership `BLOCKED`

## 8. Kontextauflösung

Der RPC muss genau einen fachlichen Kontext aufloesen.

Reihenfolge:
1. `p_club_id`, falls explizit uebergeben und fuer den User legitim
2. `current_user_club_id()`, falls vorhanden
3. genau ein aktiver Clubbezug
4. bei mehreren aktiven Clubs:
   - `user_state = MULTI`
   - `resolved_club_id = null`
   - Step-Flow blockiert bis Kontextwahl erfolgt

Regel:
- Multi-Club ist kein UI-Detail, sondern serverseitiger Zustand

## 9. Consent-Regel

Consent darf nicht nur aus UI-Haken kommen.

Wahrheit:
- `user_policy_acceptances`
- optional `legal_acceptance_events`

Der RPC muss mindestens zurueckgeben:
- ob die geforderten Policy-Keys akzeptiert sind
- ob neuere Policy-Versionen offen sind

## 10. Billing-Regel

Billing darf niemals aus Client-Events freigeschaltet werden.

Wahrheit:
- `club_billing_subscriptions`
- ggf. `club_onboarding_snapshot`

Regel:
- `billing_enablement` darf nur `completed` sein, wenn serverseitig verifiziertes Billing vorliegt

## 11. Invite-/Claim-Regel

Invite-Claim ist die gefaehrlichste Uebergangszone.

Pflichten:
- Token-Pruefung vor finalem Claim
- idempotenter Erfolg bei bereits bestehender Membership im selben Club
- kein doppeltes Usage-Counting
- kein halbfertiger Zustand bei abgelaufenem Invite

Der RPC muss deshalb unterscheiden koennen:
- `ACTIVE`
- `USED`
- `EXPIRED`
- `REVOKED`
- `INVALID`

## 12. Minimaler SQL-Aufbau

Empfohlene interne Bausteine:
- `actor`
  - `auth.uid()`
- `profile_row`
  - `profiles`
- `identity_links`
  - `club_member_identities`
- `membership_rows`
  - `club_members`
- `club_context`
  - `current_user_club_id()` / aktive Links
- `club_snapshot`
  - `ensure_club_onboarding_state()`
  - `club_onboarding_snapshot()`
- `billing_row`
  - `club_billing_subscriptions`
- `consent_rows`
  - `user_policy_acceptances`
- `invite_state`
  - sichere Invite-Helferfunktion / Edge-orchestrierte Vorpruefung

## 13. Was bewusst nicht im Renderer liegen darf

- Step-Freigabe
- Club-Kontextwahl als Sicherheitsentscheidung
- Claim-Validity
- Billing-Freigabe
- Consent-Komplettheit
- Membership-Aktivierung

## 14. Naechster Implementierungsschritt

Bevor `advance_onboarding_step` gebaut wird, muss zuerst `get_onboarding_process_state` mit echter Wahrheit stehen.

Empfohlene Reihenfolge:
1. `public.get_onboarding_process_state`
2. einfacher Stepper im Renderer
3. erst danach `public.advance_onboarding_step`
