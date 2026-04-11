import { cors, sbFetch } from "../_shared/contact-utils.ts";

type NotificationMessage = {
  id: string;
  channel: string;
  recipient_email: string | null;
  template_key: string | null;
  title: string | null;
  body: string | null;
  payload_json: {
    subject?: string;
    html?: string;
    text?: string;
    [key: string]: unknown;
  } | null;
};

const DEFAULT_FROM = "Fishing Club Portal <no-reply@mail.fishing-club-portal.de>";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function respond(headers: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function buildSubject(message: NotificationMessage) {
  const payloadSubject = text(message.payload_json?.subject);
  const title = text(message.title);
  const templateKey = text(message.template_key);
  return payloadSubject || title || templateKey || "Fishing Club Portal";
}

function buildHtml(message: NotificationMessage) {
  const payloadHtml = text(message.payload_json?.html);
  const body = text(message.body);
  if (payloadHtml) return payloadHtml;
  if (!body) return "";
  return `<pre style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace; white-space:pre-wrap">${body}</pre>`;
}

async function fetchPendingMessages(nowIso: string) {
  const query = new URLSearchParams({
    select: "id,channel,recipient_email,template_key,title,body,payload_json",
    status: "eq.pending",
    channel: "eq.email",
    order: "scheduled_at.asc.nullsfirst,created_at.asc",
    limit: "50",
    or: `(scheduled_at.is.null,scheduled_at.lte.${nowIso})`,
  });

  const result = await sbFetch(`/rest/v1/notification_messages?${query.toString()}`, { method: "GET" });
  return Array.isArray(result) ? result as NotificationMessage[] : [];
}

async function markSent(messageId: string, resendId: string) {
  await sbFetch("/rest/v1/rpc/mark_notification_sent", {
    method: "POST",
    body: JSON.stringify({
      p_message_id: messageId,
      p_resend_id: resendId,
      p_channel: "email",
    }),
  });
}

async function markFailed(messageId: string, errorText: string) {
  await sbFetch("/rest/v1/rpc/mark_notification_failed", {
    method: "POST",
    body: JSON.stringify({
      p_message_id: messageId,
      p_error_text: errorText.slice(0, 1000),
      p_channel: "email",
    }),
  });
}

async function sendMessage(message: NotificationMessage, resendKey: string, fromAddress: string) {
  const recipient = text(message.recipient_email);
  if (!recipient) throw new Error("recipient_email_missing");

  const subject = buildSubject(message);
  const html = buildHtml(message);
  if (!html) throw new Error("html_body_missing");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [recipient],
      subject,
      html,
      text: text(message.payload_json?.text) || text(message.body) || undefined,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object" ? JSON.stringify(payload) : response.statusText;
    throw new Error(`resend_${response.status}:${detail}`);
  }

  return text((payload as { id?: string } | null)?.id) || "unknown";
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST" && req.method !== "GET") {
    return respond(headers, { ok: false, error: "method_not_allowed" }, 405);
  }

  const resendKey = text(Deno.env.get("RESEND_API_KEY"));
  if (!resendKey) {
    return respond(headers, { ok: false, error: "resend_api_key_missing" }, 500);
  }

  const fromAddress = text(Deno.env.get("CONTACT_FROM_EMAIL")) || DEFAULT_FROM;
  const nowIso = new Date().toISOString();

  try {
    const pending = await fetchPendingMessages(nowIso);
    let sent = 0;
    let failed = 0;

    for (const message of pending) {
      try {
        const resendId = await sendMessage(message, resendKey, fromAddress);
        await markSent(message.id, resendId);
        sent += 1;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        await markFailed(message.id, messageText);
        failed += 1;
      }
    }

    return respond(headers, {
      ok: true,
      processed: pending.length,
      sent,
      failed,
      remaining_open: Math.max(0, pending.length - sent - failed),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return respond(headers, { ok: false, error: message }, 500);
  }
});
