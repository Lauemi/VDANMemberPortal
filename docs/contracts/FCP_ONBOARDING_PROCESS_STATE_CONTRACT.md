# FCP Onboarding Process State Contract

Dieses Contract definiert die serverseitige Wahrheit fuer den Onboarding-Prozessstatus.

Es ist der technische Gegenpart zu:
- [FCP_ONBOARDING_PROCESS_CONTRACT.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/FCP_ONBOARDING_PROCESS_CONTRACT.md)
- [VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md)

## 1. Ziel

Das Backend muss einen eindeutigen, wiederaufnehmbaren und sicherheitsfaehigen Onboarding-Status liefern.

Nicht Ziel:
- Status aus Frontend-Navigation zusammensetzen
- Prozessfreigaben aus JSON ableiten
- Claim-/Identity-/Membership-Phasen nur implizit modellieren

## 2. Empfohlener Einstiegspunkt

```txt
rpc:public.get_onboarding_process_state
```

Fuer den VDAN-Bestand ist die konkrete Payload- und Ableitungsreferenz:
- [VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md)

Optional spaeter:

```txt
rpc:public.advance_onboarding_step
edge:onboarding-claim-orchestrator
edge:onboarding-identity-orchestrator
```

## 3. Minimaler Rueckgabe-Contract

```json
{
  "process": {
    "process_id": "vdan_member_onboarding",
    "status": "in_progress",
    "current_step_id": "claim_match",
    "resume_step_id": "claim_match",
    "next_allowed_step_id": "claim_match",
    "blocking_reason": null,
    "failure_code": null,
    "failure_message": null,
    "retry_allowed": true
  },
  "identity_state": {
    "auth_user_id": "uuid",
    "status": "auth_present_unclaimed"
  },
  "membership_state": {
    "canonical_membership_id": null,
    "tenant_id": null,
    "status": "claim_pending_match"
  },
  "steps": [
    {
      "id": "auth_presence",
      "status": "completed",
      "visible": true,
      "editable": false,
      "completed": true,
      "blocked_reason": null
    },
    {
      "id": "claim_match",
      "status": "active",
      "visible": true,
      "editable": true,
      "completed": false,
      "blocked_reason": null
    }
  ]
}
```

## 4. Pflichtfelder Prozess

- `process.process_id`
- `process.status`
- `process.current_step_id`
- `process.resume_step_id`

## 5. Erlaubte Prozessstatus

- `not_started`
- `in_progress`
- `paused`
- `completed`
- `blocked`
- `failed`

## 6. Pflichtfelder pro Step

- `id`
- `status`
- `visible`
- `editable`
- `completed`

## 7. Erlaubte Step-Status

- `locked`
- `available`
- `active`
- `completed`
- `blocked`
- `failed`
- `skipped`

## 8. Kritische VDAN-Zustandsachsen

Das Backend muss mindestens diese Zonen explizit fuehren:

- `identity_state.status`
- `membership_state.status`
- `process.status`
- `steps[*].status`

Empfohlene Statuswerte fuer `identity_state.status` / `membership_state.status`:

- `auth_present_unclaimed`
- `claim_pending_match`
- `claim_matched_unverified`
- `identity_verified_membership_pending`
- `consent_pending`
- `billing_pending`
- `membership_active`

## 9. Serverpflichten

Das Backend entscheidet:
- ob ein Step sichtbar ist
- ob ein Step editierbar ist
- welcher Step aktuell aktiv ist
- ob ein Step abgeschlossen ist
- ob der Prozess blockiert ist

Der Client darf diese Wahrheit nicht ersetzen.

## 10. Was im Client nur Anzeige ist

Der Client darf:
- Stepper rendern
- Sperrhinweise anzeigen
- Formulare anzeigen
- Aktionen ausloesen

Der Client darf nicht:
- Steps selbst freischalten
- Completion selbst final setzen
- Prozessstatus selbst ableiten
