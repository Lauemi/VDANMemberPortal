Onboarding ist ein State-System.

Kernobjekte:
- User
- Club
- Membership
- Invite
- Subscription

Regeln:
- keine doppelte Logik
- kein Frontend-State als Wahrheit
- Status statt Flags
- Multi-Tenant Isolation
- Side Effects nur serverseitig

Stripe:
- nur Webhook aktiviert Club

## Transition-Matrix: User

| Current State | Trigger | Actor | Guards / Preconditions | Next State | Side Effects | Error Handling | Idempotent? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NEW` | erfolgreiche Authentifizierung | Auth-System | gueltiger Login | `AUTH` | Session vorhanden | Login ablehnen | ja |
| `AUTH` | Profil-Initialisierung | User / System | `auth.uid` vorhanden | `NO_CLUB` | `profile-bootstrap` erzeugt oder ergaenzt `profiles` | `bootstrap_failed`, keine App-Freigabe | ja |
| `AUTH` | Club-Kontext aufloesbar und genau ein Club aktiv | System | eindeutiger Clubbezug ueber `profiles.club_id` oder eine aktive Club-Rolle | `SINGLE` | Club-Kontext fuer Routing setzen | Fallback auf `NO_CLUB` oder `MULTI` | ja |
| `AUTH` | mehrere aktive Club-Bezuege erkannt | System | mehr als ein Club in `user_roles` oder `club_user_roles` | `MULTI` | Club-Auswahlscreen erzwingen | keine implizite Auswahl | ja |
| `NO_CLUB` | Invite erfolgreich eingelost | User / System | Invite gueltig, Membership hergestellt | `SINGLE` oder `MULTI` | Rollen, Mapping und Profilbezug aktualisieren | Fehlermeldung und Zustand beibehalten | ja |
| `SINGLE` | zusaetzlicher Club-Bezug entsteht | System | zweite aktive Membership oder Rolle vorhanden | `MULTI` | Club-Auswahllogik aktivieren | keine | ja |
| `MULTI` | User waehlt Club-Kontext | User | Zielclub aktiv und berechtigt | `SINGLE` im aktiven Kontext | nur Session-/UI-Kontext wechseln | Zugriff verweigern | ja |

## Transition-Matrix: Club

| Current State | Trigger | Actor | Guards / Preconditions | Next State | Side Effects | Error Handling | Idempotent? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NOT_CREATED` | Club-Setup starten | globaler Admin | Admin-Rolle vorhanden, Club-Code frei | `PENDING_SETUP` | `app_secure_settings`, Rollen, Module, optional Gewaesser anlegen | `club_code_exists`, Rollback | nein |
| `PENDING_SETUP` | Pflicht-Setup vollstaendig markiert | Club-Admin | Stammdaten, Gewaesser, Karten-Matrix und Import-Minimum erfuellt | `PENDING_PAYMENT` | Billing-Start freigeben | Setup bleibt offen | ja |
| `PENDING_SETUP` | Setup zwischenspeichern | Club-Admin | Auth + Club-Scoping | `PENDING_SETUP` | Teilfortschritt persistieren | Validierungsfehler pro Modul | ja |
| `PENDING_PAYMENT` | Checkout erstellt | System | Setup abgeschlossen, kein aktives Billing | `PENDING_PAYMENT` | Stripe-Checkout-Referenz speichern | Checkout nicht erzeugt -> Zustand bleibt | ja |
| `PENDING_PAYMENT` | verifizierter Zahlungs-Webhook | Stripe / Server | Signatur ok, Event relevant, Subscription aktiv | `ACTIVE` | Billingdaten persistieren, Club freischalten | keine Aktivierung bei ungueltigem Event | ja |
| `PENDING_PAYMENT` | Checkout abgebrochen oder abgelaufen | User / System | keine erfolgreiche Subscription | `PENDING_PAYMENT` | Re-Checkout erlauben | UI-Hinweis, kein Statuswechsel | ja |
| `ACTIVE` | Billing ausgesetzt oder gekuendigt | Stripe / Server | verifiziertes Billing-Ereignis | `SUSPENDED` | Zugriff fuer Club-kontextuelle Features blockieren | Session restriktiv weiterfuehren | ja |
| `SUSPENDED` | Billing wieder aktiv | Stripe / Server | verifiziertes Recovery-Ereignis | `ACTIVE` | Zugriff wieder freigeben | bleibt suspendiert | ja |

## Transition-Matrix: Membership

| Current State | Trigger | Actor | Guards / Preconditions | Next State | Side Effects | Error Handling | Idempotent? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NONE` | Invite validiert | System | gueltiger Invite, aber noch nicht eingelost | `INVITED` | nur technische Vorpruefung, keine Rolle | bei Fehler keine Membership | ja |
| `INVITED` | Invite erfolgreich eingelost | User / System | User authentifiziert, Invite gueltig, Member-Zuordnung moeglich | `ACTIVE` | `club_member_identities`, `profiles`, `user_roles`, `club_user_roles` sichern | Fehler fuehrt zu keinem halbfertigen Endzustand | ja |
| `ACTIVE` | Club oder Admin sperrt Mitgliedschaft | Club-Admin / System | Berechtigung vorhanden | `BLOCKED` | App-Zugriffe des Clubs entziehen | bereits gesperrt -> keine Aenderung | ja |
| `BLOCKED` | Reaktivierung | Club-Admin | Berechtigung vorhanden, Club aktiv | `ACTIVE` | Rollen wieder wirksam | unberechtigt -> verweigern | ja |

## Transition-Matrix: Invite

| Current State | Trigger | Actor | Guards / Preconditions | Next State | Side Effects | Error Handling | Idempotent? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DRAFT` | Invite erzeugen | Club-Manager | `admin` oder `vorstand` im Club | `ACTIVE` | Token generieren, Hash in `app_secure_settings` speichern | `forbidden_club_manager_only` | nein |
| `ACTIVE` | Invite pruefen | User / System | Token vorhanden, nicht abgelaufen, nicht exhausted | `ACTIVE` | Meta-Infos zur UI liefern | `invite_invalid`, `invite_expired`, `invite_exhausted` | ja |
| `ACTIVE` | Invite einloesen | User / System | Auth vorhanden, Invite gueltig | `USED` oder `ACTIVE` | `used_user_ids`, `used_count`, evtl. `status=exhausted` aktualisieren | keine doppelte Membership, kein doppeltes Counting | ja |
| `ACTIVE` | Ablauf erreicht | System | `expires_at < now()` | `EXPIRED` | keine weitere Einloesung | bei spaeterem Claim `invite_expired` | ja |
| `ACTIVE` | manuell widerrufen | Club-Manager | Berechtigung vorhanden | `REVOKED` | Claim blockieren | unberechtigt -> verweigern | ja |
| `USED` | erneuter Claim desselben Users | User / System | User bereits in `used_user_ids` | `USED` | keine erneute Zaehlererhoehung | kein Fehler, idempotentes Erfolgsergebnis | ja |

## Transition-Matrix: Subscription / Billing

| Current State | Trigger | Actor | Guards / Preconditions | Next State | Side Effects | Error Handling | Idempotent? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NONE` | Club geht in Billing | Club-Admin / System | Club in `PENDING_PAYMENT` | `CHECKOUT_OPEN` | Checkout-Session anlegen | Session-Erzeugung fehlgeschlagen | nein |
| `CHECKOUT_OPEN` | Checkout erfolgreich bezahlt, Webhook verifiziert | Stripe / Server | Signatur ok, Clubreferenz vorhanden | `ACTIVE` | Subscription-Daten speichern, Club aktivieren | Event ignorieren, wenn unvollstaendig | ja |
| `CHECKOUT_OPEN` | Checkout abgebrochen | User / System | keine Payment-Bestaetigung | `CHECKOUT_OPEN` | Re-Checkout erlauben | kein State-Verlust | ja |
| `ACTIVE` | Billing-Problem / Zahlungsausfall | Stripe / Server | relevantes Lifecycle-Event | `PAST_DUE` oder `SUSPENDED` | Clubeinschraenkung, Audit-Log | nur per Webhook | ja |
| `PAST_DUE` | Zahlung wiederhergestellt | Stripe / Server | verifiziertes Erfolgsereignis | `ACTIVE` | Club weiter aktiv | keine | ja |
| `ACTIVE` oder `PAST_DUE` | Abo gekuendigt und ausgelaufen | Stripe / Server | verifiziertes Ende | `CANCELED` | Billing-Status final setzen | keine | ja |

## Technische Leitlinien zur Implementierung

- Alle Transitionen werden serverseitig validiert.
- Jede Transition braucht explizite Guards.
- Idempotente Trigger muessen bei Wiederholung denselben Endzustand liefern.
- Fehler muessen auf Fachfehler, Berechtigungsfehler und Infrastrukturfehler getrennt reagieren.
- Club-Aktivierung durch Billing darf niemals vom Frontend aus erfolgen.
