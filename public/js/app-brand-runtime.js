;(() => {
  function cfg() {
    const body = document.body;
    return {
      url: String(body?.getAttribute("data-supabase-url") || "").trim().replace(/\/+$/, ""),
      key: String(body?.getAttribute("data-supabase-key") || "").trim(),
    };
  }

  function normalizeRoute(pathname) {
    const raw = String(pathname || "").trim();
    if (!raw) return "/";
    return (raw.replace(/\/+$/, "") || "/");
  }

  function siteMode() {
    return String(document.body?.getAttribute("data-site-mode") || "").trim().toLowerCase() === "vdan" ? "vdan" : "fcp";
  }

  function isLocalDev() {
    const host = String(window.location.hostname || "").trim().toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  }

  async function loadConfig() {
    const { url } = cfg();
    if (!url || isLocalDev()) return null;
    const params = new URLSearchParams({ action: "get", scope: siteMode() });
    const res = await fetch(`${url}/functions/v1/admin-web-config?${params.toString()}`, {
      method: "GET",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return data;
  }

  function applyTheme(brand) {
    const safe = String(brand || "").trim().toLowerCase();
    const theme = safe === "vdan_default" || safe === "fcp_brand" ? safe : "fcp_tactical";
    document.body?.setAttribute("data-app-theme", theme);
    document.body?.setAttribute("data-app-brand-runtime-source", "remote");
  }

  async function init() {
    if (!String(window.location.pathname || "").startsWith("/app/")) return;
    const data = await loadConfig().catch(() => null);
    const matrix = data?.app_mask_matrix && typeof data.app_mask_matrix === "object" ? data.app_mask_matrix : null;
    if (!matrix) return;
    const route = normalizeRoute(window.location.pathname);
    const match = matrix[route];
    if (!match) return;
    applyTheme(match);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
