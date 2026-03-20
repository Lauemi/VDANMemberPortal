import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

/**
 * VDAN APP — Standard Template
 * - static output (works on shared hosting like IONOS)
 * - member area protected by Supabase Auth + RLS
 */
const isVercelRuntime = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const forceServerOutput = process.env.FORCE_SERVER_OUTPUT === "1" || process.env.FORCE_SERVER_OUTPUT === "true";
const useServerOutput = isVercelRuntime || forceServerOutput;
const normalizedSiteMode = String(process.env.PUBLIC_SITE_MODE || "").trim().toLowerCase();
const isFcpSiteMode = normalizedSiteMode === "fcp" || normalizedSiteMode === "fcp_brand";
const publicSiteUrl = process.env.PUBLIC_SITE_URL?.trim()
  || process.env.FCP_PLATFORM_URL?.trim()
  || (isFcpSiteMode ? "https://www.fishing-club-portal.de" : "https://www.vdan-ottenheim.com");

export default defineConfig({
  site: publicSiteUrl,
  trailingSlash: "always",
  output: useServerOutput ? "server" : "static",
  adapter: useServerOutput ? vercel() : undefined,
  integrations: [sitemap()],
  server: { host: "127.0.0.1", port: 4321 },
});
