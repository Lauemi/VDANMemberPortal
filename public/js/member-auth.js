;(() => {
  const SESSION_KEY = "vdan_member_session_v1";
  const SESSION_META_KEY = "vdan_member_session_meta_v1";
  const INVITE_PENDING_KEY = "vdan_invite_claim_pending_v1";
  const CLUB_REQUEST_PENDING_KEY = "vdan_club_request_pending_v1";
  const CLUB_REGISTER_PENDING_KEY = "vdan_club_register_pending_v1";
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

  function currentProjectUrl() {
    return String(cfg().url || "").trim().replace(/\/+$/, "");
  }

  function safeBase64UrlDecode(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      return atob(padded);
    } catch {
      return "";
    }
  }

  function readJwtPayload(token) {
    const value = String(token || "").trim();
    const parts = value.split(".");
    if (parts.length < 2) return null;
    const decoded = safeBase64UrlDecode(parts[1]);
    if (!decoded) return null;
    try {
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  function sessionMatchesCurrentProject(session, meta = null) {
    const expectedUrl = currentProjectUrl();
    if (!expectedUrl) return true;

    const metaProjectUrl = String(meta?.projectUrl || "").trim().replace(/\/+$/, "");
    if (metaProjectUrl) return metaProjectUrl === expectedUrl;

    const token = String(session?.access_token || "").trim();
    if (!token) return true;
    const payload = readJwtPayload(token);
    const issuer = String(payload?.iss || "").trim().replace(/\/+$/, "");
    if (!issuer) return true;
    return issuer === `${expectedUrl}/auth/v1`;
  }

  function isValidSession(session) {
    if (!session || typeof session !== "object") return false;
    const expiresAt = Number(session.expiresAt);
    if (!Number.isFinite(expiresAt)) return false;
    return (expiresAt - EXPIRY_SKEW_MS) > nowMs() && Boolean(session.access_token);
  }

  function sessionStorageAvailable() {
    try {
      return typeof sessionStorage !== "undefined";
    } catch {
      return false;
    }
  }

  function safeParse(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readPendingClubRequest() {
    try {
      return safeParse(localStorage.getItem(CLUB_REQUEST_PENDING_KEY))
        || safeParse(localStorage.getItem(CLUB_REGISTER_PENDING_KEY));
    } catch {
      return null;
    }
  }

  function writePendingClubRequest(payload = {}) {
    try {
      localStorage.setItem(CLUB_REQUEST_PENDING_KEY, JSON.stringify(payload || {}));
      localStorage.setItem(CLUB_REGISTER_PENDING_KEY, JSON.stringify(payload || {}));
    } catch {
      // ignore
    }
  }

  function clearPendingClubRequest() {
    try {
      localStorage.removeItem(CLUB_REQUEST_PENDING_KEY);
      localStorage.removeItem(CLUB_REGISTER_PENDING_KEY);
    } catch {
      // ignore
    }
  }

  function sessionMetaFrom(payload) {
    return {
      user: payload?.user
        ? {
            id: String(payload.user.id || "").trim() || null,
            email: String(payload.user.email || "").trim() || null,
          }
        : null,
      expiresAt: Number(payload?.expiresAt || 0) || null,
      projectUrl: currentProjectUrl() || null,
      updated_at: new Date().toISOString(),
    };
  }

  function readLegacyLocalSession() {
    try {
      return safeParse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  function readSessionMeta() {
    try {
      return safeParse(localStorage.getItem(SESSION_META_KEY));
    } catch {
      return null;
    }
  }

  function loadStoredSession() {
    try {
      const meta = readSessionMeta();
      if (sessionStorageAvailable()) {
        const raw = sessionStorage.getItem(SESSION_KEY);
        const parsed = safeParse(raw);
        if (parsed) {
          if (!sessionMatchesCurrentProject(parsed, meta)) {
            clearSession();
            return null;
          }
          return parsed;
        }
      }

      const legacy = readLegacyLocalSession();
      if (legacy && sessionStorageAvailable()) {
        if (!sessionMatchesCurrentProject(legacy, meta)) {
          clearSession();
          return null;
        }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(legacy));
        localStorage.setItem(SESSION_META_KEY, JSON.stringify(sessionMetaFrom(legacy)));
        localStorage.removeItem(SESSION_KEY);
      }
      if (legacy && !sessionMatchesCurrentProject(legacy, meta)) {
        clearSession();
        return null;
      }
      return legacy;
    } catch {
      return null;
    }
  }

  function loadSession() {
    const parsed = loadStoredSession();
    return isValidSession(parsed) ? parsed : null;
  }

  function saveSession(payload) {
    const serialized = JSON.stringify(payload);
    if (sessionStorageAvailable()) {
      sessionStorage.setItem(SESSION_KEY, serialized);
    }
    localStorage.setItem(SESSION_META_KEY, JSON.stringify(sessionMetaFrom(payload)));
    localStorage.removeItem(SESSION_KEY);
  }

  function clearSession() {
    if (sessionStorageAvailable()) sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_META_KEY);
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

  async function callEdgeFunctionWithSession(functionName, payload = {}) {
    const token = String(loadSession()?.access_token || "").trim();
    if (!token) throw new Error("Bitte zuerst einloggen.");
    return callEdgeFunction(functionName, payload, token);
  }

  async function loadAuthUser(accessToken = "") {
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;
    const res = await sbFetch("/auth/v1/user", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
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

  function configuredSuperadmins() {
    return String(document.body?.getAttribute("data-superadmin-user-ids") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function isCurrentSuperadmin() {
    const uid = String(loadSession()?.user?.id || "").trim();
    if (!uid) return false;
    return configuredSuperadmins().includes(uid);
  }

  function readInviteContextHints() {
    const registerForm = document.getElementById("registerForm");
    const query = new URLSearchParams(window.location.search || "");
    return {
      club_id: String(registerForm?.dataset?.inviteClubId || query.get("club_id") || "").trim(),
      club_code: String(registerForm?.dataset?.inviteClubCode || query.get("club_code") || "").trim().toUpperCase(),
      club_name: String(registerForm?.dataset?.inviteClubName || query.get("club_name") || "").trim(),
    };
  }

  function hydrateJoinPageFromUrl() {
    const registerForm = document.getElementById("registerForm");
    const tokenInput = document.getElementById("registerInviteToken");
    const memberNoInput = document.getElementById("registerMemberNo");
    const query = new URLSearchParams(window.location.search || "");
    const invite = String(query.get("invite") || "").trim();
    const clubId = String(query.get("club_id") || "").trim();
    const clubCode = String(query.get("club_code") || "").trim().toUpperCase();
    const clubName = String(query.get("club_name") || "").trim();
    const memberNo = String(query.get("member_no") || "").trim().toUpperCase();

    if (registerForm) {
      if (clubId) registerForm.dataset.inviteClubId = clubId;
      if (clubCode) registerForm.dataset.inviteClubCode = clubCode;
      if (clubName) registerForm.dataset.inviteClubName = clubName;
    }
    if (tokenInput && invite && !String(tokenInput.value || "").trim()) {
      tokenInput.value = invite;
    }
    if (memberNoInput && memberNo && !String(memberNoInput.value || "").trim()) {
      memberNoInput.value = memberNo;
    }
  }

  function stagePendingInviteFromCurrentContext() {
    const path = String(window.location.pathname || "").toLowerCase();
    const query = new URLSearchParams(window.location.search || "");
    const inviteToken = String(
      document.getElementById("registerInviteToken")?.value
      || query.get("invite")
      || ""
    ).trim();
    if (!inviteToken) return;

    const memberNo = normalizeMemberNo(
      document.getElementById("loginInviteMemberNo")?.value
      || document.getElementById("registerMemberNo")?.value
      || query.get("member_no")
      || ""
    );

    if (path.startsWith("/vereinssignin") && !memberNo) {
      throw new Error("Bitte die Vereins-Mitgliedsnummer eingeben, um den Invite-Claim fortzusetzen.");
    }

    writePendingInvite({
      invite_token: inviteToken,
      member_no: memberNo,
      first_name: "",
      last_name: "",
    });
  }

  function stagePendingInviteFromCurrentContextIfPresent() {
    const query = new URLSearchParams(window.location.search || "");
    const inviteToken = String(
      document.getElementById("registerInviteToken")?.value
      || query.get("invite")
      || ""
    ).trim();
    if (!inviteToken) return;
    stagePendingInviteFromCurrentContext();
  }

  function applyInviteContextUi(payload = {}) {
    const wrap = document.getElementById("registerInviteContext");
    const copy = document.getElementById("registerInviteContextCopy");
    const tokenField = document.getElementById("registerInviteTokenField");
    const tokenInput = document.getElementById("registerInviteToken");
    const clubName = String(payload?.club_name || "").trim();
    if (wrap && copy) {
      if (clubName) {
        wrap.hidden = false;
        wrap.classList.remove("hidden");
        copy.textContent = `Du trittst dem Verein ${clubName} bei.`;
      } else if (String(copy.textContent || "").trim()) {
        wrap.hidden = false;
        wrap.classList.remove("hidden");
      } else {
        wrap.hidden = true;
        wrap.classList.add("hidden");
        copy.textContent = "";
      }
    }
    if (tokenField && tokenInput && String(tokenInput.value || "").trim()) {
      tokenField.hidden = true;
      tokenField.classList.add("hidden");
      tokenInput.readOnly = true;
    }
  }

  function isRegistrationPath(pathname = "") {
    const path = String(pathname || "");
    return path.startsWith("/registrieren")
      || path.startsWith("/verein-anfragen")
      || path.startsWith("/vereinssignin");
  }

  function mapRegistrationErrorMessage(rawError) {
    const message = String(rawError?.message || rawError || "").trim();
    if (!message) return "Registrierung fehlgeschlagen.";
    if (message === "member_email_missing") {
      return "Fuer dieses Mitglied ist im Verein noch keine E-Mail-Adresse hinterlegt. Bitte zuerst die Mitgliedsdaten im Verein ergaenzen.";
    }
    if (message === "member_email_mismatch") {
      return "Diese E-Mail-Adresse passt nicht zum Mitgliedsdatensatz im Verein.";
    }
    if (message === "member_no_not_found_in_club") {
      return "Diese Mitgliedsnummer ist in diesem Verein nicht vorhanden.";
    }
    if (message === "member_no_required") {
      return "Bitte die Vereins-Mitgliedsnummer angeben.";
    }
    if (message === "invite_invalid" || message === "invite_inactive" || message === "invite_expired" || message === "invite_exhausted") {
      return "Diese Einladung ist ungueltig oder nicht mehr aktiv.";
    }
    if (message === "club_request_existing_admin_scope") {
      return "Dieser Account ist bereits als Admin oder Vorstand in einem Verein hinterlegt und kann keinen weiteren Verein gruenden.";
    }
    if (message === "club_request_already_pending") {
      return "Fuer diesen Account gibt es bereits eine offene Vereinsanfrage.";
    }
    if (message === "unauthorized" || message === "login_required_for_invite_claim") {
      return "Bitte melde dich zuerst mit deinem Zugang an.";
    }
    return message;
  }

  function initializeJoinOnlyRegisterUi() {
    const registerForm = document.getElementById("registerForm");
    const joinSection = document.getElementById("registerJoinSection");
    const hiddenInput = document.getElementById("registerModeValue");
    const submitBtn = document.getElementById("registerSubmitBtn");
    const hasInviteContext = registerForm?.dataset?.hasInviteContext === "true";

    if (hiddenInput) hiddenInput.value = "join_club";
    if (joinSection) {
      joinSection.hidden = false;
      joinSection.classList.remove("hidden");
      joinSection.classList.add("is-active");
    }
    if (registerForm) {
      registerForm.dataset.registerMode = "join_club";
      registerForm.dataset.authBypass = "false";
    }
    if (submitBtn) {
      submitBtn.textContent = hasInviteContext ? "Verein beitreten" : "Konto anlegen";
    }
  }

  function initializeMobileRegisterSubmitAnchor() {
    const cta = document.getElementById("registerMobileSubmitAnchor");
    const submitBtn = document.getElementById("registerSubmitBtn");
    if (!cta || !submitBtn) return;
    cta.hidden = false;
    cta.classList.remove("hidden");
    cta.addEventListener("click", (event) => {
      event.preventDefault();
      submitBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      submitBtn.focus({ preventScroll: true });
      window.location.hash = "registerSubmitBtn";
    });
  }

  function updateRegisterPasswordFeedback() {
    const passInput = document.getElementById("registerPass");
    const pass2Input = document.getElementById("registerPass2");
    const hint = document.getElementById("registerPasswordHint");
    if (!passInput || !pass2Input || !hint) return true;

    const pass = String(passInput.value || "");
    const pass2 = String(pass2Input.value || "");
    if (!pass && !pass2) {
      hint.textContent = "";
      hint.dataset.state = "";
      pass2Input.setCustomValidity("");
      return true;
    }

    if (!pass || !pass2) {
      hint.textContent = "Bitte beide Passwortfelder ausfuellen.";
      hint.dataset.state = "pending";
      pass2Input.setCustomValidity("");
      return false;
    }

    if (pass !== pass2) {
      hint.textContent = "Passwoerter stimmen nicht ueberein.";
      hint.dataset.state = "error";
      pass2Input.setCustomValidity("Passwoerter stimmen nicht ueberein.");
      return false;
    }

    hint.textContent = "Passwoerter stimmen ueberein.";
    hint.dataset.state = "ok";
    pass2Input.setCustomValidity("");
    return true;
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

  async function prepareJoinInviteContext() {
    const path = String(window.location.pathname || "");
    if (!path.startsWith("/vereinssignin")) return null;
    const tokenInput = document.getElementById("registerInviteToken");
    const inviteToken = String(tokenInput?.value || "").trim();
    const hints = readInviteContextHints();
    if (!inviteToken) {
      applyInviteContextUi(hints);
      return hints;
    }
    const verified = await verifyInviteToken(inviteToken);
    const merged = {
      ...hints,
      club_id: String(verified?.club_id || hints.club_id || "").trim(),
      club_code: String(verified?.club_code || hints.club_code || "").trim().toUpperCase(),
      club_name: String(verified?.club_name || hints.club_name || "").trim(),
      expires_at: String(verified?.expires_at || "").trim(),
      remaining_uses: verified?.remaining_uses,
    };
    applyInviteContextUi(merged);
    return merged;
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

  async function signUpWithPassword(emailRaw, password, metadata = {}, options = {}) {
    const email = String(emailRaw || "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Bitte eine gÃ¼ltige E-Mail eingeben.");
    if (String(password || "").length < 8) throw new Error("Passwort muss mindestens 8 Zeichen haben.");

    const signupBody = { email, password, data: metadata || {} };
    const emailRedirectTo = String(options?.emailRedirectTo || "").trim();
    if (emailRedirectTo) signupBody.redirect_to = emailRedirectTo;

    const res = await sbFetch("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify(signupBody),
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
      throw new Error(err?.msg || err?.error_description || "Passwort konnte nicht geÃ¤ndert werden.");
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

    // Clear any existing session BEFORE building the new one.
    // An auth callback always establishes a fresh identity — spreading an existing
    // session via ...base would let an old browser session (different user/club)
    // bleed into the callback session, causing wrong-context bugs.
    clearSession();
    const expiresIn = Number(payload.expires_in || 3600);
    const expiresAt = nowMs() + (expiresIn * 1000);
    const nextSession = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || "",
      token_type: payload.token_type || "bearer",
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
    window.location.replace(`/app/zugang-prÃ¼fen/?next=${next}`);
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

  async function loadClubRequestGateState(accessToken = "") {
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;
    const res = await sbFetch("/rest/v1/rpc/club_request_gate_state", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  async function loadPortalAccessState(accessToken = "") {
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;
    const res = await sbFetch("/rest/v1/rpc/self_portal_access_state", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: "{}",
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  function buildClubRequestPayloadFromSource(source = {}) {
    const city = String(source?.city || source?.club_city || source?.club_location || "").trim();
    const street = String(source?.street || "").trim();
    const houseNumber = String(source?.house_number || source?.houseNumber || "").trim();
    const clubAddress = String(source?.club_address || [street, houseNumber].filter(Boolean).join(" ")).trim();
    const payload = {
      club_name: String(source?.club_name || "").trim(),
      club_location: city,
      zip: String(source?.zip || source?.club_zip || "").trim(),
      city,
      street,
      house_number: houseNumber,
      club_address: clubAddress,
      responsible_name: String(source?.responsible_name || "").trim(),
      responsible_role: String(source?.responsible_role || "").trim(),
      responsible_email: String(source?.responsible_email || "").trim().toLowerCase(),
      club_size: String(source?.club_size || "").trim(),
      club_mail_confirmed: Boolean(source?.club_mail_confirmed),
      legal_confirmed: Boolean(source?.legal_confirmed),
      registration_mode: String(source?.registration_mode || "").trim(),
      onboarding_path: String(source?.onboarding_path || "").trim(),
    };
    const looksLikeClubRequest = payload.registration_mode === "club_request_pending"
      || payload.registration_mode === "club_register_pending"
      || payload.onboarding_path === "club_request"
      || payload.onboarding_path === "club_register";
    if (!looksLikeClubRequest) return null;
    if (!payload.club_name || !payload.city || !payload.zip || !payload.club_address || !payload.responsible_name || !payload.responsible_role || !payload.responsible_email || !payload.club_size || !payload.legal_confirmed) {
      return null;
    }
    return payload;
  }

  async function submitClubRequestIfNeeded(accessToken = "", { payload = null, autoApprove = false } = {}) {
    const token = String(accessToken || "").trim() || String(loadSession()?.access_token || "").trim();
    if (!token) return null;

    const gate = await loadClubRequestGateState(token).catch(() => null);
    if (gate?.request_id) {
      clearPendingClubRequest();
      return gate;
    }

    const authUser = await loadAuthUser(token).catch(() => null);
    const authMeta = authUser?.user_metadata && typeof authUser.user_metadata === "object" ? authUser.user_metadata : {};
    const pending = readPendingClubRequest() || {};
    const candidate = buildClubRequestPayloadFromSource(payload || pending || authMeta) || buildClubRequestPayloadFromSource(pending) || buildClubRequestPayloadFromSource(authMeta);
    if (!candidate) return null;

    await callEdgeFunction("club-request-submit", {
      club_name: candidate.club_name,
      club_location: candidate.club_location,
      zip: candidate.zip,
      city: candidate.city,
      street: candidate.street,
      house_number: candidate.house_number,
      club_address: candidate.club_address,
      responsible_name: candidate.responsible_name,
      responsible_role: candidate.responsible_role,
      responsible_email: candidate.responsible_email,
      club_size: candidate.club_size,
      club_mail_confirmed: candidate.club_mail_confirmed,
      legal_confirmed: candidate.legal_confirmed,
      auto_approve: Boolean(autoApprove),
    }, token);

    clearPendingClubRequest();
    return loadClubRequestGateState(token).catch(() => null);
  }

  async function enforceClubRequestPendingIfNeeded(accessToken = "", { allowRegisterPage = false } = {}) {
    const path = String(window.location.pathname || "");
    const isAppPath = path.startsWith("/app/");
    const isRegisterPath = isRegistrationPath(path);
    if (!isAppPath && !(allowRegisterPage && isRegisterPath)) return false;
    if (path.startsWith("/app/passwort-aendern/")) return false;
    if (path.startsWith("/app/zugang-pruefen/")) return false;
    if (path.startsWith("/app/rechtliches-bestaetigen/")) return false;

    const gate = await loadClubRequestGateState(accessToken);
    if (!gate?.request_id) return false;
    if (String(gate.status || "").trim().toLowerCase() === "approved") {
      if (path.startsWith("/app/anfrage-offen/")) {
        window.location.replace("/app/");
        return true;
      }
      return false;
    }

    if (path.startsWith("/app/anfrage-offen/")) return false;
    window.location.replace("/app/anfrage-offen/");
    return true;
  }

  async function enforcePortalAccessStateIfNeeded(accessToken = "", redirectTarget = "") {
    const path = String(window.location.pathname || "");
    if (!path.startsWith("/app/")) return false;
    if (path.startsWith("/app/passwort-aendern/")) return false;
    if (path.startsWith("/app/zugang-pruefen/")) return false;

    const state = await loadPortalAccessState(accessToken);
    if (!state || String(state.state_key || "").trim().toLowerCase() === "linked") return false;

    const next = encodeURIComponent(String(redirectTarget || (path + window.location.search) || "/app/"));
    window.location.replace(`/app/zugang-pruefen/?state=unlinked&next=${next}`);
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
    submitClubRequestIfNeeded,
    loadLegalAcceptanceState,
    acceptCurrentLegal,
    verifyInviteToken,
    claimPendingInviteIfPresent,
    mapRegistrationErrorMessage,
    logout,
    SESSION_KEY,
    SESSION_META_KEY,
    INVITE_PENDING_KEY,
  };

  // Login page wiring (if present)
  document.addEventListener("DOMContentLoaded", async () => {
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

    const callbackResult = await consumeAuthCallbackFromUrl().catch(() => null);
    // invite-confirm.astro owns its post-callback claim flow and surfaces errors explicitly.
    if (window.location.pathname.startsWith("/auth/invite-confirm")) return;
    if (callbackResult?.ok && callbackResult?.session?.access_token) {
      const callbackToken = String(callbackResult.session.access_token || "");

      // If a pending invite claim exists and the callback did NOT land on /auth/invite-confirm
      // (e.g. Supabase SITE_URL override redirected here instead), send the user to the
      // invite-confirm page so that claim errors surface explicitly rather than being swallowed.
      const _hasPendingInvite = (() => {
        try { return Boolean(localStorage.getItem(INVITE_PENDING_KEY)); } catch { return false; }
      })();
      if (_hasPendingInvite) {
        const _sessionEmail = String(callbackResult.session?.user?.email || "").trim();
        const _confirmPath = _sessionEmail
          ? "/auth/invite-confirm/?email=" + encodeURIComponent(_sessionEmail)
          : "/auth/invite-confirm/";
        window.location.replace(_confirmPath);
        return;
      }

      await submitClubRequestIfNeeded(callbackToken, { autoApprove: false }).catch(() => null);
      await acceptCurrentLegal(callbackToken).catch(() => null);
      await ensureProfileBootstrap(callbackToken).catch(() => null);
      await claimPendingInviteIfPresent(callbackToken).catch(() => null);
      if (await enforceClubRequestPendingIfNeeded(callbackToken, { allowRegisterPage: true })) return;
      if (await enforcePortalAccessStateIfNeeded(callbackToken, DEFAULT_CORE_HOME)) return;
      if (isRegistrationPath(window.location.pathname || "")) {
        const target = postAuthTarget(DEFAULT_CORE_HOME);
        if (await enforceIdentityVerificationIfNeeded(callbackToken, target)) return;
        if (await enforceLegalAcceptanceIfNeeded(callbackToken, target)) return;
        window.location.assign(target);
        return;
      }
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (msg) msg.textContent = "â€¦";
        const memberNo = String(
          document.getElementById("loginMemberNo")?.value ||
          document.getElementById("loginEmail")?.value ||
          ""
        ).trim();
        const password = String(document.getElementById("loginPass")?.value || "");
        try {
          stagePendingInviteFromCurrentContextIfPresent();
          const sessionData = await loginWithPassword(memberNo, password);
          await submitClubRequestIfNeeded(sessionData?.access_token || "", { autoApprove: false }).catch(() => null);
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
          if (await enforcePortalAccessStateIfNeeded(sessionData?.access_token || "", target)) return;
          if (await enforceIdentityVerificationIfNeeded(sessionData?.access_token || "", target)) return;
          if (await enforceLegalAcceptanceIfNeeded(sessionData?.access_token || "", target)) return;
          if (await enforceClubRequestPendingIfNeeded(sessionData?.access_token || "")) return;
          window.location.assign(target);
        } catch (err) {
          if (msg) msg.textContent = err?.message || "Login fehlgeschlagen";
        }
      });
    }

    if (registerForm) {
      hydrateJoinPageFromUrl();
      const regMsg = document.getElementById("registerMsg");
      const passInput = document.getElementById("registerPass");
      const pass2Input = document.getElementById("registerPass2");
      const prefilledInviteToken = String(document.getElementById("registerInviteToken")?.value || "").trim();
      initializeJoinOnlyRegisterUi();
      initializeMobileRegisterSubmitAnchor();
      if (passInput) passInput.addEventListener("input", updateRegisterPasswordFeedback);
      if (pass2Input) pass2Input.addEventListener("input", updateRegisterPasswordFeedback);
      updateRegisterPasswordFeedback();
      if (prefilledInviteToken) {
        prepareJoinInviteContext().catch((err) => {
          if (regMsg) regMsg.textContent = mapRegistrationErrorMessage(err);
        });
      } else {
        applyInviteContextUi(readInviteContextHints());
      }
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (regMsg) regMsg.textContent = "â€¦";
        const memberNo = normalizeMemberNo(document.getElementById("registerMemberNo")?.value || "");
        const emailRaw = String(document.getElementById("registerEmail")?.value || "").trim().toLowerCase();
        const inviteToken = String(document.getElementById("registerInviteToken")?.value || "").trim();
        const pass = String(document.getElementById("registerPass")?.value || "");
        const accepted = Boolean(document.getElementById("registerAccept")?.checked);
        const firstName = "";
        const lastName = "";

        if (!accepted) {
          if (regMsg) regMsg.textContent = "Bitte Nutzungsbedingungen und DatenschutzerklÃ¤rung bestÃ¤tigen.";
          return;
        }
        if (!updateRegisterPasswordFeedback()) {
          if (regMsg) regMsg.textContent = "PasswÃ¶rter stimmen nicht Ã¼berein.";
          document.getElementById("registerPass2")?.reportValidity?.();
          return;
        }
        try {
          if (!inviteToken) throw new Error("FÃ¼r den Vereinsbeitritt ist aktuell ein Invite-Token erforderlich.");
          const verify = await verifyInviteToken(inviteToken);
          applyInviteContextUi(verify);
          const inviteMemberNo = extractInviteMemberNo(verify);
          const effectiveMemberNo = inviteMemberNo || memberNo;
          if (inviteMemberNo && memberNo && inviteMemberNo !== memberNo) throw new Error("Mitgliedsnummer passt nicht zur Einladung.");
          if (!effectiveMemberNo) throw new Error("Bitte die Vereins-Mitgliedsnummer angeben.");

          const clubCode = String(verify?.club_code || "").trim();
          if (!clubCode) throw new Error("Einladung ohne Vereinsbezug ist ungueltig.");

          if (!emailRaw || !isLikelyEmail(emailRaw)) {
            throw new Error("Bitte die im Verein hinterlegte E-Mail-Adresse eingeben.");
          }
          const claimPayload = {
            invite_token: inviteToken,
            member_no: effectiveMemberNo,
            first_name: firstName,
            last_name: lastName,
          };
          // GAP[supabase-redirect-whitelist]: This URL must be listed under
          // Supabase Auth → URL Configuration → Additional Redirect URLs.
          // If it is not whitelisted, Supabase silently falls back to SITE_URL,
          // causing the callback to land on the wrong page/site. This is a
          // Supabase dashboard configuration step — not fixable repo-side.
          const inviteConfirmUrl = `${window.location.origin}/auth/invite-confirm/?email=${encodeURIComponent(emailRaw)}`;
          const result = await signUpWithPassword(emailRaw, pass, {
            registration_mode: "join_club",
            ...claimPayload,
            club_code: clubCode,
            club_name: String(verify?.club_name || "").trim(),
          }, { emailRedirectTo: inviteConfirmUrl });
          writePendingInvite(claimPayload);
          if (result?.access_token) {
            await acceptCurrentLegal(result.access_token);
            await ensureProfileBootstrap(result.access_token, {
              preferred_member_no: effectiveMemberNo,
              first_name: firstName,
              last_name: lastName,
            });
            await claimInviteToken(claimPayload, result.access_token);
            if (regMsg) regMsg.textContent = "Registrierung erfolgreich. Du wirst jetzt zur verpflichtenden Erstaktivierung weitergeleitet.";
            clearPendingInvite();
            const next = postAuthTarget(DEFAULT_CORE_HOME);
            window.location.assign(`/app/zugang-pruefen/?next=${encodeURIComponent(next)}`);
            return;
          }
          if (regMsg) regMsg.textContent = "Registrierung gespeichert. Bitte E-Mail verifizieren. Danach folgt automatisch die Erstaktivierung mit Datenabgleich.";
        } catch (err) {
          if (regMsg) regMsg.textContent = mapRegistrationErrorMessage(err);
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
          if (msgEl) msgEl.textContent = "PasswÃ¶rter stimmen nicht Ã¼berein.";
          return;
        }
        try {
          if (msgEl) msgEl.textContent = "Speichereâ€¦";
          await updatePassword(p1);
          if (msgEl) msgEl.textContent = "Passwort aktualisiert.";
          const target = postAuthTarget(DEFAULT_CORE_HOME);
          window.location.assign(target);
        } catch (err) {
          if (msgEl) msgEl.textContent = err?.message || "Passwort konnte nicht geÃ¤ndert werden.";
        }
      });
    }

    if (loadSession()) {
      const active = loadSession();
      ensureProfileBootstrap(active?.access_token || "").catch(() => {});
      (async () => {
        await enforcePasswordChangeIfNeeded().catch(() => {});
        await enforceClubRequestPendingIfNeeded(active?.access_token || "").catch(() => {});
        await enforcePortalAccessStateIfNeeded(active?.access_token || "").catch(() => {});
        await enforceIdentityVerificationIfNeeded(active?.access_token || "").catch(() => {});
        await enforceLegalAcceptanceIfNeeded(active?.access_token || "").catch(() => {});
      })();
    }
  });
})();
