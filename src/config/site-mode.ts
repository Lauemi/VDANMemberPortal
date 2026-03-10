export type SiteMode = "vdan" | "fcp";

function normalizeHost(hostname: string): string {
  return String(hostname || "").trim().toLowerCase();
}

export function resolveSiteMode(hostname: string, fallback: SiteMode): SiteMode {
  const host = normalizeHost(hostname);
  if (host.includes("fishing-club-portal.de")) return "fcp";
  if (host.includes("vdan-ottenheim.com")) return "vdan";
  return fallback;
}

