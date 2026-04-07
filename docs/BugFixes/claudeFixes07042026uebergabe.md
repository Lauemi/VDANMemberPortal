Hier ist die vollständige Übergabe.

---

# FCP System Audit – Übergabe 07.04.2026

## Ausgangssituation

Das FCP-System (Fishing Club Portal) war technisch weit fortgeschritten aber vor dem Launch standen drei ungelöste Probleme:

**Problem 1 – Altlasten in der Datenbank.** Es existierten hunderte User-Accounts die über einen alten, unsauberen Auth-Prozess angelegt worden waren. Diese hatten keine echte Identity-Bindung, keinen Token-Match, keine E-Mail-Verifikation. Sie unterliefen damit die neue Auth-Logik die für den Launch verbindlich sein sollte. Solange diese Accounts existierten gab es zwei parallele Wahrheiten im System – den neuen sauberen Invite-Flow und den alten Legacy-Pfad.

**Problem 2 – Die drei Preview-Panels in ADM_CLUB_SETTINGS_ONBOARDING.** Der Kescher zeigte vier Panels in der Overview-Section mit offenen Issues. Drei davon hingen auf `local_only: app_status` statt auf echten Server-Pfaden. Es war unklar ob das Binding-Probleme, echte Backend-Gaps oder bewusst gehaltene Zustände waren.

**Problem 3 – Fehlende Verifikierbarkeit.** Es gab keinen automatisierbaren Test der schwarz auf weiß bestätigt was live ist und was nicht. Der Kescher-Export war manuell und browser-abhängig.

---

## Was wir gelöst haben

### Schritt 1 – DB-Bereinigung der Altlasten

Alle `member_*@members.vdan.local` Accounts wurden identifiziert. Das waren exakt 346 Accounts die über den alten Auth-Prozess ohne Token, ohne E-Mail-Match und ohne Mitgliedsanker reingekommen waren.

Die Bereinigung war nicht trivial weil das System eine tiefe FK-Kette hat. Wir haben die korrekte Löschreihenfolge erarbeitet:

1. `club_user_roles`
2. `user_roles`
3. `club_member_identities`
4. `club_members` (identity_id-basiert)
5. `canonical_memberships` (mit Schutz für echte Mitgliedsdaten ohne identity_id)
6. `catch_entries`, `fishing_trips`, `trip_catch_context`, `participation_core`
7. `gear_setups`, `item_ownership`
8. `notification_messages`, `notification_preferences`
9. `legal_event_log`, `import_jobs`
10. `proxy_profiles`
11. `profiles_platform`
12. `profiles`
13. `identity_core`
14. `auth.users`

Wichtig: Echte Mitgliedsdatensätze mit `identity_id = null` (importierte Vereinsdaten ohne Login) wurden dabei nicht angefasst. Der `canonical_memberships`-DELETE lief mit einem `NOT IN`-Schutz.

**Ergebnis:** 0 Altlasten in `auth.users`. Einzige verbleibende Auth-Wahrheit ist der neue Invite-Flow: Token + E-Mail-Match + Mitgliedsanker.

---

### Schritt 2 – Inventarisierung der Preview-Panels

Vor jedem Fix wurde der echte DB- und Funktionsbestand inventarisiert. Ergebnis:

`club_settings_process_context` – anschließbar, nur Key-Mapping nötig. `get_onboarding_process_state` existiert, liefert aber `process.status` statt `process_status` etc. Bewusst auf preview belassen bis das Mapping gemacht ist.

`club_settings_route_contract` – bewusst kein DB-Panel. `resume_route` und `adm_entry_route` sind hartcodierte Konstanten, keine DB-Ableitung. Das SQL-File sagt es selbst: Referenzvertrag, kein produktiver Read. Preview ist hier fachlich korrekt und bleibt so.

`club_settings_onboarding_snapshot` – echter GAP. Edge Function `club-onboarding-status` fehlte komplett als Wrapper. Die Datenquellen `club_onboarding_snapshot` und `club_billing_subscriptions` existierten bereits in der DB.

`club_settings_request_audit` – bereits live. `READ_EMPTY_RESULT` ist kein Bug sondern valider leerer Zustand wenn kein offener Request existiert.

---

### Schritt 3 – Kescher-Reader-Bug behoben

Parallel zur Panel-Analyse wurde ein systematischer Build-Bug gefunden: `normalizePanelMeta` in `fcp-mask-reader.mjs` verwarf beim Build die Felder `sqlContract`, `panelState`, `panelStateLabel` und `panelStateHint` still. Dadurch zeigte der Kescher `NO_SQL_CONTRACT_REFERENCE` auf allen 15 Panels gleichzeitig – obwohl die SQL-Verträge im JSON korrekt hinterlegt waren.

Fix: 4 Zeilen in `normalizePanelMeta` ergänzt. Danach korrekte SQL-Contract-Referenzen auf allen Panels sichtbar.

Zusätzlich wurde `structuredCloneSafe` als nicht-definierte Funktion im Resolver-IIFE gefunden und lokal ergänzt – ein pre-existing Bug der vorher nie aufgefallen war weil er erst unter bestimmten Panel-Zuständen triggerte.

---

### Schritt 4 – Edge Function gebaut und deployed

`supabase/functions/club-onboarding-status/index.ts` wurde vervollständigt. Die Datei existierte bereits aber war unfertig – kein Superadmin-Check, kein `x-vdan-access-token` Support.

Gebaut wurde:
- Auth via `getAuthUser` mit Multi-apiKey-Fallback identisch zum `club-onboarding-workspace`-Pattern
- Role-Check: Superadmin via `PUBLIC_SUPERADMIN_USER_IDS`, dann `club_user_roles` canonical, dann `user_roles` legacy
- `club_id` wird nur akzeptiert wenn der isAllowed-Check positiv ist – kein blindes Client-Trust
- Rückgabe: `{ ok, club_id, snapshot: {...}, billing: { billing_state } }`

Binding in `ADM_clubSettings.json` umgehängt: `local_only: app_status` → `edge_function: club-onboarding-status`.

Deploy mit `--no-verify-jwt` weil das Projekt ES256-JWTs nutzt und Supabase den Token sonst vor dem Function-Code ablehnt. Auth wird intern in der Function geprüft.

---

### Schritt 5 – Drei Bugs auf dem Weg gefixt

**Bug 1 – `forbidden_club_scope`:** `ensure_club_onboarding_state` prüft `is_service_role_request()` was bei ES256-JWTs false zurückgibt. Fix: `ensure_club_onboarding_state` aus dem Read-Pfad entfernt, Snapshot-RPC mit User-JWT aufgerufen. Der `is_admin_or_vorstand_in_club`-Guard lässt den bereits verifizierten User durch.

**Bug 2 – `column reference "club_id" is ambiguous`:** `club_onboarding_snapshot` hat `returns table(club_id uuid, ...)` deklariert. PostgreSQL kann nicht unterscheiden ob die Output-Spalte oder die Tabellenspalte gemeint ist. Fix als neue Migration `20260407_fix_club_onboarding_snapshot_ambiguous_club_id.sql` – alle ambiguous `club_id` Referenzen mit Tabellenalias qualifiziert.

**Bug 3 – `club_id` und `billing_state` fehlten im Response:** Die Edge Function gab `{ ok, snapshot, billing }` zurück aber `club_id` fehlte auf Root-Ebene und `billing` war bei leerem Billing-Datensatz `null`. Fix: `club_id` explizit auf Root-Ebene ergänzt, `billing` mit Fallback auf leeres Objekt abgesichert.

---

### Schritt 6 – 4 JSON-Korrekturen und 1 Resolver-Fix

Parallel wurden Kescher-Semantik-Fehler bereinigt:

`club_settings_cards_table`: `panelState: "teilweise_live"` → `"partial"` (kein valider Kescher-State). `meta.sourceTable` von v1 auf v2 korrigiert.

`club_settings_roles_backend_contract`: Explizit `panelState: "gap"` gesetzt weil der Kescher fälschlich `preview` ableitete obwohl kein Read-Pfad existiert.

`classifyWritePathState` im Resolver: Wenn `panelState === "gap"` → `"not_applicable"` statt doppeltem gap-Signal. Additiver Einzeiler, kein produktiver Pfad berührt.

---

### Schritt 7 – Hardening-Migration für get_onboarding_process_state

`20260407_harden_onboarding_process_state.sql` wurde als neue Migration gebaut:

`invite_state` – vorher Placeholder-String-Check, jetzt echte SHA-256-Validierung gegen `app_secure_settings` identisch zur `club-invite-verify` Edge Function. Liefert korrekt `NONE / ACTIVE / USED / EXPIRED / REVOKED / INVALID`.

`consent_state` – vorher versionsblind, jetzt gegen aktive Policy-Version aus `legal_documents` geprüft.

`actor.first_name` – war in der CTE vorhanden aber fehlte im Output.

`next_allowed_step_id` – war Kopie von `current_step_id`, jetzt echter Lookahead auf den nächsten nicht-blockierten Step.

---

### Schritt 8 – Audit-Script

`scripts/audit-panel-status.mjs` – läuft mit `node scripts/audit-panel-status.mjs`, liest `ADM_clubSettings.json` über den bestehenden Reader, prüft pro Panel `panelState`, `loadKind` und `saveKind` gegen einen hardcodierten Soll-Zustand, gibt klares PASS/FAIL aus. Exit-Code 0 = alles im Soll, Exit-Code 1 = Abweichung. CI-tauglich.

---

## Aktueller Stand

```
node scripts/audit-panel-status.mjs

✅ PASS  club_settings_request_audit                  live / rpc
✅ PASS  club_settings_onboarding_snapshot            live / edge_function
✅ PASS  club_settings_club_master_data               live / edge_function / edge_function
✅ PASS  club_settings_members_registry               live / rpc
✅ PASS  club_settings_waters_table                   live / edge_function
✅ PASS  club_settings_cards_table                    partial / rpc
✅ PASS  club_settings_invite_create                  partial / local_only / edge_function
✅ PASS  club_settings_process_context                preview / local_only
✅ PASS  club_settings_route_contract                 preview / local_only
✅ PASS  club_settings_club_approvals_inline_preview  preview / local_only
✅ PASS  club_settings_roles_backend_contract         gap / local_only
✅ PASS  club_settings_rules_table                    gap / local_only
✅ PASS  club_settings_work_helpers_table             gap / local_only
✅ PASS  club_settings_approvals_table                gap / local_only
✅ PASS  club_settings_settings_qfm                   gap / local_only

--- SUMMARY ---
15/15 Panels im Soll-Zustand
```

---

## Was bewusst offen bleibt

Die verbleibenden GAP-Panels sind keine Launch-Blocker sondern geplante nächste Bauphasen:

`roles_backend_contract` – club-scoped Read-RPC für Rollen-Übersicht fehlt noch. Backend-Tabelle existiert.

`work_helpers_table` – kombinierter Read über `work_events + work_participations + event_planner_*` fehlt. Einzelteile vorhanden.

`approvals_table` – Read-Vertrag für Fangfreigaben fehlt.

`rules_table` – kein Backend-Source für Regelwerke.

`settings_qfm` – kein Read-/Write-Vertrag für Club-Einstellungen.

`process_context` – Binding-Anpassung und Key-Mapping auf `get_onboarding_process_state` offen.

Alle diese Panels sind korrekt als `gap` oder `preview` markiert. Der Kescher lügt nicht mehr.