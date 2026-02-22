declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export type ContactPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
  hp_company?: string;
  turnstile_token?: string;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function bad(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
}

export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getClientIp(req: Request) {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  ];
  return candidates.find((v) => v && v.length > 0) || "0.0.0.0";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validatePayload(payload: ContactPayload) {
  const name = String(payload.name || "").trim();
  const email = normalizeEmail(String(payload.email || ""));
  const subject = String(payload.subject || "").trim();
  const message = String(payload.message || "").trim();
  const hp = String(payload.hp_company || "").trim();
  const token = String(payload.turnstile_token || "").trim();

  if (hp) return { ok: false, reason: "bot_detected_honeypot" };
  if (name.length < 2) return { ok: false, reason: "name_too_short" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "invalid_email" };
  if (subject.length < 3) return { ok: false, reason: "subject_too_short" };
  if (message.length < 30) return { ok: false, reason: "message_too_short" };

  const urlCount = (message.match(/https?:\/\/|www\./gi) || []).length;
  const words = message.split(/\s+/).filter(Boolean).length || 1;
  if (urlCount >= Math.max(2, Math.floor(words * 0.7))) return { ok: false, reason: "message_link_only" };

  const spamWords = ["viagra", "casino", "seo", "backlinks", "crypto giveaway", "porn", "loan"];
  const m = message.toLowerCase();
  if (spamWords.some((w) => m.includes(w))) return { ok: false, reason: "message_spam_keyword" };

  if (!token) return { ok: false, reason: "turnstile_token_missing" };

  return { ok: true, cleaned: { name, email, subject, message, token } };
}

export async function verifyTurnstile(token: string, ip?: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY") || "";
  if (!secret) return { ok: false, reason: "turnstile_secret_missing" };
  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  if (ip) params.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: params,
  });
  if (!res.ok) return { ok: false, reason: `turnstile_http_${res.status}` };
  const data = await res.json();
  if (!data?.success) return { ok: false, reason: "turnstile_failed" };
  return { ok: true };
}

export async function sbFetch(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase request failed (${res.status}): ${t}`);
  }
  if (res.status === 204) return null;
  return await res.json().catch(() => null);
}

export async function checkRateLimits(ipHash: string, email: string) {
  const now = new Date();
  const tenMin = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const oneHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDay = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [ip10, ipDay, emailHour] = await Promise.all([
    sbFetch(`/rest/v1/contact_requests?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(tenMin)}`),
    sbFetch(`/rest/v1/contact_requests?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(oneDay)}`),
    sbFetch(`/rest/v1/contact_requests?select=id&email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(oneHour)}`),
  ]);

  const ip10Count = Array.isArray(ip10) ? ip10.length : 0;
  const ipDayCount = Array.isArray(ipDay) ? ipDay.length : 0;
  const emailHourCount = Array.isArray(emailHour) ? emailHour.length : 0;

  if (ip10Count >= 3) return { ok: false, reason: "rate_limit_ip_10m" };
  if (ipDayCount >= 20) return { ok: false, reason: "rate_limit_ip_day" };
  if (emailHourCount >= 3) return { ok: false, reason: "rate_limit_email_hour" };
  return { ok: true };
}

export async function sendConfirmationMail(email: string, name: string, confirmUrl: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("CONTACT_FROM_EMAIL") || "";
  if (!resendKey || !from) {
    return { ok: false, reason: "mail_provider_not_configured" };
  }

  const html = `
    <p>Hallo ${name},</p>
    <p>bitte bestätige deine Kontaktanfrage über diesen Link:</p>
    <p><a href="${confirmUrl}">${confirmUrl}</a></p>
    <p>Der Link ist 24 Stunden gültig.</p>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Bitte Kontaktanfrage bestätigen",
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, reason: `mail_send_failed:${res.status}:${t}` };
  }
  return { ok: true };
}

function escHtml(input: string) {
  return String(input || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export async function sendContactForwardMail(params: {
  to: string;
  requesterName: string;
  requesterEmail: string;
  subject: string;
  message: string;
  requestId: string;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("CONTACT_FROM_EMAIL") || "";
  if (!resendKey || !from) {
    return { ok: false, reason: "mail_provider_not_configured" };
  }

  const html = `
    <h2>Neue bestätigte Kontaktanfrage</h2>
    <p><strong>ID:</strong> ${escHtml(params.requestId)}</p>
    <p><strong>Name:</strong> ${escHtml(params.requesterName)}</p>
    <p><strong>E-Mail:</strong> ${escHtml(params.requesterEmail)}</p>
    <p><strong>Betreff:</strong> ${escHtml(params.subject)}</p>
    <hr />
    <p style="white-space:pre-wrap">${escHtml(params.message)}</p>
  `;

  const text = [
    "Neue bestaetigte Kontaktanfrage",
    `ID: ${params.requestId}`,
    `Name: ${params.requesterName}`,
    `E-Mail: ${params.requesterEmail}`,
    `Betreff: ${params.subject}`,
    "",
    params.message,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: `Kontaktanfrage: ${params.subject}`,
      html,
      text,
      reply_to: params.requesterEmail,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return { ok: false, reason: `mail_send_failed:${res.status}:${t}` };
  }

  return { ok: true };
}
