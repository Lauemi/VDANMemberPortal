# Closing-Notiz 07.04.2026

Diese Notiz schließt den Stand vom 07.04.2026 für ClubSettings, Kescher, Onboarding-Overview und die zugehörige Gegenbewertung.

Sie fasst nicht neue Architektur zusammen, sondern den verifizierten Ist-Stand:
- was jetzt sauber läuft
- was bewusst noch preview oder gap ist
- was fachlich erledigt ist, aber formal noch Repo-Trail braucht

---

## 1. Geschlossener Stand

### ClubSettings / Kescher

Der ClubSettings-Bereich ist jetzt strukturell sauber eingeordnet.

Der wichtigste harte Beleg ist:

`node scripts/audit-panel-status.mjs`

Ergebnis:

`15/15 Panels im Soll-Zustand`

Damit ist schwarz auf weiß bestätigt:

- `club_settings_request_audit` läuft live über `rpc`
- `club_settings_onboarding_snapshot` läuft live über `edge_function`
- `club_settings_club_master_data` läuft live
- `club_settings_members_registry` läuft live über `rpc`
- `club_settings_waters_table` läuft live über `edge_function`
- `club_settings_cards_table` ist bewusst `partial`
- `club_settings_invite_create` ist bewusst `partial`
- `club_settings_process_context` ist bewusst `preview`
- `club_settings_route_contract` ist bewusst `preview`
- `club_settings_roles_backend_contract` ist bewusst `gap`
- `rules`, `work_helpers`, `approvals`, `settings_qfm` sind bewusst `gap`

Wichtig:
Der Kescher lügt an dieser Stelle nicht mehr. Er zeigt jetzt die reale Vertragslage statt diffuser Fehlbilder.

---

## 2. Technisch geschlossene Fixes

Diese Punkte sind repo-belegt.

### Snapshot-Panel

`club_settings_onboarding_snapshot` ist auf die Edge Function `club-onboarding-status` umgehängt.

Beleg:
- `docs/masks/templates/Onboarding/ADM_clubSettings.json`

### Snapshot-SQL-Bug

Die ambige `club_id`-Referenz in `club_onboarding_snapshot` wurde über Migration korrigiert.

Beleg:
- `supabase/migrations/20260407_fix_club_onboarding_snapshot_ambiguous_club_id.sql`

### Process-State-Hardening

Die Härtung von `get_onboarding_process_state` liegt als Migration vor.

Beleg:
- `supabase/migrations/20260407_harden_onboarding_process_state.sql`

Enthalten sind insbesondere:
- echte Invite-State-Validierung
- versionshartes Consent-State
- `actor.first_name`
- echter Lookahead für `next_allowed_step_id`

### Kescher-/Reader-Fixes

Die früheren Kescher-Fehlbilder wurden im Reader/Resolver sauberer gemacht.

Repo-belegt sind:
- Reader-Fix für `normalizePanelMeta`
- `structuredCloneSafe` im Resolver
- Status-/Semantik-Fixes für `gap`, `preview`, `sqlContract`

Belege:
- `scripts/fcp-mask-reader.mjs`
- `public/js/fcp-mask-data-resolver.js`

---

## 3. Fachlich erledigt, aber formal noch nicht sauber dokumentiert

### Auth-Altlasten

Die Legacy-Accounts `member_*@members.vdan.local` wurden fachlich bereinigt.

Aktueller Sachstand:
- diese Altlasten sind nicht mehr in `auth.users`
- damit gibt es nicht mehr zwei parallele Wahrheiten zwischen altem Legacy-Auth-Weg und neuem Invite-Flow

Wichtig:
Der Schritt ist fachlich erledigt, aber aktuell nicht als versionierter Migrationsschritt im Repo dokumentiert.

Das ist kein akuter Launch-Blocker mehr, aber ein formaler Nachweis fehlt.

Empfehlung:
- dokumentierende SQL-/Operations-Notiz ergänzen
- Löschlogik und Reichweite sauber festhalten

---

## 4. Bewusst offen

Diese Punkte sind keine verdeckten Fehler, sondern aktuell bewusst noch nicht live angeschlossen.

### Preview

- `club_settings_process_context`
  - fachlich anschließbar
  - noch Mapping-/Binding-Thema
- `club_settings_route_contract`
  - bewusst kein produktiver DB-Read
  - bleibt Vertrags-/Resolver-Panel

### Gap

- `roles_backend_contract`
- `work_helpers_table`
- `approvals_table`
- `rules_table`
- `settings_qfm`

Diese Bereiche brauchen noch echte fachliche Verträge oder einen bestehenden serverseitigen Read-/Write-Pfad.
Sie sind aber jetzt korrekt als `gap` markiert und werden nicht fälschlich als "kaputt" oder "fast live" dargestellt.

---

## 5. Gemeinsame Bewertung

Claude-Übergabe und Codex-Gegenbewertung laufen im Kern jetzt zusammen:

- ClubSettings ist für den aktuellen Scope sauber eingeordnet
- der Kescher ist als Diagnoseinstrument deutlich vertrauenswürdiger
- der Overview-Bereich ist nicht mehr unklar, sondern sauber getrennt in:
  - live
  - preview
  - gap

Der Unterschied bleibt:
- Claude dokumentiert zusätzlich operative und historische Schritte
- Codex trennt strenger zwischen repo-belegt und nur plausibel übergeben

Diese Trennung ist sinnvoll und soll beibehalten werden.

---

## 6. Nächster sicherer Schritt

Nicht neu bauen.
Nur sauber nachziehen.

Die nächsten sinnvollen Schritte sind:

1. formale Doku der Auth-Altlasten-Bereinigung ergänzen
2. `process_context` entscheiden:
   - bewusst preview lassen
   - oder kontrolliert auf echte führende Read-Wahrheit anbinden
3. die `gap`-Panels nacheinander nur dort schließen, wo bereits eine echte serverseitige Wahrheit existiert

---

## Kurzfazit

Der 07.04.2026 schließt nicht mit einer neuen Architektur, sondern mit einem deutlich saubereren Zustand:

- ClubSettings ist prüfbar
- Kescher ist belastbarer
- Overview ist semantisch geklärt
- Snapshot ist live
- Request Audit ist live
- offene Panels sind sichtbar als offene Panels

Der wichtigste harte Abschlussbeleg bleibt:

`node scripts/audit-panel-status.mjs`  
`15/15 Panels im Soll-Zustand`
