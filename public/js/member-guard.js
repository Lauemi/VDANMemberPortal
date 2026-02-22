;(() => {
  const ADMIN_PATHS = ["/app/mitglieder/", "/app/fangliste/cockpit/"];
  const MANAGER_PATHS = [
    "/app/dokumente/",
    "/app/bewerbungen/",
    "/app/arbeitseinsaetze/cockpit/",
    "/app/termine/cockpit/",
    "/app/sitzungen/",
    "/app/ausweis/verifizieren/",
  ];

  function onReady(fn){ if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function currentPath() {
    const p = String(window.location.pathname || "/").toLowerCase();
    return p.endsWith("/") ? p : `${p}/`;
  }

  function needsAdmin(path) {
    return ADMIN_PATHS.some((x) => path.startsWith(x));
  }

  function needsManager(path) {
    return MANAGER_PATHS.some((x) => path.startsWith(x));
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    const token = window.VDAN_AUTH?.loadSession?.()?.access_token;
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json().catch(() => ({}));
  }

  async function loadRoles() {
    const uid = window.VDAN_AUTH?.loadSession?.()?.user?.id;
    if (!uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  function forbid() {
    window.location.replace("/app/?forbidden=1");
  }

  onReady(() => {
    const run = async () => {
      const { VDAN_AUTH } = window;
      if (!VDAN_AUTH?.loadSession) return;
      const path = currentPath();
      const session = VDAN_AUTH.loadSession();
      if (!session) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login/?next=${next}`);
        return;
      }

      if (!needsAdmin(path) && !needsManager(path)) return;

      const roles = await loadRoles().catch(() => []);
      const isAdmin = roles.includes("admin");
      const isManager = isAdmin || roles.includes("vorstand");

      if (needsAdmin(path) && !isAdmin) {
        forbid();
        return;
      }

      if (needsManager(path) && !isManager) {
        forbid();
        return;
      }

    };

    run().catch(() => {
      forbid();
    });
  });
})();
