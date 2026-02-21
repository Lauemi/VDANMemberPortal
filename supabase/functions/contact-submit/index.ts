import {
  bad,
  checkRateLimits,
  ContactPayload,
  cors,
  getClientIp,
  json,
  normalizeEmail,
  sbFetch,
  sendConfirmationMail,
  sha256Hex,
  validatePayload,
  verifyTurnstile,
} from "../_shared/contact-utils.ts";

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const payload = (await req.json().catch(() => ({}))) as ContactPayload;
    const v = validatePayload(payload);
    if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.reason }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });

    const cleaned = v.cleaned!;
    const ip = getClientIp(req);
    const salt = Deno.env.get("IP_HASH_SALT") || "";
    if (!salt) return new Response(JSON.stringify({ ok: false, error: "server_ip_hash_salt_missing" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
    const ipHash = await sha256Hex(`${salt}:${ip}`);

    const turnstile = await verifyTurnstile(cleaned.token, ip);
    if (!turnstile.ok) return new Response(JSON.stringify({ ok: false, error: turnstile.reason }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });

    const limits = await checkRateLimits(ipHash, cleaned.email);
    if (!limits.ok) return new Response(JSON.stringify({ ok: false, error: limits.reason }), { status: 429, headers: { ...headers, "Content-Type": "application/json" } });

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const inserted = await sbFetch("/rest/v1/contact_requests?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ip_hash: ipHash,
        user_agent: req.headers.get("user-agent") || null,
        email: normalizeEmail(cleaned.email),
        name: cleaned.name,
        subject: cleaned.subject,
        message: cleaned.message,
        turnstile_verified: true,
        email_verified: false,
        status: "pending",
        honeypot_triggered: false,
        spam_score: 0,
        confirm_token_hash: tokenHash,
        confirm_expires_at: expiresAt,
      }),
    }) as Array<{ id: string }> | null;

    const rowId = Array.isArray(inserted) && inserted[0]?.id ? inserted[0].id : null;
    if (!rowId) return new Response(JSON.stringify({ ok: false, error: "insert_failed" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });

    const confirmBase = Deno.env.get("CONTACT_CONFIRM_BASE_URL") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/contact-confirm`;
    const confirmUrl = `${confirmBase}?token=${encodeURIComponent(token)}`;
    const mailResult = await sendConfirmationMail(cleaned.email, cleaned.name, confirmUrl);

    if (!mailResult.ok) {
      await sbFetch(`/rest/v1/contact_requests?id=eq.${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          rejection_reason: mailResult.reason,
        }),
      });
      return new Response(JSON.stringify({ ok: false, error: "mail_confirmation_failed" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

