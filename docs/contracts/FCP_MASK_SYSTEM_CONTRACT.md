# FCP Mask System Contract

Dieses Contract definiert, wie aus `Mask JSON + SQL + Ownership/Write-Pfad-Kontext` deterministisch eine vollstaendige Maske fuer das FCP-System entsteht.

Es ist absichtlich:
- ohne UI-Design
- ohne HTML
- ohne konkrete Einzelmaske
- nur Struktur, Regeln und Mapping
- Fokus auf Renderer-Zuordnung und Systemintegration
- inklusive verbindlichem Sicherheits- und RLS-Kontext

## 1. Ziel

Das Zielsystem lautet:

```txt
Modulplanung -> JSON -> Renderer -> fertige Maske
```

Nicht Ziel:
- freie manuelle UI-Zusammenstellung
- spontane Renderer-Interpretation
- neue Einzelmasken ohne Systemvertrag

## 2. Grundprinzip

Fuer FCP gilt:

- nichts wird weggeworfen
- alles wird strukturiert zusammengezogen
- bestehende Standards bleiben erhalten
- neue Masken entstehen aus Systemlogik

Das Maskensystem ist damit ein Integrationssystem, kein Ersatz der bestehenden App-Shell.

## 3. Systemgrenze

Dieses System betrifft nur den Maskeninhalt innerhalb von:

```txt
<main class="main">
  <div class="container">
    MASK CONTENT
  </div>
</main>
```

Nicht betroffen:
- Header
- Footer
- globale Navigation
- Portalbutton / Portal Rail
- Fav-Menues
- FAB / Plus-Button / Floating-Stacks
- globale Dialoge / globale Overlays / globale Sheets
- sonstige Shell-Komponenten ausserhalb des Maskeninhalts

## 4. Eine Maske = eine JSON-Datei

Jede Maske wird durch genau eine JSON-Datei definiert.

Diese JSON-Datei ist die technische Referenz fuer:
- Renderer-Zuordnung
- Struktur
- Datenquellen
- Load-/Write-Pfade
- Sicherheitskontext
- Permissions
- Scope
- Ownership
- Standardkomponenten
- Sonderfaelle

Regel:
- JSON ist die einzige Maskenwahrheit
- Renderer raten nicht
- Renderer erfinden keine Struktur

## 5. Datei- und Namenskonvention

```txt
<QFM_OR_ADM>_<mask_name>.json
```

Beispiele:

```txt
QFM_einstellungen.json
ADM_admin-panel.json
QFM_fangliste.json
```

Bedeutung:
- `QFM` = QuickflowMaske
- `ADM` = Admin-Panel

Regel:
- Dateiname ist Routing-Signal
- Prefix bestimmt Renderer
- keine heuristische Erkennung
- kein Guessing
- kein Fallback auf einen anderen Renderer

## 6. Mask JSON Grundstruktur

```js
const maskConfig = {
  maskId: "einstellungen",
  maskFamily: "QFM",
  maskType: "sectioned",
  securityContext: {
    rlsKey: "tenant_id",
    membershipKey: "canonical_membership_id",
    requiresTenantAccess: true,
    requiresRoleCheck: false,
    allowedRoles: [],
    serverValidated: true
  },

  header: {
    title: "Einstellungen",
    description: "Zentrale Verwaltungsmaske"
  },

  sections: [
    /* Section-Definitionen */
  ]
};
```

Pflichtfelder:
- `maskId`
- `maskFamily`
- `maskType`
- `sections`

Pflichtregel:
- fuer alle nicht-lokalen Datenmasken muss ein passender `securityContext` vorhanden sein

Pflichtregel:
- `maskFamily` in JSON und Prefix im Dateinamen muessen uebereinstimmen

## 7. Renderer-Zuordnung

Regel:
- `QFM` -> Quickflow-Renderer
- `ADM` -> Admin-Panel-Renderer

Resolver:

```js
resolveMaskRenderer(fileName, config)
```

```js
if (prefix === "QFM") {
  return renderQuickflowMask(config);
}

if (prefix === "ADM") {
  return renderAdminPanelMask(config);
}
```

Wichtig:
- kein Auto-Detect
- keine implizite Uminterpretation
- Prefix ist technischer Eintrittspunkt

## 8. Maskenfamilien

### QFM

QFM steht fuer QuickflowMaske.

Merkmale:
- Main-Content-Pattern
- Section-/Panel-Logik
- standardisierte Inhaltsrenderer
- genau ein aktiver Hauptbereich, wenn `maskType = sectioned`

### ADM

ADM steht fuer Admin-Panel.

Merkmale:
- anderer Kontext / anderer Wrapper
- kann andere Navigation oder Toolbar-Logik besitzen
- kann Full-Width-Arbeitsbereiche haben
- bleibt trotzdem im FCP-Stil und nutzt denselben Daten- und Komponentenvertrag

### Gemeinsamer Kern von QFM und ADM

QFM und ADM teilen:
- Datenmodell
- Section-/Panel-Kern
- Permissions
- Load-/Save-Bindings
- Field-Mapping
- Meta-Mapping
- Standardkomponenten

Unterschiede zwischen QFM und ADM:
- Darstellungskontext
- Wrapper
- Navigationslogik
- Layoutgewichtung
- Full-width / taktischer Arbeitsmodus / Cockpitmodus

Regel:
- QFM und ADM sind nicht gegeneinander gebaut
- sie sind zwei Renderer auf einem gemeinsamen strukturellen Kern

## 9. Gemeinsamer Maskenkern

Alle Masken basieren logisch auf:

```txt
Mask
  -> Section
    -> Panel
      -> ContentSlot
```

Zusatzlogiken:
- Permissions
- Scope
- Ownership
- SecurityContext
- Load-/Save-Bindings
- Meta-Handling
- Sonderfall-Markierung

## 10. Mindeststruktur fuer Sections, Panels und Fields

### Pflichtfelder pro Section
- `id`
- `label`
- `title`
- `permissions`
- `securityContext`
- `panels`

### Pflichtfelder pro Panel
- `id`
- `title`
- `renderMode`
- `permissions`
- `securityContext`
- `saveBinding`
- `meta`
- `content`

### Pflichtfelder pro Field
- `name`
- `label`
- `type`
- `scope`

## 11. Standard-Komponenten

Renderer duerfen nur standardisierte FCP-Komponenten verwenden:
- Inputs
- Readonly-Felder
- Data Tables
- Inline Data Tables
- Action Panels
- Status Panels
- Mixed Panels

Regel:
- keine freie Komponentenwahl
- keine spontane UI-Erfindung
- Standardfaelle laufen immer ueber Standardkomponenten

### Verbindliche Tabellen-Standards

Fuer Tabellen gilt kuenftig:
- `componentType = "data-table"` fuer FCP Data Table v1
- `componentType = "inline-data-table"` fuer FCP Inline Data Table v2

Diese Komponententypen duerfen auf:
- Panel-Ebene
- oder Mixed-Block-Ebene

verwendet werden.

Pflichtfelder fuer `data-table` und `inline-data-table`:
- `columns`
- `tableConfig.tableId`
- `rowsPath` oder statische `rows`

Empfohlene Pflichtfelder fuer produktive SQL-Masken:
- `tableConfig.rowKeyField`
- `tableConfig.gridTemplateColumns`

Optionale Runtime-Felder:
- `tableConfig.rowInteractionMode`
- `tableConfig.selectionMode`
- `tableConfig.viewMode`
- `tableConfig.sortKey`
- `tableConfig.sortDir`
- `tableConfig.filterFields`

Regel:
- `renderMode = "table"` allein reicht nicht fuer den vollen Runtime-Vertrag
- der eigentliche Tabellenstandard wird ueber `componentType` + `tableConfig` definiert
- `table` und `table_inline` gelten nur noch als Legacy-Aliase fuer die Reader-Normalisierung

## 12. FCP Design System

Alle Masken:
- laufen automatisch im FCP-Stil
- nutzen bestehende CSS
- respektieren bestehende UI-Standards

Regel:
- kein neues Styling pro Maske
- keine Designabweichung ohne expliziten Sonderfall

## 13. Sonderfaelle

Sonderfaelle sind erlaubt, aber streng geregelt.

Voraussetzung:
- explizites DOM
- explizites CSS
- explizite Kennzeichnung im JSON

Beispiele:
- Scanner
- Kamera
- Capture-Flow
- stark abweichender Prozessdialog

Regel:
- keine impliziten Sonderfaelle
- kein Renderer improvisiert Sonderlogik

## 14. Load / Save System

Jedes Panel hat genau ein Binding.

Erlaubte Typen:
- `rpc`
- `auth_action`
- `edge_function`
- `local_only`
- `none`

Regeln:
- jedes Panel hat genau einen Typ
- kein implizites Verhalten
- kein generisches Save
- `none` bedeutet bewusst readonly / keine Mutation

Zusatzregel:
- jedes nicht-lokale Binding braucht einen serverseitig plausiblen Sicherheitskontext

## 15. Meta-Logik

Das System darf Standard-Meta automatisch ableiten, aber nur nach festen Regeln.

Automatisch erkennbare Meta-Felder:
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`

Regeln:
- Auto-Meta darf nur angezeigt werden, wenn das Feld im SQL-Kontext real existiert
- Auto-Meta darf nicht frei erfunden werden
- append-only Systeme muessen als append-only gekennzeichnet sein und duerfen nicht als normales `updated_at`-Objekt behandelt werden
- wenn Meta sicher erkennbar ist, darf kein manuelles Mapping erforderlich sein

## 16. Permissions

Permissions bestehen aus:
- `view`
- `write`
- `update`
- `delete`
- `roles`

Auswertungsreihenfolge:
1. Rolle
2. Scope
3. Ownership
4. Binding

Regeln:
- keine Berechtigung -> kein Render
- kein Write-Pfad -> readonly
- auth-relevante Felder -> kein normales Form-Handling
- consent append-only -> kein ueberschreibbares Form-Handling
- UI-Permissions ersetzen niemals serverseitige RLS- oder RPC-Pruefung

## 17. Sicherheits- und RLS-Standard

Das FCP-Maskensystem besitzt einen verbindlichen Sicherheitsstandard in:

- `docs/contracts/FCP_RLS_SECURITY_STANDARD.md`

Verbindliche Regel:
- JSON beschreibt Sicherheitskontext
- SQL, RLS, RPC und Edge Functions setzen Sicherheit serverseitig durch
- Clientwerte wie `club_id`, `tenant_id` oder `canonical_membership_id` sind nie allein vertrauenswuerdig

### Standardfeld `securityContext`

`securityContext` beschreibt den fuer eine Maske, Section oder ein Panel benoetigten Sicherheitsrahmen.

Standardform:

```json
{
  "securityContext": {
    "rlsKey": "tenant_id",
    "membershipKey": "canonical_membership_id",
    "requiresTenantAccess": true,
    "requiresRoleCheck": false,
    "allowedRoles": [],
    "serverValidated": true
  }
}
```

Regeln:
- `requiresTenantAccess = true` verlangt serverseitige Tenant-/Clubpruefung
- `requiresRoleCheck = true` verlangt nichtleere `allowedRoles`
- `serverValidated = true` ist fuer `rpc`, `edge_function` und `auth_action` verpflichtend
- `securityContext` darf nie als Ersatz fuer echte RLS-/RPC-Validierung verstanden werden

## 18. Scope und Ownership

### Erlaubte Scope-Werte
- `global_user`
- `auth_system`
- `club_scoped`
- `club_override`
- `billing_snapshot`
- `consent_append_only`

### Regeltrennung

`scope` beschreibt:
- wo das Feld fachlich verortet ist
- wie es sich im UI verhalten darf

`ownership` beschreibt:
- wer den Datensatz oder Prozess fuehrt
- welcher Write-Pfad legitim ist

Regeln:
- Scope ist verpflichtend
- Ownership ist verpflichtend
- unbekannter Scope oder unbekannte Ownership blockiert die automatische Maskengenerierung

## 19. Was niemals gerendert werden darf

- Felder ohne Leseberechtigung
- sicherheitskritische Rohdaten
- interne technische IDs ohne Nutzwert
- auth-kritische Bearbeitung als normales Form-Panel
- append-only Daten als ueberschreibbare Form
- Felder mit unbekanntem Ownership-Modell
- nicht normierte Sonderfaelle ohne explizite Kennzeichnung
- Masken oder Panels mit fehlendem serverseitigem Sicherheitskontext fuer nicht-lokale Prozesse

## 20. Implementierungsstatus

Wichtig:

Dieses System ist noch im Aufbau.

Aktuell existiert:
- teilweise Renderer
- teilweise Struktur
- teilweise Komponenten

Es fehlt noch:
- vollstaendige JSON-Steuerung
- vollstaendiger Resolver
- vollstaendige Validierung
- vollstaendige Renderer-Familienabdeckung fuer QFM und ADM
- vollstaendige Sicherheitskontext-Validierung ueber JSON, Resolver und Renderer

## 21. Zielzustand

Der Zielzustand ist:

```txt
Modulplanung -> JSON -> Resolver -> Renderer -> fertige Maske
```

Ohne:
- doppelte Logik
- freie Interpretation
- manuelles Maskenzusammenbauen

## Kurzform

- JSON ist Wahrheit
- Prefix bestimmt Renderer
- Renderer ist deterministisch
- Komponenten sind standardisiert
- Design ist FCP
- Sonderfaelle sind explizit
- Permissions, Scope, Ownership und SecurityContext steuern alles
- QFM und ADM teilen einen gemeinsamen strukturellen Kern
- System wird aufgebaut, nicht ersetzt
