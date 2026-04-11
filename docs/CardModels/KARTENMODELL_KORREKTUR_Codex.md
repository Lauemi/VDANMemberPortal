# Kartenmodell-Korrektur – Übergabe an Codex
**Datum: 2026-04-08 | Priorität: SOFORT vor jedem Weiterbau**

---

## Das Prinzip (nicht verhandelbar)

**Ein Kontext erzeugt automatisch mehrere Ableitungen.**
Ableitungen sind standardmäßig vorhanden, aber jederzeit überschreibbar.
Struktur bleibt zentral — Unterschiede liegen in den abgeleiteten Werten.

Konkret auf Karten übertragen:

```
Kontext:    Jahreskarte
Ableitung:  → Standard-Preis (auto, überschreibbar)
            → Jugend-Preis   (auto, überschreibbar)
            → Ehren-Preis    (auto, überschreibbar)
```

**1 Kartenart → n Gruppenregeln. Nicht n getrennte Kartenobjekte.**

---

## Was aktuell falsch ist (IST-Stand in der DB)

```json
[
  { "title": "VDAN Standard", "kind": "annual", "member_group_key": "standard", "is_default": true }
]
```

**Problem:** `member_group_key` liegt auf der Kartenart-Ebene.
Das erzwingt für jede Gruppe einen separaten Eintrag:
- Jahreskarte Standard
- Jahreskarte Jugend
- Jahreskarte Ehren

Das ist Datensatzpflege, keine Vereinslogik. Genau das wollten wir vermeiden.

Gleicher Fehler steckt in `permit_card_types` (Tabellenspalte `member_group_key` auf Zeilen-Ebene) — die Tabelle ist daher für das neue Modell nicht geeignet. Bleibt im MVP inaktiv.

---

## Das Zielformat (SOLL)

`app_secure_settings` Key `club_cards:{club_id}` — neues Format:

```json
[
  {
    "id": "jahreskarte",
    "title": "Jahreskarte",
    "kind": "annual",
    "is_active": true,
    "group_rules": {
      "standard":  { "label": "Standard",      "is_default": true,  "price": null },
      "youth":     { "label": "Jugend",         "is_default": true,  "price": null },
      "honorary":  { "label": "Ehrenmitglied",  "is_default": true,  "price": null }
    }
  },
  {
    "id": "tageskarte",
    "title": "Tageskarte",
    "kind": "daily",
    "is_active": true,
    "group_rules": {
      "standard":  { "label": "Standard", "is_default": false, "price": null }
    }
  }
]
```

**Regeln:**
- `group_rules` wird beim Anlegen einer Kartenart **automatisch mit allen drei Gruppen vorbelegt** (standard, youth, honorary)
- `is_default: true` bedeutet: diese Gruppenregel gilt als Standard-Zuweisung für neue Mitglieder dieser Gruppe
- `price` ist MVP-optional (null erlaubt), aber das Feld ist vorbereitet
- Jede Gruppe kann einzeln überschrieben oder deaktiviert werden
- Pro Kartenart darf jede Gruppe maximal einmal vorkommen

---

## Was geändert werden muss

### 1. RPC `admin_upsert_club_cards()` — Migration ersetzen

Die aktuelle Migration `20260408113000_qob_cards_rpc` validiert noch das alte Flat-Format
(`member_group_key` auf Eintragsebene). Diese RPC muss ersetzt werden.

**Neue Signatur:**
```sql
CREATE OR REPLACE FUNCTION public.admin_upsert_club_cards(
  p_club_id uuid,
  p_cards   jsonb   -- Array im neuen Format mit group_rules
)
RETURNS void
```

**Neue Validierungslogik:**
```
FOR jede Karte in p_cards:
  - title darf nicht leer sein
  - kind muss in ('annual', 'daily', 'weekly', 'monthly') sein
  - group_rules muss ein Objekt sein
  - pro group_rules-Key darf is_default maximal einmal true sein
    (aber: verschiedene Kartenarten dürfen je Gruppe eigene Defaults haben)
  - keine doppelten Karten-IDs im Array
```

**Validierungsregel für is_default:**
Pro Kartenart und pro Gruppe maximal ein `is_default: true`.
NICHT mehr: pro Gruppe über alle Karten hinweg nur ein Default.
(Weil: eine Jahreskarte kann Default für Standard sein, und eine Tageskarte auch — je nach Kontext)

### 2. RPC `normalize_club_cards()` — Altformat-Normalisierung anpassen

Aktuell normalisiert die Funktion `["VDAN Standard"]` zu:
```json
[{ "title": "VDAN Standard", "kind": "annual", "member_group_key": "standard", "is_default": true }]
```

Das muss ins neue Format normalisieren:
```json
[{
  "id": "vdan_standard",
  "title": "VDAN Standard",
  "kind": "annual",
  "is_active": true,
  "group_rules": {
    "standard":  { "label": "Standard",     "is_default": true, "price": null },
    "youth":     { "label": "Jugend",        "is_default": true, "price": null },
    "honorary":  { "label": "Ehrenmitglied", "is_default": true, "price": null }
  }
}]
```

Begründung: Beim Altformat wissen wir nicht welche Gruppen der Verein hat —
daher werden alle drei Standardgruppen automatisch als Default vorbelegt.
Der Admin kann sie danach anpassen.

### 3. RPC `get_club_cards()` — kein Change nötig
Gibt einfach den normalisierten JSONB zurück. Format ändert sich durch die Normalisierungs-RPC.

### 4. Auto-Assign-Logik in `club-onboarding-workspace` anpassen

Bisher:
```typescript
const defaults = cards.filter(c => c.member_group_key === memberGroupKey && c.is_default);
```

Neu:
```typescript
// Finde Karten die für diese Gruppe einen is_default: true haben
const defaultCard = cards.find(c =>
  c.group_rules?.[memberGroupKey]?.is_default === true
);
const fishingCardType = defaultCard?.title ?? '-';
```

Wenn mehrere Karten für eine Gruppe `is_default: true` haben:
→ keine automatische Zuweisung, explizite Auswahl erforderlich.

### 5. UI-Panel `club_settings_cards_quick_add` in `ADM_clubSettings.json`

Aktuelles Formular:
- title, kind, member_group_key, is_default

Neues Formular (zwei Stufen):

**Stufe 1 — Kartenart:**
- `title` (Freitext, z.B. „Jahreskarte")
- `kind` (select: annual / daily / weekly / monthly)

**Stufe 2 — Gruppenregeln (automatisch vorbelegt, überschreibbar):**
- Standard: `is_default` toggle, `price` (optional)
- Jugend: `is_default` toggle, `price` (optional)
- Ehren: `is_default` toggle, `price` (optional)

Das System erzeugt Stufe 2 automatisch wenn Stufe 1 gespeichert wird.
Der Admin sieht die Gruppenregeln vorbelegt und kann sie anpassen — muss aber nicht.

---

## Migrations-Reihenfolge für Codex

```
SCHRITT 1: Neue Migration anlegen
  Name: 20260408120000_qob_cards_rpc_v2
  Inhalt:
    - DROP FUNCTION IF EXISTS public.admin_upsert_club_cards(uuid, jsonb)
    - DROP FUNCTION IF EXISTS public.normalize_club_cards(text)
    - Neu: normalize_club_cards() mit group_rules-Format
    - Neu: admin_upsert_club_cards() mit group_rules-Validierung
    - get_club_cards() bleibt unverändert

SCHRITT 2: club-onboarding-workspace Edge Function anpassen
  - Auto-Assign-Logik auf group_rules umstellen
  - Karten-Write-Handler auf neues Format umstellen
  - Karten-Read-Handler: normalize_club_cards() wird automatisch aufgerufen

SCHRITT 3: ADM_clubSettings.json anpassen
  - Panel club_settings_cards_quick_add: Felder auf 2-Stufen-Modell umstellen

SCHRITT 4: db push
  supabase db push

SCHRITT 5: Edge Function deployen
  npx supabase functions deploy club-onboarding-workspace --no-verify-jwt
```

---

## Was NICHT geändert wird

- `permit_card_types` — bleibt inaktiv, Schema passt nicht zum neuen Modell
- `club_onboarding_state.cards_complete` — Flag bleibt, Semantik ändert sich nicht
- `admin_member_registry_create()` — bleibt unverändert
- `upsert_club_onboarding_progress()` — bleibt unverändert
- `club_onboarding_requirements` `has_default_card`-Check — bleibt kompatibel
  (prüft nur ob cards_raw nicht leer ist, das gilt für neues Format genauso)

---

## Aktueller DB-Stand (verifiziert 2026-04-08)

VDAN club_id: `736c6406-e90f-46cd-b0d8-f14a4323a177`

Aktueller Wert in `app_secure_settings`:
```json
[{ "kind": "annual", "title": "VDAN Standard", "is_default": true, "member_group_key": "standard" }]
```

→ Wird beim ersten Aufruf von `normalize_club_cards()` automatisch ins neue Format migriert.
→ Kein manueller DB-Eingriff nötig.

---

## Erfolgskriterium

Nach der Korrektur muss gelten:

- [ ] Admin legt „Jahreskarte" an → System erzeugt automatisch Standard/Jugend/Ehren-Regel
- [ ] Admin kann einzelne Gruppenregel überschreiben (Preis, is_default)
- [ ] Admin muss NICHT drei separate Einträge anlegen
- [ ] Auto-Assign bei Mitgliederanlage liest `group_rules[memberGroupKey].is_default`
- [ ] `normalize_club_cards()` wandelt altes VDAN-Format korrekt um
- [ ] `admin_upsert_club_cards()` lehnt doppelte Karten-IDs ab
