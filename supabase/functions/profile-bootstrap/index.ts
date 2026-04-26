declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import { createClient } from "npm:@supabase/supabase-js@2";

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

function normalizeMemberNo(raw: unknown) {
  return txt(raw).toUpperCase().replace(/\s+/g, "");
}

function autoMemberNo(userId: string) {
  const userPart = userId.replace(/-/g, "").slice(0, 12).toUpperCase() || "USER";
  return `AUTO-${userPart}`;
}

function memberCardIdFromUserId(userId: string) {
  return userId.replace(/-/g, "").slice(0, 16).toUpperCase() || crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}

function generateMemberCardKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
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
    console.error("profile-bootstrap service request failed", {
      path,
      status: res.status,
      body: body.slice(0, 500),
    });
    throw new Error(`supabase_request_failed_${res.status}`);
  }
  return res;
}

async function getAuthUser(req: Request, supabaseUrl: string) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!anonKey) throw new Error("missing_supabase_anon_env");

  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user;
}

async function memberNoTaken(memberNo: string) {
  if (!memberNo) return false;
  const res = await sbServiceFetch(
    `/rest/v1/profiles?select=id&member_no=eq.${encodeURIComponent(memberNo)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function hasPreferredClubAccess(userId: string, preferredClubId: string) {
  if (!preferredClubId) return false;

  const legacyRes = await sbServiceFetch(
    `/rest/v1/user_roles?select=club_id&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(preferredClubId)}&limit=1`,
    { method: "GET" },
  );
  const legacyRows = await legacyRes.json().catch(() => []);
  if (Array.isArray(legacyRows) && legacyRows.length) return true;

  const aclRes = await sbServiceFetch(
    `/rest/v1/club_user_roles?select=club_id&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(preferredClubId)}&limit=1`,
    { method: "GET" },
  );
  const aclRows = await aclRes.json().catch(() => []);
  return Array.isArray(aclRows) && aclRows.length > 0;
}

async function loadUserClubIds(userId: string) {
  const legacyRes = await sbServiceFetch(
    `/rest/v1/user_roles?select=club_id&user_id=eq.${encodeURIComponent(userId)}&club_id=not.is.null`,
    { method: "GET" },
  );
  const legacyRows = await legacyRes.json().catch(() => []);

  const aclRes = await sbServiceFetch(
    `/rest/v1/club_user_roles?select=club_id&user_id=eq.${encodeURIComponent(userId)}&club_id=not.is.null`,
    { method: "GET" },
  );
  const aclRows = await aclRes.json().catch(() => []);

  return [...new Set(
    [...(Array.isArray(legacyRows) ? legacyRows : []), ...(Array.isArray(aclRows) ? aclRows : [])]
      .map((row) => txt(row?.club_id))
      .filter(Boolean),
  )];
}

async function resolvePreferredClubId(userId: string, preferredClubIdRaw: unknown, existingClubIdRaw: unknown) {
  const preferredClubId = txt(preferredClubIdRaw);
  if (preferredClubId && await hasPreferredClubAccess(userId, preferredClubId)) {
    return preferredClubId;
  }

  const existingClubId = txt(existingClubIdRaw);
  if (existingClubId) return existingClubId;

  const clubIds = await loadUserClubIds(userId);

  // Deterministic: auto-bind only if there is exactly one unambiguous club.
  if (clubIds.length === 1) return clubIds[0];
  return "";
}

async function pickMemberNo(userId: string, preferredRaw: unknown) {
  const preferred = normalizeMemberNo(preferredRaw);
  if (preferred && !preferred.includes("@") && !(await memberNoTaken(preferred))) {
    return preferred;
  }

  const base = autoMemberNo(userId);
  if (!(await memberNoTaken(base))) return base;

  for (let i = 0; i < 6; i += 1) {
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    const candidate = `${base}-${suffix}`;
    if (!(await memberNoTaken(candidate))) return candidate;
  }
  throw new Error("member_no_generation_failed");
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_service_env");

    const actor = await getAuthUser(req, supabaseUrl);
    if (!actor?.id) throw new Error("unauthorized");

    const body = await req.json().catch(() => ({}));
    const firstName = txt((body as { first_name?: string })?.first_name);
    const lastName = txt((body as { last_name?: string })?.last_name);
    const preferredMemberNo = txt((body as { preferred_member_no?: string })?.preferred_member_no);
    const preferredClubId = txt((body as { preferred_club_id?: string })?.preferred_club_id);

    const userId = txt(actor.id);
    const email = txt((actor as { email?: string })?.email).toLowerCase() || null;

    const profileRes = await sbServiceFetch(
      `/rest/v1/profiles?select=id,member_no,club_id,active_club_id,email,display_name,first_name,last_name,member_card_id,member_card_key,member_card_valid,member_card_valid_from,member_card_valid_until,fishing_card_type&limit=1&id=eq.${encodeURIComponent(userId)}`,
      { method: "GET" },
    );
    const profileRows = await profileRes.json().catch(() => []);
    const existing = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;
    const resolvedClubId = await resolvePreferredClubId(userId, preferredClubId, existing?.club_id);

    if (!existing?.id) {
      const memberNo = await pickMemberNo(userId, preferredMemberNo);
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || memberNo || userId;
      const today = new Date().toISOString().slice(0, 10);
      const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await sbServiceFetch("/rest/v1/profiles", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([{
          id: userId,
          email,
          display_name: displayName,
          first_name: firstName || null,
          last_name: lastName || null,
          member_no: memberNo,
          active_club_id: resolvedClubId || null,
          club_id: resolvedClubId || null,
          member_card_id: memberCardIdFromUserId(userId),
          member_card_key: generateMemberCardKey(),
          member_card_valid: true,
          member_card_valid_from: today,
          member_card_valid_until: validUntil,
          fishing_card_type: "-",
        }]),
      });

      return new Response(JSON.stringify({
        ok: true,
        created: true,
        member_no: memberNo,
        active_club_id: resolvedClubId || null,
        club_id: resolvedClubId || null,
      }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const patch: Record<string, unknown> = {};
    if (!txt(existing.email) && email) patch.email = email;
    if (!txt(existing.first_name) && firstName) patch.first_name = firstName;
    if (!txt(existing.last_name) && lastName) patch.last_name = lastName;

    if (!txt(existing.member_no)) {
      patch.member_no = await pickMemberNo(userId, preferredMemberNo);
    }

    const today = new Date().toISOString().slice(0, 10);
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!txt(existing.member_card_id)) patch.member_card_id = memberCardIdFromUserId(userId);
    if (!txt(existing.member_card_key)) patch.member_card_key = generateMemberCardKey();
    if (typeof existing.member_card_valid !== "boolean") patch.member_card_valid = true;
    if (!txt(existing.member_card_valid_from)) patch.member_card_valid_from = today;
    if (!txt(existing.member_card_valid_until)) patch.member_card_valid_until = validUntil;
    if (!txt(existing.fishing_card_type)) patch.fishing_card_type = "-";

    if (!txt(existing.active_club_id) && resolvedClubId) {
      patch.active_club_id = resolvedClubId;
    } else if (resolvedClubId && txt(existing.active_club_id) !== resolvedClubId) {
      patch.active_club_id = resolvedClubId;
    }

    if (!txt(existing.club_id) && resolvedClubId) {
      patch.club_id = resolvedClubId;
    }

    if (!txt(existing.display_name)) {
      const fromNames = [firstName || txt(existing.first_name), lastName || txt(existing.last_name)].filter(Boolean).join(" ");
      patch.display_name = fromNames || email || txt(existing.member_no) || userId;
    }

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      await sbServiceFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      created: false,
      member_no: txt((patch.member_no as string) || existing.member_no),
      active_club_id: txt((patch.active_club_id as string) || existing.active_club_id) || null,
      club_id: txt((patch.club_id as string) || existing.club_id) || null,
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized" ? 401 : 500;
    const safeError = message === "unauthorized" ? "unauthorized" : "bootstrap_failed";
    return new Response(JSON.stringify({ ok: false, error: safeError }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
