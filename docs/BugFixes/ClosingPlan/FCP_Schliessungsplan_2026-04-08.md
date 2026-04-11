# FCP Schließungsplan – alle offenen Punkte
**Stand: 2026-04-08 | Für: Claude · Codex · ChatGPT · Michel**

---

## Arbeitsteilung (verbindlich)

| Wer | Zuständig für |
|---|---|
| **Claude** | DB-Wahrheit, Migrationen, RPCs, Settings, Verifikation |
| **Codex** | Repo, Edge Functions, UI, Runtime, Panels |
| **ChatGPT** | Fachlogik, Architektur, Abgleich, Entscheidungshilfe |
| **Michel** | Freigabe, Vereinsgespräch, Fachklärung |

**Regel:** DB-Problem → Claude. Repo/UI-Problem → Codex. Fachfrage → ChatGPT. Nie über die falsche Ebene bridgen.

---

## Statussystem (operativ)

### Verbindliche Stati

| Status | Bedeutung |
|---|---|
| `erledigt` | fachlich und technisch abgeschlossen |
| `in_arbeit` | aktiv in Umsetzung oder Verifikation |
| `offen` | noch nicht begonnen oder noch ohne tragfähigen Fix |
| `technisch_gruen` | technisch funktionsfähig, aber noch nicht produktiv überzeugend |
| `bewusst_spaeter` | absichtlich zurückgestellt, nicht aktueller Blocker |

**Regel:** `technisch_gruen` ist kein Abschlussstatus. Er bedeutet: laeuft, aber noch nicht gut genug fuer echten Produktbetrieb.

### Aktueller Status-Snapshot aus Kescher 2026-04-08 11:52

| Bereich | Status |
|---|---|
| `club_settings_cards_config_table` | `technisch_gruen` |
| `club_settings_cards_quick_add` | `in_arbeit` |
| `club_settings_cards_table` | `bewusst_spaeter` |
| `club_settings_process_context` | `offen` |
| `club_settings_route_contract` | `offen` |
| `club_settings_request_audit` | `technisch_gruen` |
| Resume-Fix QuickOnboarding | `in_arbeit` |

---

## Block A – Sofort schließen (kein Vereinsgespräch nötig)

### Status-Update 2026-04-08 Mittag

- `club_settings_cards_config_table` ist inzwischen contract-seitig sauber:
  - SQL-Contract referenziert
  - `NO_SQL_CONTRACT_REFERENCE` ist geschlossen
  - Kescher läuft dort ohne Gap
- `club_settings_cards_config_table` hat bereits einen ersten Inline-Edit-/Save-Pfad.
  - Das ist ein brauchbarer Zwischenstand, aber noch nicht die endgültige Produktfertigstellung der Karten-Arbeitsfläche.
- Offener Rest im Kartenbereich ist aktuell vor allem:
  - `club_settings_cards_quick_add` mit verbleibendem `COLUMN_MISMATCH`
  - visuelle/produktseitige Schärfung der Karten-Arbeitsfläche
- `club-onboarding-workspace` nutzt bereits die korrigierten Fallback-Labels `Mitglied / Jugend / Ehren` und wurde deployt.

**Wichtig:** Block A ist damit teilweise bereits erledigt. Die folgenden Punkte sind als verbleibende Restarbeiten zu lesen, nicht mehr als kompletter Ausgangsstand.

### A1 · Resume-Fix verifizieren
**Wer:** Codex + Michel
**Status:** `in_arbeit`
**Was:** QuickOnboarding-Resume prüfen ob er jetzt korrekt läuft:
1. `/app/mitgliederverwaltung/?mode=quickonboarding` öffnen
2. Mit aktuellem DB-Stand (`cards ✓ · work ✓ · members ⏳`) muss Resume auf **Mitglieder** landen
3. Wenn nicht → Codex fixiert `index.astro` Resume-Logik auf:
   - `cards_complete = false` → Karten
   - `notes.work_hours_configured !== true` → Pflichtstunden
   - `members_mode = 'pending'` → Mitglieder

**Claude-Beitrag:** DB-Stand ist gesetzt und verifiziert. Kein weiterer DB-Eingriff nötig.

---

### A2 · Karten-Tabelle als Arbeitsbereich
**Wer:** Codex
**Status:** `technisch_gruen`
**Stand jetzt:** Ein erster Inline-Edit-/Save-Pfad ist vorhanden.

**Offen bleibt produktseitig:**
- Bearbeitung weiter schärfen, damit die Tabelle sich klar als Arbeitsbereich anfühlt
- `is_active` als bewusste Aktion/Spalte ergänzen, damit Deaktivieren möglich ist
- Kein Löschen (stabile Keys dürfen nie verschwinden)

**Nicht als "fertig" betrachten, nur weil der Save-Pfad existiert.**

**Constraint:** Keys `innenwasser` und `rheinlos39` sind dauerhaft — nie ändern, nie löschen.

---

### A3 · Default-Labels im Workspace
**Wer:** Codex
**Status:** `erledigt`

**Historie:** In `club-onboarding-workspace/index.ts` wurden die Fallback-Labels korrigiert:
```
Alt: "Standard" / "Ehrenmitglied"
Neu: "Mitglied" / "Ehren"
```

---

### A4 · Tippfehler `Innewasser` dokumentieren
**Wer:** Codex
**Status:** `offen`
**Was:** 9 Mitglieder haben `Innewasser` (ein `n` fehlt) in `fishing_card_type`.
- NICHT jetzt korrigieren
- Im Code sicherstellen dass Berechtigungslogik defensiv damit umgeht (case-insensitive oder Normalisierung)
- Als Altlast-Kommentar im Code markieren: `// TODO: normalize 'Innewasser' → 'Innenwasser' vor member_card_assignments Migration`

---

### A5 · Neuer Kescher-Lauf
**Wer:** Michel
**Status:** `in_arbeit`
**Was:** Nach A1–A4 und hartem Browser-Reload neuen Kescher-Export starten für `ADM_CLUB_SETTINGS_ONBOARDING`

**Aktuelle Erwartung:**
- `club_settings_cards_config_table` bleibt grün
- verbleibend offen darf nur noch sein:
  - `club_settings_cards_quick_add` mit möglichem `COLUMN_MISMATCH`
  - bekannte Preview-Panels im Overview
  - `club_settings_cards_table` als `PARTIAL_NOT_FULLY_CONNECTED`

**Wenn `club_settings_cards_quick_add` weiter `actualKeys = ok, workspace` zeigt:**
- Browser hart neu laden
- falls noetig Dev-Server neu starten
- erst danach Resolver-/Runtime-Fehler weiter untersuchen

---

## Block B – Nach Vereinsgespräch (Michel klärt mit Vorstand)

### B1 · Pflichtstunden bestätigen
**Wer:** Michel klärt, dann Claude setzt
**Status:** `offen`
**Was:** Aktuell steht in DB:
```json
{ "enabled": true, "default_hours": 8, "youth_exempt": true, "honorary_exempt": true }
```
**Fragen an Vorstand:**
- Stimmt 8 Stunden als Standard?
- Sind Jugend und Ehren wirklich vollständig befreit?
- Gibt es Ausnahmen (z.B. Passive Mitglieder)?

Wenn Antwort vorliegt → Claude updated `club_work_hours_config` direkt in DB.

---

### B2 · Preise für Karten eintragen
**Wer:** Michel klärt, dann Claude setzt
**Status:** `offen`
**Was:** Aktuell alle `price: null`. VDAN muss entscheiden:
- Innenwasser Standard: ? €
- Innenwasser Jugend: ? €
- Innenwasser Ehren: ? € (vermutlich 0)
- Rheinlos 39 Standard: ? €
- Rheinlos 39 Jugend: ? €
- Rheinlos 39 Ehren: ? €

Wenn Preise vorliegen → Claude updated `club_cards` in `app_secure_settings` direkt.

---

### B3 · `Btr. bf` klären
**Wer:** Michel klärt, dann Entscheidung
**Status:** `offen`
**Was:** 16 Mitglieder haben `Btr. bf`-Marker in `fishing_card_type`.
**Fragen an Vorstand:**
- Was bedeutet `Btr. bf` genau? (Beitrag befreit?)
- Ist das dauerhaft oder jährlich?
- Wer entscheidet das?

**Wichtig:** `Btr. bf` kommt NICHT ins Kartenmodell. Es gehört ins spätere Abrechnungsmodul. Klärung jetzt nur für die spätere Migration.

---

## Block C – Nächste Architekturbausteine (nach Block A + B)

### C0 · Karten-Arbeitsfläche produktseitig fertigziehen
**Wer:** Codex
**Status:** `offen`

**Klarstellung:** Das ist getrennt von Contract-/Kescher-Hygiene.

**Was noch fehlt:**
- `club_settings_cards_config_table` als wirklich ruhige Arbeitsfläche veredeln
- Spalten-/Interaktionslogik so schärfen, dass Bearbeiten nicht nur technisch geht, sondern produktseitig klar ist
- `club_settings_cards_quick_add` und Tabelle bewusst zusammendenken:
  - Form für schnelles Anlegen
  - Tabelle für laufende Pflege

**Nicht verwechseln mit:**
- SQL-Contract vorhanden
- Kescher grün
- Save-Pfad existiert

Das sind notwendige Voraussetzungen, aber noch nicht automatisch eine fertige Produktfläche.

---

### C1 · Stripe Billing anbinden
**Wer:** Claude (DB) + Codex (Edge Functions)
**Status:** `bewusst_spaeter`
**Was fehlt:**
- Edge Function `stripe-webhook` (empfängt Stripe-Events)
- Edge Function `club-billing-checkout` (erstellt Checkout Session)
- Nach erfolgreichem Checkout: `set_club_billing_state('active')` → `setup_state` wechselt

**Voraussetzung:** Michel bestätigt ob Stripe-Account bereits angelegt ist.

---

### C2 · Mail Templates prüfen und anpassen
**Wer:** Michel öffnet Dashboard, Claude und Codex analysieren
**Status:** `bewusst_spaeter`
**Was:** Auth-Templates leben im Supabase Dashboard, nicht in der DB.
**URL:** `https://supabase.com/dashboard/project/peujhdrqnbvhllxpfavo/auth/templates`

**Relevante Templates:**
- **Invite user** → muss zum VDAN Claim-Flow passen (Link auf Claim-Seite)
- **Confirm signup** → Willkommenstext für neue Mitglieder
- **Reset password** → Standard, vermutlich ok

**Vorgehen:** Michel kopiert aktuellen Template-Inhalt → Claude/ChatGPT formuliert verbesserte Version → Michel trägt ein.

---

### C3 · `member_card_assignments` Tabelle (nach B3-Klärung)
**Wer:** Claude (DB) + Codex (Runtime)
**Status:** `bewusst_spaeter`
**Was:** Erst wenn `Btr. bf` und Preise geklärt sind.
Planungsdokument ist fertig: `FCP_MEMBER_CARD_ASSIGNMENTS_PLANUNG.md`

**Nicht anfassen bis:** Alle Block-B-Punkte abgeschlossen.

---

## Reihenfolge visuell

```
JETZT
  ↓
A1 Resume-Fix verifizieren       [Michel + Codex]
A2 Karten-Tabelle Aktionsspalte  [Codex]
A3 Default-Labels fix            [Codex + deploy]
A4 Tippfehler dokumentieren      [Codex]
A5 Kescher-Lauf                  [Michel]
  ↓
VEREINSGESPRÄCH
  ↓
B1 Pflichtstunden bestätigen     [Michel → Claude]
B2 Preise eintragen              [Michel → Claude]
B3 Btr. bf klären                [Michel → Entscheidung]
  ↓
NÄCHSTE BAUSTEINE
  ↓
C1 Stripe anbinden               [Claude + Codex]
C2 Mail Templates                [Michel + Claude/ChatGPT]
C3 member_card_assignments       [Claude + Codex]
```

---

## Was NICHT angetastet wird (stabile Wahrheiten)

| Was | Warum |
|---|---|
| Keys `innenwasser` / `rheinlos39` | Gewässerzuordnung hängt daran |
| `fishing_card_type` als String | Läuft, Migration kommt mit C3 |
| `Btr. bf`-Mitglieder | Warten auf fachliche Klärung |
| `permit_card_types` Tabelle | Kein aktiver Runtime-Pfad |
| Migration-Reihenfolge in DB | Sauber, nicht anfassen |

---

## Ergänzende Rest-Risiken aus dem aktuellen Lauf

1. `club_settings_cards_quick_add` kann trotz korrekter `valuePaths` im Kescher noch alt wirken, wenn der Browser einen alten Resolver-Stand cached.
2. Preview-Panels im Overview sind bewusst noch nicht live und dürfen den Block-A-Abschluss nicht künstlich aufhalten.
3. `club_settings_cards_table` bleibt aktuell bewusst `partial`, weil es die bestehende Mitglieder-/Profilwahrheit abbildet und kein Teil des neuen Kartenpflegepfads ist.
4. `club_data_complete = true` bedeutet aktuell eher Flow-Haken als echte Feldvollständigkeit. Das ist dokumentierte Fachlücke, kein heutiger Blocker.
