import { defineMiddleware } from "astro:middleware";
import { isPrelaunchEnabled, isProtectedHost, prelaunchCookieName, verifyAccessToken } from "./lib/fcp-prelaunch";

const ASSET_PREFIXES = ["/_astro/", "/css/", "/js/", "/Branding/", "/Bilder/", "/assets/"];
const ASSET_FILES = ["/favicon.ico", "/manifest.webmanifest", "/robots.txt", "/sitemap-index.xml"];

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

export const onRequest = defineMiddleware(async (context, next) => {
  if (!isPrelaunchEnabled()) return next();

  const host = String(context.url.hostname || "").trim().toLowerCase();
  if (!isProtectedHost(host)) return next();

  const pathname = String(context.url.pathname || "/");
  if (context.request.method === "OPTIONS") return next();
  if (isBypassPath(pathname)) return next();

  const cookieName = prelaunchCookieName();
  const token = context.cookies.get(cookieName)?.value || "";
  if (verifyAccessToken(token, host)) return next();

  const redirectTo = new URL("/_fcp-access/", context.url.origin);
  const nextTarget = `${pathname}${context.url.search || ""}`;
  redirectTo.searchParams.set("next", nextTarget);
  return context.redirect(redirectTo.toString(), 302);
});
