declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type Action =
  | "get"
  | "save_club_data"
  | "save_cards"
  | "create_water"
  | "toggle_water"
  | "create_member";

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

function upper(value: unknown) {
  return txt(value).toUpperCase();
}

function toList(input: unknown) {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const value = txt(raw);
    if (value) seen.add(value);
  }
  return [...seen];
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

async function getAuthUser(req: Request) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const customToken = txt(req.headers.get("x-vdan-access-token"));
  const authHeader = customToken ? `Bearer ${customToken}` : bearerHeader;
  if (!base || !service || !authHeader) return null;
  const requestApiKey = txt(req.headers.get("apikey") || req.headers.get("Apikey") || "");
  const apiKeys = [
    requestApiKey,
    service,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
  ].map((value) => txt(value)).filter(Boolean);

  for (const apiKey of apiKeys) {
    const res = await fetch(`${base}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
      },
    }).catch(() => null);
    if (!res?.ok) continue;
    const user = await res.json().catch(() => null);
    if (user?.id) return user;
  }
  return null;
}

async function loadJson(path: string) {
  const res = await sbServiceFetch(path, { method: "GET" });
  return await res.json().catch(() => []);
}

async function callRpc(fn: string, payload: Record<string, unknown>) {
  const res = await sbServiceFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return await res.json().catch(() => null);
}

async function isAllowed(userId: string, clubId: string) {
  const [aclRows, legacyAdminRows] = await Promise.all([
    loadJson(`/rest/v1/club_user_roles?select=role_key&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}`),
    loadJson(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`),
  ]);
  const manager = (Array.isArray(aclRows) ? aclRows : []).some((row) => ["admin", "vorstand"].includes(txt(row?.role_key).toLowerCase()));
  const globalAdmin = Array.isArray(legacyAdminRows) && legacyAdminRows.length > 0;
  return manager || globalAdmin;
}

async function readSetting(settingKey: string) {
  const rows = await loadJson(`/rest/v1/app_secure_settings?select=setting_value&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`);
  const value = Array.isArray(rows) && rows.length ? rows[0]?.setting_value : null;
  return txt(value);
}

async function upsertSetting(settingKey: string, settingValue: string) {
  await sbServiceFetch("/rest/v1/app_secure_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ setting_key: settingKey, setting_value: settingValue }]),
  });
}

async function findClubCode(clubId: string) {
  const rows = await loadJson(`/rest/v1/app_secure_settings?select=setting_key,setting_value&setting_key=like.club_code_map:*&setting_value=eq.${encodeURIComponent(clubId)}&limit=1`);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return upper(txt(row?.setting_key).replace("club_code_map:", ""));
}

function parseJsonObject(raw: string) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function loadWorkspace(clubId: string) {
  const [clubName, clubCode, clubMetaRaw, cardsRaw, waters, members] = await Promise.all([
    readSetting(`club_name:${clubId}`),
    findClubCode(clubId),
    readSetting(`club_meta:${clubId}`),
    readSetting(`club_cards:${clubId}`),
    loadJson(`/rest/v1/water_bodies?select=id,name,area_kind,is_active&club_id=eq.${encodeURIComponent(clubId)}&order=name.asc`),
    loadJson(`/rest/v1/club_members?select=member_no,first_name,last_name,status,fishing_card_type&club_id=eq.${encodeURIComponent(clubId)}&order=member_no.asc`),
  ]);

  const meta = parseJsonObject(clubMetaRaw);
  let cardNames: string[] = [];
  try {
    cardNames = toList(JSON.parse(cardsRaw || "[]"));
  } catch {
    cardNames = [];
  }

  return {
    club_data: {
      club_name: clubName,
      club_code: clubCode,
      street: txt(meta.street),
      zip: txt(meta.zip),
      city: txt(meta.city),
      contact_name: txt(meta.contact_name),
      contact_email: txt(meta.contact_email),
      contact_phone: txt(meta.contact_phone),
    },
    waters: Array.isArray(waters) ? waters : [],
    cards: cardNames.map((name, index) => ({ name, is_default: index === 0 })),
    members: Array.isArray(members) ? members : [],
  };
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const actor = await getAuthUser(req);
    if (!actor?.id) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = txt(body.action) as Action;
    const clubId = txt(body.club_id);
    if (!clubId) throw new Error("club_id_required");
    if (!(await isAllowed(String(actor.id), clubId))) throw new Error("forbidden_club_scope");

    if (action === "save_club_data") {
      const clubName = txt(body.club_name);
      if (!clubName) throw new Error("club_name_required");
      const existingClubCode = await findClubCode(clubId);
      const submittedClubCode = upper(body.club_code);
      if (submittedClubCode && existingClubCode && submittedClubCode !== existingClubCode) {
        throw new Error("club_code_readonly");
      }
      const clubMeta = {
        club_id: clubId,
        club_name: clubName,
        club_code: existingClubCode,
        street: txt(body.street),
        zip: txt(body.zip),
        city: txt(body.city),
        contact_name: txt(body.contact_name),
        contact_email: txt(body.contact_email),
        contact_phone: txt(body.contact_phone),
      };
      await upsertSetting(`club_name:${clubId}`, clubName);
      await upsertSetting(`club_meta:${clubId}`, JSON.stringify(clubMeta));
    } else if (action === "save_cards") {
      const cards = toList(body.cards);
      if (!cards.length) throw new Error("cards_required");
      await upsertSetting(`club_cards:${clubId}`, JSON.stringify(cards));
    } else if (action === "create_water") {
      const name = txt(body.name);
      if (!name) throw new Error("water_name_required");
      await sbServiceFetch("/rest/v1/water_bodies", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([{
          club_id: clubId,
          name,
          area_kind: "vereins_gemeinschaftsgewaesser",
          is_active: true,
        }]),
      });
    } else if (action === "toggle_water") {
      const waterId = txt(body.water_id);
      if (!waterId) throw new Error("water_id_required");
      await sbServiceFetch(`/rest/v1/water_bodies?id=eq.${encodeURIComponent(waterId)}&club_id=eq.${encodeURIComponent(clubId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ is_active: Boolean(body.is_active) }),
      });
    } else if (action === "create_member") {
      const clubCode = await findClubCode(clubId);
      if (!clubCode) throw new Error("club_code_missing");
      await callRpc("admin_member_registry_create", {
        p_club_id: clubId,
        p_club_code: clubCode,
        p_first_name: txt(body.first_name),
        p_last_name: txt(body.last_name),
        p_status: txt(body.status) || "active",
        p_fishing_card_type: txt(body.fishing_card_type) || "-",
        p_street: txt(body.street),
        p_zip: txt(body.zip),
        p_city: txt(body.city),
        p_phone: txt(body.phone),
        p_mobile: txt(body.mobile),
        p_birthdate: txt(body.birthdate) || null,
      });
    } else if (action !== "get") {
      throw new Error("action_invalid");
    }

    const workspace = await loadWorkspace(clubId);
    return new Response(JSON.stringify({ ok: true, workspace }), {
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
