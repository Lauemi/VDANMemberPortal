#!/usr/bin/env bash
set -euo pipefail

# Fishing-Club-Portal - Secrets Setup Template
# Purpose: one-place setup for GitHub Actions secrets + Supabase function secrets.
# Usage:
# 1) Fill all PLACEHOLDER values below.
# 2) Ensure CLI tools are available: gh, npx/supabase.
# 3) Run: bash scripts/install-secrets-template.sh
#
# NOTE:
# - PUBLIC_* values are visible in frontend bundles.
# - Never commit real secrets.

# ---------------------------
# Project / CLI context
# ---------------------------
export GH_REPO_OWNER="PLACEHOLDER_OWNER"
export GH_REPO_NAME="PLACEHOLDER_REPO"
export SUPABASE_PROJECT_REF="PLACEHOLDER_PROJECT_REF"

# ---------------------------
# Public app/build vars
# ---------------------------
export PUBLIC_SUPABASE_URL="https://PLACEHOLDER_PROJECT_REF.supabase.co"
export PUBLIC_SUPABASE_ANON_KEY="PLACEHOLDER_ANON_KEY"
export PUBLIC_SUPABASE_PUBLISHABLE_KEY="PLACEHOLDER_PUBLISHABLE_OR_ANON_KEY"
export PUBLIC_VAPID_PUBLIC_KEY="PLACEHOLDER_VAPID_PUBLIC_KEY"
export PUBLIC_MEMBER_CARD_VERIFY_PUBKEY="-----BEGIN PUBLIC KEY-----\nPLACEHOLDER\n-----END PUBLIC KEY-----"

export PUBLIC_APP_NAME="Fishing-Club-Portal"
export PUBLIC_APP_BRAND="FCP"
export PUBLIC_APP_CHANNEL="beta"
export PUBLIC_APP_VERSION="2026.03.01-beta.1"
export PUBLIC_ENABLE_PASSWORD_RESET="true"
export PUBLIC_TURNSTILE_SITE_KEY="PLACEHOLDER_TURNSTILE_SITE_KEY"

# ---------------------------
# IONOS deploy vars
# ---------------------------
export IONOS_SFTP_HOST="PLACEHOLDER_IONOS_SFTP_HOST"
export IONOS_SFTP_USER="PLACEHOLDER_IONOS_SFTP_USER"
export IONOS_SFTP_PASS="PLACEHOLDER_IONOS_SFTP_PASS"
export IONOS_SFTP_PORT="22"
export IONOS_REMOTE_PATH="/htdocs/"

# ---------------------------
# Secret backend vars
# ---------------------------
export SUPABASE_URL="https://PLACEHOLDER_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="PLACEHOLDER_SERVICE_ROLE_KEY"
export VAPID_PUBLIC_KEY="PLACEHOLDER_VAPID_PUBLIC_KEY"
export VAPID_PRIVATE_KEY="PLACEHOLDER_VAPID_PRIVATE_KEY"
export VAPID_SUBJECT="mailto:admin@placeholder-domain.tld"
export PUSH_NOTIFY_TOKEN="PLACEHOLDER_PUSH_NOTIFY_TOKEN"
export TURNSTILE_SECRET_KEY="PLACEHOLDER_TURNSTILE_SECRET_KEY"

# ---------------------------
# Basic guards
# ---------------------------
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found."
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx not found."
  exit 1
fi

if [[ "$GH_REPO_OWNER" == PLACEHOLDER_* ]] || [[ "$GH_REPO_NAME" == PLACEHOLDER_* ]] || [[ "$SUPABASE_PROJECT_REF" == PLACEHOLDER_* ]]; then
  echo "ERROR: Fill GH_REPO_OWNER, GH_REPO_NAME, SUPABASE_PROJECT_REF first."
  exit 1
fi

GH_REPO="${GH_REPO_OWNER}/${GH_REPO_NAME}"

echo "Setting GitHub repository secrets for ${GH_REPO} ..."

# Build/App (PUBLIC)
gh secret set PUBLIC_SUPABASE_URL --repo "$GH_REPO" --body "$PUBLIC_SUPABASE_URL"
gh secret set PUBLIC_SUPABASE_ANON_KEY --repo "$GH_REPO" --body "$PUBLIC_SUPABASE_ANON_KEY"
gh secret set PUBLIC_SUPABASE_PUBLISHABLE_KEY --repo "$GH_REPO" --body "$PUBLIC_SUPABASE_PUBLISHABLE_KEY"
gh secret set PUBLIC_VAPID_PUBLIC_KEY --repo "$GH_REPO" --body "$PUBLIC_VAPID_PUBLIC_KEY"
gh secret set PUBLIC_MEMBER_CARD_VERIFY_PUBKEY --repo "$GH_REPO" --body "$PUBLIC_MEMBER_CARD_VERIFY_PUBKEY"
gh secret set PUBLIC_APP_NAME --repo "$GH_REPO" --body "$PUBLIC_APP_NAME"
gh secret set PUBLIC_APP_BRAND --repo "$GH_REPO" --body "$PUBLIC_APP_BRAND"

# Optional PUBLIC
gh secret set PUBLIC_APP_CHANNEL --repo "$GH_REPO" --body "$PUBLIC_APP_CHANNEL"
gh secret set PUBLIC_APP_VERSION --repo "$GH_REPO" --body "$PUBLIC_APP_VERSION"
gh secret set PUBLIC_ENABLE_PASSWORD_RESET --repo "$GH_REPO" --body "$PUBLIC_ENABLE_PASSWORD_RESET"
gh secret set PUBLIC_TURNSTILE_SITE_KEY --repo "$GH_REPO" --body "$PUBLIC_TURNSTILE_SITE_KEY"

# Hosting (IONOS)
gh secret set IONOS_SFTP_HOST --repo "$GH_REPO" --body "$IONOS_SFTP_HOST"
gh secret set IONOS_SFTP_USER --repo "$GH_REPO" --body "$IONOS_SFTP_USER"
gh secret set IONOS_SFTP_PASS --repo "$GH_REPO" --body "$IONOS_SFTP_PASS"
gh secret set IONOS_SFTP_PORT --repo "$GH_REPO" --body "$IONOS_SFTP_PORT"
gh secret set IONOS_REMOTE_PATH --repo "$GH_REPO" --body "$IONOS_REMOTE_PATH"

# Deploy push trigger
gh secret set SUPABASE_URL --repo "$GH_REPO" --body "$SUPABASE_URL"
gh secret set SUPABASE_SERVICE_ROLE_KEY --repo "$GH_REPO" --body "$SUPABASE_SERVICE_ROLE_KEY"
gh secret set PUSH_NOTIFY_TOKEN --repo "$GH_REPO" --body "$PUSH_NOTIFY_TOKEN"

echo "Setting Supabase function secrets for project ${SUPABASE_PROJECT_REF} ..."

npx --yes supabase secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY" \
  VAPID_SUBJECT="$VAPID_SUBJECT" \
  PUSH_NOTIFY_TOKEN="$PUSH_NOTIFY_TOKEN" \
  TURNSTILE_SECRET_KEY="$TURNSTILE_SECRET_KEY" \
  --project-ref "$SUPABASE_PROJECT_REF"

echo "Done. Next: run build/deploy and smoke test critical flows."
