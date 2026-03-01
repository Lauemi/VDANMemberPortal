;(() => {
  const ADMIN_PATHS = ["/app/mitglieder/", "/app/fangliste/cockpit/", "/app/lizenzen/"];
  const MANAGER_PATHS = [
    "/app/dokumente/",
    "/app/bewerbungen/",
    "/app/arbeitseinsaetze/cockpit/",
    "/app/termine/cockpit/",
    "/app/sitzungen/",
    "/app/ausweis/verifizieren/",
  ];
  const MEMBER_ALWAYS_PATHS = ["/app/einstellungen/"];

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

  function needsMemberOnly(path) {
    return MEMBER_ALWAYS_PATHS.some((x) => path.startsWith(x));
  }

  function allowOfflineWithoutSession(path) {
    if (path.startsWith("/app/fangliste/") && !path.startsWith("/app/fangliste/cockpit/")) return true;
    if (path.startsWith("/app/arbeitseinsaetze/")) return true;
    if (path.startsWith("/app/zustaendigkeiten/")) return true;
    return false;
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
      let session = VDAN_AUTH.loadSession();
      if (!session && navigator.onLine && VDAN_AUTH.refreshSession) {
        session = await VDAN_AUTH.refreshSession().catch(() => null);
      }
      if (!session) {
        if (!navigator.onLine && allowOfflineWithoutSession(path)) {
          return;
        }
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login/?next=${next}`);
        return;
      }

      if (needsMemberOnly(path)) return;
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
      const path = currentPath();
      if (needsAdmin(path) || needsManager(path)) {
        forbid();
        return;
      }
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login/?next=${next}`);
    });
  });
})();
