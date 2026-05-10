#!/usr/bin/env bash
# =============================================================================
# SMOKE TEST: SMOKE1 Invite → Claim → Onboarding State
# Prepared by: Claude (CEO-Assistant)
# To be executed by: fcp-smoketest (Paperclip)
#
# Testfall: Kompletter Invite-Claim-Flow validiert GAP-1 und GAP-2 Fixes.
# GAP-1: Deutscher Mitgliedsstatus (Aktiv → ACTIVE) im Onboarding-State
# GAP-2: first_name/last_name werden bei Claim in profiles geschrieben
#
# Ausgangszustand (von Claude vorbereitet):
#   - SMOKE001 resettet: kein Profile, keine Identity, keine Roles
#   - club_members: SMOKE001 / Smoke Member / status:active / fcp_demo1@...
#   - Auth user: aa885010-9b4e-46dd-a432-a92118b60200 (email confirmed)
#   - Frischer Invite: cfbbcee8e5f4a8163493a0d9a51cae258fe6 (läuft bis 22.05)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULT_FILE="$SCRIPT_DIR/results/$(date +%Y%m%d_%H%M%S)_SMOKE1_invite_claim.md"
ENV_FILE="$SCRIPT_DIR/../../.env.production.master"

# --- Load env ---
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: Weder Env-Vars noch .env.production.master gefunden"
    exit 1
  fi
  SUPABASE_URL=$(grep 'SUPABASE_URL=' "$ENV_FILE" | grep -v PUBLIC | cut -d'"' -f2)
  ANON_KEY=$(grep 'PUBLIC_SUPABASE_ANON_KEY' "$ENV_FILE" | cut -d'"' -f2)
  SERVICE_KEY=$(grep 'SUPABASE_SERVICE_ROLE_KEY' "$ENV_FILE" | cut -d'"' -f2)
else
  ANON_KEY="${PUBLIC_SUPABASE_ANON_KEY:-sb_publishable_X8FFHAA5EPeFywTDYJXPYw_OLaQwwDZ}"
  SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
fi

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_KEY" ]]; then
  echo "ERROR: Could not read SUPABASE_URL or SERVICE_ROLE_KEY from env"
  exit 1
fi

# --- Constants ---
TEST_USER_ID="aa885010-9b4e-46dd-a432-a92118b60200"
TEST_EMAIL="fcp_demo1@fishing-club-portal.de"
TEST_PASSWORD="SmokeTest2026!"
INVITE_TOKEN="cfbbcee8e5f4a8163493a0d9a51cae258fe6"
CLUB_ID="a6795892-778f-4174-95e3-903c6b6db812"
MEMBER_NO="SMOKE001"

PASS=0
FAIL=0
REPORT=""

log() { echo "$1"; REPORT+="$1"$'\n'; }
pass() { log "✅ PASS: $1"; ((PASS++)) || true; }
fail() { log "❌ FAIL: $1"; ((FAIL++)) || true; }
section() { log ""; log "## $1"; }

log "# Smoke Test Report: SMOKE1 Invite → Claim"
log "_Datum: $(date)_"
log "_Script: SMOKE1_invite_claim.sh_"

# =============================================================================
# STEP 1: Reset test user password (service role admin)
# =============================================================================
section "Step 1: Auth Setup — Reset Test User Password"

RESET_RESP=$(curl -s -w "\n%{http_code}" -X PUT \
  "$SUPABASE_URL/auth/v1/admin/users/$TEST_USER_ID" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"$TEST_PASSWORD\"}")

RESET_HTTP=$(echo "$RESET_RESP" | tail -1)
RESET_BODY=$(echo "$RESET_RESP" | head -1)

if [[ "$RESET_HTTP" == "200" ]]; then
  pass "Password reset for $TEST_EMAIL (HTTP $RESET_HTTP)"
else
  fail "Password reset failed (HTTP $RESET_HTTP): $RESET_BODY"
  log "ABORTING: Cannot proceed without auth"
  echo "$REPORT" > "$RESULT_FILE"
  exit 1
fi

# =============================================================================
# STEP 2: Sign in and get JWT
# =============================================================================
section "Step 2: Sign In as fcp_demo1"

SIGNIN_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")

SIGNIN_HTTP=$(echo "$SIGNIN_RESP" | tail -1)
SIGNIN_BODY=$(echo "$SIGNIN_RESP" | head -1)

if [[ "$SIGNIN_HTTP" != "200" ]]; then
  fail "Sign in failed (HTTP $SIGNIN_HTTP): $SIGNIN_BODY"
  log "ABORTING"
  echo "$REPORT" > "$RESULT_FILE"
  exit 1
fi

ACCESS_TOKEN=$(echo "$SIGNIN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")

if [[ -z "$ACCESS_TOKEN" ]]; then
  fail "No access_token in sign-in response: $SIGNIN_BODY"
  echo "$REPORT" > "$RESULT_FILE"
  exit 1
fi

pass "Signed in, JWT obtained"

# =============================================================================
# STEP 3: Pre-claim onboarding state
# =============================================================================
section "Step 3: Pre-Claim Onboarding State"

PRE_RESP=$(curl -s -X POST \
  "$SUPABASE_URL/rest/v1/rpc/get_onboarding_process_state" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_invite_token\": \"$INVITE_TOKEN\"}")

log "Response: $PRE_RESP"

PRE_INVITE_STATE=$(echo "$PRE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('axes',{}).get('invite_state','MISSING'))" 2>/dev/null || echo "PARSE_ERROR")
PRE_CLAIM_STATE=$(echo "$PRE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('axes',{}).get('claim_state','MISSING'))" 2>/dev/null || echo "PARSE_ERROR")

[[ "$PRE_INVITE_STATE" == "ACTIVE" ]] && pass "invite_state = ACTIVE" || fail "invite_state expected ACTIVE, got: $PRE_INVITE_STATE"
[[ "$PRE_CLAIM_STATE" == "claim_pending_match" ]] && pass "claim_state = claim_pending_match" || fail "claim_state expected claim_pending_match, got: $PRE_CLAIM_STATE"

# =============================================================================
# STEP 4: Execute Claim
# =============================================================================
section "Step 4: Execute club-invite-claim"

CLAIM_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/club-invite-claim" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\": \"$INVITE_TOKEN\", \"member_no\": \"$MEMBER_NO\", \"first_name\": \"Smoke\", \"last_name\": \"Member\"}")

CLAIM_HTTP=$(echo "$CLAIM_RESP" | tail -1)
CLAIM_BODY=$(echo "$CLAIM_RESP" | head -1)

log "HTTP: $CLAIM_HTTP"
log "Response: $CLAIM_BODY"

CLAIM_OK=$(echo "$CLAIM_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',''))" 2>/dev/null || echo "PARSE_ERROR")
CLAIM_MEMBER=$(echo "$CLAIM_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('member_no',''))" 2>/dev/null || echo "")
CLAIM_ROLE=$(echo "$CLAIM_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('role_assigned',''))" 2>/dev/null || echo "")

[[ "$CLAIM_HTTP" == "200" ]] && pass "HTTP 200" || fail "HTTP expected 200, got: $CLAIM_HTTP"
[[ "$CLAIM_OK" == "True" || "$CLAIM_OK" == "true" ]] && pass "ok = true" || fail "ok expected true, got: $CLAIM_OK"
[[ "$CLAIM_MEMBER" == "SMOKE001" ]] && pass "member_no = SMOKE001" || fail "member_no expected SMOKE001, got: $CLAIM_MEMBER"
[[ "$CLAIM_ROLE" == "member" ]] && pass "role_assigned = member" || fail "role_assigned expected member, got: $CLAIM_ROLE"

# =============================================================================
# STEP 5: Post-claim onboarding state (GAP-1 + GAP-2 Validierung)
# =============================================================================
section "Step 5: Post-Claim Onboarding State (GAP-1 + GAP-2)"

POST_RESP=$(curl -s -X POST \
  "$SUPABASE_URL/rest/v1/rpc/get_onboarding_process_state" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{}")

log "Response: $POST_RESP"

get_field() { echo "$POST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null || echo "PARSE_ERROR"; }

MEMBERSHIP_STATE=$(get_field "d.get('axes',{}).get('membership_state','MISSING')")
CLAIM_STATE_POST=$(get_field "d.get('axes',{}).get('claim_state','MISSING')")
PROCESS_STATUS=$(get_field "d.get('process',{}).get('status','MISSING')")
REQ_IDENTITY=$(get_field "d.get('requirements',{}).get('identity_bound','')")
REQ_PROFILE=$(get_field "d.get('requirements',{}).get('profile_complete','')")
REQ_MEMBERSHIP=$(get_field "d.get('requirements',{}).get('membership_active','')")

# GAP-1: status 'active' → membership_state = ACTIVE
[[ "$MEMBERSHIP_STATE" == "ACTIVE" ]] \
  && pass "[GAP-1] membership_state = ACTIVE (status 'active' korrekt gemappt)" \
  || fail "[GAP-1] membership_state expected ACTIVE, got: $MEMBERSHIP_STATE"

# GAP-2: first_name/last_name im Profile → profile_complete = True
[[ "$REQ_PROFILE" == "True" || "$REQ_PROFILE" == "true" ]] \
  && pass "[GAP-2] requirements.profile_complete = true (first/last_name im Profile)" \
  || fail "[GAP-2] requirements.profile_complete expected true, got: $REQ_PROFILE"

[[ "$CLAIM_STATE_POST" == "membership_active" ]] \
  && pass "claim_state = membership_active" \
  || fail "claim_state expected membership_active, got: $CLAIM_STATE_POST"

[[ "$PROCESS_STATUS" == "completed" ]] \
  && pass "process.status = completed" \
  || fail "process.status expected completed, got: $PROCESS_STATUS"

[[ "$REQ_IDENTITY" == "True" || "$REQ_IDENTITY" == "true" ]] \
  && pass "requirements.identity_bound = true" \
  || fail "requirements.identity_bound expected true, got: $REQ_IDENTITY"

[[ "$REQ_MEMBERSHIP" == "True" || "$REQ_MEMBERSHIP" == "true" ]] \
  && pass "requirements.membership_active = true" \
  || fail "requirements.membership_active expected true, got: $REQ_MEMBERSHIP"

# =============================================================================
# FINAL SUMMARY
# =============================================================================
section "Ergebnis"

TOTAL=$((PASS + FAIL))
log "**$PASS / $TOTAL Tests bestanden**"
log ""

if [[ $FAIL -eq 0 ]]; then
  log "🟢 **SMOKE TEST: BESTANDEN**"
  log ""
  log "Invite → Claim → Onboarding-Flow funktioniert korrekt."
  log "GAP-1 (AKTIV→ACTIVE) und GAP-2 (first/last_name) validiert."
  FINAL_STATUS=0
else
  log "🔴 **SMOKE TEST: FEHLGESCHLAGEN** ($FAIL Fehler)"
  log ""
  log "Bitte Fehler an CEO weiterleiten. Keine weiteren Fixes ohne Rücksprache."
  FINAL_STATUS=1
fi

# Write report
mkdir -p "$(dirname "$RESULT_FILE")"
echo "$REPORT" > "$RESULT_FILE"
echo ""
echo "Report gespeichert: $RESULT_FILE"

exit $FINAL_STATUS
