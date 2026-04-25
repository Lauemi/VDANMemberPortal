# MINA-75 Audit: Offene Branches und Merge-Reihenfolge (GitHub #6)

## Scope und Datenbasis (Stand: 2026-04-25, UTC)

Audit-Ziel: Alle offenen Remote-Branches gegen `origin/main` prüfen und eine sichere Merge-Reihenfolge festlegen.

Durchgeführt mit:

- `git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune`
- `git branch -r --no-merged origin/main`
- `git rev-list --left-right --count origin/main...origin/<branch>`
- `git log --oneline origin/main..origin/<branch>`
- `git diff --name-status origin/main..origin/<branch>`

Hinweis: Das lokale Repo war initial auf `main`-only Fetch konfiguriert. Für diesen Audit wurden daher alle Remote-Branches explizit nachgeladen.

Reproduzierbar per Script:

- `npm run report:branch-audit`
- Optional ohne Fetch: `node scripts/audit-open-branches.mjs --no-fetch`
- JSON-Ausgabe: `node scripts/audit-open-branches.mjs --json`

Re-Validierung:

- Letzter Lauf: `2026-04-25T03:55:23Z`
- Ergebnis: Merge-Reihenfolge und Risikobewertung bleiben unverändert.
- Snapshot-Datei: `docs/Issues/2026-04-25_MINA-75_Branch-Audit-Snapshot.md`

## Offene Remote-Branches (nicht in `origin/main` enthalten)

| Branch | Behind/Ahead ggü. `origin/main` | Letzter Commit | Einschätzung |
|---|---:|---|---|
| `origin/docs/mina-68-standardisierung-report` | `2 / 1` | `86bd7dd` | Kleiner Docs-Branch, aber nicht mehr auf Top-of-main |
| `origin/fix/mina-66-invite-ux-p1` | `4 / 1` | `a82772c` | Klein, aber auf älterem Stand |
| `origin/feat/mina-68-ui-consistency` | `12 / 1` | `8800810` | Rückstand + potentiell regressiver Commit |
| `origin/DEV-Bridge` | `63 / 138` | `59316b5` | Langlaufender Integrations-Branch |
| `origin/DEV_inner_Live` | `63 / 101` | `ce0441f` | Langlaufender Integrations-Branch |
| `origin/prep_gofishing_integration` | `63 / 101` | `bc5858e` | Langlaufender Prep-Branch |
| `origin/prep_sync_main_2026-03-10` | `63 / 133` | `b6872d8` | Langlaufender Prep-Branch |
| `origin/prep_vercel_multienv_admin_tools` | `63 / 135` | `7eb1d99` | Langlaufender Prep-Branch |
| `origin/release_vdan_fcp_sync_2026-03-10` | `63 / 113` | `8deb2f9` | Historischer Release-Branch |

Referenz:

- `origin/fix/invite-375` ist bereits in `origin/main` enthalten (`ahead 0`) und zählt nicht mehr als offener Merge-Kandidat.

## Branch-Abhängigkeiten (Tip-Ancestor-Beziehungen)

- `DEV_inner_Live -> DEV-Bridge`
- `DEV_inner_Live -> prep_sync_main_2026-03-10`
- `DEV_inner_Live -> prep_vercel_multienv_admin_tools`
- `DEV_inner_Live -> release_vdan_fcp_sync_2026-03-10`
- `prep_sync_main_2026-03-10 -> prep_vercel_multienv_admin_tools`
- `release_vdan_fcp_sync_2026-03-10 -> DEV-Bridge`

Interpretation: Ein Teil der Alt-Branches ist gestapelt; Direkt-Merges würden große, schwer kontrollierbare Change-Pakete mitziehen.

## Risiko-Befunde

### 1) `feat/mina-68-ui-consistency` enthält regressionsanfällige Löschungen

`8800810` entfernt/ändert u. a. bereits etablierte Invite-/Smoke-Artefakte (z. B. Workflow, Smoke-Script, Playwright-Spec, Doku-Dateien). Das ist bei aktuellem Main-Stand ein hohes Regressionsrisiko.

### 2) `fix/mina-66-invite-ux-p1` ist nicht auf aktuellem Main

`behind 4 / ahead 1` bedeutet: kleiner Scope, aber vor Merge Rebase oder Cherry-Pick auf aktuellen Main nötig, damit keine Altzustände zurückkommen.

### 3) Alt-/Prep-/Release-Branches sind massiv divergiert

`behind 63` bei mehreren Branches zeigt starken Drift. Direkter Merge in `main` ist operativ zu riskant (Konfliktlast, unerwartete Nebeneffekte, fehlende Traceability).

## Empfohlene Merge-Reihenfolge

1. `origin/docs/mina-68-standardisierung-report`
2. `origin/fix/mina-66-invite-ux-p1` (erst rebasen/cherry-picken auf aktuellen `origin/main`, dann testen)
3. `origin/feat/mina-68-ui-consistency` nur nach Entflechtung des Commits `8800810` (UI-Änderungen isolieren, regressionsrelevante Löschungen verwerfen)
4. Alle `DEV_*`, `prep_*`, `release_*` Branches: kein Direkt-Merge; nur selektive, kleine Folge-PRs aus sauber isolierten Commits

## Konkreter Umsetzungsplan

1. Sofort mergefähig:
   - `docs/mina-68-standardisierung-report` auf aktuellen `origin/main` rebasen und danach per PR in `main`.
2. Kurzfristig:
   - `fix/mina-66-invite-ux-p1` auf `origin/main` rebased branch erstellen.
   - Invite-/Smoke-Regressionscheck vor PR-Freigabe.
3. Danach:
   - Aus `feat/mina-68-ui-consistency` nur die UI-relevanten Hunk/Commits extrahieren (cherry-pick oder neue Branch-Basis).
4. Strategisch:
   - Für jede Altlinie (`DEV_*` / `prep_*` / `release_*`) erst Scope-Audit, dann nur notwendige Commits in kleine PRs schneiden.

## Cleanup-Empfehlung (nach bestätigter Übernahme)

- Bereits integrierte Branches entfernen (`fix/invite-375` remote, ggf. lokale Altkopien).
- Branch-Protection/Policy: Keine großen Drift-Branches länger offen halten, stattdessen kurze PR-Zyklen.
- Remote-Fetch-Config normalisieren, damit künftige Audits nicht durch `main`-only Fetch unvollständig sind.
