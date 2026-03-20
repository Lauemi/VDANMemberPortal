import { defineMiddleware } from "astro:middleware";
import { isPrelaunchEnabled, isProtectedHost, prelaunchCookieName, verifyAccessToken } from "./lib/fcp-prelaunch";

const ASSET_PREFIXES = ["/_astro/", "/css/", "/js/", "/Branding/", "/Bilder/", "/assets/"];
const ASSET_FILES = ["/favicon.ico", "/manifest.webmanifest", "/robots.txt", "/sitemap-index.xml"];
const DEV_MODE = import.meta.env.DEV;
const SUPABASE_ORIGIN = (() => {
  const raw = String(import.meta.env.PUBLIC_SUPABASE_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

function isAssetPath(pathname: string): boolean {
  if (ASSET_FILES.includes(pathname)) return true;
  if (ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return /\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|webp|ico|map|txt|xml|webmanifest|json)$/i.test(pathname);
}

function isBypassPath(pathname: string): boolean {
  if (pathname.startsWith("/_fcp-access")) return true;
  if (isAssetPath(pathname)) return true;
  return false;
}

function buildCsp(): string {
  const connectSources = [
    "'self'",
    SUPABASE_ORIGIN,
    "https://api.open-meteo.com",
    "https://api.rainviewer.com",
    "https://tilecache.rainviewer.com",
    "https://api.qrserver.com",
  ].filter(Boolean);

  const imgSources = [
    "'self'",
    "data:",
    "blob:",
    "https://api.qrserver.com",
    "https://*.tile.openstreetmap.org",
    "https://tilecache.rainviewer.com",
    "https://www.google.com",
    "https://www.gstatic.com",
  ];

  const frameSources = [
    "'self'",
    "https://www.google.com",
    "https://maps.google.com",
    "https://vdan-vereisnshop.myspreadshop.de",
  ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    `img-src ${imgSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(response: Response, url: URL): Response {
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  if (!DEV_MODE) {
    response.headers.set("Content-Security-Policy", buildCsp());
  }

  if (url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!isPrelaunchEnabled()) {
    const response = await next();
    return applySecurityHeaders(response, context.url);
  }

  const host = String(context.url.hostname || "").trim().toLowerCase();
  if (!isProtectedHost(host)) {
    const response = await next();
    return applySecurityHeaders(response, context.url);
  }

  const pathname = String(context.url.pathname || "/");
  if (context.request.method === "OPTIONS") {
    const response = await next();
    return applySecurityHeaders(response, context.url);
  }
  if (isBypassPath(pathname)) {
    const response = await next();
    return applySecurityHeaders(response, context.url);
  }

  const cookieName = prelaunchCookieName();
  const token = context.cookies.get(cookieName)?.value || "";
  if (verifyAccessToken(token, host)) {
    const response = await next();
    return applySecurityHeaders(response, context.url);
  }

  const redirectTo = new URL("/_fcp-access/", context.url.origin);
  const nextTarget = `${pathname}${context.url.search || ""}`;
  redirectTo.searchParams.set("next", nextTarget);
  return applySecurityHeaders(context.redirect(redirectTo.toString(), 302), context.url);
});
