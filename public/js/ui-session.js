;(() => {
  let touchTimer = null;

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function sb(path, withAuth = false, method = "GET", body = null) {
    const { url, key } = cfg();
    if (!url || !key) return [];
    const headers = new Headers();
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    const res = await fetch(`${url}${path}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }

  async function loadRoles() {
    const uid = session()?.user?.id;
    if (!uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, true);
    return rows.map((r) => String(r.role || "").toLowerCase());
  }

  async function loadFlags() {
    try {
      const rows = await sb("/rest/v1/feature_flags?select=key,enabled&key=eq.work_qr_enabled", true);
      const flags = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        if (r?.key) flags[r.key] = Boolean(r.enabled);
      });
      return flags;
    } catch {
      return {};
    }
  }

  async function touchUserPresence() {
    if (!session()?.access_token) return;
    await sb("/rest/v1/rpc/rpc_touch_user", true, "POST", {}).catch(() => []);
  }

  function startPresenceTicker() {
    if (touchTimer) {
      clearInterval(touchTimer);
      touchTimer = null;
    }
    if (!session()?.access_token) return;
    touchUserPresence().catch(() => {});
    touchTimer = setInterval(() => {
      if (!document.hidden) touchUserPresence().catch(() => {});
    }, 60 * 1000);
  }

  function setNavState(loggedIn){
    document.querySelectorAll("[data-member-only]").forEach((el) => {
      el.classList.toggle("hidden", !loggedIn);
      el.toggleAttribute("hidden", !loggedIn);
    });
    document.querySelectorAll("[data-guest-only]").forEach((el) => {
      el.classList.toggle("hidden", loggedIn);
      el.toggleAttribute("hidden", loggedIn);
    });
  }

  function setManagerState(isManager) {
    document.querySelectorAll("[data-manager-only]").forEach((el) => {
      el.classList.toggle("hidden", !isManager);
      el.toggleAttribute("hidden", !isManager);
    });
  }

  function setAdminState(isAdmin) {
    document.querySelectorAll("[data-admin-only]").forEach((el) => {
      el.classList.toggle("hidden", !isAdmin);
      el.toggleAttribute("hidden", !isAdmin);
    });
  }

  function setFeatureState(featureKey, enabled) {
    document.querySelectorAll(`[data-feature-${featureKey}]`).forEach((el) => {
      el.classList.toggle("hidden", !enabled);
      el.toggleAttribute("hidden", !enabled);
    });
  }

  async function init(){
    const loggedIn = Boolean(window.VDAN_AUTH?.loadSession?.());
    setNavState(loggedIn);
    if (!loggedIn) {
      if (touchTimer) {
        clearInterval(touchTimer);
        touchTimer = null;
      }
      setManagerState(false);
      setAdminState(false);
      setFeatureState("work-qr", false);
      return;
    }
    startPresenceTicker();
    const roles = await loadRoles().catch(() => []);
    const isManager = roles.includes("admin") || roles.includes("vorstand");
    const isAdmin = roles.includes("admin");
    setManagerState(isManager);
    setAdminState(isAdmin);

    if (!isManager) {
      setFeatureState("work-qr", false);
      return;
    }
    const flags = await loadFlags().catch(() => ({}));
    setFeatureState("work-qr", Boolean(flags.work_qr_enabled));
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) touchUserPresence().catch(() => {});
  });
})();
