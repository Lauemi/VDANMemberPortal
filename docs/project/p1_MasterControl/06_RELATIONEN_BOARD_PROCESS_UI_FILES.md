# Project One — Relationen Board Process UI Files

Stand: 2026-04-20

## Zweck

Dieses Dokument mappt die reale Zuordnung zwischen:

- Masterboard-Node
- Prozess im operativen Kontrollboard
- UI-/Screen-Ebene
- betroffenen Repo-Dateien

Es dokumentiert ausserdem:

- Mehrfachzuordnungen
- bekannte Inkonsistenzen
- Folgeflaechen

Grundlage:

- `docs/FCP_company/fcp_masterboard_state.json`
- `docs/FCP_company/fcp_process_control_state.json`
- reale Repo-Dateien unter `src/pages/*`, `public/js/*`, `public/css/*`, `supabase/*`

---

## Grundsatz der Relationenlage heute

Die Prozessdatei nutzt `related_nodes`, um Prozesse mit Masterboard-Nodes zu verbinden.

Analyseergebnis:

- alle `related_nodes` verweisen aktuell auf reale Node-IDs des Masterboards
- die formale Board-zu-Prozess-Verknuepfung ist damit konsistent

Nicht konsistent ist an einzelnen Stellen die Screen- oder Routenlage.

Das bedeutet:

- Board -> Process ist formal vorhanden
- Process -> UI ist nur teilweise repo-sicher
- UI -> Files ist heute haeufig implizit statt sauber gefuehrt

Repo-seitig verifiziert:

- 41 Masterboard-Nodes
- 9 Prozesse
- keine fehlenden `related_nodes`
- aktuell zwei nicht aufloesbare Screen-Routen:
  - `/app/vereine`
  - `/app/termine/cockpit`

---

## Konkrete Zuordnungen

## 1. CSV-Import

### Board

- Node: `csv`

### Process

- Prozess: `p-onboarding`

### UI / Screens

In `fcp_process_control_state.json` ist hinterlegt:

- `s-csv-import` mit Pfad `(neu) csv-onboarding`
- `s-onboarding-workspace` mit Pfad `/app/vereine`

### Reale Dateien

Aus `refs` und Repo-Pruefung bestaetigt:

- `public/js/club-admin-setup.js`
- `supabase/functions/club-members-csv-parse/index.ts`
- `supabase/migrations/20260420000000_members_birthdate_nullable.sql`
- mehrere CSV-Fachdokumente unter `docs/project/*`

### Lage heute

- Node und Prozess sind verknuepft.
- Der technische CSV-Pfad ist in `refs` nachvollziehbar.
- Der Prozessscreen `(neu) csv-onboarding` ist keine direkte reale Astro-Route.
- `/app/vereine` ist aktuell repo-seitig nicht als Astro-Datei aufloesbar.

### Folgeflaechen

- Onboarding-Gesamtprozess
- Mitgliederanlage
- Club-Kontext
- spaetere Rollen- und Stammdatenlogik

---

## 2. Billing / Vereinslizenz

### Board

- Node: `billing-stripe`
- zusaetzlich fachnah: `integrations`

### Process

- Prozess: `p-billing`

### UI / Screens

In der Prozessdatei hinterlegt:

- `s-billing-checkout` -> `(edge) fcp-create-checkout-session`
- `s-billing-webhook` -> `(edge) stripe-webhook-handler`
- `s-billing-overview` -> `(neu) ADM club_settings_billing_overview`

### Reale Dateien

Board-Refs bestaetigen:

- `supabase/functions/fcp-create-checkout-session/index.ts`
- `supabase/functions/stripe-webhook-handler/index.ts`
- `public.club_billing_state`
- `public.club_billing_webhook_events`

### Lage heute

- Die Prozesssicht ist hier staerker als eine konkrete Seitenroute.
- Zwei Screen-Eintraege sind Edge-/Systempfade, keine eigentlichen App-Seiten.
- Der Uebergang von Board zu konkreter bearbeitbarer UI ist dadurch schwach.

### Folgeflaechen

- Checkout
- Webhook-Zustand
- Billing-State
- Integrationsvertrag

---

## 3. Mitgliederverwaltung

### Board

- Node: `members-ops`
- fachliche Nachbarn:
  - `membership-model`
  - `roles`
  - `club-master`
  - `auth-profiles`

### Process

- Prozess: `p-members`

### UI / Screens

In der Prozessdatei hinterlegt:

- `/app/mitgliederverwaltung`
- `/app/mitgliederverwaltung#rollen`
- `/app/mitgliederverwaltung#waters`

### Reale Dateien

Repo-bestaetigt:

- `src/pages/app/mitgliederverwaltung/index.astro`
- `public/js/member-registry-admin.js`

Zusatz aus Board-Refs:

- mehrere `public.*`-Tabellen und Admin-RPCs fuer Registry-Pfade

### Lage heute

- Dies ist eine der saubersten realen Zuordnungen.
- Node, Prozess, Route und Frontend-Datei sind nachvollziehbar verknuepfbar.
- Trotzdem fehlt in der Masterboard-UI selbst die klickbare Darstellung dieser Beziehungen.

### Folgeflaechen

- Rollen / Rechte
- Gewaesser-Teilbereich
- Stammsatz- und Snapshot-Logik
- Mitgliedschaftsmodell

---

## 4. Gewaesser

### Board

- Nodes:
  - `waters-onboard`
  - `waters-ops`
  - fachnah `trips`

### Process

- Prozesse:
  - `p-waters`
  - zusaetzlich beteiligt: `p-onboarding`

### UI / Screens

Hinterlegt:

- `/app/mitgliederverwaltung#waters`

### Reale Dateien

- `src/pages/app/mitgliederverwaltung/index.astro`
- `public/js/member-registry-admin.js`

### Lage heute

- Mehrfachzuordnung ist real vorhanden:
  - Gewaesser sind sowohl Onboarding- als auch Operativthema
- Diese Mehrfachrolle wird im Boardtext sichtbar, aber nicht in der UI als relationale Fuehrung nutzbar gemacht.

### Folgeflaechen

- CSV-MVP
- Wasserkoerper-Logik
- Fangliste / Trips
- spaetere Statistik

---

## 5. Karten / Beitraege / Pricing

### Board

- Nodes:
  - `cards-onboard`
  - `cards-ops`
  - `pricing-model`
  - fachnah `fees-ops`

### Process

- Prozess: `p-cards-pricing`

### UI / Screens

Hinterlegt:

- `(neu) permit_card_types Admin-UI`
- `(neu) pricing-rules`

### Reale Dateien

Board- und Prozesslage bestaetigen vor allem DB-/Migrationsebene:

- `public.permit_card_types`
- `public.tenant_nodes`
- `supabase/migrations/20260417200000_admin_permit_card_types_for_club_rpc.sql`
- weitere Pricing-/Card-Tabellen laut JSON-Stand

### Lage heute

- Die Beziehung Board -> Prozess ist vorhanden.
- Eine saubere reale UI-Flaeche fuer diese Screens ist repo-seitig noch nicht hinterlegt.
- Gerade hier zeigt sich stark, dass der Prozessstand teils schon ueber reale UI hinausmodelliert ist.

### Folgeflaechen

- Onboarding
- Mitgliederzuweisung
- spaetere Billing- und Beitragslogik

---

## 6. Onboarding-Gesamtfluss

### Board

- Nodes:
  - `registration`
  - `invite`
  - `auth`
  - `welcome`
  - `csv`
  - `waters-onboard`
  - `cards-onboard`
  - `work-onboard`
  - `onboarding-process`

### Process

- Prozess: `p-onboarding`

### UI / Screens

Hinterlegt:

- `/registrieren`
- `/verein-anfragen`
- `/vereinssignin`
- `/app/vereine`
- `(neu) csv-onboarding`

### Reale Dateien

Repo-bestaetigt:

- `src/pages/registrieren.astro`
- `src/pages/verein-anfragen.astro`
- `src/pages/vereinssignin.astro`
- `public/js/member-auth.js`
- `public/js/club-admin-setup.js`

Nicht bestaetigt als Astro-Route:

- `/app/vereine`

### Lage heute

- Der Prozess verknuepft viele Nodes korrekt.
- Die reale Screen-Lage ist nur teilweise deckungsgleich mit den eingetragenen Pfaden.
- Dadurch entsteht bereits in der Dokumentation sichtbar eine wichtige Inkonsistenz zwischen Prozesskontrollsicht und Repo-Routenlage.

### Folgeflaechen

- Registrierung
- Login / Claim / Invite
- Club-Setup
- CSV
- erste operative Aktivierung

---

## 7. Dokumente / Sitzungen

### Board

- Nodes:
  - `docs-ops`
  - `meetings`
  - `protocols`

### Process

- Prozess: `p-docs-meetings`

### UI / Screens

Hinterlegt:

- `/app/dokumente`
- `/app/sitzungen`

### Reale Dateien

- `src/pages/app/dokumente/index.astro`
- `src/pages/app/sitzungen/index.astro`

### Lage heute

- Hier ist die Zuordnung zwischen Board, Prozess und UI sauber nachvollziehbar.
- Die Beziehungen sind fachlich vorhanden, aber in der Masterboard-UI selbst nicht klickbar gefuehrt.

### Folgeflaechen

- Beschluss-/Protokollpfade
- Dokumentlogik
- Governance-Sicht

---

## 8. Events / Arbeitseinsaetze

### Board

- Nodes:
  - `events-ops`
  - `work-ops`

### Process

- Prozesse:
  - `p-events`
  - `p-work`

### UI / Screens

Hinterlegt:

- `/app/arbeitseinsaetze`
- `/app/termine/cockpit`
- `/app/eventplaner`

### Reale Dateien

Repo-bestaetigt:

- `src/pages/app/arbeitseinsaetze/index.astro`
- `src/pages/app/eventplaner/index.astro`
- `src/pages/app/eventplaner-v2/index.astro`

Nicht bestaetigt als reale Astro-Route:

- `/app/termine/cockpit`

### Lage heute

- `events-ops` ist mehrfach einem Event- und Work-Kontext zugeordnet.
- Die Prozessdokumentation referenziert eine Route, die aktuell repo-seitig nicht gefunden wurde.

### Folgeflaechen

- Eventplaner
- operative Arbeitseinsaetze
- Aktivierungslogik

---

## Bekannte Inkonsistenzen

Die folgenden Inkonsistenzen sind repo-seitig bestaetigt:

### 1. Prozessscreen `/app/vereine`

In `fcp_process_control_state.json` hinterlegt, aber keine passende reale Astro-Datei gefunden.

### 2. Prozessscreen `/app/termine/cockpit`

In `fcp_process_control_state.json` hinterlegt, aber keine passende reale Astro-Datei gefunden.

### 3. Mehrere Screens als `(neu)` oder `(edge)` statt reale UI-Routen

Beispiele:

- `(neu) csv-onboarding`
- `(neu) pricing-rules`
- `(neu) permit_card_types Admin-UI`
- `(neu) ADM club_settings_billing_overview`
- `(edge) fcp-create-checkout-session`
- `(edge) stripe-webhook-handler`

Das ist nicht automatisch falsch, zeigt aber:

- die Prozesssicht ist teilweise weiter modelliert als die reale UI-Sicht
- das Kontrollboard enthaelt schon Ziel- oder Konzeptflaechen

---

## Mehrfachzuordnungen

Die Analyse bestaetigt mehrere relevante Mehrfachzuordnungen:

### `waters-onboard`

Verknuepft mit:

- `p-waters`
- `p-onboarding`

### `cards-onboard`

Verknuepft mit:

- `p-cards-pricing`
- `p-onboarding`

### `events-ops`

Verknuepft mit:

- `p-events`
- `p-work`

Diese Mehrfachzuordnungen sind wichtig fuer MasterControl, weil sie reale Folgeflaechen anzeigen.

Heute sind sie aber im Produkt kaum als Fuehrungsbeziehung nutzbar.

---

## Relationale Schlussfolgerung

Das bestehende System enthaelt bereits eine brauchbare formale Grundlage fuer:

- Board -> Process
- Process -> Screen
- Board -> technische Referenzen

Die Hauptschwaeche liegt nicht im kompletten Fehlen von Relationen, sondern darin, dass diese Relationen heute:

- nur als Text oder JSON vorliegen
- nicht klickbar gefuehrt sind
- nicht bis zur realen Datei aufgeloest werden
- Folgeflaechen nicht als Arbeitskontext sichtbar machen

Genau diese Luecke muss MasterControl spaeter schliessen.

---

## Verwendungsregel fuer Folge-Agenten

Dieses Dokument ist die fuehrende repo-wahre Mapping-Basis fuer:

- Board -> Process
- Process -> UI
- UI -> Files
- Inkonsistenzen
- Mehrfachzuordnungen

Wenn spaetere Soll- oder Plan-Dokumente abweichen, gilt fuer die reale Ist-Lage immer zuerst dieses Mapping-Dokument zusammen mit:

- `02_IST_ANALYSE_MASTERBOARD.md`
- `03_UI_WAHRHEIT_MASTERBOARD.md`
- `04_INTERAKTIONSWAHRHEIT_MASTERBOARD.md`
- `05_FUEHRUNGSDEFIZITE_MASTERBOARD.md`
