import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

const COOKIE_DEFAULT = "fcp_prelaunch";
const TTL_SECONDS_DEFAULT = 60 * 60 * 12; // 12h

function envText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function isPrelaunchEnabled(): boolean {
  return envText(import.meta.env.FCP_PRELAUNCH_ENABLED, "false").toLowerCase() === "true";
}

export function prelaunchCookieName(): string {
  return envText(import.meta.env.FCP_PRELAUNCH_COOKIE_NAME, COOKIE_DEFAULT);
}

function cookieSecret(): string {
  return envText(import.meta.env.FCP_PRELAUNCH_COOKIE_SECRET, "");
}

export function allowedHosts(): string[] {
  return envText(import.meta.env.FCP_PRELAUNCH_ALLOWED_HOSTS, "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function isProtectedHost(hostname: string): boolean {
  const host = String(hostname || "").trim().toLowerCase();
  const hosts = allowedHosts();
  // Fail-closed: if guard is enabled but host list is missing,
  // protect all hosts instead of silently allowing access.
  if (hosts.length === 0) return true;
  return hosts.includes(host);
}

function sign(input: string): string {
  const secret = cookieSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function encodePayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): Record<string, unknown> | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function issueAccessToken(host: string, ttlSeconds = TTL_SECONDS_DEFAULT): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = encodePayload({ host, exp, v: 1 });
  const sig = sign(payload);
  if (!sig) return "";
  return `${payload}.${sig}`;
}

export function verifyAccessToken(token: string, host: string): boolean {
  const raw = String(token || "").trim();
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return false;
  const expectedSig = sign(payload);
  if (!expectedSig || !safeEqual(signature, expectedSig)) return false;
  const decoded = decodePayload(payload);
  if (!decoded) return false;
  const exp = Number(decoded.exp || 0);
  const tokenHost = String(decoded.host || "").trim().toLowerCase();
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  if (tokenHost !== String(host || "").trim().toLowerCase()) return false;
  return true;
}

// Expected format:
// scrypt$<saltBase64url>$<hashBase64url>
export function verifyPassword(rawPassword: string): boolean {
  const stored = envText(import.meta.env.FCP_PRELAUNCH_PASSWORD_HASH, "");
  const password = String(rawPassword || "");
  if (!stored || !password) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const saltB64 = parts[1];
  const hashB64 = parts[2];
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expectedHash = Buffer.from(hashB64, "base64url");
    const derived = scryptSync(password, salt, expectedHash.length);
    return timingSafeEqual(derived, expectedHash);
  } catch {
    return false;
  }
}
