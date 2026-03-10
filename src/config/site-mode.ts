export type SiteMode = "vdan" | "fcp";

function normalizeHost(hostname: string): string {
  return String(hostname || "").trim().toLowerCase();
}

function normalizeFallbackMode(fallback: unknown): SiteMode {
  const mode = String(fallback || "").trim().toLowerCase();
  return mode === "fcp" ? "fcp" : "vdan";
}

export function resolveSiteMode(hostname: string, fallback: unknown): SiteMode {
  const host = normalizeHost(hostname);
  if (host.includes("fishing-club-portal.de")) return "fcp";
  if (host.includes("vdan-ottenheim.com")) return "vdan";
  return normalizeFallbackMode(fallback);
}
