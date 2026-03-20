Bestand vor Neubau.

Vor Umsetzung immer pruefen:
- Tabellen
- Flows
- RLS
- Edge Functions

Nur ergaenzen.

## Mapping auf den aktuellen Bestand

### 1. User und Profil

Bestehend:
- `public.profiles`
- Edge Function `supabase/functions/profile-bootstrap`

Heute bereits vorhanden:
- Profilanlage fuer `auth.users`
- deterministische Club-Aufloesung auf Basis von `profiles.club_id` und `user_roles`
- automatische Vergabe bzw. Ergaenzung von `member_no`

Ergaenzung:
- `profiles.club_id` darf fuer Multi-Club nur als aktiver Kontext oder Default-Kontext gelesen werden, nicht als vollstaendige Membership-Wahrheit.
- Fachliche Mehrfachzuordnung bleibt in Rollen- und Identity-Tabellen.

Kein Neubau:
- keine zweite Profil-Haupttabelle
- keine Frontend-only Nutzerzuordnung

### 2. Membership und Club-Mitgliedsidentitaet

Bestehend:
- `public.user_roles`
- `public.club_user_roles`
- `public.club_member_identities`
- `public.club_members`

Heute bereits vorhanden:
- Legacy-Rollen ueber `user_roles`
- neue club-scoped ACL ueber `club_user_roles`
- Mapping `club_id + user_id -> member_no` ueber `club_member_identities`
- Mitgliederverzeichnis ueber `club_members`

Ergaenzung:
- operative Doku behandelt `Membership` als zusammengesetzte Fachlogik aus:
  - Club-Mitgliedszuordnung
  - Rollenvergabe
  - Identity-Mapping
- wenn spaeter eine explizite `memberships`-Tabelle eingefuehrt wird, darf sie den Bestand nur verdichten, nicht parallel widersprechen.

Migrationsrisiko:
- Doppelwahrheiten zwischen `user_roles` und `club_user_roles`
- `profiles.club_id` als scheinbar einzige Clubquelle

### 3. Invite-System

Bestehend:
- `club-invite-create`
- `club-invite-verify`
- `club-invite-claim`
- `app_secure_settings` fuer Invite-Speicherung

Heute bereits vorhanden:
- Invite-Token nur gehasht gespeichert
- Ablauf, Nutzungszaehler und `used_user_ids`
- Manager-Pruefung auf Club-Ebene
- idempotente Nutzung pro User

Ergaenzung:
- Invite-Lifecycle bleibt im Bestand und wird nicht in neue Tabellen verschoben, solange kein klarer Mehrwert entsteht.
- Zusaetzliche Auditierung und Widerruf koennen auf dem bestehenden Muster aufbauen.

Kein Neubau:
- keine separate Invite-Datenbankstruktur ohne Migrationsgrund

### 4. Club-Erstellung und Setup

Bestehend:
- `club-admin-setup`
- `app_secure_settings`
- `club_roles`
- `club_user_roles`
- `club_module_usecases`
- `water_bodies`

Heute bereits vorhanden:
- Club-Code-Reservierung
- Club-Name-Speicherung
- Kernrollen und ACL-Grundlage
- Modulfreischaltung pro Club
- optionale initiale Gewaesseranlage

Ergaenzung:
- fuer echten Setup-Fortschritt fehlt noch ein explizites Persistenzmodell fuer Modulstatus oder fachliche Completion.
- bis dahin darf Setup-Abschluss nur aus belastbaren Daten abgeleitet werden, nicht aus UI-Marker allein.

Migrationsrisiko:
- Status nur in UI-Logik statt serverseitig ableitbar

### 5. Governance und ACL

Bestehend:
- `club_roles`
- `club_role_permissions`
- `club_user_roles`
- `module_catalog`
- `module_usecases`
- `club_module_usecases`

Heute bereits vorhanden:
- core Rollen `member`, `vorstand`, `admin`
- usecase-basierte Rechte
- club-scoped Zugriff

Ergaenzung:
- Onboarding muss diese Tabellen wiederverwenden, nicht parallel eigene Setup-Rollenmodelle bauen.

Kein Neubau:
- keine zweite Rollenlogik neben `club_user_roles`

### 6. CSV-Import und Mitgliederbasis

Bestehend:
- `public.club_members`
- `public.members`
- `public.member_bank_data`
- `public.membership_applications`

Heute bereits vorhanden:
- Mitgliederverzeichnis im Verein ueber `club_members`
- formaler Mitgliedsantrag ueber `membership_applications`
- strukturierte Personendaten ueber `members`

Mapping-Entscheidung:
- Onboarding-Import fuer Vereinsmitglieder mappt primaer auf `club_members`
- spaetere tiefergehende Stammdaten oder Bankdaten bleiben in den existierenden Membership-/Member-Strukturen

Migrationsrisiko:
- Verwechslung zwischen Vereinsverzeichnis `club_members` und Antragssystem `membership_applications`

### 7. Billing / Stripe

Bestehend:
- im Bestand aktuell noch keine produktive Stripe-Persistenz sichtbar
- Architekturvorgabe `webhook only` existiert, technische Implementierung fehlt noch

Ergaenzung notwendig:
- klare Billing-Tabelle oder sichere Persistenz fuer Subscription-Status
- Webhook-Dedupe
- Club-Referenzierung
- Re-Checkout-Flow

Wichtig:
- Billing ist der Bereich mit dem groessten echten Neubedarf.
- Dieser Neubedarf muss an den bestehenden Club- und Statusmodellen andocken, nicht daran vorbei arbeiten.

## Sichtbares Zielmodell ohne unnötigen Neubau

- `profiles` bleibt Nutzerbasis
- `club_members` bleibt Mitgliederverzeichnis
- `club_member_identities` bleibt Zuordnungsanker
- `user_roles` bleibt Legacy-/Kompatibilitaetsanker
- `club_user_roles` bleibt Zielmodell fuer club-scoped Rechte
- `app_secure_settings` bleibt temporaer Heimat fuer Club-Metadaten und Invite-Records
- neues Billing-Modell darf nur dort entstehen, wo der Bestand aktuell noch keine belastbare Struktur hat
