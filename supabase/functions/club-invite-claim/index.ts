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

async function sha256Hex(value: string) {
  const enc = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function loadInviteRecord(token: string) {
  const tokenHash = await sha256Hex(token);
  const settingKey = `club_invite_token:${tokenHash}`;
  const res = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_key,setting_value&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  const raw = Array.isArray(rows) && rows.length ? txt(rows[0]?.setting_value) : "";
  if (!raw) return { tokenHash, settingKey, record: null };
  return {
    tokenHash,
    settingKey,
    record: JSON.parse(raw) as InviteRecord,
  };
}

function validateInviteRecord(record: InviteRecord | null) {
  if (!record) throw new Error("invite_invalid");
  if (record.status !== "active") throw new Error("invite_inactive");
  const expires = new Date(record.expires_at).getTime();
  if (!Number.isFinite(expires) || Date.now() > expires) throw new Error("invite_expired");
  const maxUses = Math.max(1, Number(record.max_uses || 1));
  const used = Math.max(0, Number(record.used_count || 0));
  if (used >= maxUses) throw new Error("invite_exhausted");
}

async function ensureProfile(user: Record<string, unknown>, clubId: string, memberNo: string, firstName: string, lastName: string) {
  const userId = txt(user.id);
  const email = txt((user as { email?: string })?.email).toLowerCase();
  const profileRes = await sbServiceFetch(
    `/rest/v1/profiles?select=id,club_id,member_no,display_name&limit=1&id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
  const rows = await profileRes.json().catch(() => []);
  const existing = Array.isArray(rows) && rows.length ? rows[0] : null;
  const displayName = [firstName, lastName].map(txt).filter(Boolean).join(" ") || txt(existing?.display_name) || email || userId;

  if (!existing?.id) {
    await sbServiceFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify([{
        id: userId,
        display_name: displayName,
        email: email || null,
        club_id: clubId,
        member_no: memberNo,
      }]),
    });
    return;
  }

  const existingClubId = txt(existing.club_id);
  if (existingClubId && existingClubId !== clubId) {
    throw new Error("profile_already_bound_other_club");
  }

  await sbServiceFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      display_name: displayName,
      club_id: clubId,
      member_no: memberNo || txt(existing.member_no),
    }),
  });
}

async function ensureMemberRole(userId: string, clubId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role=eq.member&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  if (Array.isArray(rows) && rows.length) return;

  await sbServiceFetch("/rest/v1/user_roles", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{ user_id: userId, club_id: clubId, role: "member" }]),
  });
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
    const inviteToken = txt((body as { invite_token?: string })?.invite_token);
    const memberNo = txt((body as { member_no?: string })?.member_no).toUpperCase();
    const firstName = txt((body as { first_name?: string })?.first_name);
    const lastName = txt((body as { last_name?: string })?.last_name);

    if (!inviteToken) throw new Error("invite_token_required");
    if (!memberNo) throw new Error("member_no_required");

    const loaded = await loadInviteRecord(inviteToken);
    validateInviteRecord(loaded.record);

    const userId = txt(actor.id);
    const record = loaded.record!;
    const usedUsers = Array.isArray(record.used_user_ids) ? record.used_user_ids.map(txt).filter(Boolean) : [];
    const alreadyUsedByActor = usedUsers.includes(userId);

    await ensureProfile(actor, record.club_id, memberNo, firstName, lastName);
    await ensureMemberRole(userId, record.club_id);

    if (!alreadyUsedByActor) {
      const nextUsers = [...new Set([...usedUsers, userId])];
      const nextUsedCount = Math.max(Number(record.used_count || 0), nextUsers.length);
      const maxUses = Math.max(1, Number(record.max_uses || 1));
      const nextStatus = nextUsedCount >= maxUses ? "exhausted" : "active";
      const nextRecord: InviteRecord = {
        ...record,
        used_user_ids: nextUsers,
        used_count: nextUsedCount,
        status: nextStatus,
      };
      await upsertSetting(loaded.settingKey, JSON.stringify(nextRecord));
    }

    return new Response(JSON.stringify({
      ok: true,
      club_id: record.club_id,
      club_code: record.club_code,
      club_name: record.club_name,
      role_assigned: "member",
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
