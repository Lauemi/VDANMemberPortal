# VDAN Get Onboarding Process State Review Checklist

Diese Checkliste ist fuer die Pruefung des echten SQL-Bodies von:
- `public.get_onboarding_process_state`

Ziel:
- nicht neu erfinden
- sondern den bestehenden RPC systematisch gegen den neuen Vertrag pruefen

Referenzen:
- [VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md)
- [VDAN_GET_ONBOARDING_PROCESS_STATE_DELTA.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_DELTA.md)
- [FCP_ONBOARDING_PROCESS_STATE_CONTRACT.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/contracts/FCP_ONBOARDING_PROCESS_STATE_CONTRACT.md)

## 1. Signatur

Pruefen:
- existiert genau:
  - `public.get_onboarding_process_state(p_club_id uuid, p_invite_token text, p_include_debug boolean)`
- ist `returns jsonb`
- ist `security definer`
- ist `search_path` bewusst gesetzt

Erwartung:
- keine abweichende Signatur
- keine zweite konkurrierende Variante

## 2. Auth-Grundlage

Pruefen:
- wird `auth.uid()` oder eine gleichwertige serverseitige User-Wahrheit verwendet
- blockiert der RPC sauber bei fehlender Auth
- wird keine Client-User-ID direkt vertraut

Warnsignal:
- User-ID kommt aus Parametern
- Auth wird nur indirekt oder gar nicht geprueft

## 3. Kontextaufloesung

Pruefen:
- wird `p_club_id` nur akzeptiert, wenn der Club fuer den User legitim ist
- wird `current_user_club_id()` oder gleichwertige Logik genutzt
- wird bei mehreren moeglichen Clubs `MULTI` sauber erkannt
- wird bei `MULTI` ohne Auswahl nicht einfach irgendein Club genommen

Erwartung:
- kein blindes `p_club_id gewinnt immer`
- kein stilles `limit 1` ohne fachliche Legitimierung

## 4. Source of Truth

Pruefen, ob der RPC an diesen Bausteinen haengt:
- `profiles`
- `club_member_identities`
- `club_members`
- `club_onboarding_snapshot`
- `club_onboarding_requirements`
- `club_billing_subscriptions`
- `user_policy_acceptances`
- optional `legal_acceptance_events`
- Invite-/Claim-Bausteine aus sicherer Serverlogik

Warnsignal:
- Frontend- oder Placeholder-Wahrheiten
- neue Paralleltabellen ohne fachliche Begruendung

## 5. Invite-Logik

Pruefen:
- wird `p_invite_token` serverseitig sicher validiert
- werden mindestens unterschieden:
  - `NONE`
  - `ACTIVE`
  - `USED`
  - `EXPIRED`
  - `REVOKED`
  - `INVALID`
- wird kein nichtleerer Token automatisch als aktiv behandelt
- wird kein Invite aus dem Client direkt vertraut

Erwartung:
- Invite-Wahrheit kommt aus sicherer Verify-/Claim-Logik

## 6. Membership-State-Mapping

Pruefen:
- wird `club_members.status` oder ein anderer Rohstatus auf die erlaubte Prozessachse gemappt:
  - `NONE`
  - `INVITED`
  - `ACTIVE`
  - `BLOCKED`
- gelangen keine freien Bestandswerte ungefiltert in `axes.membership_state`

Warnsignal:
- Rohstatus wird 1:1 in den Prozess gespiegelt

## 7. Claim-/Identity-Achse

Pruefen:
- werden diese Verdichtungen serverseitig unterschieden:
  - `auth_present_unclaimed`
  - `claim_pending_match`
  - `claim_matched_unverified`
  - `identity_verified_membership_pending`
  - `consent_pending`
  - `billing_pending`
  - `membership_active`
- basiert die Ableitung auf echten Tabellen/Funktionen statt nur auf UI-Indizien

Warnsignal:
- Claim-/Identity-Wahrheit wird aus nur einem Boolean geraten

## 8. User-State

Pruefen:
- werden diese Werte sauber unterschieden:
  - `AUTH`
  - `NO_CLUB`
  - `SINGLE`
  - `MULTI`
- ist `MULTI` wirklich ein eigener Zustand und nicht nur `SINGLE` mit mehreren Datensaetzen

Warnsignal:
- mehrere Clubs vorhanden, aber der RPC liefert trotzdem still einen Defaultclub

## 9. Club-State

Pruefen:
- wird `club_state` serverseitig auf diese Werte uebersetzt:
  - `NONE`
  - `PENDING_SETUP`
  - `PENDING_PAYMENT`
  - `ACTIVE`
  - `SUSPENDED`
- ist klar, welche Wahrheit dafuer gilt:
  - Setup aus `club_onboarding_snapshot`
  - Billing aus `club_billing_subscriptions`

Warnsignal:
- Setup- und Billing-State werden unsauber vermischt

## 10. Billing-State

Pruefen:
- wird `billing_state` mindestens auf diese Werte normiert:
  - `NONE`
  - `CHECKOUT_OPEN`
  - `ACTIVE`
  - `PAST_DUE`
  - `CANCELED`
- basiert die Wahrheit auf serverseitigen Billing-Daten
- ist kein Client-/Checkout-Frontend-Status allein ausschlaggebend

Warnsignal:
- Checkout = aktiv
- keine serverseitige Billing-Pruefung

## 11. Consent

Pruefen:
- werden `policy_key` und `policy_version` beide beruecksichtigt
- prueft der RPC gegen aktuell geforderte Versionen
- wird nicht nur irgendeine alte Acceptance als ausreichend gewertet
- wird `legal_acceptance_events` sinnvoll ergaenzt oder bewusst nicht genutzt

Warnsignal:
- Consent = true nur weil es irgendwann mal `terms` gab

## 12. Schritte

Pruefen:
- liefert der RPC bereits `steps[]`
- sind pro Step mindestens enthalten:
  - `id`
  - `status`
  - `visible`
  - `editable`
  - `completed`
- werden nur erlaubte Statuswerte genutzt:
  - `locked`
  - `available`
  - `active`
  - `completed`
  - `blocked`
  - `failed`
  - `skipped`

Warnsignal:
- Renderer muss Steps erst selbst zusammensetzen

## 13. Prozessblock

Pruefen:
- liefert der RPC bereits:
  - `process_id`
  - `status`
  - `current_step_id`
  - `resume_step_id`
  - `next_allowed_step_id`
- wird `blocked` mit serverseitigem Grund geliefert

Warnsignal:
- `current_step_id` fehlt
- Client muss selbst den aktiven Schritt erraten

## 14. Block-/Fehlergruende

Pruefen:
- gibt es nachvollziehbare serverseitige Gründe wie:
  - `auth_required`
  - `invite_not_claimable`
  - `club_context_selection_required`
  - `identity_binding_required_first`
  - `profile_completion_required_first`
  - `consent_required_first`

Erwartung:
- Blockgruende kommen aus dem RPC, nicht aus UI-Heuristik

## 15. Rollenlogik

Pruefen:
- werden Billing-/Admin-nahe Schritte serverseitig an echte Clubrollen gekoppelt
- wird `current_user_has_role_in_club(...)` oder gleichwertige Rollenwahrheit genutzt

Warnsignal:
- Admin- oder Billing-Step fuer normale Mitglieder frei sichtbar/editierbar

## 16. Debug

Pruefen:
- liefert `p_include_debug = true` nur Zusatzdiagnose
- beeinflusst `debug` nicht den fachlichen Prozessstatus
- werden keine sensitiven Rohdaten unnoetig offengelegt

Warnsignal:
- Debug aendert Fachlogik
- Debug liefert geheime Tokens oder unnoetige Interna

## 17. Was der RPC NICHT tun darf

Pruefen, dass NICHT passiert:
- Frontend-Status als Wahrheit verwenden
- nicht validiertes `p_club_id` vertrauen
- Invite nur nach String-Pruefung als aktiv behandeln
- Membership- oder Consent-Wahrheit raten
- beliebige Bestandsstatus ungefiltert in Prozessachsen kopieren
- Multi-Club still aufloesen

## 18. Review-Ergebnis festhalten

Nach der Pruefung pro Punkt markieren:
- `passt bereits`
- `passt teilweise`
- `fehlt`
- `fachlich riskant`

Am Ende drei Listen bilden:

### Vor Onboarding zwingend
- Punkte, die fuer echten Step-Flow noetig sind

### Parallel reifbar
- Dinge, die den ersten Prozess nicht blockieren

### Spaeterer Feinschliff
- Komfort, Diagnostics, zusaetzliche Politur
