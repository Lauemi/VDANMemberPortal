;(() => {
  const FALLBACK_KEY = "vdan_user_settings_fallback_v1";
  const UPDATE_NOTIFY_KEY = "vdan_notify_app_update_v1";
  const RELOAD_HINT_KEY = "vdan_settings_reload_feedback_v1";
  const PUSH_SCOPE = "/";

  let accountState = null;

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function uid() {
    return session()?.user?.id || null;
  }

  async function waitForAuthReady(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.VDAN_AUTH?.loadSession) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return Boolean(window.VDAN_AUTH?.loadSession);
  }

  function isAuthEmailChangeEnabled() {
    return Boolean(window.__APP_AUTH_EMAIL_CHANGE_ENABLED === true);
  }

  function setMsg(text = "") {
    const el = document.getElementById("settingsMsg");
    if (el) el.textContent = text;
  }

  function val(v) {
    return String(v || "").trim();
  }

  function safeLabel(v) {
    return val(v) || "-";
  }

  function setInputValue(id, value = "") {
    const el = document.getElementById(id);
    if (el) el.value = val(value);
  }

  async function readErrorPayload(res) {
    const contentType = String(res.headers?.get?.("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const j = await res.json().catch(() => ({}));
      return String(j?.error_description || j?.error || j?.message || j?.msg || "").trim();
    }
    const t = await res.text().catch(() => "");
    return String(t || "").trim();
  }

  async function sb(path, init = {}, withAuth = false) {
    await waitForAuthReady();
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    let token = session()?.access_token || "";
    if (withAuth && !token && navigator.onLine && window.VDAN_AUTH?.refreshSession) {
      const refreshed = await window.VDAN_AUTH.refreshSession().catch(() => null);
      token = refreshed?.access_token || session()?.access_token || "";
    }
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const detail = await readErrorPayload(res);
      console.error("[app-settings] request failed", {
        path,
        status: res.status,
        withAuth,
        hasToken: Boolean(token),
        detail,
      });
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  function formState() {
    const handednessRaw = String(document.getElementById("setHandedness")?.value || "right").trim().toLowerCase();
    const nav_handedness = handednessRaw === "left" || handednessRaw === "right" ? handednessRaw : "auto";
    return {
      notify_new_post: Boolean(document.getElementById("setNotifyPosts")?.checked),
      notify_new_event: Boolean(document.getElementById("setNotifyEvents")?.checked),
      notify_new_work_event: Boolean(document.getElementById("setNotifyWorkEvents")?.checked),
      nav_handedness,
    };
  }

  function readUpdateNotifyPref() {
    try {
      const raw = String(localStorage.getItem(UPDATE_NOTIFY_KEY) || "1").trim();
      return raw !== "0";
    } catch {
      return true;
    }
  }

  function writeUpdateNotifyPref(enabled) {
    try {
      localStorage.setItem(UPDATE_NOTIFY_KEY, enabled ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function normalizeHandedness(raw) {
    const valRaw = String(raw || "").trim().toLowerCase();
    if (valRaw === "left" || valRaw === "right") return valRaw;
    return "right";
  }

  function applyHandednessLayout(raw) {
    const handed = normalizeHandedness(raw);
    const form = document.getElementById("settingsNotifyForm");
    if (form) {
      form.classList.toggle("settings-handed-left", handed === "left");
      form.classList.toggle("settings-handed-right", handed !== "left");
    }
    document.querySelectorAll(".settings-actions-row").forEach((el) => {
      el.classList.toggle("settings-handed-left", handed === "left");
      el.classList.toggle("settings-handed-right", handed !== "left");
    });
  }

  function vapidPublicKey() {
    return String(document.body?.dataset?.vapidPublicKey || "").trim();
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const out = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) out[i] = rawData.charCodeAt(i);
    return out;
  }

  function abToBase64Url(ab) {
    if (!ab) return "";
    const bytes = new Uint8Array(ab);
    let str = "";
    bytes.forEach((b) => { str += String.fromCharCode(b); });
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function getSwRegistration() {
    if (!("serviceWorker" in navigator)) throw new Error("Service Worker nicht verfügbar.");
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
    if (reg) return reg;
    return navigator.serviceWorker.ready;
  }

  async function upsertPushSubscription(sub, enabled = true) {
    if (!sub) return;
    const endpoint = String(sub.endpoint || "").trim();
    if (!endpoint) return;
    const p256dh = abToBase64Url(sub.getKey("p256dh"));
    const auth = abToBase64Url(sub.getKey("auth"));
    const payload = [{
      user_id: uid(),
      endpoint,
      p256dh,
      auth,
      enabled: Boolean(enabled),
      notify_app_update: readUpdateNotifyPref(),
      user_agent: String(navigator.userAgent || "").slice(0, 500),
      updated_at: new Date().toISOString(),
    }];
    await sb("/rest/v1/push_subscriptions", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload),
    }, true);
  }

  async function deletePushSubscription(endpoint) {
    const ep = String(endpoint || "").trim();
    if (!ep) return;
    await sb(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(ep)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }, true);
  }

  async function enablePushNotifications() {
    if (!uid()) throw new Error("Bitte einloggen.");
    if (!("Notification" in window)) throw new Error("Browser unterstützt keine Benachrichtigungen.");
    if (!("PushManager" in window)) throw new Error("Push wird auf diesem Gerät nicht unterstützt.");
    const key = vapidPublicKey();
    if (!key) throw new Error("PUBLIC_VAPID_PUBLIC_KEY fehlt.");

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Benachrichtigung nicht erlaubt.");

    const reg = await getSwRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    await upsertPushSubscription(sub, true);
  }

  async function disablePushNotifications() {
    if (!uid()) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const reg = await getSwRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = String(sub.endpoint || "");
    await sub.unsubscribe().catch(() => {});
    await deletePushSubscription(endpoint).catch(() => {});
  }

  function applyState(s) {
    const state = s || {};
    const set = (id, checked, fallback = true) => {
      const el = document.getElementById(id);
      if (el) el.checked = checked ?? fallback;
    };
    set("setNotifyPosts", state.notify_new_post, true);
    set("setNotifyEvents", state.notify_new_event, true);
    set("setNotifyWorkEvents", state.notify_new_work_event, true);
    set("setNotifyAppUpdate", readUpdateNotifyPref(), true);
    const handed = String(state.nav_handedness || "right").toLowerCase();
    const handedEl = document.getElementById("setHandedness");
    if (handedEl) handedEl.value = handed === "left" || handed === "right" ? handed : "right";
    applyHandednessLayout(handed);
  }

  function loadFallback() {
    try {
      return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveFallback(state) {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(state || {}));
    } catch {
      // ignore storage failures
    }
  }

  function looksLikeMissingSettingsTable(err) {
    const msg = String(err?.message || "").toLowerCase();
    return (msg.includes("user_settings") && (msg.includes("does not exist") || msg.includes("relation")))
      || (msg.includes("column") && msg.includes("user_settings"));
  }

  function looksLikeMissingAccountRpc(err) {
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("self_member_profile_get")
      || msg.includes("self_member_profile_update")
      || msg.includes("function") && msg.includes("does not exist");
  }

  function readAccountFormState() {
    return {
      first_name: val(document.getElementById("accountFirstName")?.value),
      last_name: val(document.getElementById("accountLastName")?.value),
      email: val(document.getElementById("accountEmail")?.value).toLowerCase(),
      street: val(document.getElementById("accountStreet")?.value),
      zip: val(document.getElementById("accountZip")?.value),
      city: val(document.getElementById("accountCity")?.value),
      phone: val(document.getElementById("accountPhone")?.value),
      mobile: val(document.getElementById("accountMobile")?.value),
    };
  }

  function applyAccountView(row = {}) {
    setInputValue("accountViewMemberNo", safeLabel(row.member_no));
    setInputValue("accountViewClubCode", safeLabel(row.club_code));
    setInputValue("accountViewFirstName", safeLabel(row.first_name));
    setInputValue("accountViewLastName", safeLabel(row.last_name));
    setInputValue("accountViewEmail", safeLabel(row.email));
    setInputValue("accountViewStreet", safeLabel(row.street));
    setInputValue("accountViewZip", safeLabel(row.zip));
    setInputValue("accountViewCity", safeLabel(row.city));
    setInputValue("accountViewPhone", safeLabel(row.phone));
    setInputValue("accountViewMobile", safeLabel(row.mobile));
  }

  function applyAccountForm(row = {}) {
    setInputValue("accountMemberNo", row.member_no);
    setInputValue("accountClubCode", row.club_code);
    setInputValue("accountFirstName", row.first_name);
    setInputValue("accountLastName", row.last_name);
    setInputValue("accountEmail", row.email);
    setInputValue("accountStreet", row.street);
    setInputValue("accountZip", row.zip);
    setInputValue("accountCity", row.city);
    setInputValue("accountPhone", row.phone);
    setInputValue("accountMobile", row.mobile);
  }

  function setAccountEditMode(active) {
    const view = document.getElementById("settingsAccountView");
    const form = document.getElementById("settingsAccountForm");
    const enabled = Boolean(active);
    if (view) {
      view.hidden = enabled;
      view.classList.toggle("hidden", enabled);
    }
    if (form) {
      form.hidden = !enabled;
      form.classList.toggle("hidden", !enabled);
    }
  }

  async function loadAccountProfile() {
    const rows = await sb("/rest/v1/rpc/self_member_profile_get", { method: "POST", body: "{}" }, true);
    if (Array.isArray(rows) && rows[0]) return rows[0];
    return null;
  }

  async function loadAccountFallback() {
    const userId = uid();
    if (!userId) return null;
    const [profileRows, identityRows] = await Promise.all([
      sb(`/rest/v1/profiles?select=id,member_no,first_name,last_name,email,club_id,active_club_id&limit=1&id=eq.${encodeURIComponent(userId)}`, { method: "GET" }, true).catch(() => []),
      sb(`/rest/v1/club_member_identities?select=club_id,member_no&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }, true).catch(() => []),
    ]);
    const profile = Array.isArray(profileRows) && profileRows[0] ? profileRows[0] : null;
    const identities = Array.isArray(identityRows) ? identityRows : [];
    const preferredClubId = val(profile?.active_club_id) || val(profile?.club_id) || val(identities[0]?.club_id);
    const preferredIdentity = identities.find((row) => val(row?.club_id) === preferredClubId) || identities[0] || null;
    const internalMemberNo = val(preferredIdentity?.member_no) || val(profile?.member_no);

    let clubRow = null;
    let memberRow = null;
    if (preferredClubId && internalMemberNo) {
      const [clubRows, memberRows] = await Promise.all([
        sb(`/rest/v1/club_members?select=club_id,club_code,member_no,club_member_no,first_name,last_name&club_id=eq.${encodeURIComponent(preferredClubId)}&member_no=eq.${encodeURIComponent(internalMemberNo)}&limit=1`, { method: "GET" }, true).catch(() => []),
        sb(`/rest/v1/members?select=club_id,membership_number,club_member_no,first_name,last_name,email,street,zip,city,phone,mobile&club_id=eq.${encodeURIComponent(preferredClubId)}&membership_number=eq.${encodeURIComponent(internalMemberNo)}&limit=1`, { method: "GET" }, true).catch(() => []),
      ]);
      clubRow = Array.isArray(clubRows) && clubRows[0] ? clubRows[0] : null;
      memberRow = Array.isArray(memberRows) && memberRows[0] ? memberRows[0] : null;
    }

    if (!profile && !clubRow && !memberRow) return null;

    return {
      member_no: val(memberRow?.club_member_no) || val(clubRow?.club_member_no) || internalMemberNo,
      club_code: val(clubRow?.club_code),
      first_name: val(memberRow?.first_name) || val(clubRow?.first_name) || val(profile?.first_name),
      last_name: val(memberRow?.last_name) || val(clubRow?.last_name) || val(profile?.last_name),
      email: val(memberRow?.email) || val(profile?.email),
      street: val(memberRow?.street),
      zip: val(memberRow?.zip),
      city: val(memberRow?.city),
      phone: val(memberRow?.phone),
      mobile: val(memberRow?.mobile),
    };
  }

  async function updateAuthEmail(email) {
    const nextEmail = val(email).toLowerCase();
    if (!nextEmail || !nextEmail.includes("@")) throw new Error("Bitte eine gültige E-Mail eingeben.");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/app/einstellungen/")}`;
    await sb("/auth/v1/user", {
      method: "PUT",
      body: JSON.stringify({ email: nextEmail, email_redirect_to: redirectTo }),
    }, true);
    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(uid())}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ email: nextEmail }),
    }, true);
  }

  async function updateProfileEmailOnly(email) {
    const nextEmail = val(email).toLowerCase();
    if (!nextEmail || !nextEmail.includes("@")) throw new Error("Bitte eine gültige E-Mail eingeben.");
    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(uid())}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ email: nextEmail }),
    }, true);
  }

  async function loadAndRenderAccount() {
    try {
      accountState = await loadAccountProfile();
      applyAccountView(accountState || {});
      applyAccountForm(accountState || {});
      return;
    } catch (err) {
      if (!looksLikeMissingAccountRpc(err)) throw err;
    }

    accountState = await loadAccountFallback();
    applyAccountView(accountState || {});
    applyAccountForm(accountState || {});
    setMsg("Account-RPC noch nicht ausgerollt. Vereinskontext wird ueber den Fallback geladen.");
  }

  async function saveAccount() {
    const next = readAccountFormState();
    const prevEmail = val(accountState?.email).toLowerCase();
    const nextEmail = val(next.email).toLowerCase();

    const payload = {
      p_first_name: next.first_name || null,
      p_last_name: next.last_name || null,
      p_street: next.street || null,
      p_zip: next.zip || null,
      p_city: next.city || null,
      p_phone: next.phone || null,
      p_mobile: next.mobile || null,
    };

    const rows = await sb("/rest/v1/rpc/self_member_profile_update", {
      method: "POST",
      body: JSON.stringify(payload),
    }, true);
    if (Array.isArray(rows) && rows[0]) accountState = rows[0];

    let emailNote = "";
    if (nextEmail && nextEmail !== prevEmail) {
      try {
        if (isAuthEmailChangeEnabled()) {
          await updateAuthEmail(nextEmail);
          emailNote = " E-Mail-Aenderung angestossen; bitte Verifizierungs-Mail bestätigen.";
        } else {
          await updateProfileEmailOnly(nextEmail);
          emailNote = " Kontakt-E-Mail gespeichert. Login bleibt weiterhin auf Mitgliedsnummer + Passwort.";
        }
      } catch (err) {
        emailNote = ` E-Mail konnte nicht geaendert werden (${String(err?.message || "auth_error")}). Stammdaten wurden trotzdem gespeichert.`;
      }
    }

    await loadAndRenderAccount();
    setAccountEditMode(false);
    setMsg(`Account gespeichert.${emailNote}`);
  }

  function bindAccountActions() {
    const editBtn = document.getElementById("settingsEditAccountBtn");
    const cancelBtn = document.getElementById("settingsCancelAccountBtn");
    const accountForm = document.getElementById("settingsAccountForm");

    if (editBtn && !editBtn.dataset.bound) {
      editBtn.dataset.bound = "1";
      editBtn.addEventListener("click", () => {
        applyAccountForm(accountState || {});
        setAccountEditMode(true);
      });
    }

    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.dataset.bound = "1";
      cancelBtn.addEventListener("click", () => {
        applyAccountForm(accountState || {});
        setAccountEditMode(false);
      });
    }

    if (accountForm && !accountForm.dataset.bound) {
      accountForm.dataset.bound = "1";
      accountForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await saveAccount();
        } catch (err) {
          setMsg(err?.message || "Account konnte nicht gespeichert werden.");
        }
      });
    }
  }

  async function loadRemoteSettings() {
    const userId = uid();
    if (!userId) throw new Error("Bitte einloggen.");
    const rows = await sb(`/rest/v1/user_settings?select=notify_new_post,notify_new_event,notify_new_work_event,nav_handedness&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { method: "GET" }, true);
    if (!Array.isArray(rows) || !rows[0]) return null;
    return rows[0];
  }

  async function saveRemoteSettings(state) {
    const userId = uid();
    if (!userId) throw new Error("Bitte einloggen.");
    await sb("/rest/v1/user_settings", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ user_id: userId, ...state }]),
    }, true);
  }

  async function init() {
    const form = document.getElementById("settingsNotifyForm");
    if (!form) return;

    bindAccountActions();
    setAccountEditMode(false);

    if (!uid()) {
      setMsg("Bitte einloggen.");
      return;
    }

    try {
      const reloadHint = String(sessionStorage.getItem(RELOAD_HINT_KEY) || "").trim();
      if (reloadHint) {
        setMsg(reloadHint);
        sessionStorage.removeItem(RELOAD_HINT_KEY);
      }
    } catch {
      // ignore
    }

    try {
      await loadAndRenderAccount();
    } catch (err) {
      setMsg(err?.message || "Konnte Accountdaten nicht laden.");
    }

    try {
      const remote = await loadRemoteSettings();
      applyState(remote || {});
      if (!String(document.getElementById("settingsMsg")?.textContent || "").trim()) {
        setMsg("Einstellungen geladen.");
      }
    } catch (err) {
      applyState(loadFallback());
      if (looksLikeMissingSettingsTable(err)) setMsg("DB-Setup fehlt. Lokaler Modus aktiv.");
      else setMsg(err?.message || "Konnte Einstellungen nicht laden.");
    }

    if (!form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const state = formState();
        const wantsUpdateNotify = Boolean(document.getElementById("setNotifyAppUpdate")?.checked);
        writeUpdateNotifyPref(wantsUpdateNotify);
        try {
          await saveRemoteSettings(state);
          let pushWarning = "";
          if (wantsUpdateNotify) {
            try {
              await enablePushNotifications();
            } catch (err) {
              pushWarning = ` Hinweis Push: ${String(err?.message || "Registrierung fehlgeschlagen.")}`;
            }
          } else {
            await disablePushNotifications().catch(() => {});
          }
          setMsg(`Gespeichert.${pushWarning}`);
          document.dispatchEvent(new CustomEvent("vdan:portal-settings", { detail: { nav_handedness: state.nav_handedness } }));
        } catch (err) {
          saveFallback(state);
          if (looksLikeMissingSettingsTable(err)) setMsg("DB-Setup fehlt. Lokal gespeichert.");
          else setMsg(err?.message || "Speichern fehlgeschlagen.");
          document.dispatchEvent(new CustomEvent("vdan:portal-settings", { detail: { nav_handedness: state.nav_handedness } }));
        }
      });
    }

    const versionEl = document.getElementById("settingsAppVersion");
    if (versionEl) versionEl.textContent = String(document.body?.dataset?.appVersion || "unbekannt");

    const handednessEl = document.getElementById("setHandedness");
    if (handednessEl && !handednessEl.dataset.bound) {
      handednessEl.dataset.bound = "1";
      handednessEl.addEventListener("change", (e) => {
        applyHandednessLayout(String(e?.target?.value || "right"));
      });
    }

    const reloadBtn = document.getElementById("settingsReloadBtn");
    if (reloadBtn && !reloadBtn.dataset.bound) {
      reloadBtn.dataset.bound = "1";
      reloadBtn.addEventListener("click", () => {
        const msg = `Seite wird neu geladen (Version ${String(document.body?.dataset?.appVersion || "-")}).`;
        setMsg(msg);
        try {
          sessionStorage.setItem(RELOAD_HINT_KEY, `Neu geladen. Aktive Version: ${String(document.body?.dataset?.appVersion || "-")}.`);
        } catch {
          // ignore
        }
        window.setTimeout(() => window.location.reload(), 120);
      });
    }

    const enableNotifyBtn = document.getElementById("settingsEnableNotifyBtn");
    if (enableNotifyBtn && !enableNotifyBtn.dataset.bound) {
      enableNotifyBtn.dataset.bound = "1";
      enableNotifyBtn.addEventListener("click", async () => {
        try {
          await enablePushNotifications();
          const notifyToggle = document.getElementById("setNotifyAppUpdate");
          if (notifyToggle) notifyToggle.checked = true;
          writeUpdateNotifyPref(true);
          setMsg("Benachrichtigungen erlaubt und registriert.");
        } catch (err) {
          setMsg(err?.message || "Benachrichtigung konnte nicht aktiviert werden.");
        }
      });
    }

    const checkUpdateBtn = document.getElementById("settingsCheckUpdateBtn");
    if (checkUpdateBtn && !checkUpdateBtn.dataset.bound) {
      checkUpdateBtn.dataset.bound = "1";
      checkUpdateBtn.addEventListener("click", async () => {
        const btn = document.getElementById("settingsCheckUpdateBtn");
        try {
          if (btn) btn.setAttribute("disabled", "disabled");
          if (!("serviceWorker" in navigator)) {
            setMsg("Service Worker nicht verfügbar.");
            return;
          }
          const reg = await navigator.serviceWorker.getRegistration("/");
          if (!reg) {
            setMsg("Keine SW-Registrierung gefunden.");
            return;
          }
          const currentVersion = String(document.body?.dataset?.appVersion || "unbekannt");
          setMsg(`Prüfe Update... (aktuell ${currentVersion})`);
          let controllerChanged = false;
          const onControllerChange = () => {
            controllerChanged = true;
          };
          navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage("SKIP_WAITING");
            setMsg("Update bereit. Seite lädt neu.");
            try {
              sessionStorage.setItem(RELOAD_HINT_KEY, "Update übernommen und Seite neu geladen.");
            } catch {
              // ignore
            }
            window.setTimeout(() => window.location.reload(), 250);
            return;
          }
          if (controllerChanged) {
            try {
              sessionStorage.setItem(RELOAD_HINT_KEY, "Neues Update wurde übernommen.");
            } catch {
              // ignore
            }
            window.location.reload();
            return;
          }
          setMsg(`Kein neues Update gefunden. Aktive Version: ${currentVersion}.`);
        } catch (err) {
          setMsg(err?.message || "Updateprüfung fehlgeschlagen.");
        } finally {
          if (btn) btn.removeAttribute("disabled");
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
