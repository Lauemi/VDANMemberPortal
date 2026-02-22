import { cors, sbFetch, sendContactForwardMail, sha256Hex } from "../_shared/contact-utils.ts";

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers });

  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") || "").trim();
    if (!token) return new Response("Fehlender Token", { status: 400, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
    const tokenHash = await sha256Hex(token);

    const rows = await sbFetch(
      `/rest/v1/contact_requests?select=id,status,confirm_expires_at,name,email,subject,message&confirm_token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`,
      { method: "GET" },
    ) as Array<{
      id: string;
      status: string;
      confirm_expires_at: string | null;
      name: string | null;
      email: string | null;
      subject: string | null;
      message: string | null;
    }>;

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return new Response("Ungültiger Bestätigungslink.", { status: 400, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });

    if (row.status !== "pending") {
      return new Response("Anfrage wurde bereits verarbeitet.", { status: 200, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
    }

    if (!row.confirm_expires_at || new Date(row.confirm_expires_at).getTime() < Date.now()) {
      await sbFetch(`/rest/v1/contact_requests?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          rejection_reason: "confirmation_expired",
        }),
      });
      return new Response("Bestätigungslink abgelaufen.", { status: 400, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
    }

    await sbFetch(`/rest/v1/contact_requests?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "confirmed",
        email_verified: true,
        confirmed_at: new Date().toISOString(),
      }),
    });

    const notifyTo = (Deno.env.get("CONTACT_NOTIFY_EMAIL") || "m.lauenroth@lauemi.de").trim().toLowerCase();
    const forward = await sendContactForwardMail({
      to: notifyTo,
      requesterName: String(row.name || "").trim() || "Unbekannt",
      requesterEmail: String(row.email || "").trim() || "unknown@example.invalid",
      subject: String(row.subject || "").trim() || "(ohne Betreff)",
      message: String(row.message || "").trim() || "",
      requestId: row.id,
    });

    if (!forward.ok) {
      await sbFetch(`/rest/v1/contact_requests?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          rejection_reason: forward.reason,
        }),
      });
      return new Response("Bestätigt, aber Weiterleitung per E-Mail fehlgeschlagen.", {
        status: 500,
        headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    await sbFetch(`/rest/v1/contact_requests?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "sent",
      }),
    });

    const notifyWebhook = Deno.env.get("CONTACT_NOTIFY_WEBHOOK");
    if (notifyWebhook) {
      await fetch(notifyWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_request_id: row.id, status: "confirmed" }),
      }).catch(() => null);
    }

    return new Response("Danke. Deine Kontaktanfrage wurde bestätigt.", {
      status: 200,
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new Response("Bestätigung fehlgeschlagen.", { status: 500, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }
});
