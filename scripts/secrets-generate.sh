#!/usr/bin/env bash
set -euo pipefail

# Generate environment values for local secret onboarding/rotation.
# This script does NOT generate Supabase anon/service keys.

TARGET_ENV="staging"
OUT_FILE=""
PRINT_VALUES=true

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/secrets-generate.sh [options]

Options:
  --env <staging|beta|prod>    Target environment label (default: staging)
  --out <file>                 Write export-compatible output to file
  --no-print                   Do not print secret values to stdout
  --help                       Show this help
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: missing command: $1"
    exit 1
  fi
}

gen_hex() {
  openssl rand -hex "$1"
}

gen_b64url() {
  openssl rand -base64 "$1" | tr '+/' '-_' | tr -d '=\n'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env)
      TARGET_ENV="${2:-}"
      shift 2
      ;;
    --out)
      OUT_FILE="${2:-}"
      shift 2
      ;;
    --no-print)
      PRINT_VALUES=false
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

case "$TARGET_ENV" in
  staging|beta|prod) ;;
  *)
    echo "ERROR: --env must be staging|beta|prod"
    exit 1
    ;;
esac

require_cmd openssl

PUSH_NOTIFY_TOKEN="$(gen_hex 32)"
CLIENT_REQUEST_SALT="$(gen_hex 32)"
APP_SIGNING_SECRET="$(gen_hex 64)"

# VAPID pair: prefer web-push CLI when installed.
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_NOTE=""
if command -v web-push >/dev/null 2>&1; then
  vapid_raw="$(web-push generate-vapid-keys 2>/dev/null || true)"
  VAPID_PUBLIC_KEY="$(printf '%s\n' "$vapid_raw" | sed -n 's/^Public Key:[[:space:]]*//p')"
  VAPID_PRIVATE_KEY="$(printf '%s\n' "$vapid_raw" | sed -n 's/^Private Key:[[:space:]]*//p')"
fi

if [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
  VAPID_PUBLIC_KEY="REPLACE_WITH_WEB_PUSH_PUBLIC_KEY"
  VAPID_PRIVATE_KEY="REPLACE_WITH_WEB_PUSH_PRIVATE_KEY"
  VAPID_NOTE="web-push CLI not found or failed; install with: npm i -g web-push"
fi

VAPID_SUBJECT="mailto:support@fishing-club-portal.de"
PUBLIC_APP_CHANNEL="$TARGET_ENV"
PUBLIC_APP_VERSION="$(date +%Y.%m.%d)-${TARGET_ENV}.1"

content=$(cat <<EOT
# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Environment: ${TARGET_ENV}

export TARGET_ENV='${TARGET_ENV}'
export PUBLIC_APP_CHANNEL='${PUBLIC_APP_CHANNEL}'
export PUBLIC_APP_VERSION='${PUBLIC_APP_VERSION}'

export PUSH_NOTIFY_TOKEN='${PUSH_NOTIFY_TOKEN}'
export CLIENT_REQUEST_SALT='${CLIENT_REQUEST_SALT}'
export APP_SIGNING_SECRET='${APP_SIGNING_SECRET}'

export PUBLIC_VAPID_PUBLIC_KEY='${VAPID_PUBLIC_KEY}'
export VAPID_PRIVATE_KEY='${VAPID_PRIVATE_KEY}'
export VAPID_SUBJECT='${VAPID_SUBJECT}'
EOT
)

if [ "$PRINT_VALUES" = true ]; then
  echo "$content"
  if [ -n "$VAPID_NOTE" ]; then
    echo
    echo "NOTE: $VAPID_NOTE"
  fi
else
  echo "Generated secrets for env=$TARGET_ENV (output hidden)."
  if [ -n "$VAPID_NOTE" ]; then
    echo "NOTE: $VAPID_NOTE"
  fi
fi

if [ -n "$OUT_FILE" ]; then
  umask 077
  printf '%s\n' "$content" > "$OUT_FILE"
  chmod 600 "$OUT_FILE" || true
  echo "Wrote: $OUT_FILE"
fi
