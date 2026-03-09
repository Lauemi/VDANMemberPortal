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

    const userId = txt(actor.id);
    const email = txt((actor as { email?: string })?.email).toLowerCase() || null;

    const profileRes = await sbServiceFetch(
      `/rest/v1/profiles?select=id,member_no,club_id,email,display_name,first_name,last_name&limit=1&id=eq.${encodeURIComponent(userId)}`,
      { method: "GET" },
    );
    const profileRows = await profileRes.json().catch(() => []);
    const existing = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;

    if (!existing?.id) {
      const memberNo = await pickMemberNo(userId, preferredMemberNo);
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || memberNo || userId;

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
          club_id: null,
        }]),
      });

      return new Response(JSON.stringify({ ok: true, created: true, member_no: memberNo, club_id: null }), {
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
      club_id: txt(existing.club_id) || null,
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
