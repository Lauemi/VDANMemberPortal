declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type InviteRecord = {
  version: 1;
  status: "active" | "exhausted" | "revoked";
  club_id: string;
  club_code: string;
  club_name: string;
  created_at: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  used_count: number;
  used_user_ids: string[];
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

function upper(value: unknown) {
  return txt(value).toUpperCase();
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

async function upsertSetting(settingKey: string, settingValue: string) {
  await sbServiceFetch("/rest/v1/app_secure_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ setting_key: settingKey, setting_value: settingValue }]),
  });
}

async function loadSetting(settingKey: string) {
  const res = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_value&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? txt(rows[0]?.setting_value) : "";
}

async function sha256Hex(value: string) {
  const enc = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function resolveClubId(clubCodeRaw: string, clubIdRaw: string) {
  const clubId = txt(clubIdRaw);
  if (clubId) return clubId;
  const clubCode = upper(clubCodeRaw);
  if (!clubCode) throw new Error("club_code_or_id_required");
  const mapped = await loadSetting(`club_code_map:${clubCode}`);
  if (!mapped) throw new Error("club_not_found");
  return mapped;
}

async function resolveClubCode(clubId: string, fallbackClubCode = "") {
  if (fallbackClubCode) return upper(fallbackClubCode);
  const entriesRes = await sbServiceFetch(
    "/rest/v1/app_secure_settings?select=setting_key,setting_value&setting_key=like.club_code_map:*",
    { method: "GET" },
  );
  const rows = await entriesRes.json().catch(() => []);
  for (const row of Array.isArray(rows) ? rows : []) {
    const value = txt(row?.setting_value);
    if (value !== clubId) continue;
    const key = txt(row?.setting_key);
    if (!key.startsWith("club_code_map:")) continue;
    const code = upper(key.slice("club_code_map:".length));
    if (code) return code;
  }
  return "";
}

async function resolveClubName(clubId: string, fallbackCode: string) {
  const direct = await loadSetting(`club_name:${clubId}`);
  if (direct) return direct;

  const metaRaw = await loadSetting(`club_meta:${clubId}`);
  if (metaRaw) {
    try {
      const parsed = JSON.parse(metaRaw) as { club_name?: string };
      const fromMeta = txt(parsed?.club_name);
      if (fromMeta) return fromMeta;
    } catch {
      // ignore parse error
    }
  }

  return fallbackCode || "Club";
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
    const clubCodeInput = upper((body as { club_code?: string })?.club_code);
    const clubIdInput = txt((body as { club_id?: string })?.club_id);
    const maxUsesRaw = Number((body as { max_uses?: number })?.max_uses);
    const expiresDaysRaw = Number((body as { expires_in_days?: number })?.expires_in_days);

    const maxUses = Number.isFinite(maxUsesRaw) ? Math.max(1, Math.min(500, Math.trunc(maxUsesRaw))) : 25;
    const expiresInDays = Number.isFinite(expiresDaysRaw) ? Math.max(1, Math.min(90, Math.trunc(expiresDaysRaw))) : 14;

    const clubId = await resolveClubId(clubCodeInput, clubIdInput);
    const clubCode = await resolveClubCode(clubId, clubCodeInput);
    const safeClubCode = clubCode || "CLUB";

    const userId = txt(actor.id);
    const allowed = await hasClubManagerRole(userId, clubId);
    if (!allowed) throw new Error("forbidden_club_manager_only");

    const clubName = await resolveClubName(clubId, clubCode);
    const createdAt = new Date().toISOString();
    const inviteExpiresAt = new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)).toISOString();

    const inviteToken = generateInviteToken();
    const inviteTokenHash = await sha256Hex(inviteToken);

    const inviteRecord: InviteRecord = {
      version: 1,
      status: "active",
      club_id: clubId,
      club_code: safeClubCode,
      club_name: clubName,
      created_at: createdAt,
      created_by: userId,
      expires_at: inviteExpiresAt,
      max_uses: maxUses,
      used_count: 0,
      used_user_ids: [],
    };

    await upsertSetting(`club_invite_token:${inviteTokenHash}`, JSON.stringify(inviteRecord));
    await upsertSetting(`club_invite_active:${clubId}`, inviteTokenHash);

    const reqOrigin = txt(req.headers.get("origin"));
    const registerUrl = reqOrigin
      ? `${reqOrigin.replace(/\/+$/, "")}/registrieren/?invite=${encodeURIComponent(inviteToken)}`
      : `/registrieren/?invite=${encodeURIComponent(inviteToken)}`;
    const inviteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(registerUrl)}`;

    return new Response(
      JSON.stringify({
        ok: true,
        club_id: clubId,
        club_code: safeClubCode,
        club_name: clubName,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invite_register_url: registerUrl,
        invite_qr_url: inviteQrUrl,
        max_uses: maxUses,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized" ? 401 : message.startsWith("forbidden") ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
