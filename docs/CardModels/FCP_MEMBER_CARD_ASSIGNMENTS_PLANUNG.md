# FCP Planungsdokument: Mehrfachkarten-Architektur
**Datum: 2026-04-08 | Status: Jetzt live vs. Nächster Baustein**

---

## Die eine Fachregel die alles trägt

> Karten sind Berechtigungskontexte. Ein Mitglied kann einen oder mehrere dieser Kontexte besitzen. Die gültigen Gewässer eines Mitglieds ergeben sich aus der Vereinigung aller zugewiesenen Karten.

Das ist keine technische Aussage. Das ist eine fachliche Wahrheit über Fischereivereine.

---

## Was die VDAN-Daten heute zeigen

Aktuell im System (214 aktive Mitglieder mit Kartentyp):

| `fishing_card_type` (Ist) | Anzahl | Bedeutung fachlich |
|---|---|---|
| `Innenwasser + Rheinlos` | 114 | **2 Karten** |
| `Rheinlos Erwachsener` | 29 | **1 Karte** (nur Rheinlos) |
| `Innenwasser + Rheinlos Jugend` | 28 | **2 Karten**, Jugendgruppe |
| `Innenwasser Erwachsener` | 14 | **1 Karte** (nur Innenwasser) |
| `Innenwasser + Rheinlos VSS Btr. Bf` | 10 | **2 Karten** + Beitragsvermerk |
| `Innewasser Ehrenmitglied + Rheinlos Erwachsener` | 9 | **2 Karten**, Ehrengruppe |
| `Innenwasser + Rheinlos Btr. bf` | 5 | **2 Karten** + Beitragsvermerk |
| `Innenwasser Ehrenmitglied` | 4 | **1 Karte**, Ehrengruppe |
| `Innenwasser Btr. bf` | 1 | **1 Karte** + Beitragsvermerk |

**Befund:** 166 von 214 Mitgliedern (77%) haben **zwei Karten**. Das Feld `fishing_card_type` als einzelner String denkt bereits in Richtung Kombinationen — aber als zusammengeklebter Text ohne Struktur.

Das ist der MVP-Kompromiss der jetzt aufgelöst werden muss.

---

## Jetzt live (MVP) — was gilt und was gilt nicht

### Was heute gilt
- `fishing_card_type` in `club_members` und `members` ist ein einzelner Freitext-String
- Beim Auto-Assign wird der `title` der Default-Karte gesetzt (`"Innenwasser"`)
- Die Gewässerzuordnung läuft über `club_water_card_assignments:{club_id}` mit stabilen Keys
- Karten sind als `group_rules`-Objekte in `app_secure_settings` gespeichert

### Was der MVP NICHT kann
- Einem Mitglied mehrere Karten gleichzeitig strukturiert zuweisen
- Die Gewässerberechtigung eines Mitglieds aus mehreren Karten zusammenführen
- Ausweis-Gültigkeit pro Karte getrennt verwalten
- Beitragslogik pro Kartenkontext separat abbilden

### Was der MVP vorgibt das er kann aber nicht sauber kann
- `fishing_card_type = "Innenwasser + Rheinlos"` — das sind zwei Karten in einem String. Nicht auflösbar ohne Parsing.

---

## Nächster Architekturbaustein: `member_card_assignments`

### Zielstruktur (Tabelle)

```sql
CREATE TABLE public.member_card_assignments (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id         uuid        NOT NULL,
  member_no       text        NOT NULL,
  card_id         text        NOT NULL,  -- stabiler Key: 'innenwasser', 'rheinlos39'
  member_group_key text       NOT NULL,  -- 'standard' | 'youth' | 'honorary'
  valid_from      date        NULL,
  valid_until     date        NULL,
  assigned_at     timestamptz DEFAULT now(),
  assigned_by     uuid        NULL,      -- auth.uid() des Admin der zugewiesen hat
  source          text        NULL,      -- 'manual' | 'auto_assign' | 'import' | 'invite_claim'
  notes           text        NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  -- Eindeutigkeit: ein Mitglied kann eine Karte pro Periode nur einmal haben
  UNIQUE (club_id, member_no, card_id, valid_from)
);
```

### Warum `card_id` als Text-Key und nicht als UUID-FK

Weil `club_cards` in `app_secure_settings` lebt und keine eigene Tabelle hat. Die stabilen Keys `innenwasser`, `rheinlos39` sind die Referenz — nicht generierte UUIDs. Das ist bewusst so.

Langfristig wenn `permit_card_types` aktiviert wird, kann `card_id` auf deren PK zeigen. Bis dahin: stabiler String-Key.

### Gewässerberechtigung aus mehreren Karten

```typescript
// Gewässer eines Mitglieds = Vereinigung aller zugewiesenen Karten
async function getMemberWaterAccess(clubId, memberNo) {
  const assignments = await getMemberCardAssignments(clubId, memberNo);
  const cardIds = assignments.map(a => a.card_id);

  const waterAssignments = await getClubWaterCardAssignments(clubId);
  // waterAssignments: { water_body_id: ["innenwasser", "rheinlos39"] }

  const accessibleWaters = Object.entries(waterAssignments)
    .filter(([waterId, cards]) =>
      cards.some(cardId => cardIds.includes(cardId))
    )
    .map(([waterId]) => waterId);

  return accessibleWaters;
}
```

---

## Migrationsstrategie (wenn es so weit ist)

### Phase 1 — Tabelle anlegen, parallel betreiben
- `member_card_assignments` anlegen
- `fishing_card_type` bleibt noch aktiv
- neue Mitglieder bekommen Einträge in beiden Feldern

### Phase 2 — Bestandsdaten migrieren
Aus den bestehenden `fishing_card_type`-Strings können Zuweisungen abgeleitet werden:

```
"Innenwasser + Rheinlos"        → innenwasser + rheinlos39, standard
"Rheinlos Erwachsener"          → rheinlos39, standard
"Innenwasser + Rheinlos Jugend" → innenwasser + rheinlos39, youth
"Innenwasser Ehrenmitglied"     → innenwasser, honorary
"Innewasser Ehrenmitglied + Rheinlos Erwachsener" → innenwasser (honorary) + rheinlos39 (standard)
```

**Achtung:** `VSS Btr. Bf` und `Btr. bf` sind Beitragsvermerke, keine Kartentypen. Die müssen vor der Migration bereinigt werden.

### Phase 3 — `fishing_card_type` deprecaten
- Read bleibt für Altkompatibilität
- Write nur noch via `member_card_assignments`
- UI zeigt Karten-Liste, nicht mehr String

---

## Was NICHT geändert wird (stabil)

| Was | Warum stabil |
|---|---|
| `club_cards` Key-Format mit `group_rules` | Neu gesetzt, sauber |
| Stabile Keys `innenwasser`, `rheinlos39` | Gewässerzuordnung hängt daran |
| `club_water_card_assignments` Format | Gesetzt, funktioniert |
| `admin_member_assign_card()` RPC | Wird für Phase 1 weiter genutzt |

---

## Übergabe an Codex — was er jetzt wissen muss

```
KEIN UMBAU JETZT.

Nur verstehen und vormerken welche Repo-Stellen später betroffen sind:

1. club-onboarding-workspace/index.ts
   - Auto-Assign schreibt heute in fishing_card_type (einzelner String)
   - Später: schreibt zusätzlich in member_card_assignments
   - Heute: unverändert lassen

2. club-invite-claim/index.ts
   - Heute: admin_member_assign_card() setzt fishing_card_type
   - Später: zusätzlich INSERT in member_card_assignments
   - Heute: unverändert lassen

3. ADM-Panels / Mitglieder-Übersicht
   - Heute: fishing_card_type als Text-Spalte
   - Später: Karten-Liste aus member_card_assignments
   - Heute: unverändert lassen

4. Fangbuch / catch_entries
   - Heute: kein direkter Kartenbezug
   - Später: Berechtigung prüfen gegen member_card_assignments
   - Heute: unverändert lassen

EINZIGE AUFGABE JETZT:
Prüfe ob irgendwo im Repo noch Altlogik steckt die
fishing_card_type als strukturierten Wert parst
(z.B. Split auf '+', Substring-Checks etc.)
Falls ja: benennen, noch nicht anfassen.
```

---

## Zusammenfassung in einem Satz je Schicht

**Jetzt live:** `fishing_card_type` ist ein MVP-String. Er funktioniert, ist aber strukturell zu schwach für das echte Vereinsmodell.

**Nächster Baustein:** `member_card_assignments` als n:m-Tabelle zwischen Mitglied und Kartenkontext. Gewässerberechtigung wird dann aus der Vereinigung aller zugewiesenen Karten berechnet.

**Nicht anfassen bis:** Bestandsdaten-Migrationsstrategie steht und Beitragsvermerke (`VSS Btr. Bf`, `Btr. bf`) fachlich geklärt sind.
