# Importvorlage → DB Mapping
**Geprüft gegen:** VDAN (`peujhdrqnbvhllxpfavo`)  
**Stand:** 2026-04-11  
**Zweck:** Anweisung für Codex — was wohin, was fehlt, was nicht angebunden werden darf.

---

## Sheet: `Mitglieder`
**Zieltabellen:** `public.club_members` (primär), `public.members` (Stammdaten)  
**Match-Key:** `member_number` → `club_members.club_member_no`

| Vorlage-Feld | DB-Tabelle | DB-Feld | Aktion | Anmerkung |
|---|---|---|---|---|
| `member_number` | `club_members` | `club_member_no` | Match-Key | Pflicht. Ohne → Zeile überspringen + Warnung |
| `status` | `club_members` | `status` | Insert/Update | Normalisierung nötig: `active`→`active`, `passive`→`passive`, `pending`→`pending`. Groß/Klein tolerieren. |
| `source` | `club_members` | `source` | Insert | Default `csv_import` wenn leer |
| `first_name` | `club_members` + `members` | `first_name` | Insert/Update | Beide Tabellen |
| `last_name` | `club_members` + `members` | `last_name` | Insert/Update | Beide Tabellen |
| `email` | `club_members` + `members` | `email` | Insert/Update | Nullable. Warnung bei Duplikat |
| `phone` | `members` | `phone` | Insert/Update | Nur `members` |
| `birthdate` | `members` | `birthdate` | Insert/Update | Format: ISO `YYYY-MM-DD`. Warnung bei ungültigem Format, Feld leer lassen |
| `street` | `members` | `street` | Insert/Update | Nur `members` |
| `house_number` | — | — | ❌ ignorieren | Kein Zielfeld in DB. Hinweis in Preview |
| `postal_code` | `members` | `zip` | Insert/Update | Feldname-Transform |
| `city` | `members` | `city` | Insert/Update | Nur `members` |
| `country` | — | — | ❌ ignorieren | Kein Zielfeld in DB. Hinweis in Preview |
| `club_join_date` | `canonical_memberships` | `joined_at` | ⛔ noch nicht anbinden | `canonical_memberships` für VDAN fast leer. In `snapshot_json` des Import-Rows ablegen |
| `current_membership_type` | `club_members` | `membership_kind` | Insert/Update | Werte tolerant übernehmen, keine Enum-Prüfung |
| `current_membership_since` | — | — | ❌ ignorieren | Kein direktes DB-Feld. In `snapshot_json` ablegen |
| `notes` | — | — | ❌ ignorieren | Kein Zielfeld. Hinweis in Preview |

**Pflicht-Warnungen in Preview:**
- `member_number` leer → Zeile überspringen
- `member_number` bereits in `club_members` → als Update markieren, nicht doppelt insertn
- `email` bereits bei anderem Mitglied → Warnung, trotzdem fortfahren
- `birthdate` nicht parsebar → Feld leer lassen, Warnung
- `house_number`, `country`, `notes`, `current_membership_since` → einmalig in Preview als "wird ignoriert" anzeigen

---

## Sheet: `Mitgliedschaften_Historie`
**Zieltabelle:** `public.membership_status_history`  
**Status: ⛔ Noch nicht produktiv anbinden**

**Grund:** `membership_status_history` hält Status-Wechsel (active/passive), nicht Mitgliedschaftstyp-Verläufe (Jugend→Aktiv→Ehren). Kein sauberer Zielpfad für `membership_type`-Verlauf. `canonical_memberships` für VDAN hat nur 1 Eintrag.

**Was Codex tun soll:** Sheet einlesen, Zeilen validieren, aber **nur in `import_rows.target_preview_json` ablegen** — kein Write in DB-Zieltabellen.

| Vorlage-Feld | Status | Anmerkung |
|---|---|---|
| `member_number` | nur Preview | Lookup auf `club_member_no` |
| `membership_type` | nur Preview | Kein direktes Zielfeld |
| `valid_from` | nur Preview | — |
| `valid_to` | nur Preview | Kein DB-Feld dafür |
| `reason` | nur Preview | — |
| `notes` | ignorieren | Kein Zielfeld |

---

## Sheet: `Kartenarten`
**Zieltabelle:** `public.permit_card_types` (+ `public.pricing_rules` für Preis)  
**Match-Key:** `card_code` → `permit_card_types.card_type_key`

| Vorlage-Feld | DB-Tabelle | DB-Feld | Aktion | Anmerkung |
|---|---|---|---|---|
| `card_code` | `permit_card_types` | `card_type_key` | Insert-Key | Pflicht |
| `card_name` | `permit_card_types` | `title` | Insert | Pflicht |
| `description` | — | — | ❌ ignorieren | Kein Feld in `permit_card_types`. In `snapshot_json` ablegen |
| `price_amount` | `pricing_rules` | `amount_gross` | Insert in `pricing_rules` | Separater Insert nach `permit_card_types`. Benötigt `product_id` — aktuell noch kein klarer Pfad |
| `currency` | `pricing_rules` | `currency` | Insert in `pricing_rules` | Wie `price_amount` |
| `billing_interval` | — | — | ❌ ignorieren | Kein Zielfeld in DB. In `snapshot_json` ablegen |
| `active` | `permit_card_types` | `is_active` | Insert | Transform: `ja`→`true`, `nein`→`false` |
| `notes` | `permit_card_types` | `snapshot_json` | Insert als JSON | `{"import_notes": "..."}` |

**Pflicht-Warnungen:**
- `card_code` leer → Zeile überspringen
- `card_code` bereits in `permit_card_types.card_type_key` → Update-Kandidat
- `price_amount` ohne klaren `pricing_rules`-Pfad → Warnung "Preis wird noch nicht geschrieben"

**Pflichtfeld für `permit_card_types`:** `card_kind` (NOT NULL) — hat kein Vorlage-Feld. Codex muss Default setzen: `"standard"` oder aus `card_code` ableiten.

---

## Sheet: `Gewaesser`
**Zieltabelle:** `public.water_bodies`  
**Match-Key:** `water_name` → `water_bodies.name` (kein Code-Feld in DB!)

| Vorlage-Feld | DB-Tabelle | DB-Feld | Aktion | Anmerkung |
|---|---|---|---|---|
| `water_code` | — | — | ❌ ignorieren | Kein Feld in `water_bodies`. In `snapshot_json` ablegen wenn vorhanden |
| `water_name` | `water_bodies` | `name` | Match-Key + Insert | Pflicht. Match über exakten Namen |
| `water_type` | `water_bodies` | `area_kind` | Insert | Wert direkt übernehmen. Warnung wenn leer, aber kein Abbruch |
| `region` | — | — | ❌ ignorieren | Kein Zielfeld |
| `district` | — | — | ❌ ignorieren | Kein Zielfeld |
| `active` | `water_bodies` | `is_active` | Insert/Update | Transform: `ja`→`true`, `nein`→`false` |
| `notes` | — | — | ❌ ignorieren | Kein Zielfeld |

**Pflicht-Warnungen:**
- `water_name` leer → Zeile überspringen
- `water_name` bereits in `water_bodies` → Update-Kandidat markieren
- `water_name` Duplikat innerhalb der CSV → Warnung

---

## Sheet: `Gewaesser_Karten`
**Zieltabelle:** `public.permit_water_links`  
**Status: ⛔ Erst nach `Kartenarten`-Import anbinden**

**Abhängigkeit:** Braucht `permit_card_types.card_type_key` und `water_bodies.name` als Lookup-Basis.

| Vorlage-Feld | DB-Tabelle | DB-Feld | Aktion | Anmerkung |
|---|---|---|---|---|
| `card_code` | `permit_card_types` | Lookup → `card_type_id` | Lookup | Warnung wenn kein Match |
| `water_code` | `water_bodies` | Lookup über `name` → `id` | Lookup | `water_code` nicht in DB, Match über Namen aus vorherigem Import |
| `valid_from` | `permit_water_links` | `valid_from` | Insert | Nullable |
| `valid_to` | `permit_water_links` | `valid_until` | Insert | Feldname-Transform |
| `notes` | `permit_water_links` | `reason` | Insert | Semantisch ähnlich, ausreichend |

---

## Sheet: `Mitglieder_Kartenhistorie`
**Zieltabelle:** `public.permit_assignments`  
**Status: ⛔ Noch nicht anbinden**

**Blockiert durch:** `canonical_memberships` für VDAN fast leer (1 Eintrag). `permit_card_types` für VDAN leer. Beide müssen zuerst befüllt sein.

| Vorlage-Feld | DB-Tabelle | DB-Feld | Aktion | Anmerkung |
|---|---|---|---|---|
| `member_number` | `canonical_memberships` | Lookup → `membership_id` | Lookup | Blockiert |
| `card_code` | `permit_card_types` | Lookup → `card_type_id` | Lookup | Blockiert |
| `valid_from` | `permit_assignments` | `valid_from` | Insert | — |
| `valid_to` | `permit_assignments` | `valid_until` | Insert | Feldname-Transform |
| `price_paid` | `member_claims` | `amount_gross` | ⛔ separates Objekt | Eigene Tabelle, eigener Insert-Pfad |
| `status` | `permit_assignments` | `status` | Insert | — |
| `notes` | `permit_assignments` | `snapshot_json` | Insert als JSON | — |

---

## Sheet: `Bewerbungen`
**Zieltabelle:** `public.membership_applications`  
**Match-Key:** `application_id` → `external_ref`

| Vorlage-Feld | DB-Tabelle | DB-Feld | Aktion | Anmerkung |
|---|---|---|---|---|
| `application_id` | `membership_applications` | `external_ref` | Insert als Referenz | Kein direktes `id`-Feld setzbar (UUID auto) |
| `application_status` | `membership_applications` | `status` | Insert | Werte: `pending`, `accepted`, `rejected` |
| `first_name` | `membership_applications` | `first_name` | Insert | NOT NULL in DB |
| `last_name` | `membership_applications` | `last_name` | Insert | NOT NULL in DB |
| `email` | — | — | ❌ ignorieren | Kein `email`-Feld in `membership_applications` |
| `applied_at` | — | — | ❌ ignorieren | `created_at` ist systemseitig, nicht setzbar |
| `decision_at` | `membership_applications` | `decision_at` | Insert | Nullable |
| `accepted_member_number` | — | — | ❌ ignorieren | Kein direktes Zielfeld. In `snapshot_json` ablegen |
| `notes` | — | — | ❌ ignorieren | Kein Zielfeld |

**Pflicht-Felder in DB die die Vorlage nicht liefert (NOT NULL):**
- `birthdate` → Warnung, Default oder Pflichtfeld-Hinweis
- `street`, `zip`, `city` → Warnung, tolerant leer lassen wenn DB-Constraint es erlaubt
- `is_local` → Default `false`
- `fishing_card_type` → Default `""` oder Warnung
- `sepa_approved` → Default `false`
- `iban_last4` → Default `""`

---

## Fehlende Felder in Vorlage (DB hat sie, Vorlage nicht)

| DB-Feld | Tabelle | Empfehlung |
|---|---|---|
| `is_youth` | `club_members` | Aus `current_membership_type` ableiten: `jugend` → `true`, sonst `false` |
| `role` | `club_members` | Default `"member"` |
| `card_kind` | `permit_card_types` | Pflichtfeld, Default `"standard"` |
| `sepa_approved` | `members` / `membership_applications` | Default `false` |

---

## Zusammenfassung für Codex

### Jetzt anbinden:
1. `Mitglieder` → `club_members` + `members`
2. `Kartenarten` → `permit_card_types` (ohne Preis-Pfad)
3. `Gewaesser` → `water_bodies`
4. `Bewerbungen` → `membership_applications` (mit Toleranz bei NOT-NULL-Feldern)

### Erst nach vorherigem Import:
5. `Gewaesser_Karten` → `permit_water_links` (nach Kartenarten + Gewässer)

### Noch nicht anbinden:
- `Mitgliedschaften_Historie` → nur Preview/snapshot_json
- `Mitglieder_Kartenhistorie` → blockiert bis canonical_memberships + permit_card_types befüllt

### Universelle Transforms:
- `ja`/`nein` → `true`/`false` (überall wo `boolean`)
- `active`/`Active`/`Aktiv` → `active` (status-Normalisierung)
- `passive`/`Passive`/`Passiv` → `passive`
- `postal_code` → `zip`
- `valid_to` → `valid_until`
- `card_name` → `title`
