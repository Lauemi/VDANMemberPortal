import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/**
 * VDAN APP — Standard Template
 * - static output (works on shared hosting like IONOS)
 * - member area protected by Supabase Auth + RLS
 */
export default defineConfig({
  site: "https://www.vdan-ottenheim.com", // TODO: set your domain
  trailingSlash: "always",
  output: "static",
  integrations: [sitemap()],
  server: { host: "127.0.0.1", port: 4321 },
});
