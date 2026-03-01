;(() => {
  const FALLBACK_KEY = "vdan_user_settings_fallback_v1";
  const UPDATE_NOTIFY_KEY = "vdan_notify_app_update_v1";
  const PUSH_SCOPE = "/";

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

  function setMsg(text = "") {
    const el = document.getElementById("settingsMsg");
    if (el) el.textContent = text;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
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

  function isIosDevice() {
    const ua = String(navigator.userAgent || "").toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }

  function isStandaloneApp() {
    try {
      if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
    } catch {
      // ignore
    }
    return Boolean(window.navigator?.standalone);
  }

  async function waitForSwReady(timeoutMs = 8000) {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Service Worker nicht bereit. Bitte Seite neu laden.")), timeoutMs);
    });
    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }

  async function getSwRegistration() {
    if (!("serviceWorker" in navigator)) throw new Error("Service Worker nicht verfügbar.");
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
    if (reg) return reg;
    try {
      const created = await navigator.serviceWorker.register("/sw.js", { scope: PUSH_SCOPE });
      if (created) return created;
    } catch {
      // ignore and use ready fallback below
    }
    return waitForSwReady();
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
    if (isIosDevice() && !isStandaloneApp()) {
      throw new Error("Auf iPhone nur in der installierten Home-Bildschirm-App verfügbar.");
    }
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
    const set = (id, value, fallback = true) => {
      const el = document.getElementById(id);
      if (el) el.checked = value ?? fallback;
    };
    set("setNotifyPosts", state.notify_new_post, true);
    set("setNotifyEvents", state.notify_new_event, true);
    set("setNotifyWorkEvents", state.notify_new_work_event, true);
    set("setNotifyAppUpdate", readUpdateNotifyPref(), true);
    const handed = String(state.nav_handedness || "right").toLowerCase();
    const handedEl = document.getElementById("setHandedness");
    if (handedEl) handedEl.value = handed === "left" || handed === "right" ? handed : "right";
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
    if (!uid()) {
      setMsg("Bitte einloggen.");
      return;
    }

    try {
      const remote = await loadRemoteSettings();
      applyState(remote || {});
      setMsg("Einstellungen geladen.");
    } catch (err) {
      applyState(loadFallback());
      if (looksLikeMissingSettingsTable(err)) setMsg("DB-Setup fehlt. Lokaler Modus aktiv.");
      else setMsg(err?.message || "Konnte Einstellungen nicht laden.");
    }

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

    const versionEl = document.getElementById("settingsAppVersion");
    if (versionEl) versionEl.textContent = String(document.body?.dataset?.appVersion || "unbekannt");

    document.getElementById("settingsReloadBtn")?.addEventListener("click", () => {
      window.location.reload();
    });

    document.getElementById("settingsEnableNotifyBtn")?.addEventListener("click", async () => {
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

    document.getElementById("settingsCheckUpdateBtn")?.addEventListener("click", async () => {
      try {
        if (!("serviceWorker" in navigator)) {
          setMsg("Service Worker nicht verfügbar.");
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg) {
          setMsg("Keine SW-Registrierung gefunden.");
          return;
        }
        setMsg("Prüfe Update...");
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage("SKIP_WAITING");
          setMsg("Update bereit. Seite lädt neu.");
          return;
        }
        setMsg("Kein neues Update gefunden.");
      } catch (err) {
        setMsg(err?.message || "Updateprüfung fehlgeschlagen.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
