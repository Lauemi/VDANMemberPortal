# Codex-Gegenbewertung – FCP ClubSettings Stand 07.04.2026

Erstellt als Gegenbewertung zur Claude-Übergabe vom 07.04.2026.
Bewertet nach drei Kategorien: repo-belegt, plausibel aber nicht hart verifiziert, offen.

---

## 1. Repo-belegt und verifiziert

Diese Punkte sind durch Dateien und Audit-Ergebnisse direkt nachweisbar.

### Panel-Status: 15/15 im Soll-Zustand
- Beleg: `scripts/audit-panel-status.mjs`
- Ergebnis lokal: `15/15 Panels im Soll-Zustand`
- Konkret bestätigt:
  - `request_audit` = `live / rpc`
  - `onboarding_snapshot` = `live / edge_function`
  - `club_master_data` = `live / edge_function / edge_function`
  - `members_registry` = `live / rpc`
  - `waters_table` = `live / edge_function`
  - `cards_table` = `partial / rpc`
  - `invite_create` = `partial / local_only / edge_function`
  - `process_context` = `preview / local_only`
  - `route_contract` = `preview / local_only`
  - `roles_backend_contract` = `gap / local_only`
  - `rules_table`, `work_helpers_table`, `approvals_table`, `settings_qfm` = `gap / local_only`

### Edge Function club-onboarding-status eingehängt
- Beleg: `docs/masks/templates/Onboarding/ADM_clubSettings.json`
- `club_settings_onboarding_snapshot.loadBinding.kind` = `edge_function`
- `club_settings_onboarding_snapshot.loadBinding.target` = `club-onboarding-status`

### Migration club_onboarding_snapshot ambiguous club_id
- Beleg: `supabase/migrations/20260407_fix_club_onboarding_snapshot_ambiguous_club_id.sql`
- Behebt: `ERROR 42702: column reference "club_id" is ambiguous`

### Migration get_onboarding_process_state Hardening
- Beleg: `supabase/migrations/20260407_harden_onboarding_process_state.sql`
- Enthält: echte invite_state SHA-256-Validierung, versionshartes consent_state, actor.first_name, echter next_allowed_step_id Lookahead

### Kescher-Reader-Fix normalizePanelMeta
- Beleg: `scripts/fcp-mask-reader.mjs`
- Behebt: `NO_SQL_CONTRACT_REFERENCE` auf allen Panels durch stilles Verwerfen von sqlContract/panelState im Build-Schritt

### Resolver-Fix structuredCloneSafe
- Beleg: `public/js/fcp-mask-data-resolver.js`
- Behebt: `structuredCloneSafe is not defined` Laufzeitfehler

### JSON-Korrekturen ADM_clubSettings.json
- `club_settings_cards_table`: `panelState` von `"teilweise_live"` auf `"partial"`, `sourceTable` von v1 auf v2
- `club_settings_roles_backend_contract`: explizit `panelState: "gap"` gesetzt
- Resolver-Fix `classifyWritePathState`: `gap`-Panels lösen kein falsches Write-gap-Signal mehr aus

---

## 2. Plausibel aber nicht hart verifiziert

Diese Punkte sind fachlich konsistent aber ohne formalen Migrationsbeweis.

### Auth-Altlasten-Bereinigung (346 Accounts)
- Was passiert ist: Alle `member_*@members.vdan.local` Accounts wurden per direktem SQL im Supabase-Editor gelöscht.
- Aktueller Beleg: `SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@members.vdan.local'` = 0
- Was fehlt: Eine formale Migration als dauerhafter Nachweis. Der Delete war direktes SQL, kein versionierter Migrationsstep.
- Risiko: Kein Produktionsrisiko da die Accounts weg sind. Aber kein Audit-Trail im Repo.
- Empfehlung: Eine dokumentierende Migration `20260407_remove_legacy_member_accounts.sql` anlegen die den Sachverhalt beschreibt und die Löschreihenfolge dokumentiert – auch wenn die Daten längst weg sind.

### FK-Löschreihenfolge als kanonische Wahrheit
- Die erarbeitete Reihenfolge (14 Schritte von club_user_roles bis auth.users) ist korrekt aus den Constraint-Fehlern abgeleitet worden.
- Sie ist aktuell nur in der Claude-Übergabe dokumentiert, nicht im Repo.
- Empfehlung: In eine `docs/BugFixes/` oder `docs/operations/` Datei überführen.

---

## 3. Bewusst offen – keine Launch-Blocker

Diese Panels sind korrekt als gap oder preview klassifiziert und nicht für den Launch erforderlich.

| Panel | State | Was fehlt |
|---|---|---|
| `roles_backend_contract` | gap | club-scoped Read-RPC für Rollen-Übersicht |
| `work_helpers_table` | gap | kombinierter Read work_events + participations + event_planner |
| `approvals_table` | gap | Read-Vertrag Fangfreigaben |
| `rules_table` | gap | Backend-Source Regelwerke |
| `settings_qfm` | gap | Read-/Write-Vertrag Club-Einstellungen |
| `process_context` | preview | Binding-Anpassung + Key-Mapping auf get_onboarding_process_state |
| `route_contract` | preview | bewusst kein DB-Panel, bleibt Resolver-/JSON-Vertrag |

---

## Kurzfazit

Der ClubSettings-/Kescher-Stand ist jetzt strukturell sauber und verifizierbar.

Der härteste Beleg ist `node scripts/audit-panel-status.mjs` → `15/15`.

Der einzige echte Nachbesserungspunkt ist die fehlende Migrations-Dokumentation der Auth-Altlasten-Bereinigung. Fachlich ist das erledigt, formal fehlt der Repo-Trail.
