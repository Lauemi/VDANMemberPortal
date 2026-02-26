;(() => {
  const SESSION_KEY = "vdan_member_session_v1";
  const EXPIRY_SKEW_MS = 30_000;
  const MEMBER_EMAIL_DOMAIN = "members.vdan.local";

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

  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function loadSession() {
    const parsed = loadStoredSession();
    return isValidSession(parsed) ? parsed : null;
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

  function memberNoToEmail(rawMemberNo) {
    const memberNo = String(rawMemberNo || "").trim();
    if (!memberNo) return "";
    const safe = memberNo.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `member_${safe}@${MEMBER_EMAIL_DOMAIN}`.toLowerCase();
  }

  function pageTarget(defaultTarget = "/") {
    const loginForm = document.getElementById("loginForm");
    const pwForm = document.getElementById("passwordChangeForm");
    const direct = String(loginForm?.dataset?.nextTarget || pwForm?.dataset?.nextTarget || "").trim();
    if (direct.startsWith("/")) return direct;
    return defaultTarget;
  }

  async function loginWithPassword(identifier, password) {
    const input = String(identifier || "").trim();
    const email = input.includes("@") ? input.toLowerCase() : memberNoToEmail(input);
    if (!email) {
      throw new Error("Bitte Mitgliedsnummer eingeben.");
    }
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

  async function refreshSession() {
    const stored = loadStoredSession();
    const refreshToken = String(stored?.refresh_token || "").trim();
    if (!refreshToken) return null;

    const res = await sbFetch("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data = await res.json().catch(() => ({}));
    const expiresAt = nowMs() + (Number(data.expires_in || 0) * 1000);
    const session = {
      ...stored,
      ...data,
      user: data?.user || stored?.user || null,
      expiresAt,
    };
    saveSession(session);
    return isValidSession(session) ? session : null;
  }

  async function getOwnProfile() {
    const s = loadSession();
    const uid = s?.user?.id;
    if (!uid) return null;
    const res = await sbFetch(`/rest/v1/profiles?select=id,must_change_password&limit=1&id=eq.${encodeURIComponent(uid)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${s.access_token}` },
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function clearMustChangePasswordFlag() {
    const s = loadSession();
    const uid = s?.user?.id;
    if (!uid) return;
    await sbFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      }),
    });
  }

  async function updatePassword(newPassword) {
    const s = loadSession();
    if (!s?.access_token) throw new Error("Keine aktive Session.");
    const res = await sbFetch("/auth/v1/user", {
      method: "PUT",
      headers: { Authorization: `Bearer ${s.access_token}` },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.msg || err?.error_description || "Passwort konnte nicht geändert werden.");
    }
    await clearMustChangePasswordFlag();
  }

  async function requestPasswordReset(identifier, redirectTo = "") {
    const input = String(identifier || "").trim();
    const email = input.includes("@") ? input.toLowerCase() : memberNoToEmail(input);
    if (!email) throw new Error("Bitte Mitgliedsnummer oder E-Mail eingeben.");
    const body = { email };
    const rt = String(redirectTo || "").trim();
    if (rt) body.redirect_to = rt;
    const res = await sbFetch("/auth/v1/recover", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.msg || err?.error_description || "Reset konnte nicht angefordert werden.");
    }
    return true;
  }

  async function enforcePasswordChangeIfNeeded() {
    const path = String(window.location.pathname || "");
    if (!path.startsWith("/app/")) return;
    if (path.startsWith("/app/passwort-aendern/")) return;
    const p = await getOwnProfile();
    if (p?.must_change_password) {
      const next = encodeURIComponent(path + window.location.search);
      window.location.replace(`/app/passwort-aendern/?next=${next}`);
    }
  }

  async function logout() {
    const session = loadSession() || loadStoredSession();
    if (!session) {
      clearSession();
      return;
    }
    const userId = String(session?.user?.id || "").trim();

    try {
      await sbFetch("/auth/v1/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // ignore
    } finally {
      try {
        await window.VDAN_OFFLINE_STORE?.clearUserData?.(userId);
      } catch {
        // ignore
      }
      clearSession();
    }
  }

  // Expose minimal API
  window.VDAN_AUTH = {
    hasConfig,
    loadSession,
    refreshSession,
    loginWithPassword,
    getOwnProfile,
    updatePassword,
    requestPasswordReset,
    memberNoToEmail,
    logout,
    SESSION_KEY,
  };

  // Login page wiring (if present)
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const passwordForm = document.getElementById("passwordChangeForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const msg = document.getElementById("loginMsg");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await logout();
        if (msg) msg.textContent = "Logout ok.";
        document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: false } }));
      });
    }

    if (!hasConfig()) {
      if (msg) msg.textContent = "Supabase ENV fehlt (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).";
      return;
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (msg) msg.textContent = "…";
        const memberNo = String(
          document.getElementById("loginMemberNo")?.value ||
          document.getElementById("loginEmail")?.value ||
          ""
        ).trim();
        const password = String(document.getElementById("loginPass")?.value || "");
        try {
          await loginWithPassword(memberNo, password);
          const profile = await getOwnProfile();
          if (msg) msg.textContent = "Login ok.";
          document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: true } }));
          const target = pageTarget("/");
          if (profile?.must_change_password) {
            window.location.assign(`/app/passwort-aendern/?next=${encodeURIComponent(target)}`);
            return;
          }
          window.location.assign(target);
        } catch (err) {
          if (msg) msg.textContent = err?.message || "Login fehlgeschlagen";
        }
      });
    }

    if (passwordForm) {
      const msgEl = document.getElementById("passwordChangeMsg");
      passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const p1 = String(document.getElementById("newPassword")?.value || "");
        const p2 = String(document.getElementById("newPasswordRepeat")?.value || "");
        if (p1.length < 8) {
          if (msgEl) msgEl.textContent = "Passwort muss mindestens 8 Zeichen haben.";
          return;
        }
        if (p1 !== p2) {
          if (msgEl) msgEl.textContent = "Passwörter stimmen nicht überein.";
          return;
        }
        try {
          if (msgEl) msgEl.textContent = "Speichere…";
          await updatePassword(p1);
          if (msgEl) msgEl.textContent = "Passwort aktualisiert.";
          const target = pageTarget("/");
          window.location.assign(target);
        } catch (err) {
          if (msgEl) msgEl.textContent = err?.message || "Passwort konnte nicht geändert werden.";
        }
      });
    }

    if (loadSession()) {
      enforcePasswordChangeIfNeeded().catch(() => {});
    }
  });
})();
