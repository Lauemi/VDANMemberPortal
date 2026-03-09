declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type SetupBody = {
  club_name: string;
  club_code?: string;
  default_fishing_card: string;
  default_card?: string;
  fishing_cards?: string[];
  waters?: string[];
  make_public_active?: boolean;
  assign_creator_roles?: boolean;
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

function toList(input: unknown) {
  const arr = Array.isArray(input) ? input : [];
  const uniq = new Set<string>();
  for (const raw of arr) {
    const v = txt(raw);
    if (v) uniq.add(v);
  }
  return [...uniq];
}

function firstListValue(input: unknown) {
  const list = toList(input);
  return list.length ? list[0] : "";
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

async function isAdmin(userId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureClubCodeFree(clubCode: string) {
  const byMapRes = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_key&setting_key=eq.${encodeURIComponent(`club_code_map:${clubCode}`)}&limit=1`,
    { method: "GET" },
  );
  const byMap = await byMapRes.json().catch(() => []);
  if (Array.isArray(byMap) && byMap.length > 0) throw new Error("club_code_exists");

  const byMembersRes = await sbServiceFetch(
    `/rest/v1/club_members?select=club_code&club_code=eq.${encodeURIComponent(clubCode)}&limit=1`,
    { method: "GET" },
  );
  const byMembers = await byMembersRes.json().catch(() => []);
  if (Array.isArray(byMembers) && byMembers.length > 0) throw new Error("club_code_exists");
}

function clubCodeFromIndex(index: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letterBlock = Math.floor(index / 100);
  const d = index % 100;
  const a = Math.floor(letterBlock / 26);
  const b = letterBlock % 26;
  return `${letters[a]}${letters[b]}${String(d).padStart(2, "0")}`;
}

async function listUsedClubCodes() {
  const used = new Set<string>();

  const mapRes = await sbServiceFetch(
    "/rest/v1/app_secure_settings?select=setting_key&setting_key=like.club_code_map:*",
    { method: "GET" },
  );
  const mapRows = await mapRes.json().catch(() => []);
  for (const row of Array.isArray(mapRows) ? mapRows : []) {
    const key = txt(row?.setting_key);
    if (!key.startsWith("club_code_map:")) continue;
    const code = upper(key.slice("club_code_map:".length));
    if (/^[A-Z]{2}[0-9]{2}$/.test(code)) used.add(code);
  }

  const membersRes = await sbServiceFetch("/rest/v1/club_members?select=club_code", { method: "GET" });
  const membersRows = await membersRes.json().catch(() => []);
  for (const row of Array.isArray(membersRows) ? membersRows : []) {
    const code = upper(row?.club_code);
    if (/^[A-Z]{2}[0-9]{2}$/.test(code)) used.add(code);
  }

  return used;
}

async function nextFreeClubCode() {
  const used = await listUsedClubCodes();
  for (let i = 0; i < 26 * 26 * 100; i += 1) {
    const code = clubCodeFromIndex(i);
    if (!used.has(code)) return code;
  }
  throw new Error("club_code_space_exhausted");
}

async function upsertSetting(settingKey: string, settingValue: string) {
  await sbServiceFetch("/rest/v1/app_secure_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ setting_key: settingKey, setting_value: settingValue }]),
  });
}

async function insertMissingWaters(clubId: string, waters: string[]) {
  const clean = toList(waters);
  if (!clean.length) return;

  const existingRes = await sbServiceFetch(
    `/rest/v1/water_bodies?select=name&club_id=eq.${encodeURIComponent(clubId)}`,
    { method: "GET" },
  );
  const existingRows = await existingRes.json().catch(() => []);
  const existing = new Set((Array.isArray(existingRows) ? existingRows : []).map((r) => txt(r?.name)));

  const payload = clean
    .filter((name) => !existing.has(name))
    .map((name) => ({
      club_id: clubId,
      name,
      area_kind: "vereins_gemeinschaftsgewaesser",
      is_active: true,
    }));

  if (!payload.length) return;

  await sbServiceFetch("/rest/v1/water_bodies", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
}

async function ensureCreatorRoles(userId: string, clubId: string) {
  const existingRes = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}`,
    { method: "GET" },
  );
  const existingRows = await existingRes.json().catch(() => []);
  const existing = new Set((Array.isArray(existingRows) ? existingRows : []).map((r) => txt(r?.role).toLowerCase()));

  const want = ["admin", "member"];
  const missing = want.filter((role) => !existing.has(role));
  if (!missing.length) return;

  const payload = missing.map((role) => ({ user_id: userId, club_id: clubId, role }));
  await sbServiceFetch("/rest/v1/user_roles", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
}

function autoMemberNo(clubId: string, userId: string) {
  const clubPart = clubId.replace(/-/g, "").slice(0, 4).toUpperCase() || "CLUB";
  const userPart = userId.replace(/-/g, "").slice(0, 8).toUpperCase() || "USER";
  return `MID-${clubPart}-${userPart}`;
}

function generateInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const enc = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureCreatorProfileBinding(actor: Record<string, unknown>, userId: string, clubId: string) {
  const profileRes = await sbServiceFetch(
    `/rest/v1/profiles?select=id,club_id,member_no&limit=1&id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
  const profileRows = await profileRes.json().catch(() => []);
  const row = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;

  const nextClubId = txt(row?.club_id) || clubId;
  const nextMemberNo = txt(row?.member_no) || autoMemberNo(clubId, userId);

  if (!row?.id) {
    const displayName = txt((actor as { user_metadata?: { first_name?: string; last_name?: string } })?.user_metadata?.first_name)
      || txt((actor as { email?: string })?.email)
      || userId;
    await sbServiceFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify([{
        id: userId,
        display_name: displayName,
        email: txt((actor as { email?: string })?.email) || null,
        club_id: nextClubId,
        member_no: nextMemberNo,
      }]),
    });
    return;
  }

  const needsClubPatch = txt(row?.club_id) !== nextClubId;
  const needsMemberPatch = txt(row?.member_no) !== nextMemberNo;
  if (!needsClubPatch && !needsMemberPatch) return;

  await sbServiceFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      club_id: nextClubId,
      member_no: nextMemberNo,
    }),
  });
}

Deno.serve(async (req: Request) => {
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

    const actor = await getAuthUser(req, supabaseUrl, serviceKey);
    if (!actor?.id) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
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

    const body = (await req.json().catch(() => null)) as SetupBody | null;
    const clubName = txt(body?.club_name);
    let clubCode = upper(body?.club_code);
    const defaultCard = txt(body?.default_fishing_card) || txt(body?.default_card) || firstListValue(body?.fishing_cards) || "FCP Standard";
    const cards = toList([defaultCard, ...(Array.isArray(body?.fishing_cards) ? body!.fishing_cards! : [])]);
    const waters = toList(body?.waters);
    const makePublicActive = Boolean(body?.make_public_active);
    const assignCreatorRoles = body?.assign_creator_roles !== false;

    if (!clubName) throw new Error("club_name_required");
    if (!defaultCard) throw new Error("default_fishing_card_required");

    if (clubCode) {
      if (!/^[A-Z]{2}[0-9]{2}$/.test(clubCode)) throw new Error("club_code_invalid");
      await ensureClubCodeFree(clubCode);
    } else {
      clubCode = await nextFreeClubCode();
    }

    const clubId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const inviteToken = generateInviteToken();
    const inviteTokenHash = await sha256Hex(inviteToken);
    const inviteExpiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString();

    const meta = {
      club_id: clubId,
      club_name: clubName,
      club_code: clubCode,
      default_fishing_card: defaultCard,
      fishing_cards: cards,
      created_at: createdAt,
      created_by: String(actor.id),
      version: 1,
    };

    await upsertSetting(`club_meta:${clubId}`, JSON.stringify(meta));
    await upsertSetting(`club_name:${clubId}`, clubName);
    await upsertSetting(`club_code_map:${clubCode}`, clubId);
    await upsertSetting(`club_cards:${clubId}`, JSON.stringify(cards));
    const inviteRecord: InviteRecord = {
      version: 1,
      status: "active",
      club_id: clubId,
      club_code: clubCode,
      club_name: clubName,
      created_at: createdAt,
      created_by: String(actor.id),
      expires_at: inviteExpiresAt,
      max_uses: 25,
      used_count: 0,
      used_user_ids: [],
    };
    await upsertSetting(`club_invite_token:${inviteTokenHash}`, JSON.stringify(inviteRecord));
    await upsertSetting(`club_invite_active:${clubId}`, inviteTokenHash);

    if (makePublicActive) {
      await upsertSetting("public_active_club_id", clubId);
    }

    await insertMissingWaters(clubId, waters);

    if (assignCreatorRoles) {
      await ensureCreatorRoles(String(actor.id), clubId);
    }
    await ensureCreatorProfileBinding(actor, String(actor.id), clubId);

    const reqOrigin = txt(req.headers.get("origin"));
    const registerUrl = reqOrigin
      ? `${reqOrigin.replace(/\/+$/, "")}/registrieren/?invite=${encodeURIComponent(inviteToken)}`
      : `/registrieren/?invite=${encodeURIComponent(inviteToken)}`;
    const inviteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(registerUrl)}`;

    return new Response(
      JSON.stringify({
        ok: true,
        club_id: clubId,
        club_code: clubCode,
        club_name: clubName,
        default_fishing_card: defaultCard,
        fishing_cards: cards,
        waters_created: waters,
        public_active_set: makePublicActive,
        creator_roles_assigned: assignCreatorRoles,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invite_register_url: registerUrl,
        invite_qr_url: inviteQrUrl,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
