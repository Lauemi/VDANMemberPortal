type ProfileRow = {
  id: string;
  display_name: string | null;
  member_no: string | null;
  fishing_card_type: string | null;
  member_card_valid: boolean | null;
  member_card_valid_from: string | null;
  member_card_valid_until: string | null;
  member_card_id: string | null;
  member_card_key: string | null;
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

function b64urlEncodeBytes(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlEncodeJson(value: unknown) {
  return b64urlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function parsePkcs8Pem(pem: string) {
  const body = String(pem || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("missing_private_key");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

async function getAuthUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
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
  return res.json().catch(() => null);
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "";
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_public_env" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const user = await getAuthUser(req, supabaseUrl, anonKey);
    if (!user?.id) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const rows = await sbServiceFetch(
      `/rest/v1/profiles?select=id,display_name,member_no,fishing_card_type,member_card_valid,member_card_valid_from,member_card_valid_until,member_card_id,member_card_key&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { method: "GET" },
    ) as ProfileRow[] | null;
    const p = Array.isArray(rows) ? rows[0] : null;
    if (!p?.id || !p.member_card_id || !p.member_card_key) {
      return new Response(JSON.stringify({ ok: false, error: "profile_or_card_missing" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const ttlSec = 7 * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "ES256", typ: "VDANMC1", kid: "vdan-mc-offline-v1" };
    const payload = {
      iss: "vdan-app",
      aud: "member-card-offline-verify",
      sub: p.id,
      card_id: p.member_card_id,
      card_key: p.member_card_key,
      member_no: p.member_no || null,
      display_name: p.display_name || null,
      role: "member",
      fishing_card_type: p.fishing_card_type || null,
      member_card_valid: Boolean(p.member_card_valid),
      member_card_valid_from: p.member_card_valid_from || null,
      member_card_valid_until: p.member_card_valid_until || null,
      iat: now,
      exp: now + ttlSec,
      v: 1,
    };

    const privatePem = Deno.env.get("MEMBER_CARD_SIGNING_PRIVATE_KEY") || "";
    if (!privatePem) {
      return new Response(JSON.stringify({ ok: false, error: "missing_signing_private_key" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const key = await crypto.subtle.importKey(
      "pkcs8",
      parsePkcs8Pem(privatePem),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );

    const encodedHeader = b64urlEncodeJson(header);
    const encodedPayload = b64urlEncodeJson(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const sigBuf = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput),
    );
    const signature = b64urlEncodeBytes(new Uint8Array(sigBuf));
    const token = `${signingInput}.${signature}`;

    return new Response(JSON.stringify({
      ok: true,
      token,
      exp: payload.exp,
      payload,
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

