# ADM/QFM Architektur-Prelauf – Repo-Wahrheit

## Zweck dieser Instruction

Diese Datei dient als dauerhafte Arbeitsgrundlage für CEO, FCP-Technical, FCP-CTO-Executor, FCP UX und QA im Repository `Lauemi/VDANMemberPortal`.

Sie beschreibt repo-wahr den aktuellen Stand des ADM/QFM-Maskensystems, die wichtigsten Pfade, die Render- und Datenflüsse, die Rolle der Inline-Data-Table sowie die Architekturregeln für zukünftige Arbeiten.

Diese Datei ist keine UI-Detailanalyse und kein Redesign-Auftrag. Sie ist ein Architektur-Preamble, damit künftige Agenten nicht blind einzelne Masken anfassen, sondern das System aus ADM, QFM, JSON, Renderer, Astro, Backend/Supabase/RPC/Edge und Komponenten verstehen.

---

## 1. Kurzfazit

Repo-Zugriff ist vorhanden auf `Lauemi/VDANMemberPortal`, Default-Branch `main`. Die geprüften Dateien liegen im Commit-Kontext `9eee60c03000f3b4f9dbdba24e1b20da7b746931` laut GitHub-Code-Suche; Einzeldateien wurden zusätzlich über `main` gelesen. Das ADM/QFM-System ist im Repo nicht nur Chat-Konzept, sondern bereits als Contract, JSON-Masken, Astro-Routen, Renderer und Tabellenkomponenten angelegt. Zentrale Wahrheit ist der Contract `docs/contracts/FCP_MASK_SYSTEM_CONTRACT.md`: eine Maske = eine JSON-Datei, Prefix `QFM` oder `ADM` bestimmt die Renderer-Familie, JSON beschreibt Struktur, aber Backend/RLS/RPC/Edge bleibt Sicherheits- und Prozesswahrheit.

Die Vereinsverwaltung läuft repo-wahr über `/app/mitgliederverwaltung/` und lädt `docs/masks/templates/Onboarding/ADM_clubSettings.json`. Diese ADM-Maske enthält den Menüpunkt `Vereinsverwaltung` als Workspace-Nav-Item mit Zielsection `club_settings_members`. Die konkrete sichtbare Mitglieder-/Vereinsverwaltung hängt am Panel `club_settings_members_registry` mit `componentType: "inline-data-table"`, `loadBinding.target: "public.admin_member_registry"` und `saveBinding.target: "public.admin_member_registry_update"`. Der Inline-Data-Table ist als Standardkomponente `fcp-inline-data-table-v2` vorhanden und für Mitglieder, Gewässer, Angelkarten, Regeln und weitere Admin-Pflegemasken vorgesehen.

Wichtigste strukturelle Lücke: Das System ist laut eigenem Contract noch im Aufbau; vollständige JSON-Steuerung, vollständiger Resolver, vollständige Validierung und vollständige ADM/QFM-Rendererabdeckung fehlen noch. Zusätzlich ist der Domain-Adapter der Vereinsverwaltung nicht rein deklarativ, sondern enthält aktive Fach-/Runtime-Logik. Das muss bei künftigen Standardisierungen berücksichtigt werden.

---

## 2. ADM/QFM-Grundmodell

Die Arbeitsdefinition wird repo-wahr bestätigt, mit einer wichtigen Schärfung:

ADM und QFM sind keine getrennten Welten. Der Contract sagt ausdrücklich: `QFM` = QuickflowMaske, `ADM` = Admin-Panel; beide teilen Datenmodell, Section-/Panel-Kern, Permissions, Load-/Save-Bindings, Field-Mapping, Meta-Mapping und Standardkomponenten. Unterschiede liegen in Darstellungskontext, Wrapper, Navigation, Layoutgewichtung und Full-Width-/Cockpit-Modus.

Kanonisch gilt:

- `QFM_*` → Quickflow-Renderer
- `ADM_*` → Admin-Panel-Renderer
- Dateiname ist Routing-/Renderer-Signal
- Prefix und `maskFamily` müssen übereinstimmen
- JSON ist Maskenwahrheit
- Renderer darf Struktur nicht erraten
- UI-Permissions ersetzen niemals RLS/RPC/Edge-Sicherheit

Der wichtigste Satz aus dem Repo:

> Modulplanung -> JSON -> Resolver -> Renderer -> fertige Maske

---

## 3. Pfadkarte

| Bereich | Pfad | Typ | Aufgabe | Sicherheit / Datenbindung |
|---|---|---|---|---|
| Mask-System Contract | `docs/contracts/FCP_MASK_SYSTEM_CONTRACT.md` | Contract | Grundvertrag für JSON, Prefix, Renderer, SecurityContext, Scope, Ownership, Bindings | Definiert: JSON beschreibt Sicherheitskontext; SQL/RLS/RPC/Edge setzen Sicherheit serverseitig durch. |
| ADM/QFM Interaction Contract | `docs/contracts/FCP_ADM_QFM_INTERACTION_CONTRACT.md` | Contract | Standardisiert Renderer, Table-Modi, Row-Events, Actions, Dialogpfade | Verbietet Parallel-Dialogsysteme, UI-Sicherheitslogik und neue Write-Pfade neben bestehenden Verträgen. |
| ADM Template | `docs/masks/templates/ADM_mask.template.json` | JSON Template | Basis-/Namensmuster für ADM-Masken | Über Mask-Contract relevant; konkrete Inhalte nicht vollständig geprüft. |
| QFM Template | `docs/masks/templates/QFM_mask.template.json` | JSON Template | Basis-/Namensmuster für QFM-Masken | Über Mask-Contract relevant; konkrete Inhalte nicht vollständig geprüft. |
| QFM Einstellungen | `docs/masks/templates/QFM_einstellungen.json` | QFM JSON | Einstellungsmaske | Wird u. a. durch `/app/einstellungen/` gefunden. |
| ADM ClubSettings | `docs/masks/templates/Onboarding/ADM_clubSettings.json` | ADM JSON | Admin-Workspace für Vereinsdaten, Einladungen, Vereinsverwaltung, Rollen/Rechte, Gewässer, Ausweise, Arbeitseinsätze usw. | Enthält `securityContext`, `loadBinding`, `saveBinding`, SQL-/Edge-/RPC-Verträge. |
| Vereinsverwaltung Section | `docs/masks/templates/Onboarding/ADM_clubSettings.json` → `club_settings_members` | ADM Section | Zielsection des Menüpunkts `Vereinsverwaltung` | Workspace-Slot `main`, Section-Layout `stack`. |
| Vereinsverwaltung Panel | `docs/masks/templates/Onboarding/ADM_clubSettings.json` → `club_settings_members_registry` | Inline-Data-Table Panel | Produktive Mitglieder-/Vereinsverwaltung | `loadBinding.target: public.admin_member_registry`, `saveBinding.target: public.admin_member_registry_update`, `resolver.requiresClubContext: true`, `resolver.enrichMemberRegistry: true`, `resolver.rowsPath: rows`. |
| QFM Club Entry | `docs/masks/templates/Onboarding/QFM_clubEntryBillingSignIn.json` | QFM JSON | Öffentlicher Vereinsanfrage-/Billing-/Sign-in-Einstieg | Wird von `src/pages/verein-anfragen.astro` geladen. |
| QFM Club Register | `docs/masks/templates/Onboarding/QFM_clubRegister.json` | QFM JSON | Onboarding-/Registrierungsmaske | Gefunden als Onboarding-QFM, Route nicht vertieft geprüft. |
| Vereinsverwaltung Route | `src/pages/app/mitgliederverwaltung/index.astro` | Astro Route | Hostet ADM ClubSettings für `/app/mitgliederverwaltung/` | Liest JSON per `readMaskJsonFile`, bootet `FcpMaskPageLoader` mit `rendererFamily: "ADM"`. |
| Verein anfragen Route | `src/pages/verein-anfragen.astro` | Astro Route | Hostet QFM Public Entry | Liest `QFM_clubEntryBillingSignIn.json`, transformiert Panels in QuickFlow-Struktur, bootet QFM. |
| Einstellungen Route | `src/pages/app/einstellungen/index.astro` | Astro Route | QFM-Einstellungen | Treffer vorhanden, nicht vollständig gelesen. |
| Mask Reader | `scripts/fcp-mask-reader.mjs` | Node Script | Liest/normalisiert Mask-JSONs | Bestandteil der Astro-Load-Kette. |
| Mask JSON Check | `scripts/check-mask-jsons.mjs` | Node Script | Validiert Mask-JSONs | Test-/Qualitätspfad für Masken. |
| Page Loader | `public/js/fcp-mask-page-loader.js` | Runtime Loader | Lädt Config aus Script-Tag, wählt ADM/QFM-Renderer, erzeugt Resolver, hydratisiert Panels | Entscheidet `rendererFamily === "ADM" ? AdminPanelMask.create : QuickFlowPattern.create`. |
| QFM Renderer | `public/js/quick-flow-pattern.js` | Renderer | Quickflow/QFM-Darstellung | Von QFM-Routen geladen. |
| QFM Renderer Case-Variante | `public/js/Quick-flow-pattern.js` | Renderer | Enthält ebenfalls aktive QFP-Renderlogik und ruft `FCPInlineDataTable.createStandardV2(...)` auf | Kein reiner Archivbestand; Case-/Pfad-Dopplung ist auditwürdig. |
| ADM Renderer | `public/js/admin-panel-mask.js` | Renderer | ADM/Admin-Panel-Darstellung | Von Vereinsverwaltung geladen. |
| Shared Renderer | `public/js/fcp-adm-qfm-shared-renderers.js` | Shared Runtime | Gemeinsame Renderer-/Panel-Logik | Von ADM-Route geladen. |
| Contract Hub | `public/js/fcp-adm-qfm-contract-hub.js` | Runtime Contract Layer | Gemeinsame Field-/Action-/Binding-Verträge | Von ADM/QFM-Routen geladen. |
| Data Resolver | `public/js/fcp-mask-data-resolver.js` | Runtime Data Layer | Load-/Save-Binding-Ausführung | Vom Page Loader vorausgesetzt. |
| Data Table | `public/js/fcp-data-table.js` | Tabellenkomponente | Standard `data-table` | In Vereinsverwaltung und QFM geladen. |
| Inline Data Table v2 | `public/js/fcp-inline-data-table-v2.js` | Tabellenkomponente | Standard `inline-data-table` mit Tabelle/Kartenmodus | Implementiert `viewMode`, `cards`, `table`, responsive Cards; steuert Optik indirekt über Klassen/Data-Attributes. |
| Table Dialog Host | `public/js/fcp-table-dialog-host.js` | Dialog Host | Dialogpfad für Table-Rows | Von Vereinsverwaltung geladen. |
| Vereinsverwaltung Domain Adapter | `public/js/domain-adapter-vereinsverwaltung.js` | Domain Adapter | Fachadapter für Vereinsverwaltung/Members | Enthält aktive Auth-/Session-, RPC-/Edge-, Club-Kontext-, Normalisierungs- und Mutationslogik; kein reines Config-File. |
| Member Registry Admin | `public/js/member-registry-admin.js` | Runtime/Domain Script | Relevanter Live-Pfad für produktive Mitgliederverwaltung und `createStandardV2` | Muss bei Standardisierung mitgeprüft werden. |
| QFM/OFM CSS | `public/css/ofmMask.css` | CSS | QFM/OFM-/Maskendarstellung | Von `verein-anfragen.astro` geladen. |
| Main CSS | `public/css/main.css` | CSS | Baseline-/Komponenten-Styles, u. a. Cards/Wrap/Layout-Anteile | Teil der finalen Inline-Data-Table-v2-Optik. |
| Global/Portal Redesign CSS | `public/css/redesign.css` | CSS | Globale Portal-/Redesign-Optik, Menü, Row-Actions, Theme, Feinschliff | Teil der finalen Inline-Data-Table-v2-Optik. |
| Inline Table Contract | `docs/fcp-components/FCP_INLINE_DATA_TABLE_V2_MASTER_CONTRACT.md` | Component Contract | Starres Standardtemplate für Admin-Inline-Tabellen | Definiert Shell, Toolbar, Cards-View, Domain-Config, Members-Regeln. |

---

## 4. Renderfluss

1. Astro-Route wird aufgerufen, z. B. `/app/mitgliederverwaltung/`.
2. Route importiert `readMaskJsonFile` aus `scripts/fcp-mask-reader.mjs`.
3. Route liest konkrete JSON-Maske, z. B. `docs/masks/templates/Onboarding/ADM_clubSettings.json`.
4. Astro baut aus der gelesenen Maske eine Runtime-Config, ergänzt `root`, Rollen und Scopes.
5. Config wird als JSON in ein `<script type="application/json">` geschrieben.
6. Route lädt Runtime-Skripte: Process-State, Contract-Hub, Data-Resolver, Table-Komponenten, Renderer, Domain-Adapter, Page-Loader.
7. `FcpMaskPageLoader.boot()` liest die Config aus dem Script-Tag.
8. Page Loader wählt Renderer-Familie: bei `ADM` → `AdminPanelMask.create`, sonst → `QuickFlowPattern.create`.
9. `FcpMaskDataResolver` erweitert/hydratisiert die Config und stellt `savePanel` bereit.
10. Renderer initialisiert die Maske; bei vorhandener Auth-Session werden sichtbare Panels hydratisiert.
11. Für die Vereinsverwaltung führt die Nav-Kette über `nav_club_settings_members` → `targetSectionId: club_settings_members` → Panel `club_settings_members_registry`.
12. Das Panel rendert als `componentType: "inline-data-table"` und nutzt die Standardkomponente `fcp-inline-data-table-v2` über die ADM-/QFM-Renderkette.

---

## 5. Datenfluss

1. JSON-Maske definiert Sections, Panels, Fields, `loadBinding`, `saveBinding`, `securityContext`, `scope`, `ownership`, `meta.sqlContract`.
2. `loadBinding.kind` kann laut Contract `rpc`, `auth_action`, `edge_function`, `local_only` oder `none` sein.
3. Beispiel ADM ClubSettings:
   - Prozesskontext lädt per RPC `public.get_onboarding_process_state`.
   - Vereinsanfrage/Audit lädt per RPC `public.club_request_gate_state`.
   - Setup-/Billing-Snapshot lädt per Edge Function `club-onboarding-status`.
   - Lokale Preview-Panels bleiben `local_only`.
4. Beispiel Vereinsverwaltung:
   - Panel `club_settings_members_registry` lädt über `loadBinding.target: "public.admin_member_registry"`.
   - Speichern erfolgt über `saveBinding.target: "public.admin_member_registry_update"`.
   - `meta.sourceTable: "public.admin_member_registry"`.
   - SQL-Referenz: `docs/sql-contracts/processes/club-settings/members/READ_vereinsverwaltung.sql`.
   - Resolver: `requiresClubContext: true`, `enrichMemberRegistry: true`, `rowsPath: "rows"`.
5. Resolver lädt Daten über den Binding-Vertrag und mappt sie auf Felder/Rows/Blocks.
6. Renderer zeigt die Struktur an, erzeugt aber keine neue Fachlogik.
7. Tabellen nutzen `data-table` oder `inline-data-table` über `componentType` + `tableConfig`.
8. Saves laufen über `saveBinding`/`savePanel` und damit über definierte RPC-/Edge-/Auth-Pfade.
9. Backend/Supabase bleibt Wahrheit für Validierung, Tenant-/Club-Kontext, Rollen, RLS, Prozesszustände, Billing, Invite, Claim und Onboarding.
10. JSON darf Security-Kontext beschreiben, aber niemals echte Sicherheit ersetzen.
11. UI darf Felder ausblenden, disabled setzen oder Flow spiegeln, aber keine Prozessfreigabe oder Berechtigung final entscheiden.

---

## 6. Inline-Data-Table / Vereinsverwaltung

Repo-wahrer Testeinstieg für die sichtbare Vereinsverwaltung ist:

`src/pages/app/mitgliederverwaltung/index.astro` → Route `/app/mitgliederverwaltung/` → Maske `docs/masks/templates/Onboarding/ADM_clubSettings.json`.

Konkrete Kette:

- Nav-Eintrag: `id: "nav_club_settings_members"`, `label: "Vereinsverwaltung"`, `targetSectionId: "club_settings_members"`
- Ziel-Section: `id: "club_settings_members"`, `label/title: "Vereinsverwaltung"`, `workspaceSlot: "main"`, `sectionLayout: "stack"`
- Panel: `id: "club_settings_members_registry"`, `componentType: "inline-data-table"`, `renderMode: "table"`, `contentArea: "main"`, `flowType: "standard"`
- Daten: `loadBinding.target: "public.admin_member_registry"`, `saveBinding.target: "public.admin_member_registry_update"`, `meta.sourceTable: "public.admin_member_registry"`, `meta.sqlContract.sqlFile: "docs/sql-contracts/processes/club-settings/members/READ_vereinsverwaltung.sql"`
- Resolver: `requiresClubContext: true`, `enrichMemberRegistry: true`, `rowsPath: "rows"`

Diese Route lädt explizit:

- `public/js/fcp-data-table.js`
- `public/js/fcp-inline-data-table-v2.js`
- `public/js/fcp-table-dialog-host.js`
- `public/js/domain-adapter-vereinsverwaltung.js`
- `public/js/admin-panel-mask.js`
- `public/js/fcp-mask-page-loader.js`

Damit ist die Vereinsverwaltung die richtige Architektur-Referenz für den Inline-Data-Table-Smoke-Test.

Der Master-Contract für `fcp-inline-data-table-v2` sagt: Die Komponente ist die verbindliche Standardbasis für Mitglieder, Gewässer, Angelkarten, Regeln und weitere administrative Inline-Pflegemasken. Sie ist ein starres Standard-Template mit konfigurierbaren Slots, keine frei interpretierbare Komponentenfamilie.

Konkrete Tabellenfelder hängen an `columns` des Panels `club_settings_members_registry`. Sichtbar belegt sind u. a.:

- `club_id`
- `club_code`
- `profile_user_id`
- `club_member_no`
- `member_no`
- `last_name`
- `first_name`
- `role`
- `status`
- `fishing_card_type`
- `card_assignments`
- `has_login`
- `last_sign_in_at`
- `email`
- `street`
- `zip`
- `city`
- `phone`
- `mobile`
- `birthdate`
- `guardian_member_no`
- `sepa_approved`
- `iban_last4`

Die feste DOM-Hierarchie enthält:

```html
<section class="data-table-shell">
  <div class="data-table-shell__toolbar"></div>
  <div class="filter-panel"></div>
  <div class="data-table-wrap">
    <div class="data-table">
      <div class="data-table__head"></div>
      <div class="data-table__row--create"></div>
      <div class="data-table__row"></div>
      <div class="data-table__row--editor"></div>
    </div>
  </div>
  <div class="cards-view"></div>
</section>
```

Das ist wichtig: Kartenansicht ist im Master-Template bereits Teil derselben Shell, nicht automatisch ein komplett unabhängiges zweites UI-System.

---

## 7. Kartenansicht

Repo-wahr ist die Kartenansicht im Kontext des Inline-Data-Table-v2 angelegt:

- Contract enthält `<div class="cards-view"></div>` als feste DOM-Hierarchie innerhalb der `data-table-shell`.
- Erlaubter Slot: `card_rendering_mobile`.
- Runtime `public/js/fcp-inline-data-table-v2.js` kennt `viewMode`, `cards`, `both`, `allowCards`, `initialViewMode`, `supportsCardsMode()` und schaltet mobil effektiv auf Cards.

Einordnung:

Die Kartenansicht ist architektonisch als responsive/alternative Darstellung derselben Tabellenkomponente vorgesehen. Sie darf fachlich keine zweite Wahrheit werden. Daten, Filter, Row-Key, Writes und Actions müssen denselben Verträgen folgen wie die Tabellenansicht.

Aktuelle Live-Einordnung für Vereinsverwaltung/Mitglieder-Tabelle:

- Kartenansicht ist technisch vorhanden.
- Die konkrete Live-Konfiguration für die relevante Vereinsverwaltung/Mitglieder-Tabelle steht auf `viewMode: "table"`.
- Tabellenansicht ist in diesem Kontext der primäre Zielmodus.
- Cards sind Komponentenfunktion / Responsive-Pfad, aber nicht der primäre produktive Standardmodus dieser Maske.

Offene Lücke: Über Code Search wurde kein separater, eigenständiger Kartenrenderer als eigene Hauptkomponente gefunden. Das spricht dafür, dass Cards aktuell in `fcp-inline-data-table-v2.js` verankert sind, aber eine vollständige Implementierungsprüfung der Renderfunktion wurde wegen Truncation nicht komplett durchgeführt.

---

## 8. CSS- und Optik-Zuständigkeit Inline-Data-Table-v2

Die finale produktive Inline-Data-Table-v2-Optik liegt nicht in einer einzigen Datei.

Live relevant sind:

- `public/css/main.css`
  - Baseline-/Komponenten-Styles
  - Teile für Cards, Wrap und Layout
- `public/css/redesign.css`
  - Redesign-/Override-Layer
  - Menü, Row-Actions, Theme, Feinschliff
- `public/js/fcp-inline-data-table-v2.js`
  - steuert Optik indirekt über Klassen/Data-Attributes wie `is-redesign`, `data-rd-theme`, `data-inline-view`

Regel:

> Bei Inline-Data-Table-v2-Fixes darf nicht nur in `redesign.css` gesucht werden. Die produktive Darstellung entsteht aus `main.css` + `redesign.css` + zustandssteuerndem JS.

---

## 9. Abweichungen / technische Schulden

Strukturell sichtbar:

1. **System im Aufbau**
   Der Mask-System-Contract sagt selbst: teilweise Renderer, teilweise Struktur, teilweise Komponenten; es fehlen vollständige JSON-Steuerung, vollständiger Resolver, vollständige Validierung und vollständige Renderer-Familienabdeckung für QFM/ADM.

2. **Alte/Backup-Mitgliederverwaltung existiert**
   `docs/masks/templates/Onboarding/mitgliederverwaltung.BackupoldProcess.astro` wurde gefunden. Das ist ein starkes Indiz für alten Prozess-/UI-Pfad neben dem neuen ADM/QFM-Pfad.

3. **Quickflow Case-/Pfad-Dopplung**
   Der ursprünglich vermutete Pfad `scripts/Quick-flow-Pattern.js` existiert laut Codex-Prüfung so nicht. Tatsächlich existieren:
   - `public/js/quick-flow-pattern.js`
   - `public/js/Quick-flow-pattern.js`

   Beide enthalten aktive QFP-Renderlogik für `inline-data-table` und rufen `FCPInlineDataTable.createStandardV2(...)` auf. Das ist kein bloßer Archiv-/Generatorbestand, sondern ein potenzielles Repo-/Pfad-/Case-Dopplungsthema im Live-/Runtime-Kontext.

4. **QFM Route transformiert JSON lokal**
   `src/pages/verein-anfragen.astro` transformiert Panels/Fields lokal per Funktionen wie `toQuickFlowField`, `toQuickFlowPanel`, `toQuickFlowSection`. Das ist aktuell funktional nachvollziehbar, aber langfristig eine Stelle, die in Richtung generischem Resolver/Reader konsolidiert werden sollte.

5. **Preview-/Local-only-Panels bewusst vorhanden**
   In `ADM_clubSettings.json` existieren Panels mit `sourceOfTruth: "json"` bzw. `local_only`, z. B. Routing-/Resume-Vertrag. Das ist nicht automatisch falsch, muss aber klar als Vorschau/Spiegel und nicht als Prozesswahrheit behandelt werden.

6. **Sicherheitsflags müssen auditierbar bleiben**
   Der Contract verlangt `serverValidated = true` für RPC/Edge/Auth-Action. Gleichzeitig darf `securityContext` nie echte RLS/RPC-Validierung ersetzen. Das muss bei jeder Maske geprüft werden.

7. **Domain-Adapter enthält Fachlogik**
   `public/js/domain-adapter-vereinsverwaltung.js` ist kein reines Mapping. Enthalten sind aktive Auth-/Session-Zugriffe, RPC-/Edge-Calls, Club-Context-Auflösung, Normalisierung von Karten-/Statusdaten und Mutationslogik wie Kartenzuweisung. Diese Logik muss bei Standardisierung auditierbar bleiben und darf nicht unkontrolliert wachsen.

8. **Keine dritte aktive Tabellenkomponente im relevanten Live-Pfad gefunden**
   Aktiv relevant sind vor allem:
   - `public/js/fcp-data-table.js`
   - `public/js/fcp-inline-data-table-v2.js`

   Es gibt archiv-/demoartige Altbestände im Repo, aber aktuell keinen eindeutig dritten produktiven Live-Tabellenpfad für die Mitgliederverwaltung.

---

## 10. Architekturregeln

1. Neue produktive Masken werden nicht als lokale Sonderseite gebaut, wenn ADM/QFM-Muster existiert.
2. Eine Maske entspricht genau einer JSON-Datei; Dateiprefix `ADM_` oder `QFM_` muss zur `maskFamily` passen.
3. ADM ist Admin-/Workspace-Kontext; QFM ist Quickflow-/Maskeninhaltskontext; beide teilen denselben Vertragskern.
4. JSON ist Struktur- und Maskenwahrheit, aber nicht Sicherheitswahrheit.
5. Backend/Supabase/RPC/Edge/RLS ist Prozess-, Rollen-, Tenant- und Sicherheitswahrheit.
6. Renderer stellt dar und bindet Verträge an; er darf keine Fachlogik, Sicherheitslogik oder neuen Prozesszustände erfinden.
7. `data-table` und `inline-data-table` sind kanonische Standardkomponenten; neue Tabellenvarianten sind technische Schulden, solange kein Contract sie legitimiert.
8. `fcp-inline-data-table-v2` ist ein starres Shell-Template mit konfigurierbaren Slots, keine kreative Komponentenfamilie.
9. Kartenansicht ist eine alternative Darstellung derselben Tabellenkomponente und darf keine zweite Daten-/Write-/Action-Wahrheit werden.
10. Read-/Write-Pfade müssen über vorhandene `loadBinding`/`saveBinding`/RPC/Edge-Verträge laufen; spontane Direktpfade aus UI oder Domain-Adaptern sind zu vermeiden.
11. Domain-Adapter dürfen fachlich unterstützen, aber nicht unbemerkt zur zweiten Backend-/Prozesslogik werden.
12. Bei Inline-Data-Table-v2-Fixes ist die Optikschicht als Kombination aus `main.css`, `redesign.css` und `fcp-inline-data-table-v2.js` zu prüfen.

---

## 11. Offene Fragen

1. Ist `domain-adapter-vereinsverwaltung.js` aktuell noch vollständig durch Backend-/RPC-/Edge-Verträge gedeckt, oder enthält er bereits Fachlogik, die langfristig in Backend/Resolver/Contracts zurückgeführt werden sollte?
2. Welche der beiden Quickflow-Dateien ist kanonisch zu verwenden: `public/js/quick-flow-pattern.js` oder `public/js/Quick-flow-pattern.js`? Muss eine Case-/Pfad-Bereinigung erfolgen?
3. Welche CSS-Regeln in `main.css` und `redesign.css` sind jeweils kanonisch für Inline-Data-Table-v2? Wo beginnt Override-Schuld?
4. Gibt es archiv-/demoartige Tabellenaltbestände, die markiert oder aus Live-Kontexten ausgeschlossen werden sollten?
5. Ist die Kartenansicht im aktuellen Live-Smoke-Test nur responsive erreichbar oder gibt es einen sichtbaren Toggle, der in QA explizit geprüft werden muss?
6. Welche konkreten Smoke-Test-Assertions müssen aus `club_settings_members_registry` abgeleitet werden?

---

## 12. Nächster sinnvoller Schritt

Der nächste Schritt sollte ein gezieltes Repo-Audit als Ergebnisdatei sein:

`docs/Smoke-Tests/inline-data-table/02_ARCHITEKTUR_AUDIT_ADM_QFM_INLINE_TABLE_VEREINSVERWALTUNG.md`

Ziel: nicht redesignen, sondern konkret die Live-Kette für `club_settings_members_registry` extrahieren:

`/app/mitgliederverwaltung/`
→ `ADM_clubSettings.json`
→ Nav `nav_club_settings_members`
→ Section `club_settings_members`
→ Panel `club_settings_members_registry`
→ `componentType: inline-data-table`
→ `tableConfig` / `columns`
→ `loadBinding.target: public.admin_member_registry`
→ `saveBinding.target: public.admin_member_registry_update`
→ `domain-adapter-vereinsverwaltung.js`
→ `member-registry-admin.js`
→ `fcp-inline-data-table-v2.js`
→ CSS-Schichten `main.css` + `redesign.css`
→ konkrete Smoke-Test-Assertions.

Empfohlener Testbefehl für den Prelauf/Validierungsteil:

```bash
npm run check:mask-jsons
```

Falls das Script nicht im `package.json` verdrahtet ist, direkt:

```bash
node scripts/check-mask-jsons.mjs
```

Für Projektwahrheit muss der spätere Executor immer liefern: Branch, Commit-SHA, geänderte Dateien, Testbefehl, Testergebnis und Push-Nachweis.
