;(() => {
  const SESSION_KEY = "vdan_member_session_v1";
  const INVITE_PENDING_KEY = "vdan_invite_claim_pending_v1";
  const EXPIRY_SKEW_MS = 30_000;
  const MEMBER_EMAIL_DOMAIN = "members.vdan.local";
  const DEFAULT_MEMBER_HOME = "/app/einstellungen/";
  const DEFAULT_CORE_HOME = "/app/";

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

  function parseUrlAuthPayload() {
    const hashRaw = String(window.location.hash || "").replace(/^#/, "");
    const hash = new URLSearchParams(hashRaw);
    const query = new URLSearchParams(window.location.search || "");
    const pick = (key) => {
      const h = String(hash.get(key) || "").trim();
      if (h) return h;
      return String(query.get(key) || "").trim();
    };
    return {
      access_token: pick("access_token"),
      refresh_token: pick("refresh_token"),
      token_type: pick("token_type"),
      type: pick("type"),
      expires_in: Number(pick("expires_in") || 0),
      error: pick("error"),
      error_code: pick("error_code"),
      error_description: pick("error_description"),
    };
  }

  function clearUrlAuthPayload() {
    const clean = `${window.location.pathname}${window.location.search}`;
    if (window.location.hash) window.history.replaceState({}, "", clean);
  }

  async function sbFetch(path, init) {
    const { url, key } = cfg();
    const full = `${url.replace(/\/+$/,"")}${path}`;
    const headers = new Headers(init?.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    return fetch(full, { ...init, headers });
  }

  async function callEdgeFunction(functionName, payload = {}, accessToken = "") {
    const { url, key } = cfg();
    const endpoint = `${url.replace(/\/+$/,"")}/functions/v1/${functionName}`;
    const headers = new Headers({
      apikey: key,
      "Content-Type": "application/json",
    });
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `function_${functionName}_failed_${res.status}`));
    }
    return data;
  }

  function memberNoToEmail(rawMemberNo) {
    const memberNo = String(rawMemberNo || "").trim();
    if (!memberNo) return "";
    const safe = memberNo.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `member_${safe}@${MEMBER_EMAIL_DOMAIN}`.toLowerCase();
  }

  function isOpenSelfRegistrationEnabled() {
    return Boolean(window.__APP_OPEN_SELF_REGISTRATION_ENABLED === true);
  }

  function isLikelyEmail(value) {
    return String(value || "").includes("@");
  }

  function isLegacyMemberLoginAllowed() {
    return window.__APP_AUTH_ALLOW_LEGACY_MEMBER_LOGIN !== false;
  }

  function isVdanSiteMode() {
    return String(window.__APP_SITE_MODE || "").trim().toLowerCase() === "vdan";
  }

  function pageTarget(defaultTarget = "/") {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const pwForm = document.getElementById("passwordChangeForm");
    const direct = String(loginForm?.dataset?.nextTarget || registerForm?.dataset?.nextTarget || pwForm?.dataset?.nextTarget || "").trim();
    if (direct.startsWith("/")) return direct;
    return defaultTarget;
  }

  function postAuthTarget(defaultTarget = DEFAULT_CORE_HOME) {
    const target = pageTarget(defaultTarget);
    // VDAN surface always enters the same FCP core flow after auth.
    if (isVdanSiteMode()) return DEFAULT_CORE_HOME;
    return target;
  }

  function readPendingInvite() {
    try {
      const raw = localStorage.getItem(INVITE_PENDING_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        invite_token: String(parsed.invite_token || "").trim(),
        member_no: String(parsed.member_no || "").trim().toUpperCase(),
        first_name: String(parsed.first_name || "").trim(),
        last_name: String(parsed.last_name || "").trim(),
      };
    } catch {
      return null;
    }
  }

  function writePendingInvite(data) {
    localStorage.setItem(INVITE_PENDING_KEY, JSON.stringify({
      invite_token: String(data?.invite_token || "").trim(),
      member_no: String(data?.member_no || "").trim().toUpperCase(),
      first_name: String(data?.first_name || "").trim(),
      last_name: String(data?.last_name || "").trim(),
      saved_at: new Date().toISOString(),
    }));
  }

  function clearPendingInvite() {
    localStorage.removeItem(INVITE_PENDING_KEY);
  }

  async function verifyInviteToken(inviteToken) {
    return callEdgeFunction("club-invite-verify", { invite_token: String(inviteToken || "").trim() });
  }

  function normalizeMemberNo(raw) {
    return String(raw || "").trim().toUpperCase();
  }

  function extractInviteMemberNo(verifyPayload = {}) {
    const direct = normalizeMemberNo(verifyPayload?.member_no);
    if (direct) return direct;
    const nested = normalizeMemberNo(verifyPayload?.member?.member_no);
    if (nested) return nested;
    const alt = normalizeMemberNo(verifyPayload?.invite?.member_no);
    return alt;
  }

  async function claimInviteToken(claimPayload, accessToken) {
    const token = String(accessToken || "").trim();
    if (!token) throw new Error("login_required_for_invite_claim");
    const inviteToken = String(claimPayload?.invite_token || "").trim();
    const memberNo = String(claimPayload?.member_no || "").trim().toUpperCase();
    if (!inviteToken) throw new Error("invite_claim_payload_invalid");
    return callEdgeFunction("club-invite-claim", {
      invite_token: inviteToken,
      member_no: memberNo,
      first_name: String(claimPayload?.first_name || "").trim(),
      last_name: String(claimPayload?.last_name || "").trim(),
    }, token);
  }

  async function claimPendingInviteIfPresent(accessToken = "") {
    const pending = readPendingInvite();
    if (!pending?.invite_token) return null;
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;
    const claimed = await claimInviteToken(pending, token);
    clearPendingInvite();
    return claimed;
  }

  async function ensureProfileBootstrap(accessToken = "", payload = {}) {
    let token = String(accessToken || "").trim();
    if (!token) {
      const refreshed = await refreshSession().catch(() => null);
      token = String(refreshed?.access_token || loadSession()?.access_token || "").trim();
    }
    if (!token) return null;
    try {
      return await callEdgeFunction("profile-bootstrap", {
        preferred_member_no: String(payload?.preferred_member_no || "").trim(),
        first_name: String(payload?.first_name || "").trim(),
        last_name: String(payload?.last_name || "").trim(),
      }, token);
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("unauthorized") || msg.includes("401")) {
        const refreshed = await refreshSession().catch(() => null);
        const retryToken = String(refreshed?.access_token || loadSession()?.access_token || "").trim();
        if (retryToken) {
          return callEdgeFunction("profile-bootstrap", {
            preferred_member_no: String(payload?.preferred_member_no || "").trim(),
            first_name: String(payload?.first_name || "").trim(),
            last_name: String(payload?.last_name || "").trim(),
          }, retryToken).catch(() => null);
        }
      }
      return null;
    }
  }

  async function loginWithPassword(identifier, password) {
    const input = String(identifier || "").trim();
    let email = "";
    if (input.includes("@")) {
      email = input.toLowerCase();
    } else {
      if (!isLegacyMemberLoginAllowed()) {
        throw new Error("Login mit Mitgliedsnummer ist deaktiviert. Bitte Auth-E-Mail verwenden.");
      }
      email = memberNoToEmail(input);
    }
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

  async function signUpWithPassword(emailRaw, password, metadata = {}) {
    const email = String(emailRaw || "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Bitte eine gültige E-Mail eingeben.");
    if (String(password || "").length < 8) throw new Error("Passwort muss mindestens 8 Zeichen haben.");

    const res = await sbFetch("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        data: metadata || {},
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.msg || err?.error_description || "Registrierung fehlgeschlagen");
    }

    const data = await res.json().catch(() => ({}));
    if (data?.access_token && Number(data?.expires_in || 0) > 0) {
      const expiresAt = nowMs() + (Number(data.expires_in || 0) * 1000);
      saveSession({ ...data, expiresAt }, true);
    }
    return data;
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
    let email = "";
    if (input.includes("@")) {
      email = input.toLowerCase();
    } else {
      if (!isLegacyMemberLoginAllowed()) {
        throw new Error("Passwort-Reset mit Mitgliedsnummer ist deaktiviert. Bitte Auth-E-Mail verwenden.");
      }
      email = memberNoToEmail(input);
    }
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

  async function consumeAuthCallbackFromUrl({ clearUrl = true } = {}) {
    const payload = parseUrlAuthPayload();
    if (!payload.access_token && !payload.refresh_token && !payload.error) return null;

    if (payload.error) {
      if (clearUrl) clearUrlAuthPayload();
      return {
        ok: false,
        error: payload.error,
        error_code: payload.error_code,
        error_description: payload.error_description,
        type: payload.type || "",
      };
    }

    if (!payload.access_token) {
      if (clearUrl) clearUrlAuthPayload();
      return {
        ok: false,
        error: "invalid_callback_payload",
        error_code: "missing_access_token",
        error_description: "Access token fehlt im Callback.",
        type: payload.type || "",
      };
    }

    const base = loadStoredSession() || {};
    const expiresIn = Number(payload.expires_in || 3600);
    const expiresAt = nowMs() + (expiresIn * 1000);
    const nextSession = {
      ...base,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || base.refresh_token || "",
      token_type: payload.token_type || base.token_type || "bearer",
      expires_in: expiresIn,
      expiresAt,
    };
    saveSession(nextSession);

    // Refresh user object for follow-up flows (password change, invite claim, guards).
    const active = await refreshSession().catch(() => null);
    const finalSession = active || loadSession() || nextSession;

    if (clearUrl) clearUrlAuthPayload();

    return {
      ok: true,
      type: payload.type || "",
      session: finalSession,
    };
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

  async function loadIdentityGateState(accessToken = "") {
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;
    const res = await sbFetch("/rest/v1/rpc/identity_dialog_gate_state", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  async function enforceIdentityVerificationIfNeeded(accessToken = "", redirectTarget = "") {
    const path = String(window.location.pathname || "");
    if (!path.startsWith("/app/")) return false;
    if (path.startsWith("/app/passwort-aendern/")) return false;
    if (path.startsWith("/app/zugang-pruefen/")) return false;

    const gate = await loadIdentityGateState(accessToken);
    const force = Boolean(gate?.force_enabled && gate?.must_verify_identity);
    if (!force) return false;

    const next = encodeURIComponent(String(redirectTarget || (path + window.location.search) || "/app/"));
    window.location.replace(`/app/zugang-pruefen/?next=${next}`);
    return true;
  }

  async function loadLegalAcceptanceState(accessToken = "") {
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;
    const res = await sbFetch("/rest/v1/rpc/legal_acceptance_state", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  async function acceptCurrentLegal(accessToken = "") {
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;
    const userAgent = String(navigator?.userAgent || "").slice(0, 255);
    const res = await sbFetch("/rest/v1/rpc/accept_current_legal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        p_terms: true,
        p_privacy: true,
        p_user_agent: userAgent,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.error || "accept_current_legal_failed");
    }
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  async function enforceLegalAcceptanceIfNeeded(accessToken = "", redirectTarget = "") {
    const path = String(window.location.pathname || "");
    if (!path.startsWith("/app/")) return false;
    if (path.startsWith("/app/passwort-aendern/")) return false;
    if (path.startsWith("/app/zugang-pruefen/")) return false;
    if (path.startsWith("/app/rechtliches-bestaetigen/")) return false;

    const state = await loadLegalAcceptanceState(accessToken);
    if (!state?.needs_acceptance) return false;
    const next = encodeURIComponent(String(redirectTarget || (path + window.location.search) || "/app/"));
    window.location.replace(`/app/rechtliches-bestaetigen/?next=${next}`);
    return true;
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
    signUpWithPassword,
    getOwnProfile,
    updatePassword,
    requestPasswordReset,
    consumeAuthCallbackFromUrl,
    memberNoToEmail,
    ensureProfileBootstrap,
    loadLegalAcceptanceState,
    acceptCurrentLegal,
    verifyInviteToken,
    claimPendingInviteIfPresent,
    logout,
    SESSION_KEY,
  };

  // Login page wiring (if present)
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
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
          const sessionData = await loginWithPassword(memberNo, password);
          await ensureProfileBootstrap(sessionData?.access_token || "", {
            preferred_member_no: isLikelyEmail(memberNo) ? "" : memberNo,
          });
          await claimPendingInviteIfPresent(sessionData?.access_token || "");
          const profile = await getOwnProfile();
          if (msg) msg.textContent = "Login ok.";
          document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: true } }));
          const target = postAuthTarget(DEFAULT_CORE_HOME);
          if (profile?.must_change_password) {
            window.location.assign(`/app/passwort-aendern/?next=${encodeURIComponent(target)}`);
            return;
          }
          if (await enforceIdentityVerificationIfNeeded(sessionData?.access_token || "", target)) return;
          if (await enforceLegalAcceptanceIfNeeded(sessionData?.access_token || "", target)) return;
          window.location.assign(target);
        } catch (err) {
          if (msg) msg.textContent = err?.message || "Login fehlgeschlagen";
        }
      });
    }

    if (registerForm) {
      const regMsg = document.getElementById("registerMsg");
      const regModeHint = document.getElementById("registerModeHint");
      const prefilledInviteToken = String(document.getElementById("registerInviteToken")?.value || "").trim();
      if (regModeHint) {
        if (prefilledInviteToken) {
          regModeHint.textContent = "Einladung erkannt: Registrierung wird direkt mit dem Verein verknüpft.";
        } else if (isOpenSelfRegistrationEnabled()) {
          regModeHint.textContent = "Offene Registrierung ist aktiv. Ein Verein kann später per Invite-Link hinzugefügt werden.";
        } else {
          regModeHint.textContent = "Aktuell nur Registrierung mit Einladungs-Token möglich.";
        }
      }
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (regMsg) regMsg.textContent = "…";
        const memberNo = normalizeMemberNo(document.getElementById("registerMemberNo")?.value || "");
        const emailRaw = String(document.getElementById("registerEmail")?.value || "").trim().toLowerCase();
        const inviteToken = String(document.getElementById("registerInviteToken")?.value || "").trim();
        const pass = String(document.getElementById("registerPass")?.value || "");
        const pass2 = String(document.getElementById("registerPass2")?.value || "");
        const firstName = String(document.getElementById("registerFirstName")?.value || "").trim();
        const lastName = String(document.getElementById("registerLastName")?.value || "").trim();
        const accepted = Boolean(document.getElementById("registerAccept")?.checked);

        if (!accepted) {
          if (regMsg) regMsg.textContent = "Bitte Nutzungsbedingungen und Datenschutzerklärung bestätigen.";
          return;
        }
        if (pass !== pass2) {
          if (regMsg) regMsg.textContent = "Passwörter stimmen nicht überein.";
          return;
        }
        try {
          const hasInvite = Boolean(inviteToken);
          if (hasInvite) {
            const verify = await verifyInviteToken(inviteToken);
            const inviteMemberNo = extractInviteMemberNo(verify);
            const effectiveMemberNo = inviteMemberNo || memberNo;
            if (inviteMemberNo && memberNo && inviteMemberNo !== memberNo) throw new Error("Mitgliedsnummer passt nicht zur Einladung.");

            const clubCode = String(verify?.club_code || "").trim();
            if (!clubCode) throw new Error("Einladung ohne Vereinsbezug ist ungueltig.");

            const signupMemberNo = effectiveMemberNo || `INV-${String(inviteToken).slice(0, 10).toUpperCase()}`;
            const inviteEmail = memberNoToEmail(signupMemberNo);
            const claimPayload = {
              invite_token: inviteToken,
              member_no: effectiveMemberNo,
              first_name: firstName,
              last_name: lastName,
            };
          const result = await signUpWithPassword(inviteEmail, pass, {
              ...claimPayload,
              club_code: clubCode,
              club_name: String(verify?.club_name || "").trim(),
            });
            writePendingInvite(claimPayload);
            if (result?.access_token) {
              await acceptCurrentLegal(result.access_token);
              await ensureProfileBootstrap(result.access_token, {
                preferred_member_no: effectiveMemberNo,
                first_name: firstName,
                last_name: lastName,
              });
              await claimInviteToken(claimPayload, result.access_token);
              if (regMsg) regMsg.textContent = "Registrierung erfolgreich. Du bist angemeldet.";
              clearPendingInvite();
              const next = postAuthTarget(DEFAULT_CORE_HOME);
              window.location.assign(next);
              return;
            }
            if (regMsg) regMsg.textContent = "Registrierung erfolgreich. Bitte E-Mail bestätigen und danach einloggen. Die Vereinszuordnung erfolgt automatisch beim ersten Login.";
            return;
          }

          if (!isOpenSelfRegistrationEnabled()) {
            throw new Error("Offene Registrierung ist aktuell deaktiviert. Bitte Invite-Link verwenden.");
          }
          if (!emailRaw || !isLikelyEmail(emailRaw)) {
            throw new Error("Bitte eine gueltige E-Mail eingeben.");
          }
          const result = await signUpWithPassword(emailRaw, pass, {
            first_name: firstName,
            last_name: lastName,
            registration_mode: "self",
          });
          if (result?.access_token) {
            await acceptCurrentLegal(result.access_token);
            await ensureProfileBootstrap(result.access_token, {
              preferred_member_no: memberNo,
              first_name: firstName,
              last_name: lastName,
            });
            if (regMsg) regMsg.textContent = "Registrierung erfolgreich. Du bist angemeldet.";
            window.location.assign(postAuthTarget(DEFAULT_MEMBER_HOME));
            return;
          }
          if (regMsg) regMsg.textContent = "Registrierung gespeichert. Bitte E-Mail bestätigen und danach einloggen.";
        } catch (err) {
          if (regMsg) regMsg.textContent = err?.message || "Registrierung fehlgeschlagen.";
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
          const target = postAuthTarget(DEFAULT_CORE_HOME);
          window.location.assign(target);
        } catch (err) {
          if (msgEl) msgEl.textContent = err?.message || "Passwort konnte nicht geändert werden.";
        }
      });
    }

    if (loadSession()) {
      const active = loadSession();
      ensureProfileBootstrap(active?.access_token || "").catch(() => {});
      (async () => {
        await enforcePasswordChangeIfNeeded().catch(() => {});
        await enforceIdentityVerificationIfNeeded(active?.access_token || "").catch(() => {});
        await enforceLegalAcceptanceIfNeeded(active?.access_token || "").catch(() => {});
      })();
    }
  });
})();
