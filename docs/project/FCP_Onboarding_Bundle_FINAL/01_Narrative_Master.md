Das Onboarding-System des Fishing-Club-Portals ist ein zustandsbasierter Prozess.

Es gibt drei Einstiegspunkte:
1. Login
2. Invite
3. Verein erstellen

Alle fuehren in denselben Systemkern.

## Narrative Zielarchitektur

Nach Login:
- `0 Clubs` -> Onboarding-Einstieg `NO_CLUB`
- `1 Club` -> automatische Club-Bindung, wenn eindeutig
- `mehrere Clubs` -> erzwungene Club-Auswahl vor geschuetzten App-Bereichen

Invite:
- Token validieren
- User authentifizieren oder neuen User anlegen
- Invite serverseitig gegen Club und Ablauf pruefen
- Mitgliedszuordnung herstellen
- Membership und Rolle ableiten
- danach in den Club-Kontext wechseln

Verein erstellen:
- Club minimal anlegen
- Club-Code reservieren
- Kernrollen anlegen
- Creator als Admin und Mitglied zuordnen
- Setup-Zustand setzen
- danach Setup und Billing nacheinander abarbeiten

Setup:
- Stammdaten
- Gewaesser
- Karten
- Mitgliederimport

Danach:
- Billing
- Aktivierung
- Betrieb

## Operativer Hauptfluss

### A. Login -> Routingentscheidung

1. User authentifiziert sich.
2. `profile-bootstrap` stellt sicher, dass `profiles` vorhanden ist.
3. Club-Kontext wird deterministisch aus `profiles.club_id` oder eindeutigem Club-Bezug abgeleitet.
4. Routing erfolgt nur anhand serverseitig ableitbarer Zustaende:
   - kein Clubbezug -> `NO_CLUB`
   - genau ein aktiver Club -> direkt in diesen Club
   - mehrere Clubs -> Club-Auswahl

### B. Invite -> Club-Mitgliedschaft

1. Manager/Admin erzeugt Invite ueber `club-invite-create`.
2. Invite wird als gehashter Datensatz in `app_secure_settings` gespeichert.
3. Registrierungsseite nimmt Invite-Token entgegen.
4. `club-invite-verify` liefert nur Meta-Informationen, keine Mitgliedschaft.
5. Nach Authentifizierung fuehrt `club-invite-claim` die eigentliche Einloesung aus.
6. Dabei werden in dieser Reihenfolge gesichert:
   - Invite validieren
   - Club-Member-Record sicherstellen
   - `club_member_identities` herstellen
   - `profiles` ergaenzen
   - `user_roles` und `club_user_roles` auf `member` sicherstellen
   - Invite-Nutzung idempotent verbuchen
7. Ergebnis ist ein aktiver Club-Bezug des Users fuer diesen Club.

### C. Club-Erstellung -> Setup -> Billing

1. Globaler Admin legt ueber `club-admin-setup` einen neuen Club minimal an.
2. Gespeichert werden mindestens:
   - `club_code_map:<code>` in `app_secure_settings`
   - `club_name:<club_id>` in `app_secure_settings`
   - `club_roles`
   - `club_user_roles`
   - `user_roles`
   - initiale `club_module_usecases`
   - optionale `water_bodies`
3. Der Club startet fachlich in `PENDING_SETUP`.
4. Pflichtmodule des Setups werden vom Club-Admin bearbeitet.
5. Erst wenn Setup fachlich vollstaendig ist, darf zu `PENDING_PAYMENT` uebergegangen werden.
6. Erst der erfolgreich verifizierte Stripe-Webhook darf `ACTIVE` setzen.

## Leitentscheidungen fuer den Flow

- Es gibt keine Abkuerzung von `PENDING_SETUP` direkt nach `ACTIVE`.
- Invite-Validierung ist nicht gleich Invite-Verbrauch.
- Mehrfachklicks und Wiederholungen muessen idempotent behandelt werden.
- Multi-Club ist kein Sonderfall, sondern Teil des Zielmodells.
- Das Frontend darf Fortschritt visualisieren, aber keine Zustaende allein festschreiben.
