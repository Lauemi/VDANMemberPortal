# FCP Onboarding Process Contract

Dieses Contract definiert, wie ein echter mehrstufiger Onboarding-Prozess im FCP-System aufgebaut wird.

Es ist absichtlich:
- kein UI-Design
- kein HTML
- keine konkrete Einzelmaske
- kein Ersatz fuer RLS
- sondern die verbindliche Prozessschicht zwischen:
  - VDAN-Fachlogik
  - SQL / RPC / Edge
  - Mask JSON
  - Renderer

## 1. Ziel

Das Zielsystem lautet:

```txt
VDAN Prozesslogik -> serverseitiger Prozessstatus -> Onboarding JSON -> Renderer -> sichtbarer Step-Flow
```

Nicht Ziel:
- reine Frontend-Navigation als Prozessersatz
- freie Step-Interpretation im Renderer
- Freischaltung nur ueber UI-Logik
- JSON als Sicherheits- oder Prozesswahrheit

## 2. Grundregel

Onboarding ist kein normales `sectioned` Settings-Pattern.

Onboarding ist ein echter Prozess mit:
- Reihenfolge
- Freischaltung
- Wiederaufnahme
- Sperrlogik
- Uebergangszustaenden
- Abbruch- und Fehlerzustaenden

Regel:
- JSON beschreibt den Prozess
- Renderer zeigt den Prozess
- Backend entscheidet den Prozesszustand

## 3. Wahrheitsschichten

Fuer Onboarding gilt strikt:

- `JSON`
  - beschreibt Steps, Struktur und erlaubte UI-Bloecke
- `Resolver`
  - bindet Daten und Aktionen
- `Renderer`
  - zeigt Step-UI
- `RPC / Edge / SQL`
  - entscheiden, was erlaubt, sichtbar, bearbeitbar und abgeschlossen ist

Regel:
- Prozessfreigaben duerfen niemals nur im Renderer oder nur im JSON liegen

## 4. Prozessmodus

Fuer Onboarding wird ein expliziter Prozessmodus eingefuehrt:

```json
{
  "maskFamily": "QFM",
  "maskType": "process"
}
```

Regel:
- `maskType = process` ist fuer echte mehrstufige Flows reserviert
- `sectioned` ist nicht automatisch ein Prozess

## 5. Minimaler Prozessvertrag

Jede Onboarding-Maske braucht zusaetzlich zu den normalen Maskenfeldern:

```json
{
  "process": {
    "processId": "vdan_member_onboarding",
    "resumeKey": "onboarding_state",
    "stateBinding": {
      "kind": "rpc",
      "target": "public.get_onboarding_process_state",
      "path": "rpc:public.get_onboarding_process_state"
    },
    "advanceBinding": {
      "kind": "rpc",
      "target": "public.advance_onboarding_step",
      "path": "rpc:public.advance_onboarding_step"
    },
    "steps": []
  }
}
```

Pflichtfelder:
- `process.processId`
- `process.stateBinding`
- `process.steps`

## 6. Step-Modell

Jeder Step wird explizit definiert.

```json
{
  "id": "claim_match",
  "label": "Zuordnung",
  "title": "Mitgliedschaft zuordnen",
  "stepType": "claim",
  "statusSource": "process.steps.claim_match",
  "requiresServerUnlock": true,
  "unlockRule": "server_only",
  "completionRule": "server_only",
  "visibleWhen": "server_only",
  "editableWhen": "server_only",
  "terminalStates": ["completed", "blocked", "failed"]
}
```

Pflichtfelder pro Step:
- `id`
- `label`
- `title`
- `stepType`
- `statusSource`

## 7. Erlaubte Step-Status

Ein Step darf nur diese Status haben:

- `locked`
- `available`
- `active`
- `completed`
- `blocked`
- `failed`
- `skipped`

Regel:
- Statuswahrheit kommt serverseitig
- Renderer darf Status nicht selbst erfinden

## 8. Erlaubte Prozesszustande

Der Gesamtprozess darf nur diese Zustande haben:

- `not_started`
- `in_progress`
- `paused`
- `completed`
- `blocked`
- `failed`

Regel:
- `completed` darf nur serverseitig gesetzt werden
- `blocked` und `failed` muessen einen serverseitigen Grund haben

## 9. VDAN-spezifische Kernzonen

Fuer euren VDAN-Kontext muessen mindestens diese Fachzonen explizit modelliert werden:

1. `auth_presence`
2. `claim_match`
3. `identity_binding`
4. `profile_completion`
5. `consent`
6. `billing_enablement`
7. `membership_activation`

Regel:
- diese Zonen duerfen nicht zu einem einzigen generischen "Profil ausfuellen"-Step verschmolzen werden
- die gefaehrliche Zone liegt zwischen `auth_presence`, `claim_match` und `identity_binding`

## 10. Kritische Uebergangszustaende

Diese Uebergangszustaende muessen serverseitig unterscheidbar sein:

- `auth_present_unclaimed`
- `claim_pending_match`
- `claim_matched_unverified`
- `identity_verified_membership_pending`
- `consent_pending`
- `billing_pending`
- `membership_active`

Regel:
- diese Zustaende duerfen nicht nur implizit aus einzelnen Boolean-Feldern zusammengeraten werden

## 11. Sichtbarkeit

Sichtbarkeit im Onboarding ist nicht gleich Sicherheit.

JSON darf definieren:
- Reihenfolge
- Step-Titel
- Step-Inhalt
- welche Bloecke ein Step nutzt

JSON darf nicht final entscheiden:
- ob ein Step sichtbar ist
- ob ein Step bearbeitbar ist
- ob ein Step abgeschlossen ist

Diese Wahrheit muss aus `stateBinding` kommen.

## 12. Was in JSON gehoert

In JSON gehoert:
- Step-Struktur
- fachliche Benennung
- erlaubte Inhaltsbloecke
- erwartete Bindings
- visuelle Reihenfolge
- Ziel-Renderer

Nicht in JSON als alleinige Wahrheit:
- Claim erfolgreich oder nicht
- Verifikation erfolgreich oder nicht
- Billing freigeschaltet oder nicht
- Membership aktiv oder nicht

## 13. Was in RPC gehoert

In RPC gehoert:
- aktueller Prozessstatus
- freigeschaltete Steps
- gesperrte Steps
- Step-Completion
- Claim-/Identity-/Membership-Wahrheit
- fachliche Validierung fuer Step-Uebergaenge

Beispiele:
- `public.get_onboarding_process_state`
- `public.complete_onboarding_profile_step`
- `public.complete_onboarding_consent_step`

## 14. Was in Edge Functions gehoert

Edge Functions werden verwendet wenn:
- externer Verifikationsprozess beteiligt ist
- Claims / Matching ueber mehrere Systeme laufen
- E-Mail / Invite / Token-Orchestrierung notwendig ist
- mehrstufige serverseitige Prozesslogik noetig ist

Beispiele:
- Claim-Match-Orchestrierung
- externe Identitaetspruefung
- serverseitige Aktivierungssequenz

## 15. Was niemals im Renderer liegen darf

- Freischaltung eines spaeteren Steps
- serverseitige Abschlusslogik
- Claim-Match-Wahrheit
- Membership-Aktivierung
- Billing-Freigabe
- Consent-Abschluss als alleinige Frontendentscheidung

Renderer darf:
- anzeigen
- navigieren
- Formulare sammeln
- Aktionen ausloesen
- Status visualisieren

Renderer darf nicht:
- Prozess final entscheiden

## 16. Prozessnavigation

Onboarding-Navigation ist keine freie Section-Navigation.

Es braucht:
- `currentStepId`
- `nextAllowedStepId`
- `previousCompletedStepId`
- `resumeStepId`

Regel:
- Navigation darf nur auf serverseitig erlaubte Steps fuehren
- Spruenge in gesperrte Steps sind nicht erlaubt

## 17. Resume-Verhalten

Onboarding muss wiederaufnehmbar sein.

Pflicht:
- Backend liefert `resumeStepId`
- Backend liefert `processStatus`
- JSON beschreibt nur die moeglichen Steps

Regel:
- Resume darf nicht nur aus lokaler UI-Navigation rekonstruiert werden

## 18. Fehler- und Blockzustande

Jeder Prozess muss echte Fehler- und Blockzustande tragen koennen.

Pflichtfelder serverseitig:
- `blockingReason`
- `failureCode`
- `failureMessage`
- `retryAllowed`

Regel:
- generische Platzhaltertexte reichen fuer Onboarding nicht
- Fehler muessen fachlich zuordenbar sein

## 19. Feldregeln fuer Onboarding

Fuer editierbare Onboarding-Felder gelten strengere Regeln als fuer den Settings-Pilot.

Pflicht:
- `componentType`
- `valuePath`
- `payloadKey`
- `required`
- `validationRules`

Regel:
- kein impliziter Fallback auf Feldnamen
- kein weiches Mapping fuer Pflichtfelder
- keine unerklaerten Default-Werte fuer kritische Prozessfelder

## 20. Pilotlogik-Verbot im Onboarding

In echten Onboarding-Masken sind nicht erlaubt:
- lokale Ersatzdaten
- implizite Placeholder-Prozesszustaende
- generische Pilotmeldungen
- lokale Prozesssimulation
- fallbackartige Fake-Resume-Logik

Regel:
- was fuer den Settings-Pilot akzeptabel war, ist fuer Onboarding nicht produktionsfaehig

## 21. Zielzustand

Der Zielzustand lautet:

```txt
VDAN Prozessstatus -> QFM process JSON -> Renderer -> echter Onboarding-Flow
```

Mit klarer Trennung:
- Backend = Prozesswahrheit
- JSON = Prozessstruktur
- Resolver = Daten/Binder
- Renderer = UI
- CSS = Optik

## Kurzform

- Onboarding ist ein echter Prozess, keine normale Section-Maske
- `maskType = process`
- Step-Freischaltung kommt serverseitig
- Claim-/Identity-/Membership-Zone muss explizit modelliert werden
- JSON beschreibt, Backend entscheidet
- Renderer zeigt, aber legitimiert nichts
- Pilotlogik darf im echten Onboarding nicht mehr vorkommen
