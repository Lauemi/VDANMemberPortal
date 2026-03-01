# Staging/Beta/Prod Execution Checkpoints

Stand: 2026-03-01
Zweck: Operativer Schnellablauf, um branchbasiert nach Vercel auszurollen, ohne main ungeplant zu beeinflussen.

## 1) Branch-Sicherheit
1. Live-Hotfix nur auf `main`.
2. Ausbau nur auf `prep_vercel_multienv_admin_tools` und danach gesteuert auf `develop/beta/main`.
3. Vor jedem Schritt prüfen:
```bash
git branch --show-current
git status --short
```

## 2) Environment-Readiness (GitHub)
1. Fuer jedes Environment laufen lassen:
```bash
GH_REPO=Lauemi/VDANMemberPortal TARGET_ENV=staging bash scripts/verify-vercel-env-readiness.sh
GH_REPO=Lauemi/VDANMemberPortal TARGET_ENV=beta bash scripts/verify-vercel-env-readiness.sh
GH_REPO=Lauemi/VDANMemberPortal TARGET_ENV=prod bash scripts/verify-vercel-env-readiness.sh
```
2. Nur weiter bei `Result: READY`.

## 3) Deploy-Reihenfolge
1. `develop` -> staging
2. `beta` -> beta
3. `main` -> prod

## 4) Minimal-Checks je Stufe
1. Login/Logout.
2. Feed-Post + Bild-Upload.
3. Fangliste create + sync hint.
4. Push Subscription + Testtrigger.
5. App-Version/Kanal korrekt sichtbar.

Referenz: `docs/project/RELEASE_SMOKE_TEST_STAGING_BETA_PROD_2026-03-01.md`

## 5) Promotion-Gates
1. Kein Promote bei fehlenden required secrets.
2. Kein Promote bei fehlgeschlagenem Smoke-Test.
3. Kein Promote bei offenen P0-Risiken.

## 6) Rollback-Kurzweg
1. Vercel: letzte stabile Deployment-ID wieder promoten.
2. Git: letztes stabiles Commit neu deployen.
3. Vorfall protokollieren in Risiko-/Release-Doku.

## 7) Keine Main-Beruehrung (Arbeitsregel)
1. Alle Vorbereitungsarbeiten bleiben auf `prep_vercel_multienv_admin_tools`.
2. `main` nur fuer freigegebene Live-Fixes oder explizit freigegebene Promotion.
