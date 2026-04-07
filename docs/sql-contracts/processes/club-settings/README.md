# ClubSettings SQL Channel

Dieser Ordner ist der prozessuale Einstieg fuer den ClubSettings-Workspace.

## Betroffene Maske

- `docs/masks/templates/Onboarding/ADM_clubSettings.json`

## Prinzip

- SQL-Dateien sind hier pro ClubSettings-Bereich gruppiert.
- Jede Datei beschreibt den Datenvertrag fuer genau einen Panelblock.
- Die Maske referenziert diese Dateien direkt ueber `meta.sqlContract.sqlFile`.

## Bereiche

### Overview

- `overview/READ_process_context.sql`
- `overview/READ_request_audit.sql`
- `overview/READ_route_contract.sql`
- `overview/READ_onboarding_snapshot.sql`

### Club Data

- `club-data/READ_club_master_data.sql`
- `club-data/READ_club_approvals_inline_preview.sql`

### Invites

- `invites/READ_invite_create.sql`

### Members

- `members/READ_members_overview.sql`

### Roles

- `roles/READ_roles_backend_contract.sql`

### Waters

- `waters/READ_waters_overview.sql`

### Rules

- `rules/READ_rules_overview.sql`

### Cards

- `cards/READ_cards_overview.sql`

### Work

- `work/READ_work_overview.sql`

### Approvals

- `approvals/READ_approvals_overview.sql`

### Settings

- `settings/READ_settings_qfm.sql`

## Bereits konkret angebundene Live-/Referenzpfade

- `request_audit`
- `club_master_data`
- `invite_create`
- `members`
- `waters`
- `cards`

## Noch offene Vertragsluecken

- `club_approvals_inline_preview`
- `onboarding_snapshot`
- `rules`
- `work`
- `approvals`
- `settings`
- Teile von `process_context` und `route_contract` bleiben aktuell dokumentierende Vorschau

## Zielbild fuer weitere Prozesse

Jeder weitere Prozess sollte denselben Kanal bekommen:

- ein Prozessordner
- eine README
- SQL-Dateien nach Fachbereich
- direkte JSON-Referenz auf genau diese Prozessdateien
