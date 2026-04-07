# FCP SecurityContext – Sollschema
# ============================================================
# Datei:   docs/sql-contracts/roles/SECURITY_CONTEXT_SCHEMA.md
# Zweck:   Verbindliche Regel für securityContext in ADM/QFM JSON
# Status:  NORMATIV
# Datum:   2026-04-07
# ============================================================

## Das Zielmodell

Jedes Panel in ADM/QFM bekommt einen expliziten `securityContext`:

```json
"securityContext": {
  "moduleKey":       "members",
  "usecaseKey":      "mitglieder_registry",
  "requiredAction":  "read",
  "serverValidated": true
}
```

## Felddefinitionen

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `moduleKey` | string | ja | Fachlicher Modulbereich aus `public.module_catalog` |
| `usecaseKey` | string | ja | Exakter serverseitiger Key aus `public.module_usecases` |
| `requiredAction` | string | ja | Eine von: `view`, `read`, `write`, `update`, `delete` |
| `serverValidated` | boolean | ja | Immer `true` – Runtime nutzt `has_usecase_access()` |
| `requiresTenantAccess` | boolean | nein | Zusätzliche Tenant-Prüfung nötig |
| `requiresRoleCheck` | boolean | nein | Legacy – wird durch usecaseKey ersetzt |
| `allowedRoles` | array | nein | NUR Übergangsstand – nicht als Sicherheitsquelle |

## Erlaubte usecaseKey Werte

Kanonische Quelle: `public.module_usecases`

```
fangliste               → moduleKey: "fishing"
go_fishing              → moduleKey: "fishing"
fangliste_cockpit       → moduleKey: "fishing"
arbeitseinsaetze        → moduleKey: "work"
arbeitseinsaetze_cockpit → moduleKey: "work"
eventplaner             → moduleKey: "work"
eventplaner_mitmachen   → moduleKey: "work"
feed                    → moduleKey: "feed"
mitglieder              → moduleKey: "members"
mitglieder_registry     → moduleKey: "members"
dokumente               → moduleKey: "documents"
sitzungen               → moduleKey: "meetings"
einstellungen           → moduleKey: "settings"
```

## Erlaubte requiredAction Werte

```
view    → Bereich sichtbar?
read    → Daten lesbar?
write   → Neue Daten anlegbar?
update  → Bestehende Daten änderbar?
delete  → Daten löschbar?
```

## Was die Runtime tut

```javascript
// Runtime liest aus Panel-JSON:
const { usecaseKey, requiredAction } = panel.securityContext;

// Runtime ruft serverseitig auf:
const allowed = await rpc('has_usecase_access', {
  p_club_id:     currentClubId,
  p_usecase_key: usecaseKey,
  p_action:      requiredAction
});

// Runtime entscheidet:
if (!allowed) → Panel ausblenden / sperren
```

## Verbindliche Regeln für Codex

1. `usecaseKey` ist KEIN frei gewählter UI-Name
   Er muss exakt einem Eintrag in `public.module_usecases` entsprechen.

2. `allowedRoles` ist NUR Übergangsstand
   Sobald `usecaseKey` gesetzt ist, ist `allowedRoles` bedeutungslos
   für die Sicherheitsprüfung.

3. `serverValidated: true` ist immer Pflicht
   Kein Panel darf sich selbst als sicher erklären.

4. Status schlägt Rolle
   Suspendierte / pending / rejected Mitglieder haben keine Rechte –
   auch wenn Rolle und Usecase passen würden.

5. Kein Panel in der DB
   Die DB kennt keine maskId, sectionId oder panelId.
   Das Mapping Panel → usecaseKey lebt im JSON-Vertrag.

## Beispiele

### Mitglieder-Tabelle lesen
```json
"securityContext": {
  "moduleKey":      "members",
  "usecaseKey":     "mitglieder_registry",
  "requiredAction": "read",
  "serverValidated": true
}
```

### Einstellungen schreiben
```json
"securityContext": {
  "moduleKey":      "settings",
  "usecaseKey":     "einstellungen",
  "requiredAction": "write",
  "serverValidated": true
}
```

### Fangliste nur anzeigen
```json
"securityContext": {
  "moduleKey":      "fishing",
  "usecaseKey":     "fangliste",
  "requiredAction": "view",
  "serverValidated": true
}
```

## Was NICHT erlaubt ist

```json
// FALSCH – Rollenname statt Usecase
"securityContext": {
  "allowedRoles": ["admin", "vorstand"]
}

// FALSCH – frei erfundener usecaseKey
"securityContext": {
  "usecaseKey": "mein-panel-name"
}

// FALSCH – serverValidated fehlt
"securityContext": {
  "usecaseKey": "mitglieder_registry"
}
```
