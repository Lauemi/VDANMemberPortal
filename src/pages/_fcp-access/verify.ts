import type { APIRoute } from "astro";
import { isPrelaunchEnabled, isProtectedHost, issueAccessToken, prelaunchCookieName, verifyPassword } from "../../lib/fcp-prelaunch";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeNext(raw: string): string {
  const value = String(raw || "").trim();
  return value.startsWith("/") ? value : "/";
}

export const prerender = false;

export const POST: APIRoute = async ({ request, url, cookies, redirect }) => {
  if (!isPrelaunchEnabled()) return redirect("/", 302);
  const host = String(url.hostname || "").trim().toLowerCase();
  if (!isProtectedHost(host)) return redirect("/", 302);

  const form = await request.formData().catch(() => null);
  const password = String(form?.get("password") || "");
  const next = safeNext(String(form?.get("next") || "/"));

  if (!verifyPassword(password)) {
    // Minimal brute-force friction for prelaunch guard.
    await wait(600);
    const back = new URL("/_fcp-access/", url.origin);
    back.searchParams.set("error", "1");
    back.searchParams.set("next", next);
    return redirect(back.toString(), 302);
  }

  const token = issueAccessToken(host);
  const cookieName = prelaunchCookieName();
  const isProd = import.meta.env.PROD;
  cookies.set(cookieName, token, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
  });

  return redirect(next, 302);
};
