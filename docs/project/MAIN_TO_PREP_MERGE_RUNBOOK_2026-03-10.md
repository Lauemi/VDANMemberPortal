# Runbook: Main -> Prep Merge (Shared DB, VDAN stabil / FCP erweitert)
Stand: 2026-03-10

## Ziel
`prep_vercel_multienv_admin_tools` auf aktuellen `main`-Stand bringen, ohne VDAN-Livebetrieb zu gefährden.  
In `prep` bleiben nur FCP-spezifische Unterschiede (Branding/Farben/Feature-Erweiterungen).

## Rahmenbedingungen
- `main` und `prep` teilen sich dieselbe Supabase-DB (gewollt).
- Deshalb: DB-first kompatibel, keine destruktiven Sondermigrationen aus `prep`.
- VDAN (`main`) bleibt stabiler Produktivpfad.
- FCP (`prep`) bleibt Preview-/Rolloutpfad über Vercel.

## P0-Regeln vor dem Merge
1. Keine direkten Änderungen an `main` während des Merge-Fensters.
2. Config-Freeze während des Merge-Fensters:
- keine ENV-Änderungen parallel,
- keine Supabase-Dashboard-Änderungen parallel,
- keine Redirect-/Domain-Zuordnungsänderungen parallel.
2. Aktuellen Zustand in `prep` taggen:
   - `git checkout prep_vercel_multienv_admin_tools`
   - `git tag -a prep-before-main-sync-2026-03-10 -m "Prep before main sync"`
3. Merge nur in dediziertem Branch durchführen:
   - `git checkout prep_vercel_multienv_admin_tools`
   - `git checkout -b prep_sync_main_2026-03-10`

## Merge-Ablauf (technisch)
1. `main` holen:
   - `git fetch origin`
2. Merge starten:
   - `git merge origin/main`
3. Konflikte lösen nach Strategie unten.
4. Build + Smoke lokal:
   - `npm run build`
5. Commit:
   - `git add -A`
   - `git commit -m "Sync prep with main, keep FCP custom layer"`
6. Push + PR auf `prep_vercel_multienv_admin_tools`.

## Konfliktstrategie (wichtig)
### A) Von `main` bevorzugen (Sicherheits-/Basispfad)
- `docs/supabase/94_*`
- `docs/supabase/95_*`
- `docs/supabase/96_*`
- `supabase/functions/profile-bootstrap/index.ts`
- `supabase/functions/push-notify-update/index.ts`
- `supabase/functions/work-event-admin-update/index.ts`
- `public/js/dialog-ux-guard.js`
- `public/js/catchlist.js`
- rechtliche/board-relevante Doku aus `main` (falls Konflikte)

### B) In `prep` bewusst behalten (FCP-Layer)
- FCP-spezifische Branding/Assets:
  - `public/Branding/**`
  - `src/pages/index.astro` (FCP-Coming-Soon/Launch-Landing)
  - FCP-spezifische CSS/Theme-Anpassungen
- Vercel-Preview-spezifische Deploy-Logik (falls benötigt)
- FCP-Featureseiten (z. B. Weather/Feedback/Admin-Extensions), sofern nicht regressiv für shared DB

### C) Nicht in gemeinsamen Produktivpfad ziehen
- Große Staging-/Bundle-SQLs aus `prep` ohne explizite Freigabe:
  - `docs/supabase/60_staging_full_setup_schema.sql`
  - weitere staging-only SQL-Bundles/Runbooks
- Alte Medien-Lösch-/Umbaupakete, wenn sie VDAN-Seiten brechen könnten

### D) Globale Defaults gesondert prüfen (nie blind übernehmen)
- Dateien mit indirekter Laufzeitwirkung immer einzeln prüfen:
  - globale Config-Dateien,
  - App-Init/Env-Mapping,
  - Host-/Domain-Resolver,
  - zentrale Layouts,
  - Default-Title/Footer/Meta-Logik.
- Ziel: kein unbeabsichtigter Branding-, Redirect- oder Auth-Callback-Effekt.

## Shared-DB-Sicherheitsregeln beim Sync
1. Keine SQL anwenden, die Tabellen/Policies für `main` brechen.
2. Nur additive/kompatible DB-Änderungen.
3. Vor Freigabe immer beide Pfade testen:
   - `main`-Flows (VDAN)
   - `prep`-Flows (FCP)
4. Keine Policy-Verschärfung ohne Verifikation auf beiden Pfaden.
5. Keine Spalten-/Constraint-Änderung ohne Fallback-Prüfung im `main`-Code.
6. Keine DB-Änderung, die `main` implizit auf neue Pflichtfelder zwingt.

## Smoke-Test-Gate (Pflicht)
## VDAN (`main`-Pfad)
1. Login funktioniert.
2. Invite/Claim funktioniert.
3. `profile-bootstrap` ok.
4. Keine Regression in Portal-Basisseiten.
5. Verifikation gegen aktuellen stabilen Referenzstand (auch ohne neuen `main`-Deploy).

## FCP (`prep`-Pfad)
1. Preview deployt mit neuen Preview-ENVs.
2. Branding/Farben korrekt.
3. FCP-Erweiterungen (z. B. Wetter/Feedback) laden.
4. Keine Cross-Club-/Tenant-Regressions.

## Freigabeentscheidung
Merge `main -> prep` gilt als abgeschlossen, wenn:
1. Konflikte dokumentiert sind.
2. Build grün ist.
3. Smoke-Test `main` + `prep` grün ist.
4. Keine unbeabsichtigte Änderung an VDAN-Livepfad entsteht.
5. Bei Shared-DB-relevanten Änderungen ist explizit dokumentiert, dass `main` funktional unbeeinträchtigt bleibt.

## Optional: Schnelle Konflikthilfe
Auf `prep_sync_main_2026-03-10` während Konflikten:
- Für eine Datei `main` übernehmen:
  - `git checkout --theirs <datei>`
- Für eine Datei `prep` behalten:
  - `git checkout --ours <datei>`
- Danach:
  - `git add <datei>`
