#!/usr/bin/env bash
set -euo pipefail

# Verify GitHub environment readiness for deploy-vercel.yml
# Usage:
#   GH_REPO=OWNER/REPO TARGET_ENV=staging bash scripts/verify-vercel-env-readiness.sh

: "${GH_REPO:?Set GH_REPO=OWNER/REPO}"
: "${TARGET_ENV:=staging}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI fehlt."
  exit 1
fi

required_keys=(
  VERCEL_TOKEN
  VERCEL_ORG_ID
  VERCEL_PROJECT_ID
  PUBLIC_SUPABASE_URL
  PUBLIC_SUPABASE_ANON_KEY
  PUBLIC_VAPID_PUBLIC_KEY
  PUBLIC_MEMBER_CARD_VERIFY_PUBKEY
  PUBLIC_APP_NAME
  PUBLIC_APP_BRAND
  PUBLIC_APP_CHANNEL
  PUBLIC_APP_VERSION
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  PUSH_NOTIFY_TOKEN
)

optional_keys=(
  VERCEL_STAGING_DOMAIN
  VERCEL_BETA_DOMAIN
  PUBLIC_SUPABASE_PUBLISHABLE_KEY
  PUBLIC_ENABLE_PASSWORD_RESET
  PUBLIC_TURNSTILE_SITE_KEY
)

echo "Repo: ${GH_REPO}"
echo "Environment: ${TARGET_ENV}"

env_keys_raw="$(gh secret list --repo "$GH_REPO" --env "$TARGET_ENV" --json name --jq '.[].name' 2>/dev/null || true)"
if [ -z "$env_keys_raw" ]; then
  echo "WARN: Keine Environment-Secrets gefunden oder Environment existiert nicht."
fi

mapfile -t env_keys <<<"$env_keys_raw"

has_key() {
  local key="$1"
  for k in "${env_keys[@]:-}"; do
    if [ "$k" = "$key" ]; then
      return 0
    fi
  done
  return 1
}

missing=()

for key in "${required_keys[@]}"; do
  if has_key "$key"; then
    echo "OK   required: $key"
  else
    echo "MISS required: $key"
    missing+=("$key")
  fi
done

for key in "${optional_keys[@]}"; do
  if has_key "$key"; then
    echo "OK   optional: $key"
  else
    echo "WARN optional: $key"
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo
  echo "Result: NOT READY"
  echo "Missing required keys (${#missing[@]}):"
  for key in "${missing[@]}"; do
    echo " - $key"
  done
  exit 2
fi

echo
echo "Result: READY (required keys present)."
