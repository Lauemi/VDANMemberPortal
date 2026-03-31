# FCP CSV Onboarding MVP – Technische TODO

Stand: 2026-03-31

## Zweck

Diese Datei beschreibt die **konkrete technische Umsetzung** fuer das CSV-Onboarding-MVP im FCP auf Basis des final abgestimmten Rahmens.

Verbindlicher Rahmen:

- primaerer Zielpfad: `club_members`
- `water_bodies` bleibt in V1 drin
- neue Tabelle `club_card_types`
- `members` und `club_user_roles` nicht als Primaerpfad
- minimale Endpoints:
  - `csv-onboarding-preview`
  - `csv-onboarding-confirm`
- Preview + Zuordnungspruefung + Confirm
- keine Vollmigration
- kein Blind-Import

## Zielbild

Ziel ist:

> Anmelden -> zahlen -> CSV hochladen -> Vorschau + Mapping -> bestaetigen -> Verein ist arbeitsfaehig

## 1. Minimale Migrationsliste

### MIG-001 – `water_bodies` club-scoped uniqueness korrigieren

Ziel:

- gleiche Gewaessernamen in verschiedenen Vereinen ermoeglichen
- Matching im CSV-Onboarding sauber auf Club-Ebene machen

Umsetzung:

- alten globalen Unique-Pfad aufloesen
- eindeutigen Index auf Club-Ebene setzen

Empfehlung:

- eindeutiger Index auf:
  - `club_id`
  - `lower(trim(name))`
  - `area_kind`

### MIG-002 – neue Tabelle `club_card_types`

Ziel:

- Kartentypen nicht mehr nur als JSON in `app_secure_settings`
- stabile Fachentitaet fuer CSV-Mapping und spaetere Registry

Minimalfelder:

- `id uuid primary key`
- `club_id uuid not null`
- `card_key text not null`
- `label text not null`
- `is_active boolean not null default true`
- `is_default boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Minimalregeln:

- `unique (club_id, card_key)`
- optional `unique (club_id, lower(trim(label)))`

### MIG-003 – neue Tabelle `club_work_settings`

Ziel:

- `WORK_HOURS` im MVP nicht in operative Arbeitsstundenbuchungen schreiben
- stattdessen in einen kleinen Vereins-Arbeitsstundenkontext ueberfuehren

Minimalfelder:

- `club_id uuid primary key`
- `required_hours_per_year integer`
- `is_enabled boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Optional spaeter:

- `adult_required_hours`
- `youth_required_hours`
- `grace_rules jsonb`

### MIG-004 – optionale Tabelle `club_csv_import_jobs`

Ziel:

- Preview und Mapping persistieren
- Support/Audit vereinfachen
- Abbruch/Fortsetzung ermoeglichen

Minimalfelder:

- `id uuid primary key`
- `club_id uuid not null`
- `status text not null`
- `source_filename text`
- `csv_version text`
- `uploaded_by uuid`
- `preview_payload jsonb not null default '{}'::jsonb`
- `mapping_payload jsonb not null default '{}'::jsonb`
- `result_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Statuswerte:

- `uploaded`
- `preview_ready`
- `confirmed`
- `imported`
- `failed`
- `aborted`

### MIG-005 – optional nur bei Bedarf: `club_member_roles`

Nur noetig, wenn importierte Mitglieder **vor User-Aktivierung** schon frei konfigurierbare Rollen erhalten muessen.

Minimalfelder:

- `club_id uuid not null`
- `member_no text not null`
- `role_key text not null`
- `created_at timestamptz not null default now()`

Schluessel:

- `primary key (club_id, member_no, role_key)`

FKs:

- `(club_id, member_no)` -> `club_members`
- `(club_id, role_key)` -> `club_roles`

## 2. Notwendige Constraint-Anpassungen

### C-001 – `water_bodies` Eindeutigkeit korrigieren

Aktuell problematisch:

- globaler Unique-Pfad auf Name/Area-Kind

Noetig:

- club-scoped uniqueness

### C-002 – `club_card_types` eindeutige Schluessel definieren

Noetig:

- `card_key` pro Club eindeutig
- optional `label` pro Club normalisiert eindeutig

### C-003 – keine CSV-V1-Kopplung an `members`

Wichtig:

- CSV-V1 darf keine Pflicht erzeugen, vollstaendige `members`-Saetze zu bauen
- bestehende RPCs, die dual in `club_members` + `members` schreiben, sind **nicht** Hauptimportpfad

### C-004 – keine CSV-V1-Kopplung an `club_user_roles`

Wichtig:

- importierte Mitglieder haben haeufig noch keinen `user_id`
- `club_user_roles` ist deshalb kein stabiler Primaerpfad fuer V1

## 3. Neue Tabellen

### Pflicht fuer V1

- `club_card_types`
- `club_work_settings`

### Sinnvoll fuer V1

- `club_csv_import_jobs`

### Nur falls Rollen vor User-Aktivierung frei gepflegt werden muessen

- `club_member_roles`

## 4. Endpoints / Functions / RPCs

## Minimaler Schnitt

### Function 1 – `csv-onboarding-preview`

Aufgabe:

- Datei entgegennehmen
- Header pruefen
- CSV parsen
- Zeilen normalisieren
- Rollen-/Karten-/Gewaesser-Kandidaten erkennen
- Preview-Datenstruktur erzeugen
- Konflikte markieren

Input:

- `club_id`
- Datei
- optional `delimiter`
- optional `csv_version`

Output:

- `ImportPreviewDTO`
- optional `import_job_id`

### Function 2 – `csv-onboarding-confirm`

Aufgabe:

- bestaetigte Mappings entgegennehmen
- Mitglieder nach `club_members` importieren
- Kartentypen nach `club_card_types` anlegen/verwenden
- Gewaesser nach `water_bodies` anlegen/verwenden
- `club_work_settings` aktualisieren, wenn `WORK_HOURS` vorhanden ist
- `club_onboarding_state` fortschreiben
- `club_onboarding_audit` schreiben

Input:

- `club_id`
- `import_job_id` oder `preview_payload`
- `role_mapping`
- `card_mapping`
- `water_mapping`
- `duplicate_strategy`

Output:

- Summary:
  - importierte Mitglieder
  - uebersprungene Zeilen
  - angelegte Kartentypen
  - angelegte Gewaesser
  - Warnungen

## Optionale interne RPCs

Nur wenn ihr Writes kapseln wollt:

- `csv_import_upsert_club_member`
- `csv_import_upsert_card_type`
- `csv_import_upsert_water_body`
- `csv_import_finalize_onboarding`

Aber:

- Upload, Preview und Confirm sollten als Edge Functions laufen
- nicht als reine Frontend->REST-Kette

## 5. UI-Screens / Komponenten

### UI-001 – CSV Upload Screen

Ort:

- im Club-Onboarding / Setup-Bereich

Funktionen:

- Datei waehlen
- CSV-Version anzeigen
- Separatorwahl optional
- Upload starten

### UI-002 – Preview / Mapping Screen

Pflichtbereiche:

- Zusammenfassung:
  - Zeilen gelesen
  - importierbar
  - Fehler
  - Warnungen
- Mitgliederliste
- Rollen-Mapping
- Karten-Mapping
- Gewaesser-Mapping
- Konfliktsektion

### UI-003 – Confirm Screen / Import Result

Anzeige:

- Anzahl importierter Mitglieder
- Anzahl angelegter Karten
- Anzahl angelegter Gewaesser
- uebersprungene Zeilen
- Link zu Registry / Gewaesser / Rollen

### Komponentenempfehlung

Fuer Preview und Konfliktlisten:

- `fcp-inline-data-table-v2`

Fuer Mappinggruppen:

- kompakte Mapping-Cards oder Tabellen

Nicht noetig fuer V1:

- komplexer Wizard mit 8 Schritten

## 6. Reihenfolge der Umsetzung

### Phase 1 – Datenbasis vorbereiten

1. `water_bodies` uniqueness auf Club-Ebene korrigieren
2. `club_card_types` anlegen
3. `club_work_settings` anlegen
4. optional `club_csv_import_jobs` anlegen

### Phase 2 – Backend Preview bauen

5. `csv-onboarding-preview` Function bauen
6. CSV-Parser + Normalization Layer bauen
7. PreviewDTO definieren
8. Rollen-/Karten-/Gewaesser-Kandidaten erkennen

### Phase 3 – Backend Confirm bauen

9. `csv-onboarding-confirm` Function bauen
10. Upsert-Logik fuer `club_members`
11. Upsert-Logik fuer `club_card_types`
12. Upsert-Logik fuer `water_bodies`
13. optional `club_work_settings` aus `WORK_HOURS` fuellen
14. `club_onboarding_state.members_mode = 'imported'`
15. Audit in `club_onboarding_audit`

### Phase 4 – UI bauen

16. Upload-Screen
17. Preview-/Mapping-Screen
18. Confirm-/Ergebnis-Screen

### Phase 5 – Abschluss

19. Happy-Path mit 100-500 Zeilen testen
20. Fehler-/Konfliktfaelle testen
21. Importierte Vereinsdaten in Registry / Gewaesser / Karten pruefen

## 7. Explizite Nicht-Ziele

Bewusst **nicht** Teil von V1:

- Vollimport nach `members`
- automatische Anlage von `club_user_roles` fuer importierte Mitglieder ohne User
- Mehrfachkarten pro Mitglied
- Kartenhistorie
- Mitgliedschaftshistorie
- automatische Jugend->Erwachsen-Regeln
- Arbeitsstundenbuchungsimporte
- fuzzy Auto-Matching
- automatische Dublettenfusion
- vollstaendige Beitrags- und Ehrungslogik
- vollstaendige Governance-Synchronisierung

## 8. Fachliche V1-Zielstruktur

### Mitglieder

Ziel:

- `club_members`

Pflichtwirkung:

- sichtbare Vereinsnummer
- Name
- Rolle
- Status
- aktueller Kartentyp

### Gewaesser

Ziel:

- `water_bodies`

### Karten

Ziel:

- `club_card_types`

### Arbeitsstunden

Ziel:

- `club_work_settings`

### Onboarding / Audit

Ziel:

- `club_onboarding_state`
- `club_onboarding_audit`
- optional `club_csv_import_jobs`

## 9. Technische Zielentscheidung

### Primaerpfad in V1

- `club_members`
- `water_bodies`
- `club_card_types`
- `club_work_settings`
- `club_onboarding_state`
- `club_onboarding_audit`

### Nicht Primaerpfad in V1

- `members`
- `club_user_roles`
- `club_member_identities`

## 10. Definition of Done fuer V1

V1 gilt als fertig, wenn:

1. CSV-Upload funktioniert
2. Header validiert werden
3. Preview erstellt wird
4. Rollen/Karten/Gewaesser vor Import gemappt werden koennen
5. Import erst nach Confirm erfolgt
6. Mitglieder in `club_members` landen
7. Gewaesser in `water_bodies` landen
8. Kartentypen in `club_card_types` landen
9. `members_mode` im Onboarding fortgeschrieben wird
10. Audit-Eintrag geschrieben wird
11. kein Blind-Import moeglich ist
12. keine Pflichtkopplung an `members` oder `club_user_roles` besteht
