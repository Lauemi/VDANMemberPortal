;(() => {
  const SESSION_KEY = "vdan_member_session_v1";
  const EXPIRY_SKEW_MS = 30_000;

  function cfg() {
    const url = String(window.__APP_SUPABASE_URL || "").trim();
    const key = String(window.__APP_SUPABASE_KEY || "").trim();
    return { url, key };
  }

  function hasConfig() {
    const { url, key } = cfg();
    return Boolean(url && key);
  }

  function nowMs() {
    return Date.now();
  }

  function isValidSession(session) {
    if (!session || typeof session !== "object") return false;
    const expiresAt = Number(session.expiresAt);
    if (!Number.isFinite(expiresAt)) return false;
    return (expiresAt - EXPIRY_SKEW_MS) > nowMs() && Boolean(session.access_token);
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isValidSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveSession(payload) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function sbFetch(path, init) {
    const { url, key } = cfg();
    const full = `${url.replace(/\/+$/,"")}${path}`;
    const headers = new Headers(init?.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    return fetch(full, { ...init, headers });
  }

  async function loginWithPassword(email, password) {
    const res = await sbFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error_description || err?.msg || "Login fehlgeschlagen");
    }

    const data = await res.json();
    // Supabase returns expires_in (seconds)
    const expiresAt = nowMs() + (Number(data.expires_in || 0) * 1000);
    const session = { ...data, expiresAt };
    saveSession(session);
    return session;
  }

  async function logout() {
    const session = loadSession();
    if (!session) return;

    try {
      await sbFetch("/auth/v1/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // ignore
    } finally {
      clearSession();
    }
  }

  // Expose minimal API
  window.VDAN_AUTH = {
    hasConfig,
    loadSession,
    loginWithPassword,
    logout,
    SESSION_KEY,
  };

  // Login page wiring (if present)
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const msg = document.getElementById("loginMsg");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await logout();
        if (msg) msg.textContent = "Logout ok.";
        document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: false } }));
      });
    }

    if (!form) return;

    if (!hasConfig()) {
      if (msg) msg.textContent = "Supabase ENV fehlt (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).";
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (msg) msg.textContent = "…";
      const email = String(document.getElementById("loginEmail")?.value || "").trim();
      const password = String(document.getElementById("loginPass")?.value || "");
      try {
        await loginWithPassword(email, password);
        if (msg) msg.textContent = "Login ok.";
        document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: true } }));
        const target = String(window.__APP_AFTER_LOGIN || "/app/");
        window.location.assign(target);
      } catch (err) {
        if (msg) msg.textContent = err?.message || "Login fehlgeschlagen";
      }
    });
  });
})();
