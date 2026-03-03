# Secrets Rotation Runbook

Stand: 2026-03-02
Scope: GitHub Environments, Vercel, Supabase function secrets.

## 1) Preconditions
1. Password manager entry created for target env.
2. Required CLIs available if used: `gh`, `vercel`, `supabase`.
3. Operator has access to GitHub envs, Vercel project, Supabase project.

## 2) Rotation flow (safe)
1. Generate new values locally:
```bash
bash scripts/secrets-generate.sh --env staging --out .secrets.staging.env --no-print
```
2. Store generated values in password manager.
3. Apply to GitHub environment:
```bash
GH_REPO=OWNER/REPO TARGET_ENV=staging bash scripts/secrets-apply.sh --source .secrets.staging.env --github
```
4. Apply to Vercel env variables:
```bash
TARGET_ENV=staging bash scripts/secrets-apply.sh --source .secrets.staging.env --vercel
```
5. Apply to Supabase function secrets:
```bash
SUPABASE_PROJECT_REF=YOUR_REF bash scripts/secrets-apply.sh --source .secrets.staging.env --supabase
```
6. Verify readiness:
```bash
GH_REPO=OWNER/REPO TARGET_ENV=staging bash scripts/verify-vercel-env-readiness.sh
```
7. Trigger deployment and run smoke test.

## 3) Rollback
1. Restore previous values from password manager.
2. Re-apply previous values with `scripts/secrets-apply.sh`.
3. Redeploy last known stable build.

## 4) Security notes
1. Do not run generation in CI.
2. Prefer `--no-print` in shared terminals.
3. Remove local temp files after apply:
```bash
rm -f .secrets.staging.env
```
4. Never paste `SUPABASE_SERVICE_ROLE_KEY` into client-side variables.

## 5) Rotation cadence
- Critical server secrets: every 90 days
- VAPID keypair: every 180 days
- Immediate rotation after any suspected leak

