# ADM ClubSettings — Architecture Notes

Dieser Begleittext zu `ADM_clubSettings.json` dokumentiert offene Vertraege, GAP-Status,
Renderer-Entscheidungen und Sicherheitshinweise, die nicht zur Runtime der Maske gehoeren.

**Regel**: Nichts aus dieser Datei darf als panelState, loadBinding oder saveBinding in die
Laufmaske eingetragen werden. Laufmaske und Whiteboard bleiben getrennt.

---

## Panel-Status-Uebersicht

| Panel-ID | panelState | Hinweis |
|---|---|---|
| club_settings_process_context | live | Prozesskontext via public.get_onboarding_process_state |
| club_settings_onboarding_snapshot | preview | Routing-Werte lokal gespiegelt, kein serverseitiger Read-Pfad noetig |
| club_settings_club_data | live | Snapshot via Edge Function club-onboarding-status |
| club_settings_invite_compare | partial | Vergleichsflaeche sichtbar, kombinierter Live-Read-Vertrag fehlt noch |
| club_settings_invite_create | partial | Write-Pfad live, Read fuer letzten Invite lokal bis RPC-Fallback ausgerollt |
| club_settings_roles_panel | gap | Backend-Relation club_user_roles existiert, kein club-scoped Read-Vertrag |
| club_settings_waters_table | partial | Kartenzuordnung (card_keys) live auf permit_water_links; name/area_kind/is_active aus water_bodies. Felder water_type/water_status/is_youth_allowed/requires_board_approval sind Workspace-GAP (nicht in water_bodies). |
| club_settings_cards | live | Erste Ausweise-Uebersicht auf bestehender Mitglieder-/Profilwahrheit |
| club_settings_work | gap | ClubSettings-Reader fuer Helfer und Einsaetze fehlt noch |
| club_settings_approvals | gap | Fangfreigaben als Zielbereich angelegt, Live-Vertrag nicht belegt |
| club_settings_settings | gap | QFM-Flaeche zeigt Zielbild, serverseitiger Write-Vertrag fehlt noch |

---

## Offene Vertraege (specialCases)

### routing_contract — club_settings_resume_before_adm
Aktuell ist der bekannte Einstieg noch `/app/mitgliederverwaltung/`. Diese Maske beschreibt
denselben kuenftigen Bereich semantisch als ClubSettings, ohne die bestehende Route im Repo
bereits hart umzubenennen.

### contract_gap — club_settings_acl_backend_gap
Die alte ACL-Matrix war nur ein LocalStorage-Pilot. Fuer Rollen/Rechte wird erst dann ein
editierbarer Panel-Block sauber, wenn ein serverseitiger Read-/Write-Vertrag fuer
`club_user_roles` und Modulrechte explizit belegt ist.

### renderer_gap — club_settings_roles_matrix_renderer_gap
Fuer Rollen/Rechte existiert fachlich eine Matrix, aber aktuell keine angeschlossene
Rendererfunktion in ADM/QFM. Erst wenn DOM-, CSS-, Load-/Save- und Audit-Vertrag zusammen
definiert sind, darf hier eine echte Rechte-Matrix live gehen.

### audit_contract — club_settings_audit_auto_fields
Audit-Felder wie `created_at`, `created_by`, `updated_at` und `updated_by` werden serverseitig
gepflegt. Die Maske darf sie anzeigen, aber nicht frei im Frontend setzen.

### security_review_pending — club_settings_snapshot_security_pending
Snapshot- und Setup-Overview bleiben vorsichtig angebunden, bis `public.club_onboarding_snapshot`
und `public.get_onboarding_process_state` gegen den echten Zielstand serverseitig verifiziert sind.

### security_note — club_settings_edge_contracts_verified_locally
Die lokalen Edge-Functions `club-onboarding-workspace` und `club-invite-create` pruefen
Club-Ownership serverseitig. Remote-Deploy und Laufzeit muessen trotzdem separat gegen den
Zielstand verifiziert werden.

### ux_contract — club_settings_dual_access_approvals_helpers
Freigaben und Helfer koennen bewusst an zwei Stellen auftauchen: einmal im fachlich richtigen
Spezialbereich und einmal als Vergleichszugang innerhalb der Vereinsdaten. Die zweite Flaeche
dient der Bedienpruefung und ersetzt den spaeteren Spezial-Workflow nicht automatisch.

### contract_gap — club_settings_work_approvals_read_contract_pending
Fuer Helfer- und Freigabeflaechen existieren bereits Datenbausteine und Tabellen im Backend,
aber noch kein finaler kombinierter Board-Read-Vertrag fuer ADM. Der aktuelle Vertragsstand ist
in `docs/contracts/ADM_CLUB_SETTINGS_WORK_APPROVALS_CONTRACT.md` dokumentiert und darf erst
nach echter Read-Anbindung live gehen.

### renderer_contract — club_settings_adm_qfm_inner_content_contract
ADM bleibt die aeussere Maskenfamilie und der Workspace-Rahmen. Einzelne Inhaltsbloecke
innerhalb von ADM duerfen bewusst im QFM-Stil gerendert werden. Dafuer wird keine dritte
Maskenfamilie eingefuehrt, solange ADM den QFM-Inhalt ueber bestehende Form- und
Content-Renderer sauber tragen kann.

---

## Bankdaten-Vorbereitung (Bundle 7)

- `sepa_approved` (boolean): bereits live als Spalte in Vereinsverwaltung
- `iban_last4` (masked-text): bereits live als Anzeige-Spalte
- `iban` (write-only Input): ab diesem Stand neu als Edit-Spalte — sendet `p_iban` an
  `admin_member_registry_update`, wird serverseitig normalisiert und als `iban_hash`/`iban_last4`
  in `member_bank_data` gespeichert
- `bic`, `account_holder`: noch kein DB-Schema vorhanden → GAP, separater Migrations-Schritt
