const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAIL_ON_YELLOW = String(process.env.GOV_FAIL_ON_YELLOW || "false").toLowerCase() === "true";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(2);
}

async function runGate() {
  const url = new URL("/rest/v1/rpc/governance_health_ci_gate", SUPABASE_URL).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ p_fail_on_yellow: FAIL_ON_YELLOW }),
  });

  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    console.error("Governance gate RPC failed:", res.status, payload);
    process.exit(2);
  }

  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== "object") {
    console.error("Unexpected governance gate payload:", payload);
    process.exit(2);
  }

  const summary = {
    passed: Boolean(row.passed),
    red_clubs: Number(row.red_clubs || 0),
    yellow_clubs: Number(row.yellow_clubs || 0),
    green_clubs: Number(row.green_clubs || 0),
    total_clubs: Number(row.total_clubs || 0),
    total_issues: Number(row.total_issues || 0),
    fail_reason: row.fail_reason || null,
    evaluated_at: row.evaluated_at || null,
    fail_on_yellow: FAIL_ON_YELLOW,
  };

  console.log("Governance health gate summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exit(1);
  }
}

runGate().catch((err) => {
  console.error("Governance gate execution error:", err?.message || err);
  process.exit(2);
});
