type ActionBody =
  | { action: "update"; event_id: string; patch: Record<string, unknown> }
  | { action: "delete"; event_id: string };

function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: authHeader,
    },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ? user : null;
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
    const txt = await res.text().catch(() => "");
    throw new Error(`supabase_request_failed_${res.status}:${txt}`);
  }
  return res;
}

async function isManager(userId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" }
  );
  const rows = await res.json().catch(() => []);
  const roles = (Array.isArray(rows) ? rows : []).map((r) => String(r?.role || "").toLowerCase());
  return roles.includes("admin") || roles.includes("vorstand");
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
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

    const user = await getAuthUser(req, supabaseUrl, serviceKey);
    if (!user?.id) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!(await isManager(String(user.id)))) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as ActionBody | null;
    const eventId = String(body?.event_id || "").trim();
    if (!eventId) {
      return new Response(JSON.stringify({ ok: false, error: "event_id_required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (body?.action === "delete") {
      await sbServiceFetch(`/rest/v1/work_events?id=eq.${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      });
      return new Response(JSON.stringify({ ok: true, deleted: true }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (body?.action === "update") {
      const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
      const safePatch: Record<string, unknown> = {};
      const allowed = new Set(["title", "description", "location", "starts_at", "ends_at", "max_participants", "status"]);
      Object.entries(patch).forEach(([k, v]) => {
        if (allowed.has(k)) safePatch[k] = v;
      });
      if (Object.keys(safePatch).length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "empty_patch" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      safePatch.updated_by = user.id;
      await sbServiceFetch(`/rest/v1/work_events?id=eq.${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(safePatch),
      });
      return new Response(JSON.stringify({ ok: true, updated: true }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "invalid_action" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

