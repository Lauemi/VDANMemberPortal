# ADM ClubSettings Legacy Mapping Review

## Ziel
Dieses Dokument extrahiert die alte ClubSettings-/Mitgliederverwaltungsmaske vollstaendig und mappt sie gegen die aktuelle [ADM_clubSettings.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/ADM_clubSettings.json).

Es ist bewusst:
- kein neues JSON
- kein freier Redesign-Vorschlag
- kein neuer ADM-Entwurf
- nur Bestandsaufnahme, Mapping und Gap-Review

## Gepruefte Quellen
- Alte Maske:
  - [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)
- Alte Runtime / dynamische UI:
  - [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js)
- Aktuelle Zielmaske:
  - [ADM_clubSettings.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/ADM_clubSettings.json)

## Kurzurteil
Die aktuelle `ADM_clubSettings.json` deckt bisher nur den kontrollierten Onboarding-Handoff ab:
- `Prozesskontext`
- `Routing/Handoff`
- teilweise `Billing` ueber `billing_status`

Der alte Bestand enthaelt deutlich mehr operative Admin-Funktionalitaet:
- Vereinsdaten bearbeiten
- Invite/QR erzeugen
- Mitglieder verwalten
- Rollen/ACL pflegen
- Gewaesser verwalten
- Detaildialoge

Diese operative Tiefe ist aktuell in `ADM_clubSettings.json` noch nicht enthalten.

## Statuslegende
- `bereits abgedeckt`
- `teilweise abgedeckt`
- `fehlt noch`
- `technisch blockiert`

## 1. Bestandsinventar der alten Maske

### Navigation / Workspace-Struktur
Quelle:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)

Elemente:
- Linke Workspace-Navigation
- Bereiche:
  - `Vereinsdaten`
  - `Mitglieder`
  - `Rollen / Rechte`
  - `Gewässer`
  - `Regelwerke`
  - `Ausweise`
  - `Arbeitseinsätze`
  - `Fangfreigaben`
  - `Einstellungen`

### Vereinsdaten
Quellen:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)
- [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js#L1718)

Elemente:
- Intro-Karte `Mitglieder-Registry`
- Statusmeldung `memberRegistryMsg`
- KPI-Karten:
  - `Verein`
  - `Mitglieder`
  - `Club-ID`
- Formularfelder:
  - `club_name`
  - `street`
  - `zip`
  - `city`
  - `contact_name`
  - `contact_email`
  - `contact_phone`
- Aktionen:
  - `Vereinsdaten speichern`
  - `Neu laden`
- Form-Status:
  - `clubDataFormMsg`

Bekannte technische Pfade:
- Read:
  - `club-onboarding-workspace` mit `action = "get"`
- Write:
  - `club-onboarding-workspace` mit `action = "save_club_data"`
- Fallback:
  - lokaler Draft `club:registry:club_data_draft:v1:<club_id>`

### Einladungsprozess
Quellen:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)
- [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js#L1839)

Elemente:
- Feld `clubInviteClubSelect`
- Feld `clubInviteCreateCode`
- Feld `clubInviteCreateMaxUses`
- Feld `clubInviteCreateDays`
- Aktion `Einladungs-QR erzeugen`
- Ergebnisbereich:
  - `clubInviteExpires`
  - `clubInviteQr`
  - `clubInviteToken`
  - `clubInviteUrl`
  - `clubInviteOpenUrl`
- Aktionen:
  - `Token kopieren`
  - `URL kopieren`
  - `Link öffnen`
- Status:
  - `clubInviteMsg`

Bekannte technische Pfade:
- Write:
  - Edge Function `club-invite-create`
- Vorbedingung:
  - `club_id`
  - berechtigter Vereinskontext / Admin- oder Vorstandsrolle

### Mitglieder
Quellen:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)
- [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js#L1116)

Elemente:
- Inline-Data-Table-Mount `memberRegistryInlineTableMount`
- Tabellen-/Toolbar-Funktionen:
  - Suche
  - Filter `Status`
  - Filter `Club`
  - Filter `Rolle`
  - Filter `Login`
  - Sortierung
  - Seitenwechsel
  - Spaltenwahl
  - `Neu laden`
  - `Neuer Eintrag`
- Tabellenfelder / Spalten:
  - `club_code`
  - `club_member_no`
  - `member_no`
  - `last_name`
  - `first_name`
  - `role`
  - `status`
  - `fishing_card_type`
  - `login_dot`
  - `last_sign_in_at`
  - `street`
  - `email`
  - `zip`
  - `city`
  - `phone`
  - `mobile`
  - `birthdate`
  - `guardian_member_no`
  - `sepa_approved`
  - `iban_last4`
  - `club_id`
  - `actions`
- Zeilenaktionen:
  - create
  - edit
  - delete
  - duplicate

Bekannte technische Pfade:
- Read:
  - RPC `admin_member_registry`
  - RPC `get_club_identity_map`
  - RPC `admin_user_last_signins`
  - REST `club_user_roles`
  - REST `profiles`
- Write:
  - RPC `admin_member_registry_create`
  - RPC `admin_member_registry_update`
  - RPC `admin_member_registry_delete`

### Rollen / Rechte
Quellen:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)
- [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js#L11)

Elemente:
- Rollenwahl `roleAclRoleSelect`
- Feld `roleAclNewRole`
- Aktionen:
  - `Rolle hinzufügen`
  - `Rolle löschen`
- ACL-Matrix mit Modulen:
  - `club_data`
  - `members`
  - `roles_acl`
  - `waters`
  - `rules`
  - `cards`
  - `work_events`
  - `catch_approvals`
  - `settings`
- ACL-Rechte je Modul:
  - `view`
  - `read`
  - `write`
  - `update`
  - `delete`
- Status:
  - `roleAclMsg`

Bekannter technischer Zustand:
- lokal persistierter Pilot-Stub
- LocalStorage:
  - `club:registry:acl_stub:v1`
- keine echte Backend-/RLS-Durchsetzung in der alten Maske

### Gewässer
Quellen:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)
- [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js#L1498)

Elemente:
- Inline-Table-Mount `memberRegistryWatersMount`
- Tabellenfelder:
  - `name`
  - `water_type`
  - `water_status`
  - `is_youth_allowed`
  - `requires_board_approval`
  - `water_cards`
  - `actions`
- Zeilenaktionen:
  - create
  - edit
  - delete
  - duplicate
- Filter:
  - `name`
  - `water_status`
  - `water_type`
  - `is_youth_allowed`
  - `requires_board_approval`
- Status:
  - `memberRegistryWatersMsg`

Bekannte technische Pfade:
- Read:
  - Edge Function `club-onboarding-workspace` mit `action = "get"`
- Write:
  - `create_water`
  - `update_water`
  - `delete_water`
  jeweils ueber `club-onboarding-workspace`

### Regelwerke / Ausweise / Arbeitseinsätze / Fangfreigaben / Einstellungen
Quelle:
- [mitgliederverwaltung.BackupoldProcess.astro](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro)

Elemente:
- je ein Placeholder-Panel mit:
  - Titel
  - Missing-Badge
  - kurzer Beschreibung

### Dialog / Detailpflege
Quelle:
- [member-registry-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-registry-admin.js#L1886)

Elemente:
- Dialog `Mitglied verwalten`
- Edit-Felder:
  - `club_member_no`
  - `member_no` readonly
  - `club_code` readonly
  - `club_id` readonly
  - `first_name`
  - `last_name`
  - `status`
  - `fishing_card_type`
  - `street`
  - `email`
  - `zip`
  - `city`
  - `phone`
  - `mobile`
  - `birthdate`
  - `guardian_member_no`
  - `sepa_approved`
  - `iban`
  - `iban_last4` readonly
  - `last_sign_in_at` readonly
- Create-Dialog:
  - `mrCreateClubId`
  - `mrCreateClubCode`
  - plus große Teile der oben genannten Felder
- Dialogaktionen:
  - `Speichern`
  - `Mitglied löschen`
  - `Schließen`

Bekannte technische Pfade:
- Write:
  - RPC `admin_member_registry_create`
  - RPC `admin_member_registry_update`
  - RPC `admin_member_registry_delete`

## 2. Mapping gegen aktuelle ADM_clubSettings.json

### A. Prozesskontext

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Workspace als Club-Board | Prozesskontext | `workspaceMode`, `workspaceNav`, `header` | `teilweise abgedeckt` | Grundstruktur vorhanden, aber nur ein reduzierter Onboarding-Workspace |
| Intro / Prozessstatus | Prozesskontext | Panel `club_settings_process_context` | `bereits abgedeckt` | Prozessstatus, aktueller Schritt, Billingstatus, Setupstatus sind vorhanden |
| Onboarding-Handoff-Regeln | Prozesskontext | `meta.processAdapter = club_settings_handoff` | `bereits abgedeckt` | Handoff ist explizit in der JSON beschrieben |

### B. Routing / Handoff

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Aktuelle bekannte ADM-Route `/app/mitgliederverwaltung/` | Routing/Handoff | Panel `club_settings_route_contract` | `bereits abgedeckt` | Route steht explizit in der JSON |
| Resume vor ADM auf `/verein-anfragen/` | Routing/Handoff | `resumeRouteBeforeAdm`, `resume_route` | `bereits abgedeckt` | Vertrag ist klar im JSON hinterlegt |
| Eintritt erst nach Billing oder Freigabe | Routing/Handoff | `entryRules.enterAdmAfterAnyOf` | `bereits abgedeckt` | Bedingung ist beschrieben |
| Invite-URL / Registrierungs-URL / Open-Link | Routing/Handoff | keine | `fehlt noch` | alter Invite-Prozess ist in ADM noch nicht modelliert |

Fehlende Fakten:
- fehlender `valuePath` fuer Invite-URL, Invite-Token, QR, Ablaufdatum
- fehlender Read-/Write-Pfad fuer Invite-Resultate in `ADM_clubSettings.json`
- fehlender `securityContext` fuer invite-basierten Adminbetrieb im Club-Kontext

### C. Billing

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Billingstatus | Billing | Feld `billing_status` | `teilweise abgedeckt` | Status ist sichtbar, aber kein Billing-Workspace vorhanden |
| Billing-UI / Aktionen | Billing | keine | `fehlt noch` | alter Bestand enthielt faktisch keine Billing-Oberfläche |

Fehlende Fakten:
- fehlende serverseitige Prozesswahrheit fuer Billing-Panel im ADM-Bereich
- fehlender Read-Pfad fuer Billing-Snapshot oder Subscription-Daten
- fehlender Write-Pfad fuer Billing-Aktionen

### D. Vereinsdaten

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| KPI `Verein` | Vereinsdaten | keine | `fehlt noch` | in ADM aktuell nicht enthalten |
| KPI `Mitglieder` | Vereinsdaten | keine | `fehlt noch` | in ADM aktuell nicht enthalten |
| KPI `Club-ID` | Vereinsdaten | keine | `fehlt noch` | in ADM aktuell nicht enthalten |
| Felder `club_name`, `street`, `zip`, `city`, `contact_name`, `contact_email`, `contact_phone` | Vereinsdaten | keine | `fehlt noch` | alter Bereich ist komplett nicht gemappt |
| Aktion `Vereinsdaten speichern` | Vereinsdaten | keine | `technisch blockiert` | aktuelles ADM ist bewusst readonly; alter Write-Pfad braucht Club-Kontext |
| Aktion `Neu laden` | Vereinsdaten | keine | `teilweise abgedeckt` | globales ADM-Load existiert, aber kein separater Vereinsdaten-Reload-Block |

Fehlende Fakten:
- fehlende `valuePath`s fuer Club-Stammdaten in `ADM_clubSettings.json`
- fehlende `payloadKey`s fuer editierbare Vereinsdaten
- fehlender Read-Pfad im ADM-JSON fuer `club_data`
- fehlender Write-Pfad im ADM-JSON fuer `save_club_data`
- fehlender tenant-/club-basierter `securityContext`

Bekannter alter Pfad:
- Edge Function `club-onboarding-workspace`
  - `action = "get"`
  - `action = "save_club_data"`

### E. Stammdaten

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Mitglieder-Inline-Tabelle | Stammdaten | keine | `fehlt noch` | in ADM noch kein Tabellenblock fuer Mitglieder |
| Dialog `Mitglied verwalten` | Stammdaten | keine | `fehlt noch` | kein Side-/Detailbereich in ADM vorhanden |
| Create/Edit/Delete/Duplicate Mitglieder | Stammdaten | keine | `technisch blockiert` | aktuelles ADM ist readonly und vor echtem Club-Kontext |
| Such-/Filter-/Sort-/Spaltenlogik | Stammdaten | keine | `fehlt noch` | keine ADM-Table-Config fuer Mitglieder vorhanden |
| Rollenanzeige pro Mitglied | Stammdaten | keine | `fehlt noch` | keine Feld- oder Spaltenabbildung |

Fehlende Fakten:
- fehlende `componentType = "inline-data-table"` oder `data-table`
- fehlende `tableConfig`
- fehlende `rowsPath`
- fehlende `valuePath`s fuer Member-Felder
- fehlende `payloadKey`s fuer Edit-Felder
- fehlender `securityContext` fuer club-scoped member administration

Bekannte alte Pfade:
- Read:
  - `admin_member_registry`
  - `get_club_identity_map`
  - `admin_user_last_signins`
- Write:
  - `admin_member_registry_create`
  - `admin_member_registry_update`
  - `admin_member_registry_delete`

### F. Rollen / Rechte

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Rollenwahl | Rollen/Rechte | keine | `fehlt noch` | kein Rollenpanel in ADM |
| Neue Rolle anlegen | Rollen/Rechte | keine | `technisch blockiert` | alter Stand war nur LocalStorage-Pilot |
| Rolle löschen | Rollen/Rechte | keine | `technisch blockiert` | keine serverseitige ACL-Wahrheit im alten Bestand |
| ACL-Matrix | Rollen/Rechte | keine | `fehlt noch` | nicht nach ADM gemappt |
| Modulrechte `view/read/write/update/delete` | Rollen/Rechte | keine | `fehlt noch` | kein JSON-Block vorhanden |

Fehlende Fakten:
- fehlender Read-Pfad fuer echte ACL-Matrix
- fehlender Write-Pfad fuer echte ACL-Matrix
- fehlende serverseitige Prozesswahrheit / Security-Wahrheit
- fehlender `securityContext` fuer Rollenpflege im Club-Kontext

Bekannter alter Zustand:
- technisch nur LocalStorage-Pilot
- keine belastbare Backend-Wahrheit

### G. Prozesskontext mit Invite

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Invite erzeugen | Prozesskontext | keine | `technisch blockiert` | braucht freigegebenen Club-Kontext und Rolle |
| QR/Token/URL anzeigen | Prozesskontext | keine | `fehlt noch` | kein Invite-Panel in ADM |
| Ablaufdatum anzeigen | Prozesskontext | keine | `fehlt noch` | kein Feld gemappt |

Fehlende Fakten:
- fehlender `valuePath` fuer Invite-Resultat
- fehlender Write-Pfad fuer `club-invite-create`
- fehlender `securityContext` mit `requiresTenantAccess = true`

### H. Gewässer

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Gewässer-Inline-Tabelle | Sonstiges | keine | `fehlt noch` | in ADM nicht enthalten |
| Felder `name`, `water_type`, `water_status`, `is_youth_allowed`, `requires_board_approval`, `water_cards` | Sonstiges | keine | `fehlt noch` | keine Gewässer-Blocks vorhanden |
| Create/Edit/Delete/Duplicate Gewässer | Sonstiges | keine | `technisch blockiert` | braucht Club-Workspace und Write-Pfade |

Fehlende Fakten:
- fehlender `componentType = "inline-data-table"`
- fehlende `tableConfig`
- fehlende `rowsPath`
- fehlende `valuePath`s / `payloadKey`s fuer Gewaesserfelder
- fehlender `securityContext` mit Club-/Tenant-Zugriff

Bekannter alter Pfad:
- Edge Function `club-onboarding-workspace`
  - `get`
  - `create_water`
  - `update_water`
  - `delete_water`

### I. Regelwerke / Ausweise / Arbeitseinsätze / Fangfreigaben / Einstellungen

| Legacy-Element | Kategorie | Aktuelle Abdeckung | Status | Begründung |
|---|---|---:|---|---|
| Regelwerke Placeholder | Sonstiges | keine | `fehlt noch` | in ADM nicht dargestellt |
| Ausweise Placeholder | Sonstiges | keine | `fehlt noch` | in ADM nicht dargestellt |
| Arbeitseinsätze Placeholder | Sonstiges | keine | `fehlt noch` | in ADM nicht dargestellt |
| Fangfreigaben Placeholder | Sonstiges | keine | `fehlt noch` | in ADM nicht dargestellt |
| Einstellungen Placeholder | Sonstiges | keine | `fehlt noch` | in ADM nicht dargestellt |

Fehlende Fakten:
- kein Read-Pfad
- kein Write-Pfad
- keine serverseitige Prozesswahrheit

## 3. Verdichtete Gap-Liste

### Bereits abgedeckt
- ADM-Workspace-Grundstruktur
- Prozesskontext-Handoff
- Resume-Regel vor ADM
- aktuelle bekannte Route `/app/mitgliederverwaltung/`

### Teilweise abgedeckt
- Billing nur als Statusfeld
- globale ADM-Struktur ohne operative Inhalte

### Fehlt noch
- Vereinsdaten-Panel
- Invite-/QR-Bereich
- Mitglieder-Tabelle
- Mitgliederdialog
- Rollen-/ACL-Panel
- Gewässer-Panel
- Placeholder-Bereiche fuer Regelwerke, Ausweise, Arbeitseinsätze, Fangfreigaben, Einstellungen

### Technisch blockiert
- alles, was echten Club-/Tenant-Kontext und Adminrechte braucht, solange `ADM_clubSettings.json` noch bewusst pre-tenant und readonly bleibt
- Rollen-/ACL-Write, weil der alte Stand selbst nur Pilot-Stub war

## 4. Was konkret fuer die naechste Ausbauphase fehlt

### Fehlende `valuePath`s
- Vereinsdaten:
  - `record.club_data.club_name`
  - `record.club_data.street`
  - `record.club_data.zip`
  - `record.club_data.city`
  - `record.club_data.contact_name`
  - `record.club_data.contact_email`
  - `record.club_data.contact_phone`
- Invite:
  - `record.invite_token`
  - `record.invite_register_url`
  - `record.invite_qr_url`
  - `record.invite_expires_at`
- Mitglieder:
  - alle Stammdatenfelder aus `admin_member_registry`
- Gewässer:
  - alle Workspace-Water-Felder

### Fehlende `payloadKey`s
- alle editierbaren Vereinsdatenfelder
- Mitgliederdialog-Felder
- Gewässer-Felder
- Invite-Generator-Felder

### Fehlende Read-/Write-Pfade
- Vereinsdaten:
  - `club-onboarding-workspace:get`
  - `club-onboarding-workspace:save_club_data`
- Invite:
  - `club-invite-create`
- Mitglieder:
  - `admin_member_registry`
  - `admin_member_registry_create`
  - `admin_member_registry_update`
  - `admin_member_registry_delete`
- Gewässer:
  - `club-onboarding-workspace:create_water`
  - `club-onboarding-workspace:update_water`
  - `club-onboarding-workspace:delete_water`

### Fehlender `securityContext`
- fuer alle echten Club-/Tenant-Bereiche:
  - `requiresTenantAccess = true`
  - rollenbasierte Freigabe
  - sauberer club-/tenant-bezogener `rlsKey`

### Fehlende serverseitige Prozesswahrheit
- wann der Wechsel von readonly ClubSettings in echte operative ClubSettings erfolgen darf
- wann Invite-Funktionen sichtbar und nutzbar sind
- wann Mitglieder-/Gewässerverwaltung im Onboarding bereits erlaubt ist
- wie Billing-/Approval-/Club-Freigabe den ADM-Umfang freischalten

## 5. Fazit

Die alte Mitgliederverwaltung ist fachlich viel groesser als die aktuelle `ADM_clubSettings.json`.

Der aktuelle ADM-Stand ist deshalb:
- als kontrollierter Handoff-Workspace stimmig
- als vollwertiger Ersatz der alten Mitgliederverwaltung noch nicht ausreichend

Die nächste saubere Ausbauphase sollte nicht frei UI erfinden, sondern diese alten Bloecke gezielt und nacheinander in `ADM_clubSettings.json` uebernehmen:
1. Vereinsdaten
2. Invite / Routing-Handoff
3. Mitglieder
4. Rollen / Rechte
5. Gewässer

Wichtig:
- erst Read-/Write-/Security-Wahrheit pro Block klarziehen
- dann JSON ergaenzen
- nicht alles auf einmal in eine scheinbar fertige ADM-Maske druecken
