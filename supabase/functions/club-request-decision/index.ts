import { sendClubRequestDecisionMail } from "../_shared/contact-utils.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type DecisionBody = {
  request_id?: string;
  action?: "approve" | "reject";
  rejection_reason?: string;
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

async function callRpc<T>(fn: string, payload: Record<string, unknown>) {
  const res = await sbServiceFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return await res.json().catch(() => null) as T;
}

async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const customToken = String(req.headers.get("x-vdan-access-token") || "").trim();
  const authHeader = customToken ? `Bearer ${customToken}` : bearerHeader;
  const debug: Record<string, unknown> = {
    hasAuthorizationHeader: Boolean(bearerHeader),
    hasCustomToken: Boolean(customToken),
    bearerHeaderPrefix: bearerHeader ? `${bearerHeader.slice(0, 24)}...` : "",
    customTokenPrefix: customToken ? `${customToken.slice(0, 24)}...` : "",
    customTokenSegments: customToken ? customToken.split(".").length : 0,
    authHeaderPrefix: authHeader ? `${authHeader.slice(0, 32)}...` : "",
  };
  if (!authHeader) return { user: null, debug };
  const requestApiKey = String(
    req.headers.get("apikey")
    || req.headers.get("Apikey")
    || "",
  ).trim();
  debug.requestApiKeyPrefix = requestApiKey ? `${requestApiKey.slice(0, 16)}...` : "";
  const apiKeys = [
    requestApiKey,
    serviceKey,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const attempts: Array<Record<string, unknown>> = [];

  for (const apiKey of apiKeys) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
      },
    }).catch(() => null);
    if (!res) {
      attempts.push({ apiKeyPrefix: `${apiKey.slice(0, 16)}...`, ok: false, status: "fetch_failed" });
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      attempts.push({ apiKeyPrefix: `${apiKey.slice(0, 16)}...`, ok: false, status: res.status, body });
      continue;
    }
    const user = await res.json().catch(() => null);
    attempts.push({ apiKeyPrefix: `${apiKey.slice(0, 16)}...`, ok: true, status: res.status, userId: user?.id || "" });
    if (user?.id) {
      debug.attempts = attempts;
      return { user, debug };
    }
  }
  debug.attempts = attempts;
  return { user: null, debug };
}

function configuredSuperadminIds() {
  return String(
    Deno.env.get("PUBLIC_SUPERADMIN_USER_IDS")
    || Deno.env.get("SUPERADMIN_USER_IDS")
    || "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function isAdmin(userId: string) {
  if (configuredSuperadminIds().includes(String(userId || "").trim())) return true;
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_service_env" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const authResult = await getAuthUser(req, supabaseUrl, serviceKey);
    const actor = authResult?.user;
    if (!actor?.id) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized", debug: authResult?.debug || null }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!(await isAdmin(String(actor.id)))) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden_admin_only" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as DecisionBody | null;
    const requestId = txt(body?.request_id);
    const action = txt(body?.action).toLowerCase();
    const rejectionReason = txt(body?.rejection_reason);
    if (!requestId) throw new Error("request_id_required");
    if (!(action === "approve" || action === "reject")) throw new Error("action_invalid");

    const requestRes = await sbServiceFetch(
      `/rest/v1/club_registration_requests?select=*&id=eq.${encodeURIComponent(requestId)}&limit=1`,
      { method: "GET" },
    );
    const requestRows = await requestRes.json().catch(() => []);
    const requestRow = Array.isArray(requestRows) && requestRows.length ? requestRows[0] : null;
    if (!requestRow?.id) throw new Error("request_not_found");
    if (txt(requestRow.status) !== "pending") throw new Error("request_not_pending");

    if (action === "reject") {
      await sbServiceFetch(`/rest/v1/club_registration_requests?id=eq.${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "rejected",
          rejected_by: String(actor.id),
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
          decision_payload: {
            decided_by: String(actor.id),
            decided_at: new Date().toISOString(),
            action: "reject",
          },
        }),
      });

      const mailResult = await sendClubRequestDecisionMail({
        to: txt(requestRow.requester_email),
        clubName: txt(requestRow.club_name),
        status: "rejected",
        rejectionReason,
      });

      return new Response(JSON.stringify({ ok: true, action: "reject", mail: mailResult }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const customToken = String(req.headers.get("x-vdan-access-token") || "").trim();
    const authHeader = customToken ? `Bearer ${customToken}` : bearerHeader;
    const setupRes = await fetch(`${supabaseUrl}/functions/v1/club-admin-setup`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        ...(customToken ? { "x-vdan-access-token": customToken } : {}),
      },
      body: JSON.stringify({
        request_id: requestId,
        club_name: txt(requestRow.club_name),
        default_fishing_card: "FCP Standard",
        fishing_cards: ["FCP Standard"],
        waters: [],
        make_public_active: false,
        assign_creator_roles: true,
        street: txt(requestRow.club_address),
        contact_name: txt(requestRow.responsible_name),
        contact_email: txt(requestRow.responsible_email),
        responsible_name: txt(requestRow.responsible_name),
        responsible_email: txt(requestRow.responsible_email),
        club_size: txt(requestRow.club_size),
        creator_user_id: txt(requestRow.requester_user_id),
        creator_email: txt(requestRow.requester_email),
      }),
    });
    const setupData = await setupRes.json().catch(() => ({}));
    if (!setupRes.ok || setupData?.ok === false) {
      throw new Error(String(setupData?.error || `club_admin_setup_failed_${setupRes.status}`));
    }

    const clubId = txt(setupData?.club_id);
    if (!clubId) throw new Error("club_id_missing_after_setup");

    await sbServiceFetch(`/rest/v1/club_registration_requests?id=eq.${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "approved",
        approved_club_id: clubId,
        approved_by: String(actor.id),
        approved_at: new Date().toISOString(),
        decision_payload: {
          decided_by: String(actor.id),
          decided_at: new Date().toISOString(),
          action: "approve",
          club_id: clubId,
        },
      }),
    });

    await callRpc("create_member_notification", {
      p_club_id: clubId,
      p_user_id: txt(requestRow.requester_user_id),
      p_type: "club_request_approved",
      p_title: "Vereinsanfrage freigegeben",
      p_message: `Deine Anfrage fuer ${txt(requestRow.club_name)} wurde freigegeben. Du kannst jetzt ins Portal.`,
      p_severity: "success",
      p_source_kind: "club_registration_request",
      p_source_id: requestId,
      p_action_url: "/app/",
    }).catch(() => null);

    const origin = txt(req.headers.get("origin"));
    const loginUrl = origin ? `${origin.replace(/\/+$/, "")}/login/?next=%2Fapp%2F` : "/login/?next=%2Fapp%2F";
    const mailResult = await sendClubRequestDecisionMail({
      to: txt(requestRow.requester_email),
      clubName: txt(requestRow.club_name),
      status: "approved",
      loginUrl,
    });

    return new Response(JSON.stringify({
      ok: true,
      action: "approve",
      club_id: clubId,
      setup: setupData,
      mail: mailResult,
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
