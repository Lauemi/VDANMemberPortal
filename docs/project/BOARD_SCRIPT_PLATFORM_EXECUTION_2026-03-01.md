# Board Script - Platform Execution

Stand: 2026-03-01
Branch: prep_vercel_multienv_admin_tools
Zweck: Zentrale Steuerdatei fuer Multi-Tenant-Ausbau, Store-Faehigkeit, Billing, Performance und Bereinigung.

## 1) Marker-Legende
- `SEC` = Security-relevant
- `DSGVO` = Datenschutz/Compliance-relevant
- `PERF` = Performance/Kosten-relevant
- `OPS` = Betriebs-/Release-relevant
- `STORE` = iOS/Android Store-relevant
- `BILLING` = Abrechnung/Stripe-relevant

## 2) Prioritaeten
- `P0` Blocker fuer sicheren Betrieb oder Rollout
- `P1` sehr wichtig, direkt nach P0
- `P2` Optimierung/Skalierung

## 3) Bestehende Referenzen (bereits vorhanden)
- Multi-Club Gates: `docs/project/MULTI_CLUB_FINAL_AUSBAU_GATES_2026-03-01.md`
- Multi-Club Backlog: `docs/project/MULTI_CLUB_PHASE1_IMPLEMENTATION_BACKLOG_2026-03-01.md`
- Risiko-Matrix: `docs/project/TECH_RISIKO_MATRIX_2026-03-01.md`
- Smoke-Test: `docs/project/RELEASE_SMOKE_TEST_STAGING_BETA_PROD_2026-03-01.md`
- Vercel Cutover: `docs/project/VERCEL_CUTOVER_RUNBOOK_2026-03-01.md`
- Open-Items Tracker: `docs/project/MASTERLISTE_OPEN_ITEMS_TRACKER_2026-03-01.md`
- SQL Plan Phase 1: `docs/supabase/50_multi_club_phase1_plan.sql`

## 4) Risiko-15 als umsetzbare Board-Tasks

### T-01 `club_id` Vollstaendigkeit erzwingen
- Marker: `SEC`, `DSGVO`, `OPS`
- Prio: P0
- Ziel: keine domaintabelle ohne `club_id not null`.
- Nachweis:
  - [ ] Tabellenliste mit `club_id`-Status erstellt
  - [ ] Backfill + FK + NOT NULL auf Staging verifiziert

### T-02 RLS Komplexitaet reduzieren
- Marker: `SEC`, `PERF`
- Prio: P0
- Ziel: simple membership-basierte Policies, keine teuren policy-joins.
- Nachweis:
  - [ ] Kritische Tabellen mit EXPLAIN/Timing geprüft
  - [ ] Policy-Pattern dokumentiert

### T-03 SECURITY DEFINER Harden
- Marker: `SEC`, `DSGVO`
- Prio: P0
- Ziel: jede definer function mit `auth.uid()` + `club_id` checks + fixed `search_path`.
- Nachweis:
  - [ ] RPC-Inventar erstellt
  - [ ] definer-review abgeschlossen

### T-04 JWT Stale-Permission Umgang
- Marker: `SEC`, `OPS`
- Prio: P1
- Ziel: Rollenwechsel wirkt zeitnah und sicher.
- Nachweis:
  - [ ] Session-refresh flow dokumentiert
  - [ ] rollenwechsel-smoke-test vorhanden

### T-05 Schreibdialog Multi-Membership
- Marker: `SEC`, `DSGVO`, `OPS`
- Prio: P0
- Ziel: bei >1 Membership immer explizite Vereinsauswahl.
- Nachweis:
  - [ ] UX-Dialog spezifiziert
  - [ ] no-silent-default test bestanden

### T-06 Idempotenz fuer Writes
- Marker: `SEC`, `OPS`
- Prio: P0
- Ziel: kein Doppel-Submit via offline/retry.
- Nachweis:
  - [ ] `client_request_id` Pattern in betroffenen Flows
  - [ ] unique constraints aktiv

### T-07 Offline-Konfliktstrategie
- Marker: `OPS`, `DSGVO`
- Prio: P1
- Ziel: konfliktbehandlung (optimistic lock + UI decision).
- Nachweis:
  - [ ] Konflikt-UX beschrieben
  - [ ] Konflikt-Testfall dokumentiert

### T-08 Push Payload Club-Awareness
- Marker: `SEC`, `OPS`
- Prio: P0
- Ziel: push payload enthält `club_id`, `club_name`, `target_url`.
- Nachweis:
  - [ ] payload schema versioniert
  - [ ] e2e push test mit multi-club kontext

### T-09 Storage Tenant-Schutz
- Marker: `SEC`, `DSGVO`
- Prio: P0
- Ziel: private buckets + korrekte policies + scoped paths.
- Nachweis:
  - [ ] bucket checklist abgearbeitet
  - [ ] negativer fremdzugriffstest fehlgeschlagen (wie gewünscht)

### T-10 CORS/Redirect/CSP je Env
- Marker: `SEC`, `OPS`, `STORE`
- Prio: P0
- Ziel: jede domain/env korrekt eingetragen.
- Nachweis:
  - [ ] env matrix vollständig
  - [ ] auth smoke je env erfolgreich

### T-11 Key/Secret Trennung pro Env
- Marker: `SEC`, `OPS`
- Prio: P0
- Ziel: keine key-wiederverwendung staging/beta/prod.
- Nachweis:
  - [ ] secrets-matrix gefüllt
  - [ ] verify-script für 3 envs grün

### T-12 Audit-Spuren
- Marker: `SEC`, `DSGVO`, `OPS`
- Prio: P1
- Ziel: kritische aktionen mit `actor`, `club_id`, `action`, `time`.
- Nachweis:
  - [ ] audit event schema
  - [ ] mind. 5 kritische flows geloggt

### T-13 Migration + Rollback
- Marker: `OPS`, `SEC`
- Prio: P0
- Ziel: backfill und rollback path pro migration.
- Nachweis:
  - [ ] rollout runbook
  - [ ] rollback dry-run auf staging

### T-14 Performance Guards
- Marker: `PERF`, `OPS`
- Prio: P1
- Ziel: index, pagination, payload limits, query budgets.
- Nachweis:
  - [ ] perf budget pro endpoint
  - [ ] top 10 queries gemessen

### T-15 Restore/Offboarding tenantfähig
- Marker: `DSGVO`, `OPS`, `SEC`
- Prio: P1
- Ziel: restore testbar, tenant offboarding sauber.
- Nachweis:
  - [ ] quartals-restore protokoll
  - [ ] offboarding checklist vorhanden

## 5) Store-Faehigkeit (iOS/Android)

### T-16 PWA -> Store Readiness Entscheidung
- Marker: `STORE`, `OPS`
- Prio: P1
- Optionen:
  - a) Nur PWA (kein Store)
  - b) Wrapper (Capacitor) fuer App Store/Play Store
- Nachweis:
  - [ ] Entscheidung dokumentiert
  - [ ] Build pipeline je Plattform definiert

### T-17 iOS Anforderungen
- Marker: `STORE`, `SEC`, `DSGVO`
- Prio: P1
- Checks:
  - [ ] Apple Developer Account
  - [ ] Privacy Manifest / App Privacy Angaben
  - [ ] Push, Permissions, Deep Links sauber
  - [ ] Review-konforme Rechtstexte/In-App Links

### T-18 Android Anforderungen
- Marker: `STORE`, `SEC`, `DSGVO`
- Prio: P1
- Checks:
  - [ ] Play Console Setup
  - [ ] Target SDK aktuell
  - [ ] Data Safety Form korrekt
  - [ ] Crash/ANR Monitoring geplant

## 6) Stripe/Billing Readiness

### T-19 Billing Domain Model
- Marker: `BILLING`, `SEC`, `DSGVO`
- Prio: P1
- Ziel: Abrechnungsobjekte pro Club:
  - `billing_customer_id`
  - `subscription_id`
  - `plan_id`
  - `status`
- Nachweis:
  - [ ] Billing Tabellenentwurf
  - [ ] Rechtekonzept (wer darf Abo sehen/ändern)

### T-20 Stripe Webhook Sicherheit
- Marker: `BILLING`, `SEC`, `OPS`
- Prio: P0 (sobald Billing startet)
- Ziel: signaturprüfung, idempotenz, retry-safe.
- Nachweis:
  - [ ] webhook signature verify
  - [ ] idempotency keys
  - [ ] event replay test

### T-21 DSGVO Billing
- Marker: `BILLING`, `DSGVO`
- Prio: P1
- Ziel: Datenminimierung, Rechtsgrundlage, Löschkonzept.
- Nachweis:
  - [ ] AVV/Datenschutzhinweise ergänzt
  - [ ] Export/Löschung Prozess definiert

## 7) Funktionsleichen / Tech Debt Cleanup

### T-22 Dead Code & Unused Modules Audit
- Marker: `PERF`, `OPS`
- Prio: P1
- Ziel: ungenutzte scripts/pages/functions identifizieren.
- Nachweis:
  - [ ] Inventar "unused" erstellt
  - [ ] Removal-Plan in 2 Wellen (safe -> risky)

### T-23 Feature Flags für Legacy Pfade
- Marker: `OPS`, `SEC`
- Prio: P2
- Ziel: riskante alte Pfade per Flag stilllegbar.
- Nachweis:
  - [ ] Flag-Liste dokumentiert
  - [ ] kill-switch testbar

## 8) Ausfuehrungsreihenfolge (empfohlen)
1. P0 Infrastruktur: T-10, T-11, T-13
2. P0 Tenant-Sicherheit: T-01, T-02, T-03, T-05, T-06, T-08, T-09
3. P1 Stabilität: T-04, T-07, T-12, T-14, T-15
4. P1 Erweiterung: T-16, T-17, T-18, T-19, T-21
5. P0 Billing-Startmoment: T-20
6. P1/P2 Hygiene: T-22, T-23

## 9) Board-Template
| Task-ID | Titel | Marker | Prio | Owner | ETA | Status | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | club_id Vollstaendigkeit | SEC,DSGVO,OPS | P0 |  |  | offen |  |
| T-10 | CORS/Redirect/CSP je Env | SEC,OPS,STORE | P0 |  |  | offen |  |
| T-11 | Key/Secret Trennung pro Env | SEC,OPS | P0 |  |  | offen |  |

## 10) Sofort-Nächste 7 Aktionen
1. T-11: verify script für `staging/beta/prod` laufen lassen.
2. T-10: domain/cors/redirect matrix vervollständigen.
3. T-01: Tabelleninventar `club_id` erstellen.
4. T-02/T-03: RLS/definer review-sprint starten.
5. T-05: Multi-membership write-dialog spezifizieren.
6. T-06: idempotency-felder in kritischen writes planen.
7. T-22: Dead-code audit-liste initial erzeugen.
