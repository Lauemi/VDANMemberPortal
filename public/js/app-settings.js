;(() => {
  const FALLBACK_KEY = "vdan_user_settings_fallback_v1";

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
    return {
      notify_new_post: Boolean(document.getElementById("setNotifyPosts")?.checked),
      notify_new_event: Boolean(document.getElementById("setNotifyEvents")?.checked),
      notify_new_work_event: Boolean(document.getElementById("setNotifyWorkEvents")?.checked),
    };
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
    return msg.includes("user_settings") && (msg.includes("does not exist") || msg.includes("relation"));
  }

  async function loadRemoteSettings() {
    const userId = uid();
    if (!userId) throw new Error("Bitte einloggen.");
    const rows = await sb(`/rest/v1/user_settings?select=notify_new_post,notify_new_event,notify_new_work_event&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { method: "GET" }, true);
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
      try {
        await saveRemoteSettings(state);
        setMsg("Gespeichert.");
      } catch (err) {
        saveFallback(state);
        if (looksLikeMissingSettingsTable(err)) setMsg("DB-Setup fehlt. Lokal gespeichert.");
        else setMsg(err?.message || "Speichern fehlgeschlagen.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
