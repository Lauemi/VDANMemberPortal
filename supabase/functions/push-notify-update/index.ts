import webpush from "npm:web-push@3.6.7";

function cors(req: Request) {
  const allow = String(Deno.env.get("PUSH_CORS_ALLOW_ORIGIN") || "").trim();
  const reqOrigin = String(req.headers.get("origin") || "").trim();
  const origin = allow || reqOrigin || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
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

async function isManager(userId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" }
  );
  const rows = await res.json().catch(() => []);
  const roles = (Array.isArray(rows) ? rows : []).map((r) => String(r?.role || "").toLowerCase());
  return roles.includes("admin") || roles.includes("vorstand");
}

function validTargetUrl(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return "/app/einstellungen/";
  if (s.startsWith("/")) return s;
  if (/^https:\/\//i.test(s)) return s;
  return "/app/einstellungen/";
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    const pushToken = Deno.env.get("PUSH_NOTIFY_TOKEN") || "";
    if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_service_env");
    if (!vapidPublic || !vapidPrivate) throw new Error("missing_vapid_env");

    const tokenHeader = String(req.headers.get("x-push-token") || "").trim();
    let authorized = false;
    if (pushToken && tokenHeader && tokenHeader === pushToken) authorized = true;

    if (!authorized) {
      const user = await getAuthUser(req, supabaseUrl, serviceKey);
      if (!user?.id || !(await isManager(String(user.id)))) {
        return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      authorized = true;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      version?: string;
      title?: string;
      message?: string;
      url?: string;
      dry_run?: boolean;
    };
    const version = String(body?.version || "").trim().slice(0, 80);
    const title = String(body?.title || "VDAN APP").trim().slice(0, 80);
    const message = String(body?.message || `Neue Version${version ? ` ${version}` : ""} verfügbar.`).trim().slice(0, 240);
    const url = validTargetUrl(String(body?.url || "/app/einstellungen/"));
    const dryRun = Boolean(body?.dry_run);
    if (!version && !message) throw new Error("version_or_message_required");

    const subsRes = await sbServiceFetch(
      "/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth,enabled,notify_app_update&enabled=eq.true&notify_app_update=eq.true",
      { method: "GET" }
    );
    const subs = await subsRes.json().catch(() => []);

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, subscriptions: Array.isArray(subs) ? subs.length : 0 }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      tag: version ? `vdan-update-${version}` : "vdan-update",
      version,
    });

    let sent = 0;
    let removed = 0;
    let failed = 0;
    for (const s of Array.isArray(subs) ? subs : []) {
      const endpoint = String(s?.endpoint || "").trim();
      const p256dh = String(s?.p256dh || "").trim();
      const auth = String(s?.auth || "").trim();
      if (!endpoint || !p256dh || !auth) continue;
      const sub = {
        endpoint,
        keys: { p256dh, auth },
      };
      try {
        await webpush.sendNotification(sub, payload, { TTL: 60 * 60 });
        sent += 1;
      } catch (err) {
        failed += 1;
        const statusCode = Number((err as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          const id = String(s?.id || "").trim();
          if (id) {
            await sbServiceFetch(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(id)}`, {
              method: "DELETE",
              headers: { Prefer: "return=minimal" },
            }).catch(() => {});
            removed += 1;
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, removed }), {
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
