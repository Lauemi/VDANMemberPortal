declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  const reqHeaders = req.headers.get("access-control-request-headers") || "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function txt(value: unknown) {
  return String(value ?? "").trim();
}

async function sbServiceFetch(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !service) throw new Error("missing_supabase_service_env");

  const headers = new Headers(init.headers || {});
  headers.set("apikey", service);
  headers.set("Authorization", `Bearer ${service}`);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`supabase_request_failed_${res.status}:${body}`);
  }
  return res;
}

async function callRpc<T>(fn: string, payload: Record<string, unknown>): Promise<T> {
  const res = await sbServiceFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return await res.json().catch(() => null) as T;
}

// Mirrors the auth pattern from club-onboarding-workspace:
// supports both Authorization header and x-vdan-access-token custom header,
// tries multiple apiKeys to resolve the user.
async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const customToken = txt(req.headers.get("x-vdan-access-token"));
  const authHeader = customToken ? `Bearer ${customToken}` : bearerHeader;
  if (!authHeader) return null;

  const requestApiKey = txt(req.headers.get("apikey") || req.headers.get("Apikey") || "");
  const apiKeys = [
    requestApiKey,
    serviceKey,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
  ].map((v) => txt(v)).filter(Boolean);

  for (const apiKey of apiKeys) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: { apikey: apiKey, Authorization: authHeader },
    }).catch(() => null);
    if (!res?.ok) continue;
    const user = await res.json().catch(() => null);
    if (user?.id) return user;
  }
  return null;
}

// Mirrors isAllowed from club-onboarding-workspace:
// superadmin env IDs → club_user_roles (canonical) → user_roles (legacy).
// club_id is validated against the user's actual memberships — never blindly trusted.
async function isAllowed(userId: string, clubId: string): Promise<boolean> {
  const superadminIds = txt(
    Deno.env.get("PUBLIC_SUPERADMIN_USER_IDS") || Deno.env.get("SUPERADMIN_USER_IDS") || "",
  ).split(",").map((v) => txt(v)).filter(Boolean);
  if (superadminIds.includes(txt(userId))) return true;

  const [aclRows, legacyClubRows, legacyGlobalRows] = await Promise.all([
    sbServiceFetch(
      `/rest/v1/club_user_roles?select=role_key&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role_key=in.(admin,vorstand)&limit=1`,
      { method: "GET" },
    ).then((r) => r.json()).catch(() => []),
    sbServiceFetch(
      `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role=in.(admin,vorstand)&limit=1`,
      { method: "GET" },
    ).then((r) => r.json()).catch(() => []),
    sbServiceFetch(
      `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
      { method: "GET" },
    ).then((r) => r.json()).catch(() => []),
  ]);

  return (
    (Array.isArray(aclRows) && aclRows.length > 0) ||
    (Array.isArray(legacyClubRows) && legacyClubRows.length > 0) ||
    (Array.isArray(legacyGlobalRows) && legacyGlobalRows.length > 0)
  );
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_service_env");

    const actor = await getAuthUser(req, supabaseUrl, serviceKey);
    if (!actor?.id) throw new Error("unauthorized");

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const clubId = txt(body?.club_id);
    if (!clubId) throw new Error("club_id_required");

    // club_id is validated here — only accepted if the calling user is admin/vorstand/superadmin for that club.
    if (!(await isAllowed(txt(actor.id), clubId))) {
      throw new Error("forbidden_club_manager_only");
    }

    // club_onboarding_snapshot has an explicit security guard (is_service_role_request / is_admin_or_vorstand).
    // Calling it with the service role key is unreliable on ES256-JWT projects because PostgREST
    // does not inject request.jwt.claim.role = service_role correctly in that context.
    // The user is already verified as admin/vorstand above, so forwarding their JWT makes the RPC
    // guard pass via is_admin_or_vorstand_in_club — no new logic needed.
    const userAuthHeader = (() => {
      const customToken = txt(req.headers.get("x-vdan-access-token"));
      const bearer = req.headers.get("authorization") || req.headers.get("Authorization") || "";
      return customToken ? `Bearer ${customToken}` : bearer;
    })();
    const anonKey = txt(
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
    );

    const [snapshotRows, billingRes, workHoursConfig] = await Promise.all([
      // Call snapshot RPC with user JWT — guard passes because user is admin/vorstand.
      fetch(`${supabaseUrl}/rest/v1/rpc/club_onboarding_snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey || serviceKey,
          "Authorization": userAuthHeader,
        },
        body: JSON.stringify({ p_club_id: clubId }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          throw new Error(`supabase_request_failed_${r.status}:${body}`);
        }
        return r.json().catch(() => null);
      }),
      // Billing: direct table query with service role — RLS is bypassed, no guard function involved.
      sbServiceFetch(
        `/rest/v1/club_billing_subscriptions?select=club_id,billing_state,checkout_state,current_period_end,canceled_at,updated_at&club_id=eq.${encodeURIComponent(clubId)}&limit=1`,
        { method: "GET" },
      ).then((r) => r.json()).catch(() => []),
      sbServiceFetch(`/rest/v1/rpc/get_work_hours_config`, {
        method: "POST",
        body: JSON.stringify({ p_club_id: clubId }),
      }).then((r) => r.json()).catch(() => ({ configured: false, enabled: false })),
    ]);

    const snapshot = Array.isArray(snapshotRows) ? (snapshotRows[0] ?? null) : snapshotRows;
    // Ensure billing object always has billing_state key even when no subscription row exists yet.
    const billingRaw = Array.isArray(billingRes) ? (billingRes[0] ?? null) : null;
    const billing = billingRaw ?? { billing_state: null };

    return new Response(
      // club_id at root: required by valuePath "record.club_id" in ADM_clubSettings.json
      JSON.stringify({ ok: true, club_id: clubId, snapshot, billing, work_hours_config: workHoursConfig }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized" ? 401 : message.startsWith("forbidden") ? 403 : 400;
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
