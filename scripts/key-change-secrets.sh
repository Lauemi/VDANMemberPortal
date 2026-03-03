#!/usr/bin/env bash
set -euo pipefail

# key-change-secrets.sh
#
# Ziel:
# - GitHub Environment Secrets rotieren
# - Sichere Custom-Secrets generieren
# - Optional generierten Push-Token direkt setzen
#
# WICHTIG:
# - Supabase ANON/SERVICE_ROLE Keys werden im Supabase Projekt erzeugt (nicht lokal generiert).
# - Dieses Script generiert nur "eigene" Secrets (z. B. PUSH_NOTIFY_TOKEN, App-Secret).
#
# Beispiele:
# 1) Nur sichere Werte generieren (ohne Setzen):
#    bash scripts/key-change-secrets.sh --generate
#
# 2) Generierten Push-Token direkt in GitHub Env setzen:
#    GH_REPO=Lauemi/VDANMemberPortal TARGET_ENV=prod \
#    bash scripts/key-change-secrets.sh --generate --set-generated-push
#
# 3) Supabase-Werte rotieren (aus Supabase kopierte Werte setzen):
#    GH_REPO=Lauemi/VDANMemberPortal TARGET_ENV=prod \
#    NEW_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
#    NEW_PUBLIC_SUPABASE_ANON_KEY="..." \
#    NEW_SUPABASE_URL="https://xxx.supabase.co" \
#    NEW_SUPABASE_SERVICE_ROLE_KEY="..." \
#    bash scripts/key-change-secrets.sh --supabase
#
# 4) Push/VAPID manuell setzen:
#    GH_REPO=Lauemi/VDANMemberPortal TARGET_ENV=staging \
#    NEW_PUSH_NOTIFY_TOKEN="..." \
#    NEW_PUBLIC_VAPID_PUBLIC_KEY="..." \
#    bash scripts/key-change-secrets.sh --push-token --vapid

need_gh=false
rotate_supabase=false
rotate_push=false
rotate_vapid=false
do_generate=false
set_generated_push=false

usage() {
  cat <<'EOF'
Usage:
  bash scripts/key-change-secrets.sh [options]

Options:
  --generate              Generate secure custom secrets (prints exports)
  --set-generated-push    With --generate: set generated PUSH_NOTIFY_TOKEN in GH env
  --supabase              Rotate Supabase-related secrets (requires NEW_* vars)
  --push-token            Rotate PUSH_NOTIFY_TOKEN (requires NEW_PUSH_NOTIFY_TOKEN)
  --vapid                 Rotate PUBLIC_VAPID_PUBLIC_KEY (requires NEW_PUBLIC_VAPID_PUBLIC_KEY)
  --all                   Equivalent to --supabase --push-token --vapid
  --help                  Show this help

Required env when setting secrets:
  GH_REPO=OWNER/REPO
  TARGET_ENV=staging|beta|prod

Notes:
  - Supabase ANON/SERVICE_ROLE keys are not generated here.
  - They must be copied from the target Supabase project settings.
EOF
}

if [ "$#" -eq 0 ]; then
  usage
  exit 1
fi

for arg in "$@"; do
  case "$arg" in
    --generate) do_generate=true ;;
    --set-generated-push) set_generated_push=true ;;
    --supabase)
      rotate_supabase=true
      need_gh=true
      ;;
    --push-token)
      rotate_push=true
      need_gh=true
      ;;
    --vapid)
      rotate_vapid=true
      need_gh=true
      ;;
    --all)
      rotate_supabase=true
      rotate_push=true
      rotate_vapid=true
      need_gh=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      usage
      exit 1
      ;;
  esac
done

if [ "$set_generated_push" = true ]; then
  need_gh=true
fi

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Command not found: $cmd"
    exit 1
  fi
}

random_hex() {
  local bytes="$1"
  openssl rand -hex "$bytes"
}

random_b64url() {
  local bytes="$1"
  openssl rand -base64 "$bytes" | tr '+/' '-_' | tr -d '=\n'
}

set_secret() {
  local key="$1"
  local value="$2"
  gh secret set "$key" --repo "$GH_REPO" --env "$TARGET_ENV" --body "$value"
  echo "UPDATED: $key"
}

if [ "$need_gh" = true ]; then
  require_cmd gh
  : "${GH_REPO:?Set GH_REPO=OWNER/REPO}"
  : "${TARGET_ENV:?Set TARGET_ENV=staging|beta|prod}"
  echo "Repo: $GH_REPO"
  echo "Environment: $TARGET_ENV"
fi

require_cmd openssl

generated_push_token=""
generated_membership_key=""
generated_app_secret=""

if [ "$do_generate" = true ]; then
  generated_push_token="$(random_hex 32)"
  generated_membership_key="$(random_b64url 48)"
  generated_app_secret="$(random_hex 64)"

  echo
  echo "# Generated secure custom secrets (store safely)"
  echo "export NEW_PUSH_NOTIFY_TOKEN='$generated_push_token'"
  echo "export NEW_MEMBERSHIP_ENCRYPTION_KEY='$generated_membership_key'"
  echo "export NEW_APP_SIGNING_SECRET='$generated_app_secret'"
  echo
  echo "# Supabase keys are NOT generated here:"
  echo "# - PUBLIC_SUPABASE_ANON_KEY"
  echo "# - SUPABASE_SERVICE_ROLE_KEY"
  echo "# Copy those from the target Supabase project."
  echo
fi

if [ "$set_generated_push" = true ]; then
  if [ -z "$generated_push_token" ]; then
    echo "ERROR: --set-generated-push requires --generate in the same call."
    exit 1
  fi
  set_secret PUSH_NOTIFY_TOKEN "$generated_push_token"
fi

if [ "$rotate_supabase" = true ]; then
  : "${NEW_PUBLIC_SUPABASE_URL:?Missing NEW_PUBLIC_SUPABASE_URL}"
  : "${NEW_PUBLIC_SUPABASE_ANON_KEY:?Missing NEW_PUBLIC_SUPABASE_ANON_KEY}"
  : "${NEW_SUPABASE_URL:?Missing NEW_SUPABASE_URL}"
  : "${NEW_SUPABASE_SERVICE_ROLE_KEY:?Missing NEW_SUPABASE_SERVICE_ROLE_KEY}"

  set_secret PUBLIC_SUPABASE_URL "$NEW_PUBLIC_SUPABASE_URL"
  set_secret PUBLIC_SUPABASE_ANON_KEY "$NEW_PUBLIC_SUPABASE_ANON_KEY"
  set_secret SUPABASE_URL "$NEW_SUPABASE_URL"
  set_secret SUPABASE_SERVICE_ROLE_KEY "$NEW_SUPABASE_SERVICE_ROLE_KEY"
fi

if [ "$rotate_vapid" = true ]; then
  : "${NEW_PUBLIC_VAPID_PUBLIC_KEY:?Missing NEW_PUBLIC_VAPID_PUBLIC_KEY}"
  set_secret PUBLIC_VAPID_PUBLIC_KEY "$NEW_PUBLIC_VAPID_PUBLIC_KEY"
fi

if [ "$rotate_push" = true ]; then
  : "${NEW_PUSH_NOTIFY_TOKEN:?Missing NEW_PUSH_NOTIFY_TOKEN}"
  set_secret PUSH_NOTIFY_TOKEN "$NEW_PUSH_NOTIFY_TOKEN"
fi

echo "Done."
