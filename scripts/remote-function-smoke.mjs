const base = String(process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");

if (!base) {
  console.error("[remote-function-smoke] FAIL: PUBLIC_SUPABASE_URL oder SUPABASE_URL fehlt.");
  process.exit(1);
}

const functions = [
  {
    name: "admin-web-config",
    path: "/functions/v1/admin-web-config",
    postBody: { action: "get", scope: "fcp" },
    expectedStatuses: [200],
  },
  {
    name: "club-admin-setup",
    path: "/functions/v1/club-admin-setup",
    postBody: {},
    expectedStatuses: [401, 403, 405],
  },
  {
    name: "club-onboarding-workspace",
    path: "/functions/v1/club-onboarding-workspace",
    postBody: {},
    expectedStatuses: [401, 403, 405],
  },
];

async function checkPreflight(url) {
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:4321",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
  const allowOrigin = res.headers.get("access-control-allow-origin") || "";
  const allowHeaders = res.headers.get("access-control-allow-headers") || "";
  if (!res.ok) {
    throw new Error(`preflight_status_${res.status}`);
  }
  if (!allowOrigin) {
    throw new Error("missing_access_control_allow_origin");
  }
  if (!allowHeaders.toLowerCase().includes("content-type")) {
    throw new Error("missing_content_type_in_allow_headers");
  }
}

async function checkPost(url, body, expectedStatuses) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  if (!expectedStatuses.includes(res.status)) {
    const text = await res.text().catch(() => "");
    throw new Error(`unexpected_post_status_${res.status}:${text}`);
  }
}

for (const fn of functions) {
  const url = `${base}${fn.path}`;
  console.log(`[remote-function-smoke] CHECK: ${fn.name}`);
  await checkPreflight(url);
  await checkPost(url, fn.postBody, fn.expectedStatuses);
  console.log(`[remote-function-smoke] PASS: ${fn.name}`);
}

console.log("[remote-function-smoke] PASS: alle Ziel-Functions antworten mit gueltigem Preflight und erwartbarem POST-Status.");
