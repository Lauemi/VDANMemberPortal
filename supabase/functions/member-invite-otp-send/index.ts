// Member-Claim STEP 5a: member-invite-otp-send
// Erzeugt einen Supabase Magic-Link server-seitig via Admin-API und sendet ihn
// via Resend — umgeht Supabase's internen E-Mail-Provider.
// Wird aus invite-confirm.astro aufgerufen wenn das Mitglied "Per E-Mail verifizieren" klickt.

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const DEFAULT_FROM = "Fishing Club Portal <no-reply@mail.fishing-club-portal.de>";
const ALLOWED_HOST_SUFFIXES = ["fishing-club-portal.de", "vdan-ottenheim.com", "localhost"];

function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function txt(v: unknown) { return String(v ?? "").trim(); }

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function safeOrigin(raw: string): string | null {
  const o = txt(raw);
  if (!o) return null;
  try {
    const u = new URL(o);
    if (ALLOWED_HOST_SUFFIXES.some((s) => u.hostname === s || u.hostname.endsWith("." + s))) {
      return `${u.protocol}//${u.host}`;
    }
  } catch { /* ignore */ }
  return null;
}

async function sbService(path: string, init: RequestInit = {}): Promise<unknown> {
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
    throw new Error(`supabase_${res.status}:${body.slice(0, 300)}`);
  }
  return res.json().catch(() => null);
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const body = await req.json().catch(() => ({}));
    const token = txt((body as { token?: string })?.token);
    const originRaw = txt((body as { origin?: string })?.origin);
    if (!token) throw new Error("token_required");

    const base = safeOrigin(originRaw);
    if (!base) throw new Error("origin_not_allowed");

    // Invite-Kontext über member_invite_preview RPC laden (validiert Token und Status)
    const pvRaw = await sbService("/rest/v1/rpc/member_invite_preview", {
      method: "POST",
      body: JSON.stringify({ p_token: token }),
    });
    const pv = (Array.isArray(pvRaw) ? pvRaw[0] : pvRaw) as Record<string, unknown> | null;
    if (!pv?.ok) throw new Error(txt(pv?.message) || "invite_invalid");
    if (!pv?.has_email) throw new Error("member_email_missing");

    const memberEmail = txt(pv.member_email);
    const firstName = txt(pv.first_name) || "Mitglied";
    const memberNo = txt(pv.member_no);
    const clubCode = txt(pv.club_code);
    const clubName = txt(pv.club_name) || "deinen Verein";

    // Magic-Link via Supabase Admin-API generieren
    // Admin-API umgeht die redirect_to-Whitelist-Prüfung (anerkanntes Verhalten).
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const redirectTo = `${base}/auth/invite-confirm?token=${encodeURIComponent(token)}&verified=1`;

    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "magiclink",
        email: memberEmail,
        redirect_to: redirectTo,
        data: {
          registration_mode: "join_club",
          invite_token: token,
          member_no: memberNo,
          club_code: clubCode,
        },
      }),
    });

    if (!linkRes.ok) {
      const detail = await linkRes.text().catch(() => "");
      throw new Error(`generate_link_${linkRes.status}:${detail.slice(0, 200)}`);
    }

    const linkData = await linkRes.json().catch(() => ({})) as Record<string, unknown>;
    // GoTrue v2 liefert action_link in properties; Fallback direkt im Root
    const props = (linkData?.properties || {}) as Record<string, unknown>;
    const actionLink = txt(props?.action_link) || txt(linkData?.action_link);
    if (!actionLink) throw new Error("no_action_link_in_response");

    // Via Resend versenden
    const resendKey = txt(Deno.env.get("RESEND_API_KEY"));
    if (!resendKey) throw new Error("resend_api_key_missing");

    const html = `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a202c">
        <h2 style="color:#c05621">E-Mail-Adresse bestätigen</h2>
        <p>Hallo ${esc(firstName)},</p>
        <p>Bitte bestätige deine E-Mail-Adresse, um deinen Zugang zum Vereinsportal von <strong>${esc(clubName)}</strong> zu aktivieren.</p>
        <p style="margin:24px 0">
          <a href="${esc(actionLink)}" style="background:#c05621;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">E-Mail bestätigen &amp; Zugang aktivieren</a>
        </p>
        <p style="font-size:13px;color:#5a6472">Falls der Button nicht funktioniert, kopiere diesen Link:<br>${esc(actionLink)}</p>
        <p style="font-size:13px;color:#5a6472">Der Link ist zeitlich begrenzt. Bitte zeitnah öffnen.</p>
      </div>`;

    const fromAddress = txt(Deno.env.get("CONTACT_FROM_EMAIL")) || DEFAULT_FROM;
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to: [memberEmail],
        subject: "Deinen Vereinszugang bestätigen",
        html,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`resend_${resp.status}:${detail.slice(0, 200)}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unexpected_error";
    const clientErrors = ["token_required", "invite_invalid", "member_email_missing", "origin_not_allowed"];
    const status = clientErrors.some((e) => msg.startsWith(e)) ? 400 : 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
