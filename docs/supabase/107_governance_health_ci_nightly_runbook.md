# 107 Governance Health CI/Nightly Runbook
Datum: 2026-03-11

## Ziel
Nightly und manuelle CI-Prüfung gegen dieselbe DB-Governance-Logik:
- `public.governance_health_ci_gate(false)` => fail nur bei rot
- `public.governance_health_ci_gate(true)` => fail bei rot+gelb

## Voraussetzungen
- Migrationen angewendet:
  - `20260311193000_governance_health_snapshot.sql`
  - `20260311194000_governance_health_ci_gate.sql`
- GitHub Secrets gesetzt:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Lokaler Check
```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
npm run check:governance-health
```

Strict-Mode (gelb auch fail):
```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
GOV_FAIL_ON_YELLOW=true \
npm run check:governance-health
```

## GitHub Actions
Workflow:
- `.github/workflows/governance-health.yml`

Trigger:
- Nightly: täglich 02:15 UTC
- Manuell: `workflow_dispatch` mit `fail_on_yellow=true|false`

## Interpretation
- Exit-Code `0`: Gate bestanden.
- Exit-Code `1`: Fachlicher Gate-Fail (`passed=false`).
- Exit-Code `2`: Technischer Fehler (Secrets/RPC/Netzwerk).

## Empfehlung
- Nightly: `fail_on_yellow=false` (nur rot blockiert).
- Release-Branch/Prod-Deploy: `fail_on_yellow=true` als strenger Preflight.
