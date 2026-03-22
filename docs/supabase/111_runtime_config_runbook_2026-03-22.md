# Runtime Config Runbook

Stand: 2026-03-22

## Was ist ein Runbook?

Ein Runbook ist eine konkrete Arbeitsanleitung fuer einen wiederholbaren technischen Ablauf.

Nicht Konzept.
Nicht Architekturpapier.
Nicht nur Checkliste.

Sondern:

"Welche Schritte fuehre ich in welcher Reihenfolge aus, was muss dabei herauskommen und woran erkenne ich, ob etwas schiefgelaufen ist?"

Kurz:

- Architektur sagt: wie das System gedacht ist
- Audit sagt: ob es korrekt steht
- Runbook sagt: wie du es sauber durchfuehrst

## Zweck dieses Runbooks

Dieses Runbook beschreibt die sichere Reihenfolge fuer:

1. Runtime-Foundation einspielen
2. Route-Catalog seeden
3. Default-Runtime-Werte einspielen
4. atomaren Publish-RPC einspielen
5. Audits ausfuehren

## Reihenfolge

### 1. Runtime-Foundation einspielen

SQL:

- `supabase/migrations/20260321193000_runtime_config_foundation.sql`

Erwartung:

- Tabellen fuer Runtime, Templates, Theme, Release und Audit existieren
- RLS ist aktiv
- deny-all Policies sind aktiv

### 2. Route-Catalog einspielen

SQL:

- `supabase/migrations/20260321194000_runtime_route_catalog_seed.sql`

Erwartung:

- kanonische Route-Keys sind vorhanden
- keine doppelten `route_path`

### 3. Default-Runtime-Werte einspielen

SQL:

- `supabase/migrations/20260322083000_runtime_config_defaults_seed.sql`

Erwartung:

- `branding.static_web_matrix` fuer `fcp` und `vdan` vorhanden
- `branding.app_mask_matrix` fuer `fcp` und `vdan` vorhanden
- alle vier Datensaetze stehen auf:
  - `status = published`
  - `is_active = true`

### 4. Atomaren Publish-RPC einspielen

SQL:

- `supabase/migrations/20260322093000_runtime_config_atomic_publish.sql`

Erwartung:

- Funktion `public.admin_publish_runtime_config(...)` existiert
- Funktion ist `security definer`
- `EXECUTE` ist fuer `public`, `anon`, `authenticated` entzogen

## Audits danach

### Audit A: Foundation

SQL:

- `docs/supabase/109_runtime_config_foundation_audit_2026-03-22.sql`

Gruen erwartet:

- `runtime-config-foundation-green`

### Audit B: Atomic Publish

SQL:

- `docs/supabase/110_runtime_config_atomic_publish_audit_2026-03-22.sql`

Gruen erwartet:

- `runtime-config-atomic-publish-green`

## Schnellkontrolle in der App

Nach gruener SQL-Seite:

1. Admin Board oeffnen
2. `Modul Web` pruefen
3. Tabelle fuer `FCP` und `VDAN` laden
4. App-Masken-Brand-Tabelle laden
5. eine kleine Aenderung speichern
6. pruefen, ob ein neuer Runtime-Release/Audit-Eintrag entstanden ist

## Wenn etwas nicht gruen ist

### Fall 1: Foundation-Audit nicht gruen

Pruefen:

- wurde `20260321193000_runtime_config_foundation.sql` wirklich ausgefuehrt?
- wurde `20260321194000_runtime_route_catalog_seed.sql` wirklich ausgefuehrt?
- wurde `20260322083000_runtime_config_defaults_seed.sql` wirklich ausgefuehrt?

### Fall 2: Atomic-Publish-Audit nicht gruen

Pruefen:

- wurde `20260322093000_runtime_config_atomic_publish.sql` wirklich ausgefuehrt?
- existiert `public.admin_publish_runtime_config`?
- ist `EXECUTE` wirklich entzogen?

### Fall 3: App nutzt weiter alten Stand

Pruefen:

- Edge Function `admin-web-config` neu deployt?
- lokal auf `localhost` getestet? Dann greift bewusst nur Draft/Fallback.
- Remote-Umgebung mit aktuellem Function-Stand getestet?

## Nachgelagerte Pflicht

Nach SQL + Audit:

1. `admin-web-config` deployen
2. falls betroffen auch:
   - `club-admin-setup`
   - `club-onboarding-workspace`
3. `npm run check:remote-function-smoke`
4. kurzer UI-Smoke-Test

## Zielbild

Wenn dieses Runbook sauber durchlaufen ist, dann gilt:

- Runtime-DB-Struktur steht
- Default-Werte stehen
- atomarer Publish steht
- Audit und Release-Log stehen
- Admin-Board arbeitet auf einer belastbaren Grundlage
