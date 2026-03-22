# DB-Driven Runtime System fuer FCP/VDAN

Stand: 2026-03-21

## Zielbild

Die Software soll sich spaeter kontrolliert aus der Datenbank heraus steuern lassen, ohne dass dabei die harte Trennung zwischen:

- `statischen VDAN-Spezialseiten`
- `statischen FCP-Seiten`
- `App-Masken / Portal-Branding`

verloren geht.

## Leitprinzip

Nicht alles gleich stark dynamisieren.

Wir unterscheiden drei Ebenen:

1. `Deploy Guard Layer`
   - harte Repo-/Code-Regeln
   - darf nicht durch DB-Content ausgehebelt werden
   - Beispiel: VDAN-Spezialseiten bleiben im FCP-Deploy gesperrt

2. `Runtime Config Layer`
   - serverseitige DB-Konfiguration fuer Sichtbarkeit, Branding, Module, Texte
   - darf nur innerhalb des Guards wirken
   - Beispiel: App-Maske im FCP-Deploy von `fcp_tactical` auf `fcp_brand` umstellen

3. `Template Content Layer`
   - JSON-/Blob-basierte Layout- und Masken-Definitionen
   - nutzt nur freigegebene Komponenten und Slots
   - Beispiel: andere Hero-Struktur, andere Feldgruppen, andere Kartenreihenfolge

## Grundregel fuer Machtgrenzen

Der Guard ist die Verfassung.
Die Runtime Config ist die Regierung.
Templates sind die Einrichtung.

Diese Ebenen duerfen nicht vermischt werden.

## Feste Override-Reihenfolge

Die Aufloesung erfolgt immer in derselben Prioritaet:

1. `global`
2. `site_mode`
3. `club`
4. finaler `guard filter`

Wichtig:

- der spezifischere Scope ueberschreibt nur erlaubte Felder
- der Guard filtert immer zuletzt
- kein "last write wins"
- keine DB-Konfiguration darf eine harte Guard-Regel aushebeln

## Empfohlene Tabellen / Schluessel

### 1) `app_runtime_configs`

Zweck:
- zentrale Konfiguration pro Scope

Schluessel:
- `scope_type`: `site_mode` | `club` | `global`
- `scope_key`: z. B. `vdan`, `fcp`, `club:<uuid>`
- `config_key`: namespaced, z. B. `branding.app_mask_matrix`, `modules.visibility`, `branding.theme_tokens`
- `config_value`: `jsonb`
- `status`
- `draft_of`
- `version`
- `created_by`
- `updated_by`
- `approved_by`
- `updated_at`
- `published_at`
- `is_active`
- `rollback_of`
- `supersedes_version`

Beispiele:
- `site_mode / vdan / branding.app_mask_matrix`
- `site_mode / fcp / branding.app_mask_matrix`
- `site_mode / fcp / modules.visibility`

Statuswerte:

- `draft`
- `review`
- `published`
- `archived`

### 2) `app_template_library`

Zweck:
- versionierte Vorlagen fuer Masken, Cards, Hero-Bloecke, Form-Abschnitte

Felder:
- `template_key`
- `template_type`
  - `page_shell`
  - `mask_layout`
  - `card_stack`
  - `form_template`
- `brand_scope`
  - `vdan`
  - `fcp`
  - `shared`
- `schema_version`
- `template_json`
- `payload_hash`
- `created_by`
- `approved_by`
- `status`
  - `draft`
  - `review`
  - `published`
  - `archived`
- `published_at`
- `supersedes_version`
- `rollback_of`

### 3) `app_template_bindings`

Zweck:
- ordnet einer konkreten Route oder Maske die aktive Vorlage zu

Felder:
- `scope_type`
- `scope_key`
- `route_key`
- `route_path`
- `template_key`
- `variant_key`
- `is_active`

Beispiel:
- `site_mode / fcp / members_registry / /app/mitgliederverwaltung / registry_v2_fcp`

Regel:

- `route_key` ist kanonisch und kommt aus einem zentralen Routen-Katalog
- `route_path` ist nur die aktuelle technische Bindung
- freie String-Varianten pro Teammitglied sind nicht erlaubt

### 4) `app_theme_tokens`

Zweck:
- Theme-Werte getrennt von Layout-JSON pflegen

Felder:
- `scope_type`
- `scope_key`
- `theme_key`
- `tokens_json`

Beispiele:
- Farben
- Radius
- Shadow-Intensitaet
- Typo-Stacks
- Button-Sets

Guard fuer Theme-Tokens:

- erlaubt: visuelle Systemwerte
- nicht erlaubt: Routing, Rechte, Core-Navigation-Logik, strukturelle Sicherheits-Sichtbarkeit
- Theme-Tokens tragen Look, nicht Verhalten

### 5) `app_runtime_releases`

Zweck:
- veroeffentlichte Runtime-Snapshots nachvollziehbar machen

Felder:
- `release_key`
- `scope_type`
- `scope_key`
- `release_type`
- `payload_hash`
- `published_by`
- `published_at`
- `notes`

Nutzen:

- nachvollziehen, was gestern aktiv war
- gezielte Rollbacks
- klare Freigabehistorie

### 6) `app_runtime_audit_log`

Zweck:
- alle Admin-Aenderungen an Runtime, Branding und Template-Bindings nachvollziehbar machen

Felder:
- `actor_id`
- `scope_type`
- `scope_key`
- `entity_type`
- `entity_key`
- `action`
- `before_json`
- `after_json`
- `created_at`

Fragen, die damit beantwortbar sein muessen:

- Wer hat welches Brand-Override geaendert?
- Wer hat eine Modul-Sichtbarkeit veroeffentlicht?
- Wer hat welches Template an welche Route gebunden?

### 7) `app_route_catalog`

Zweck:
- kanonische Definition aller steuerbaren Routen und Masken

Felder:
- `route_key`
- `route_path`
- `route_type`
  - `static_web`
  - `app_mask`
  - `legal_core`
- `guard_class`
- `is_template_bindable`
- `is_brand_override_allowed`

Nutzen:

- verhindert uneinheitliche Route-Strings
- trennt kanonische ID von technischem Pfad
- ist Grundlage fuer Bindings, UIs und Tests

## Was explizit NICHT aus der DB kommen sollte

1. Harte Deploy-Freigaben fuer VDAN-Spezialseiten
2. Sicherheitskritische Guard-Entscheidungen
3. Basis-Routing fuer rechtliche Kernseiten
4. Rechte-/Tenant-Enforcement

Diese Punkte bleiben im Code und in Policies.

## Sichere Render-Strategie fuer JSON-/Blob-Templates

Wenn wir Masken spaeter als JSON/Blob speichern, dann nicht als freies HTML.

Sondern als:

- `component`
- `slot`
- `props`
- `data_binding`
- `visibility_rule`
- `theme_variant`

Beispiel:

```json
{
  "template_key": "registry_club_panel_v1",
  "sections": [
    {
      "component": "kpi_grid",
      "props": {
        "items": ["club_name", "member_count", "club_id"]
      }
    },
    {
      "component": "club_data_form",
      "props": {
        "fields": ["name", "street", "zip", "city", "contact_name", "contact_email", "phone"]
      }
    }
  ]
}
```

Damit bleibt das System:

- validierbar
- versionierbar
- rollback-faehig
- XSS-aermer als freies HTML

Zusaetzliche Regel:

- pro `template_type` gibt es ein eigenes JSON-Schema
- Speichern ohne Schema-Validierung ist nicht erlaubt
- Rendern ohne erfolgreich validiertes Template ist nicht erlaubt

## Render-Pipeline

1. App startet mit hartem Deploy-Guard.
2. `site_mode` wird aufgeloest.
3. Guard entscheidet, welche Route/Seite grundsaetzlich erlaubt ist.
4. Runtime-Config aus DB wird fuer den aktuellen Scope geladen.
5. Overrides werden strikt nach `global -> site_mode -> club` zusammengelegt.
6. Optional wird die Template-Bindung geladen.
7. Renderer baut die Maske aus erlaubten Komponenten zusammen.
8. Theme-Tokens werden auf den Scope angewendet.
9. finaler Resolve-Output wird als validierter Snapshot bereitgestellt.

## Resolved Runtime Snapshot

Fuer Debugging, Performance und Testbarkeit sollte es pro Scope/Route einen aufgeloesten Endzustand geben.

Beispiel:

- `resolved_runtime_snapshot`
- `scope_type`
- `scope_key`
- `route_key`
- `resolved_json`
- `payload_hash`
- `resolved_at`

Nutzen:

- weniger wiederholtes Zusammenbauen zur Laufzeit
- klarer Debug-Zustand
- einfache Smoke- und Snapshot-Tests
- bessere Rollback-Faehigkeit

## Empfohlene Reihenfolge fuer den Ausbau

### Phase 1

- bestehendes `admin-web-config` auf echte Runtime-Config-Basis heben
- `app_mask_matrix` und `module_visibility` dort sauber versionieren
- Scope-Override-Regel `global -> site_mode -> club` fest implementieren
- Namespaces fuer `config_key` verbindlich machen
- Audit-Log fuer Admin-Aenderungen mitschreiben

### Phase 2

- zusaetzliche Tabelle fuer `theme_tokens`
- Admin-Board zum Umschalten von Farben/Brand-Tokens
- Theme-Tokens strikt auf visuelle Werte begrenzen
- erster Release-/Snapshot-Log fuer Runtime-Freigaben

### Phase 3

- `template_library` + `template_bindings`
- zuerst nur fuer App-Masken, nicht fuer statische Spezialseiten
- `route_catalog` als kanonische Route-ID-Quelle einfuehren
- JSON-Schema-Validierung pro `template_type`

### Phase 4

- JSON-Renderer fuer erlaubte Komponenten
- Vorlagen als veroeffentlichbare Draft/Published-Objekte
- resolved snapshots cachen
- Rollback-/Freigabekette ueber Releases nutzbar machen

## Konkrete Empfehlung fuer jetzt

Kurzfristig:

- statische Seiten weiter hart im Repo/Deploy steuern
- App-Masken und Modul-Sichtbarkeit serverseitig in der DB steuern
- Theme-Tokens als naechsten echten DB-Block einfuehren
- Runtime-Aenderungen frueh auditieren und versionieren

Erst danach:

- Template-JSON/Blob fuer einzelne Masken

So behalten wir Kontrolle und koennen spaeter trotzdem in Richtung "Software aus der DB steuerbar" wachsen, ohne uns die sichere Trennung kaputt zu machen.
