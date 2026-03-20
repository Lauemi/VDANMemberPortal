declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
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

async function hasClubManagerRole(userId: string, clubId: string) {
  const legacyRes = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role=in.(admin,vorstand)&limit=1`,
    { method: "GET" },
  );
  const legacyRows = await legacyRes.json().catch(() => []);
  if (Array.isArray(legacyRows) && legacyRows.length > 0) return true;

  const aclRes = await sbServiceFetch(
    `/rest/v1/club_user_roles?select=role_key&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role_key=in.(admin,vorstand)&limit=1`,
    { method: "GET" },
  );
  const aclRows = await aclRes.json().catch(() => []);
  return Array.isArray(aclRows) && aclRows.length > 0;
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

    const body = await req.json().catch(() => ({}));
    const clubId = txt((body as { club_id?: string })?.club_id);
    if (!clubId) throw new Error("club_id_required");

    if (!(await hasClubManagerRole(txt(actor.id), clubId))) {
      throw new Error("forbidden_club_manager_only");
    }

    const clubDataComplete = typeof (body as { club_data_complete?: unknown })?.club_data_complete === "boolean"
      ? Boolean((body as { club_data_complete?: boolean }).club_data_complete)
      : null;
    const watersComplete = typeof (body as { waters_complete?: unknown })?.waters_complete === "boolean"
      ? Boolean((body as { waters_complete?: boolean }).waters_complete)
      : null;
    const cardsComplete = typeof (body as { cards_complete?: unknown })?.cards_complete === "boolean"
      ? Boolean((body as { cards_complete?: boolean }).cards_complete)
      : null;
    const membersMode = txt((body as { members_mode?: string })?.members_mode) || null;
    const notes = typeof (body as { notes?: unknown })?.notes === "object" && (body as { notes?: unknown })?.notes !== null
      ? (body as { notes?: Record<string, unknown> }).notes
      : null;

    await callRpc("ensure_club_onboarding_state", { p_club_id: clubId });
    const progress = await callRpc<Record<string, unknown>>("upsert_club_onboarding_progress", {
      p_club_id: clubId,
      p_club_data_complete: clubDataComplete,
      p_waters_complete: watersComplete,
      p_cards_complete: cardsComplete,
      p_members_mode: membersMode,
      p_notes: notes,
    });
    const snapshotRows = await callRpc<Array<Record<string, unknown>>>("club_onboarding_snapshot", { p_club_id: clubId });

    return new Response(JSON.stringify({
      ok: true,
      club_id: clubId,
      progress,
      snapshot: Array.isArray(snapshotRows) ? snapshotRows[0] || null : snapshotRows,
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized" ? 401 : message.startsWith("forbidden") ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
