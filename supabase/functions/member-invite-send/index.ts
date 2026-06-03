// Member-Claim STEP 3: member-invite-send
// Versendet die personalisierte Invite-Mail via Resend an die hinterlegte
// Mitglieds-Adresse. Token-basiert; Origin (Tenant-Domain) kommt aus dem Body
// und wird gegen eine Whitelist geprüft.

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const DEFAULT_FROM = "Fishing Club Portal <no-reply@mail.fishing-club-portal.de>";
const DEFAULT_BASE = "https://www.fishing-club-portal.de";
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

function safeBase(originRaw: string): string {
  const o = txt(originRaw);
  if (!o) return DEFAULT_BASE;
  try {
    const u = new URL(o);
    if (ALLOWED_HOST_SUFFIXES.some((s) => u.hostname === s || u.hostname.endsWith("." + s) || u.hostname === s)) {
      return `${u.protocol}//${u.host}`;
    }
  } catch { /* ignore */ }
  return DEFAULT_BASE;
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function sbService(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !service) throw new Error("missing_supabase_service_env");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", service);
  headers.set("Authorization", `Bearer ${service}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`supabase_${res.status}`);
  return res.json().catch(() => []);
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    if (!auth) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });

    const resendKey = txt(Deno.env.get("RESEND_API_KEY"));
    if (!resendKey) return new Response(JSON.stringify({ ok: false, error: "resend_api_key_missing" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const token = txt((body as { token?: string })?.token);
    const base = safeBase(txt((body as { origin?: string })?.origin));
    if (!token) throw new Error("token_required");

    // Invite (aktiv) laden
    const invites = await sbService(`/rest/v1/club_member_invites?select=club_id,club_member_id,status,expires_at&token=eq.${encodeURIComponent(token)}&limit=1`);
    const invite = Array.isArray(invites) && invites.length ? invites[0] : null;
    if (!invite || invite.status !== "active") throw new Error("invite_not_active");

    // Mitglied + Verein
    const members = await sbService(`/rest/v1/club_members?select=first_name,last_name,email&id=eq.${encodeURIComponent(invite.club_member_id)}&limit=1`);
    const member = Array.isArray(members) && members.length ? members[0] : null;
    if (!member?.email) throw new Error("member_email_missing");

    const ident = await sbService(`/rest/v1/rpc/get_club_identity_map`, { method: "POST", body: "{}" }).catch(() => []);
    const club = Array.isArray(ident) ? ident.find((c: { club_id?: string }) => c.club_id === invite.club_id) : null;
    const clubName = txt(club?.club_name) || "dein Verein";

    const inviteUrl = `${base}/auth/invite-confirm?token=${encodeURIComponent(token)}`;
    const firstName = txt(member.first_name) || "Mitglied";

    const html = `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a202c">
        <h2 style="color:#c05621">Dein Zugang zum Vereinsportal</h2>
        <p>Hallo ${esc(firstName)},</p>
        <p><strong>${esc(clubName)}</strong> lädt dich ein, deinen digitalen Zugang zum Mitgliederportal zu aktivieren.</p>
        <p style="margin:24px 0">
          <a href="${esc(inviteUrl)}" style="background:#c05621;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">Zugang aktivieren</a>
        </p>
        <p style="font-size:13px;color:#5a6472">Falls der Button nicht funktioniert, kopiere diesen Link:<br>${esc(inviteUrl)}</p>
        <p style="font-size:13px;color:#5a6472">Der Link ist 14 Tage gültig.</p>
      </div>`;

    const fromAddress = txt(Deno.env.get("CONTACT_FROM_EMAIL")) || DEFAULT_FROM;
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to: [member.email],
        subject: `${clubName}: Dein Zugang zum Vereinsportal`,
        html,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`resend_${resp.status}:${detail.slice(0, 200)}`);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unexpected_error";
    const status = msg === "unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
