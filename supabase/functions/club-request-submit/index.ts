import { sendClubRequestDecisionMail } from "../_shared/contact-utils.ts";

declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type SubmitBody = {
  club_name?: string;
  club_address?: string;
  responsible_name?: string;
  responsible_email?: string;
  club_size?: string;
  club_mail_confirmed?: boolean;
  auto_approve?: boolean;
};

function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  const reqHeaders = req.headers.get("access-control-request-headers") || "authorization, x-client-info, apikey, content-type";
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": reqHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin, Access-Control-Request-Headers" };
}
function txt(v: unknown) { return String(v ?? "").trim(); }
async function sbServiceFetch(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !service) throw new Error("missing_supabase_service_env");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", service);
  headers.set("Authorization", `Bearer ${service}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`supabase_request_failed_${res.status}:${body}`); }
  return res;
}
async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, { method: "GET", headers: { apikey: serviceKey, Authorization: authHeader } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ? user : null;
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_service_env");
    const actor = await getAuthUser(req, supabaseUrl, serviceKey);
    if (!actor?.id) throw new Error("unauthorized");
    const body = (await req.json().catch(() => null)) as SubmitBody | null;
    const clubName = txt(body?.club_name);
    const clubAddress = txt(body?.club_address);
    const responsibleName = txt(body?.responsible_name);
    const responsibleEmail = txt(body?.responsible_email).toLowerCase();
    const clubSize = txt(body?.club_size);
    const clubMailConfirmed = Boolean(body?.club_mail_confirmed);
    const autoApprove = body?.auto_approve !== false;
    if (!clubName) throw new Error("club_name_required");
    if (!clubAddress) throw new Error("club_address_required");
    if (!responsibleName) throw new Error("responsible_name_required");
    if (!responsibleEmail || !responsibleEmail.includes("@")) throw new Error("responsible_email_required");
    if (!clubSize) throw new Error("club_size_required");
    const requesterEmail = txt((actor as { email?: string }).email).toLowerCase();
    const insertRes = await sbServiceFetch("/rest/v1/club_registration_requests", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ requester_user_id: String(actor.id), requester_email: requesterEmail, status: "pending", club_name: clubName, club_address: clubAddress, responsible_name: responsibleName, responsible_email: responsibleEmail, club_size: clubSize, club_mail_confirmed: clubMailConfirmed, auto_approved: autoApprove, request_payload: { registration_mode: "club_request_pending", onboarding_path: "club_request", billing_status: "billing_pending" } }]),
    });
    const rows = await insertRes.json().catch(() => []);
    const requestRow = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!requestRow?.id) throw new Error("request_insert_failed");
    if (!autoApprove) return new Response(JSON.stringify({ ok: true, request_id: requestRow.id, status: "pending" }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const setupRes = await fetch(`${supabaseUrl}/functions/v1/club-admin-setup`, { method: "POST", headers: { apikey: serviceKey, Authorization: authHeader, "Content-Type": "application/json" }, body: JSON.stringify({ request_id: requestRow.id, club_name: clubName, default_fishing_card: "FCP Standard", fishing_cards: ["FCP Standard"], waters: [], make_public_active: false, assign_creator_roles: true, street: clubAddress, contact_name: responsibleName, contact_email: responsibleEmail, responsible_name: responsibleName, responsible_email: responsibleEmail, club_size: clubSize, creator_user_id: String(actor.id), creator_email: requesterEmail }) });
    const setupData = await setupRes.json().catch(() => ({}));
    if (!setupRes.ok || setupData?.ok === false) throw new Error(String(setupData?.error || `club_admin_setup_failed_${setupRes.status}`));
    await sbServiceFetch(`/rest/v1/club_registration_requests?id=eq.${encodeURIComponent(String(requestRow.id))}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "approved", approved_club_id: String(setupData.club_id || ""), approved_by: String(actor.id), approved_at: new Date().toISOString(), decision_payload: { action: "auto_approve", actor_id: String(actor.id), club_id: String(setupData.club_id || "") } }) });
    await sendClubRequestDecisionMail({ to: requesterEmail, clubName, status: "approved", loginUrl: `${txt(req.headers.get("origin")).replace(/\/+$/, "")}/app/` }).catch(() => null);
    return new Response(JSON.stringify({ ok: true, request_id: requestRow.id, status: "approved", club_id: setupData.club_id || null }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});

