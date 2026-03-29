;(() => {
  const SESSION_KEY = "vdan_member_session_v1";
  const SESSION_META_KEY = "vdan_member_session_meta_v1";
  const INVITE_PENDING_KEY = "vdan_invite_claim_pending_v1";
  const CLUB_REQUEST_PENDING_KEY = "vdan_club_request_pending_v1";
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
      return safeParse(localStorage.getItem(CLUB_REQUEST_PENDING_KEY));
    } catch {
      return null;
    }
  }

  function writePendingClubRequest(payload = {}) {
    try {
      localStorage.setItem(CLUB_REQUEST_PENDING_KEY, JSON.stringify(payload || {}));
    } catch {
      // ignore
    }
  }

  function clearPendingClubRequest() {
    try {
      localStorage.removeItem(CLUB_REQUEST_PENDING_KEY);
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
      if (sessionStorageAvailable()) {
        const raw = sessionStorage.getItem(SESSION_KEY);
        const parsed = safeParse(raw);
        if (parsed) return parsed;
      }

      const legacy = readLegacyLocalSession();
      if (legacy && sessionStorageAvailable()) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(legacy));
        localStorage.setItem(SESSION_META_KEY, JSON.stringify(sessionMetaFrom(legacy)));
        localStorage.removeItem(SESSION_KEY);
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

  function readRegisterMode() {
    const hiddenInput = document.getElementById("registerModeValue");
    const hiddenValue = String(hiddenInput?.value || "").trim();
    if (hiddenValue) return hiddenValue;
    const checked = document.querySelector('input[name="registration_mode"]:checked');
    return String(checked?.value || "create_club").trim();
  }

  function readInviteContextHints() {
    const registerForm = document.getElementById("registerForm");
    return {
      club_id: String(registerForm?.dataset?.inviteClubId || "").trim(),
      club_code: String(registerForm?.dataset?.inviteClubCode || "").trim().toUpperCase(),
      club_name: String(registerForm?.dataset?.inviteClubName || "").trim(),
    };
  }

  function applyInviteContextUi(payload = {}) {
    const wrap = document.getElementById("registerInviteContext");
    const copy = document.getElementById("registerInviteContextCopy");
    const tokenField = document.getElementById("registerInviteTokenField");
    const tokenInput = document.getElementById("registerInviteToken");
    const clubName = String(payload?.club_name || "").trim();
    const clubCode = String(payload?.club_code || "").trim().toUpperCase();
    const expiresAt = String(payload?.expires_at || "").trim();
    if (wrap && copy) {
      const parts = [];
      if (clubName) parts.push(clubName);
      if (clubCode) parts.push(`(${clubCode})`);
      if (expiresAt) {
        const dt = new Date(expiresAt);
        if (Number.isFinite(dt.getTime())) parts.push(`gültig bis ${dt.toLocaleString("de-DE")}`);
      }
      if (parts.length) {
        wrap.hidden = false;
        wrap.classList.remove("hidden");
        copy.textContent = `Die Join-Seite ist bereits mit deiner Einladung für ${parts.join(" ")} vorbelegt.`;
      } else {
        wrap.hidden = true;
        wrap.classList.add("hidden");
        copy.textContent = "Vereinskontext wird geladen ...";
      }
    }
    if (tokenField && tokenInput && String(tokenInput.value || "").trim()) {
      tokenField.hidden = true;
      tokenField.classList.add("hidden");
      tokenInput.readOnly = true;
    }
  }

  function writeRegisterMode(mode) {
    const normalized = String(mode || "create_club").trim() || "create_club";
    const hiddenInput = document.getElementById("registerModeValue");
    if (hiddenInput) hiddenInput.value = normalized;
    const modeInput = document.querySelector(`input[name="registration_mode"][value="${normalized}"]`);
    if (modeInput && "checked" in modeInput) modeInput.checked = true;
    syncRegisterModeUi();
    updateRegisterPasswordFeedback();
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

  function syncRegisterModeUi() {
    const mode = readRegisterMode();
    const hasActiveSession = Boolean(loadSession()?.access_token);
    const authBypass = hasActiveSession && mode === "create_club";
    const registerForm = document.getElementById("registerForm");
    const joinSection = document.getElementById("registerJoinSection");
    const createSection = document.getElementById("registerCreateSection");
    const joinCard = document.getElementById("registerModeJoinCardWrap");
    const createCard = document.getElementById("registerModeCreateCard");
    const createLockedNote = document.getElementById("registerCreateLockedNote");
    const createFieldset = document.getElementById("registerCreateFieldset");
    const currentPathLabel = document.getElementById("registerCurrentPathLabel");
    const introTitle = document.getElementById("registerIntroTitle");
    const hint = document.getElementById("registerModeHint");
    const context = document.getElementById("registerModeContext");
    const authTitle = document.getElementById("registerAuthTitle");
    const authCopy = document.getElementById("registerAuthCopy");
    const legalTitle = document.getElementById("registerLegalTitle");
    const legalCopy = document.getElementById("registerLegalCopy");
    const submitBtn = document.getElementById("registerSubmitBtn");
    const passwordHint = document.getElementById("registerPasswordHint");
    const emailInput = document.getElementById("registerEmail");
    const passInput = document.getElementById("registerPass");
    const pass2Input = document.getElementById("registerPass2");
    const emailField = document.getElementById("registerEmailField");
    const passField = document.getElementById("registerPasswordField");
    const pass2Field = document.getElementById("registerPasswordRepeatField");
    const internalEntry = document.getElementById("registerInternalEntry");
    const showCreateBtn = document.getElementById("registerShowCreateFlow");
    const backToJoinBtn = document.getElementById("registerBackToJoinFlow");

    if (joinSection) {
      const isJoin = mode === "join_club";
      joinSection.hidden = !isJoin;
      joinSection.classList.toggle("hidden", !isJoin);
      joinSection.classList.toggle("is-active", isJoin);
    }
    if (createSection) {
      const isCreate = mode === "create_club";
      createSection.hidden = !isCreate;
      createSection.classList.toggle("hidden", !isCreate);
      createSection.classList.toggle("is-active", isCreate);
    }
    if (registerForm) {
      registerForm.dataset.registerMode = mode;
      registerForm.dataset.authBypass = authBypass ? "true" : "false";
    }
    if (joinCard) {
      joinCard.classList.toggle("is-active", mode === "join_club");
    }
    if (createCard) {
      createCard.classList.toggle("is-active", mode === "create_club");
      createCard.classList.remove("is-locked");
      createCard.setAttribute("aria-disabled", "false");
    }
    if (createLockedNote) {
      createLockedNote.hidden = true;
      createLockedNote.classList.add("hidden");
    }
    if (createFieldset) {
      createFieldset.disabled = false;
      createFieldset.classList.remove("is-locked");
    }
    if (internalEntry) {
      internalEntry.hidden = true;
      internalEntry.classList.add("hidden");
    }
    if (showCreateBtn) {
      showCreateBtn.hidden = mode === "create_club";
    }
    if (backToJoinBtn) {
      backToJoinBtn.hidden = mode !== "create_club";
    }
    if (hint) {
      hint.textContent = mode === "create_club"
        ? hasActiveSession
          ? "Du fragst jetzt einen Verein an. Da du bereits authentifiziert bist, wird die Anfrage sofort freigegeben und du wirst Admin im neuen Verein."
          : "Du fragst jetzt einen Verein an. Nach Auth und Mail-Bestaetigung wird die Anfrage gespeichert und zur Pruefung vorgelegt."
        : "Tritt mit deiner Einladung einem bestehenden Verein bei. Fuer neue Vereine nutzt du den separaten Anfrage-Flow.";
    }
    if (currentPathLabel) {
      currentPathLabel.textContent = mode === "create_club" ? "Aktiver Pfad: Verein anfragen" : "Aktiver Pfad: VereinsSignIn";
    }
    if (introTitle) {
      introTitle.textContent = mode === "create_club" ? "Verein anfragen" : "VereinsSignIn";
    }
    if (context) {
      context.textContent = mode === "create_club"
        ? "Du befindest dich im Anfrageprozess fuer neue Vereine. Invite- und Mitgliedsdaten spielen hier keine Rolle."
        : "Du befindest dich im Beitrittsprozess fuer bestehende Vereine. Es werden nur Invite- und Mitgliedsdaten abgefragt.";
    }
    if (authTitle) {
      authTitle.textContent = mode === "create_club" ? "Zugang fuer die Vereinsanfrage" : "Zugang fuer den VereinsSignIn";
    }
    if (authCopy) {
      authCopy.textContent = mode === "create_club"
        ? "Zuerst legen wir den Auth-Zugang fuer die anfragende Person an. Danach folgt direkt die eigentliche Vereinsanfrage."
        : "Zuerst legen wir den Zugang fuer den Vereinsbeitritt an. Danach pruefen wir Invite-Token und Vereins-Mitgliedsnummer.";
    }
    if (legalTitle) {
      legalTitle.textContent = mode === "create_club" ? "Rechtstexte fuer die Vereinsanfrage" : "Rechtstexte fuer den VereinsSignIn";
    }
    if (legalCopy) {
      legalCopy.textContent = mode === "create_club"
        ? "Ohne bestätigte Rechtstexte wird die Vereinsanfrage nicht gespeichert."
        : "Ohne bestätigte Rechtstexte wird der Vereinsbeitritt nicht abgeschlossen.";
    }
    if (submitBtn) {
      submitBtn.textContent = mode === "create_club" ? "Verein anfragen" : "VereinsSignIn starten";
    }
    if (emailInput) emailInput.required = mode === "create_club" ? !authBypass : true;
    if (passInput) passInput.required = mode === "create_club" ? !authBypass : true;
    if (pass2Input) pass2Input.required = mode === "create_club" ? !authBypass : true;
    if (emailField) {
      emailField.hidden = authBypass && mode === "create_club";
      emailField.classList.toggle("hidden", authBypass && mode === "create_club");
    }
    if (passField) {
      passField.hidden = authBypass && mode === "create_club";
      passField.classList.toggle("hidden", authBypass && mode === "create_club");
    }
    if (pass2Field) {
      pass2Field.hidden = authBypass && mode === "create_club";
      pass2Field.classList.toggle("hidden", authBypass && mode === "create_club");
    }
    if (passwordHint && authBypass && mode === "create_club") {
      passwordHint.textContent = "Du bist bereits eingeloggt. Fuer die Vereinsanfrage wird dein bestehender Auth-Zugang verwendet.";
      passwordHint.dataset.state = "info";
    } else if (passwordHint && !String(passwordHint.dataset.state || "").trim()) {
      passwordHint.textContent = "";
    }
  }

  function updateRegisterPasswordFeedback() {
    const passInput = document.getElementById("registerPass");
    const pass2Input = document.getElementById("registerPass2");
    const hint = document.getElementById("registerPasswordHint");
    if (!passInput || !pass2Input || !hint) return true;

    const pass = String(passInput.value || "");
    const pass2 = String(pass2Input.value || "");
    const authBypass = Boolean(loadSession()?.access_token) && readRegisterMode() === "create_club";

    if (authBypass && !pass && !pass2) {
      hint.textContent = "Du bist bereits eingeloggt. Fuer die Vereinsanfrage wird kein neues Passwort benoetigt.";
      hint.dataset.state = "info";
      pass2Input.setCustomValidity("");
      return true;
    }

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

  async function signUpWithPassword(emailRaw, password, metadata = {}) {
    const email = String(emailRaw || "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Bitte eine gÃ¼ltige E-Mail eingeben.");
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

  function buildClubRequestPayloadFromSource(source = {}) {
    const city = String(source?.city || source?.club_city || source?.club_location || "").trim();
    const payload = {
      club_name: String(source?.club_name || "").trim(),
      club_location: city,
      zip: String(source?.zip || source?.club_zip || "").trim(),
      city,
      club_address: String(source?.club_address || "").trim(),
      responsible_name: String(source?.responsible_name || "").trim(),
      responsible_role: String(source?.responsible_role || "").trim(),
      responsible_email: String(source?.responsible_email || "").trim().toLowerCase(),
      club_size: String(source?.club_size || "").trim(),
      club_mail_confirmed: Boolean(source?.club_mail_confirmed),
      legal_confirmed: Boolean(source?.legal_confirmed),
      registration_mode: String(source?.registration_mode || "").trim(),
      onboarding_path: String(source?.onboarding_path || "").trim(),
    };
    const looksLikeClubRequest = payload.registration_mode === "club_request_pending" || payload.onboarding_path === "club_request";
    if (!looksLikeClubRequest) return null;
    if (!payload.club_name || !payload.city || !payload.zip || !payload.club_address || !payload.responsible_name || !payload.responsible_role || !payload.responsible_email || !payload.club_size || !payload.club_mail_confirmed || !payload.legal_confirmed) {
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
    SESSION_META_KEY,
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
    if (callbackResult?.ok && callbackResult?.session?.access_token) {
      const callbackToken = String(callbackResult.session.access_token || "");
      await submitClubRequestIfNeeded(callbackToken, { autoApprove: false }).catch(() => null);
      await acceptCurrentLegal(callbackToken).catch(() => null);
      await ensureProfileBootstrap(callbackToken).catch(() => null);
      await claimPendingInviteIfPresent(callbackToken).catch(() => null);
      if (await enforceClubRequestPendingIfNeeded(callbackToken, { allowRegisterPage: true })) return;
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
      const regMsg = document.getElementById("registerMsg");
      const passInput = document.getElementById("registerPass");
      const pass2Input = document.getElementById("registerPass2");
      const prefilledInviteToken = String(document.getElementById("registerInviteToken")?.value || "").trim();
      const modeInputs = Array.from(document.querySelectorAll('input[name="registration_mode"]'));
      const showCreateBtn = document.getElementById("registerShowCreateFlow");
      const backToJoinBtn = document.getElementById("registerBackToJoinFlow");
      if (prefilledInviteToken) {
        writeRegisterMode("join_club");
      }
      modeInputs.forEach((input) => input.addEventListener("change", () => {
        syncRegisterModeUi();
        updateRegisterPasswordFeedback();
      }));
      if (showCreateBtn) {
        showCreateBtn.addEventListener("click", () => writeRegisterMode("create_club"));
      }
      if (backToJoinBtn) {
        backToJoinBtn.addEventListener("click", () => writeRegisterMode("join_club"));
      }
      if (passInput) passInput.addEventListener("input", updateRegisterPasswordFeedback);
      if (pass2Input) pass2Input.addEventListener("input", updateRegisterPasswordFeedback);
      syncRegisterModeUi();
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
        const mode = readRegisterMode();
        const memberNo = normalizeMemberNo(document.getElementById("registerMemberNo")?.value || "");
        const emailRaw = String(document.getElementById("registerEmail")?.value || "").trim().toLowerCase();
        const inviteToken = String(document.getElementById("registerInviteToken")?.value || "").trim();
        const pass = String(document.getElementById("registerPass")?.value || "");
        const pass2 = String(document.getElementById("registerPass2")?.value || "");
        const accepted = Boolean(document.getElementById("registerAccept")?.checked);
        const clubName = String(document.getElementById("registerClubName")?.value || "").trim();
        const clubZip = String(document.getElementById("registerClubZip")?.value || "").trim();
        const clubCity = String(document.getElementById("registerClubCity")?.value || "").trim();
        const clubAddress = String(document.getElementById("registerClubAddress")?.value || "").trim();
        const responsibleName = String(document.getElementById("registerResponsibleName")?.value || "").trim();
        const responsibleRole = String(document.getElementById("registerResponsibleRole")?.value || "").trim();
        const responsibleEmail = String(document.getElementById("registerResponsibleEmail")?.value || "").trim().toLowerCase();
        const clubSize = String(document.getElementById("registerClubSize")?.value || "").trim();
        const clubMailConfirm = Boolean(document.getElementById("registerClubMailConfirm")?.checked);
        const legalAuthorityConfirm = Boolean(document.getElementById("registerLegalAuthorityConfirm")?.checked);
        const firstName = "";
        const lastName = "";
        const clubRequestPayload = {
          registration_mode: "club_request_pending",
          onboarding_path: "club_request",
          club_name: clubName,
          club_location: clubCity,
          zip: clubZip,
          city: clubCity,
          club_address: clubAddress,
          responsible_name: responsibleName,
          responsible_role: responsibleRole,
          responsible_email: responsibleEmail,
          club_size: clubSize,
          club_mail_confirmed: clubMailConfirm,
          legal_confirmed: legalAuthorityConfirm,
        };

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
          if (mode === "join_club") {
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
          const result = await signUpWithPassword(emailRaw, pass, {
              registration_mode: "join_club",
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
              if (regMsg) regMsg.textContent = "Registrierung erfolgreich. Du wirst jetzt zur verpflichtenden Erstaktivierung weitergeleitet.";
              clearPendingInvite();
              const next = postAuthTarget(DEFAULT_CORE_HOME);
              window.location.assign(`/app/zugang-pruefen/?next=${encodeURIComponent(next)}`);
              return;
            }
            if (regMsg) regMsg.textContent = "Registrierung gespeichert. Bitte E-Mail bestaetigen. Danach folgt automatisch die Erstaktivierung mit Datenabgleich.";
            return;
          }

          const activeSession = loadSession();
          const createAuthBypass = Boolean(activeSession?.access_token);
          if (!createAuthBypass && (!emailRaw || !isLikelyEmail(emailRaw))) {
            throw new Error("Bitte eine gueltige E-Mail eingeben.");
          }
          if (!clubName) {
            throw new Error("Bitte den Vereinsnamen angeben.");
          }
          if (!clubZip) {
            throw new Error("Bitte die PLZ des Vereins angeben.");
          }
          if (!clubCity) {
            throw new Error("Bitte den Ort des Vereins angeben.");
          }
          if (!clubAddress) {
            throw new Error("Bitte die Vereinsanschrift angeben.");
          }
          if (!responsibleName) {
            throw new Error("Bitte die verantwortliche Person angeben.");
          }
          if (!responsibleRole) {
            throw new Error("Bitte die Funktion der verantwortlichen Person angeben.");
          }
          if (!responsibleEmail || !isLikelyEmail(responsibleEmail)) {
            throw new Error("Bitte eine gueltige E-Mail-Adresse der verantwortlichen Person angeben.");
          }
          if (!clubSize) {
            throw new Error("Bitte die Vereinsgroesse auswaehlen.");
          }
          if (!clubMailConfirm) {
            throw new Error("Bitte den Hinweis zur Vereinsadministrator-E-Mail bestaetigen.");
          }
          if (!legalAuthorityConfirm) {
            throw new Error("Bitte die Berechtigung fuer die Vereinsanfrage bestaetigen.");
          }

          if (createAuthBypass) {
            const data = await callEdgeFunction("club-request-submit", {
              club_name: clubName,
              club_location: clubCity,
              zip: clubZip,
              city: clubCity,
              club_address: clubAddress,
              responsible_name: responsibleName,
              responsible_role: responsibleRole,
              responsible_email: responsibleEmail,
              club_size: clubSize,
              club_mail_confirmed: clubMailConfirm,
              legal_confirmed: legalAuthorityConfirm,
              auto_approve: true,
            }, activeSession?.access_token || "");
            clearPendingClubRequest();
            if (regMsg) regMsg.textContent = "Vereinsanfrage erfolgreich verarbeitet. Du wirst jetzt ins Portal geleitet.";
            const approvedClubId = String(data?.club_id || "").trim();
            const nextUrl = approvedClubId ? `/app/?club_id=${encodeURIComponent(approvedClubId)}` : "/app/";
            window.location.assign(nextUrl);
            return;
          }

          writePendingClubRequest(clubRequestPayload);
          const result = await signUpWithPassword(emailRaw, pass, {
            ...clubRequestPayload,
            billing_status: "billing_pending",
          });
          if (result?.access_token) {
            await acceptCurrentLegal(result.access_token).catch(() => null);
            await ensureProfileBootstrap(result.access_token, {
              first_name: firstName,
              last_name: lastName,
            });
            await submitClubRequestIfNeeded(result.access_token, {
              payload: clubRequestPayload,
              autoApprove: false,
            }).catch(() => null);
            if (regMsg) regMsg.textContent = "Dein Verein wurde erfolgreich angefragt.";
            window.location.assign("/app/anfrage-offen/");
            return;
          }
          if (regMsg) regMsg.textContent = "Registrierung gespeichert. Bitte E-Mail bestaetigen. Danach landest du auf der Seite fuer deine Vereinsanfrage.";
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
        await enforceIdentityVerificationIfNeeded(active?.access_token || "").catch(() => {});
        await enforceLegalAcceptanceIfNeeded(active?.access_token || "").catch(() => {});
      })();
    }
  });
})();
