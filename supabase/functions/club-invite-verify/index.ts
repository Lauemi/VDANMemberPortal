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

async function sha256Hex(value: string) {
  const enc = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadInviteRecord(token: string) {
  const tokenHash = await sha256Hex(token);
  const res = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_value&setting_key=eq.${encodeURIComponent(`club_invite_token:${tokenHash}`)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  const raw = Array.isArray(rows) && rows.length ? txt(rows[0]?.setting_value) : "";
  if (!raw) return null;
  const parsed = JSON.parse(raw) as InviteRecord;
  return parsed;
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

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const body = await req.json().catch(() => ({}));
    const inviteToken = txt((body as { invite_token?: string })?.invite_token);
    if (!inviteToken) throw new Error("invite_token_required");

    const record = await loadInviteRecord(inviteToken);
    validateInviteRecord(record);

    const maxUses = Math.max(1, Number(record!.max_uses || 1));
    const used = Math.max(0, Number(record!.used_count || 0));

    return new Response(
      JSON.stringify({
        ok: true,
        club_id: record!.club_id,
        club_code: record!.club_code,
        club_name: record!.club_name,
        expires_at: record!.expires_at,
        remaining_uses: Math.max(0, maxUses - used),
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
