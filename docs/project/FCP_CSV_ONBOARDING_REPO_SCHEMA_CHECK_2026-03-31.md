# FCP CSV Onboarding – Repo- und Schema-Check

Stand: 2026-03-31

## Einordnung

Diese Einschaetzung ist **repo- und schema-nah**.

Sie basiert auf den im Repo vorhandenen Migrationen, Functions und den aktuell genutzten Registry-/Onboarding-Pfaden.

Wichtig:

- das ist **kein Live-DB-Introspect**
- sondern eine Pruefung gegen den **real vorhandenen Codepfad**
- inklusive der Stellen, an denen die aktuelle Struktur fuer ein CSV-Onboarding-MVP gut passt oder noch bremst

## Ziel

Zielbild fuer das MVP:

> Anmelden -> zahlen -> CSV hochladen -> Verein ist arbeitsfaehig

Dabei gilt:

- kein Blind-Import
- Preview + Mapping + Confirm
- Mitglieder zuerst ueber `club_members`
- Gewaesser auf bestehende Vereinsgewaesser
- Karten im MVP als kontrollierte Kartentypen
- keine volle Historie und keine n:m-Explosion in V1

## Kurzfazit

### GO / NO GO

**GO mit kleinen, gezielten Migrationen.**

Die aktuelle Struktur ist fuer ein CSV-Onboarding-MVP **grundsaetzlich tragfaehig**, wenn ihr:

1. `club_members` als primären Mitglieds-Zielpfad nehmt
2. `members` **nicht** als verpflichtenden V1-Importpfad nehmt
3. Gewaesser gegen `water_bodies` schreibt
4. Karten **nicht** weiter nur als JSON in `app_secure_settings` belasst
5. fuer Import/Preview einen eigenen Backend-Pfad baut

**NO GO** waere es nur dann, wenn V1 gleichzeitig leisten soll:

- individuelle Rollen pro Mitglied vor User-Aktivierung ueber `club_user_roles`
- mehrere Karten pro Mitglied
- Kartenhistorie
- Mitgliedschaftshistorie
- perfekte Dublettenzusammenfuehrung

Das passt nicht mehr in die kleinste tragfaehige V1.

## 1. Direkt nutzbare bestehende Tabellen

### 1. `public.club_members`

Das ist der **richtige primaere Zielpfad fuer das MVP**.

Warum:

- dort liegt bereits die vereinsbezogene Mitgliedslogik
- die Member Registry arbeitet bereits darauf
- aktuelle Felder wie:
  - `club_id`
  - `club_code`
  - `member_no`
  - `club_member_no`
  - `first_name`
  - `last_name`
  - `status`
  - `membership_kind`
  - `fishing_card_type`
  - `role`
  - `wiso_roles`
- passen viel besser zu einem schnellen Vereins-Onboarding als `members`

Fazit:

- **Ja, direkt nutzbar**
- **Hauptzielpfad fuer V1**

### 2. `public.water_bodies`

Das ist der **richtige bestehende Zielpfad fuer Gewaesser**.

Warum:

- bereits produktiv fuer Gewaesserkontext vorhanden
- im Club-Onboarding-Workspace bereits genutzt
- club-bezogen seit `club_id`-Rollout

Fazit:

- **Ja, direkt nutzbar**
- aber es gibt ein wichtiges Constraint-Problem, siehe unten

### 3. `public.club_onboarding_state`

Bereits vorhanden und fuer den Flow sehr nuetzlich.

Relevante Felder:

- `setup_state`
- `billing_state`
- `portal_state`
- `club_data_complete`
- `waters_complete`
- `cards_complete`
- `members_mode`

Fazit:

- **Ja, direkt nutzbar**
- besonders fuer:
  - `members_mode = imported`
  - Fortschrittsanzeige
  - Onboarding-Status

### 4. `public.club_onboarding_audit`

Bereits vorhanden und passend fuer:

- Import gestartet
- Preview erzeugt
- Mapping bestaetigt
- Import abgeschlossen
- Import verworfen

Fazit:

- **Ja, direkt nutzbar**
- fuer MVP-Audit reicht das bereits gut

### 5. `public.club_roles`

Sinnvoll als Ziel fuer konfigurierte Vereinsrollen.

Fazit:

- **Ja, als Rollenstamm nutzbar**
- aber nicht allein ausreichend fuer importierte Mitgliederrollen

### 6. `public.club_user_roles`

Nur eingeschraenkt nutzbar.

Problem:

- Tabelle braucht `user_id`
- importierte CSV-Mitglieder haben in der Regel **noch keinen Auth-User**

Das ist ein zentraler Repo-/Schema-Punkt.

Fazit:

- **nicht** primaerer Zielpfad fuer CSV-importierte Mitgliederrollen
- erst spaeter sinnvoll, wenn ein Mitglied einem echten Benutzerkonto zugeordnet ist

### 7. `public.club_member_identities`

Wichtig, aber **nicht** primärer CSV-Importpfad.

Problem:

- koppelt `club_id + user_id + member_no`
- setzt also ebenfalls einen existierenden User voraus

Fazit:

- fuer Invite/Claim/Link spaeter relevant
- fuer V1-Import nicht das Hauptziel

### 8. `public.members`

Fuer das MVP **nicht** der richtige Hauptzielpfad.

Warum:

- Tabelle ist staerker aus dem Membership-/Antragskontext gewachsen
- erwartet bereits mehr persoenliche Verwaltungsdaten
- aktuelle Registry-RPCs schreiben dort mit Platzhalterwerten hinein
- das ist fuer ein CSV-Schnell-Onboarding fachlich zu schwer und zu frueh

Fazit:

- **nicht** als primaeres V1-Ziel
- hoechstens spaeter als zweiter, kontrollierter Sync-Pfad

## 2. Problematische Tabellen / Constraints

### A. `public.members` ist fuer CSV-Onboarding V1 zu schwer

Aktuelle Probleme:

- starke Kopplung an Address-/Personendaten
- historisch aus Membership-Applications gewachsen
- Registry-Create schreibt heute bereits Hilfs-/Placeholder-Werte hinein
- das fuehrt bei CSV-Minimaldaten schnell zu fachlich duennen oder kuenstlichen Datensaetzen

Konsequenz:

- V1 nicht direkt gegen `members` bauen

### B. `admin_member_registry_create` ist fuer CSV-V1 ungeeignet

Aktuelle Repo-Realitaet:

- die RPC schreibt **dual** in:
  - `club_members`
  - `members`

Das ist fuer Registry okay, aber fuer CSV-Onboarding-MVP zu schwer.

Konsequenz:

- fuer CSV-Import braucht ihr **einen eigenen Importpfad**
- nicht einfach die bestehende Registry-Create-RPC wiederverwenden

### C. `water_bodies` hat aktuell die falsche Eindeutigkeit fuer Multi-Club-MVP

Im Repo liegt historisch:

- `unique (name, area_kind)`

Das ist fuer club-spezifische Gewaesser zu eng.

Denn fachlich soll moeglich sein:

- gleicher Gewaessername in mehreren Vereinen

Konsequenz:

- fuer CSV-Onboarding muss die Eindeutigkeit auf Club-Ebene gezogen werden

### D. `club_members.role` ist fuer frei konfigurierbare Rollen nicht sauber genug

Historisch kommt `club_members.role` aus einem Kernrollenkontext:

- `member`
- `vorstand`
- `admin`

Problem:

- ihr habt inzwischen `club_roles`
- ihr wollt neue Rollen konfigurieren
- importierte Mitglieder haben aber oft noch keinen User
- `club_user_roles` braucht `user_id`

Konsequenz:

- frei konfigurierbare Rollen koennen fuer importierte Mitglieder nicht sauber nur ueber `club_user_roles` getragen werden
- und `club_members.role` ist als einziges Ziel zu eng

### E. Karten liegen aktuell im Onboarding noch als JSON-Settings

Aktueller Pfad:

- `club_cards:{clubId}` in `app_secure_settings`

Das funktioniert fuer das bestehende Workspace-UI, ist aber fuer CSV-Mapping nur bedingt gut:

- keine echte Tabelle
- keine stabile Referenzierung
- keine eindeutige Fachquelle

Konsequenz:

- fuer CSV-V1 besser eine kleine echte Kartentyp-Tabelle anlegen

### F. `WORK_HOURS` hat aktuell keinen passenden kleinen Zielpfad

Vorhanden sind:

- `work_events`
- `work_participations`
- weitere Arbeitszeit-/Einsatztabellen

Was aber fehlt:

- ein einfacher Vereins-Arbeitsstunden-Grundwert / Modell

Konsequenz:

- `WORK_HOURS` sollte im MVP nicht direkt in operative Stundenbuchungen importiert werden
- dafuer braucht ihr ein kleines Settings-/Model-Objekt

## 3. Minimale Migrationen fuer tragfaehige V1

Wenn ihr V1 klein und sauber halten wollt, wuerde ich diese Migrationen als Minimum empfehlen:

### 1. `water_bodies` club-scoped unique machen

Von:

- global `unique (name, area_kind)`

Zu:

- `unique (club_id, normalized_name, area_kind)`

Praktisch z. B. ueber einen eindeutigen Index auf:

- `club_id`
- `lower(trim(name))`
- `area_kind`

Das ist fuer V1 wichtig.

### 2. Neue Tabelle `club_card_types`

Warum:

- Karten aktuell nur als JSON-Setting
- CSV-Mapping braucht stabile Entitaeten

Minimal:

- `id`
- `club_id`
- `card_key`
- `label`
- `is_active`
- `is_default`
- `created_at`
- `updated_at`

### 3. Neue Tabelle `club_work_models` oder `club_work_settings`

Warum:

- `WORK_HOURS` braucht einen fachlichen Zielpfad

Minimal:

- `club_id`
- `required_hours_per_year`
- `youth_required_hours`
- `adult_required_hours`
- `is_enabled`
- `updated_at`

Wenn ihr es noch kleiner wollt:

- `club_work_settings(club_id primary key, required_hours_per_year int, updated_at timestamptz)`

### 4. Optional, aber sehr sinnvoll: `club_csv_import_jobs`

Wenn ihr Previews nicht rein transient halten wollt.

Minimal:

- `id`
- `club_id`
- `status`
- `source_filename`
- `csv_version`
- `uploaded_by`
- `preview_payload jsonb`
- `mapping_payload jsonb`
- `result_payload jsonb`
- `created_at`
- `updated_at`

### 5. Optional, aber fachlich sauber fuer Rollen: `club_member_roles`

Nur noetig, wenn CSV-Rollen bereits vor User-Aktivierung mehr sein sollen als Kernrollen.

Minimal:

- `club_id`
- `member_no`
- `role_key`

Mit FK auf:

- `(club_id, role_key) -> club_roles`
- `(club_id, member_no) -> club_members`

Das loest genau den aktuellen Bruch:

- importiertes Mitglied hat noch keinen `user_id`
- Rolle ist trotzdem fachlich zugeordnet

## 4. Neue Tabellen – minimale Empfehlung

### A. `club_card_types`

**Empfehlung: Ja**

Das ist die wichtigste neue V1-Tabelle.

### B. `club_work_settings` oder `club_work_models`

**Empfehlung: Ja**

Aber klein halten.

Ich wuerde fuer V1 eher `club_work_settings` nehmen statt eines grossen Modells.

### C. `club_csv_import_jobs`

**Empfehlung: Optional, aber sehr sinnvoll**

Wenn ihr:

- Upload neu laden koennen wollt
- Preview persistent halten wollt
- Fehler nachvollziehen wollt
- Audit/Support ernst nehmt

dann lohnt sich die Tabelle sofort.

Wenn ihr absolut klein bleiben wollt:

- Preview nur im Arbeitsspeicher / Request-Kontext
- Import-Audit nur in `club_onboarding_audit`

## 5. Sinnvolle Endpoints / RPCs

Ich wuerde die CSV-Strecke **nicht** in die bestehende Registry-RPC pressen.

### Empfehlung: Edge Functions fuer Upload / Preview / Confirm

#### 1. `csv-onboarding-preview`

Aufgabe:

- CSV entgegennehmen
- Header pruefen
- Rohzeilen parsen
- normalisieren
- Kandidaten fuer Rollen / Karten / Gewaesser erkennen
- Konflikte / Fehler / Warnungen erzeugen
- Preview-DTO zurueckgeben

#### 2. `csv-onboarding-confirm`

Aufgabe:

- bestaetigte Mappings entgegennehmen
- Mitglieder in `club_members` schreiben
- Gewaesser in `water_bodies` anlegen/verwenden
- Kartentypen in `club_card_types` anlegen/verwenden
- Onboarding-State/Audit fortschreiben

#### 3. Optional: `csv-onboarding-job-get`

Nur wenn Preview persistiert wird.

### RPCs nur fuer einzelne kontrollierte Writes

Wenn ihr RPCs nutzen wollt, dann eher intern fuer:

- `csv_import_upsert_club_member`
- `csv_import_upsert_water_body`
- `csv_import_upsert_card_type`
- `csv_import_mark_onboarding_members_imported`

Aber:

- Upload, Parsing und Preview eher als Function
- nicht als nackte RPC

## 6. Richtige Zielstruktur fuer V1

### Empfohlene Zielstruktur

V1 sollte aus meiner Sicht schreiben nach:

1. `club_members`
2. `water_bodies`
3. `club_card_types`
4. `club_onboarding_state`
5. `club_onboarding_audit`

Optional:

6. `club_csv_import_jobs`

### Nicht primär in V1

- `members`
- `club_member_identities`
- `club_user_roles`

Diese Tabellen sind fuer spaetere Aktivierung / Self-Service / Portalnutzung wichtig, aber nicht fuer den kleinsten arbeitsfaehigen CSV-Start.

## 7. Was ich explizit NICHT in V1 bauen wuerde

Bewusst weglassen:

- Dual-Write nach `members`
- Kartenhistorie
- mehrere Karten pro Mitglied
- Mitgliedschaftshistorie
- automatische Jugend->Erwachsen-Logik
- automatische Dublettenfusion
- vollstaendige Rollenprojektion auf `club_user_roles`
- Arbeitsstunden-Buchungsimporte
- Gewaesser-/Karten-n:m
- fuzzy Auto-Matching

## 8. Kleinste umsetzbare V1 im aktuellen System

Die kleinste tragfaehige V1 ist:

### Mitglieder

- Import nach `club_members`
- Pflichtfelder:
  - `club_id`
  - `club_code`
  - `club_member_no`
  - `first_name`
  - `last_name`
  - `status`
  - `fishing_card_type` oder spaeter Mapping auf `club_card_types`
- `member_no` intern automatisch generieren

### Gewaesser

- Import / Mapping nach `water_bodies`
- zusammenfuehren ueber normalisierten Namen + `area_kind`

### Karten

- neue `club_card_types`
- Mitglied bekommt in V1 genau einen aktuellen Kartentyp

### Rollen

- fuer absolute Minimalversion:
  - Mapping nur auf Kernrollen
  - Speicherung vorerst in `club_members.role`
- wenn neue Rollen vor Benutzeraktivierung noetig sind:
  - `club_member_roles` ergaenzen

### Onboarding

- `club_onboarding_state.members_mode = 'imported'`
- Audit-Eintrag in `club_onboarding_audit`

## 9. Wichtigste Realitaetschecks gegen den aktuellen Stack

### Realitaetscheck 1

`club_members` ist heute der richtige operative Vereins-Member-Pfad.

### Realitaetscheck 2

`members` ist heute fuer CSV-V1 zu schwer und zu frueh.

### Realitaetscheck 3

`club_user_roles` loest nicht das Problem importierter Mitglieder ohne `user_id`.

### Realitaetscheck 4

`water_bodies` ist nutzbar, aber braucht club-scoped uniqueness.

### Realitaetscheck 5

Karten als `app_secure_settings`-JSON sind fuer CSV-Mapping auf Dauer zu weich.

## 10. Empfohlene minimale Migrationsliste

### Pflicht fuer tragfaehige V1

1. `water_bodies` uniqueness auf Club-Ebene ziehen
2. `club_card_types` anlegen
3. `club_work_settings` anlegen
4. neuen CSV-Importpfad bauen, der **nicht** `admin_member_registry_create` als Hauptweg nutzt

### Sehr sinnvoll

5. `club_csv_import_jobs` anlegen

### Nur falls freie Rollen vor User-Aktivierung noetig sind

6. `club_member_roles` anlegen

## 11. Empfohlene Backend-Schnittstellen

### Minimal

- `csv-onboarding-preview`
- `csv-onboarding-confirm`

### Optional

- `csv-onboarding-job-get`
- `csv-onboarding-job-cancel`

### Interne Hilfs-RPCs optional

- `csv_import_upsert_club_member`
- `csv_import_upsert_water_body`
- `csv_import_upsert_card_type`
- `csv_import_finalize_onboarding`

## Abschlussentscheidung

### GO

**GO fuer ein MVP auf aktueller Struktur**, wenn ihr die Zielstruktur bewusst klein haltet:

- `club_members`
- `water_bodies`
- `club_card_types`
- `club_onboarding_state`
- `club_onboarding_audit`

und `members` erstmal aus dem Importpfad heraushaltet.

### NO GO

**NO GO**, wenn V1 gleichzeitig schon sein soll:

- vollstaendige Mitgliedschaftsverwaltung
- freie Rollenlogik ohne Zusatzmodell
- Kartenhistorie
- Mehrfachkarten
- perfekte Identitaets- und Dublettenlogik

Dann wird es kein kleines CSV-Onboarding-MVP mehr, sondern ein groesseres Membership-/Governance-Projekt.
