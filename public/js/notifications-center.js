;(() => {
  const state = {
    notifications: [],
    open: false,
    pollTimer: null,
    available: true,
  };

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function isLoggedIn() {
    return Boolean(session()?.access_token);
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", hidden);
    el.toggleAttribute("hidden", hidden);
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    if (!url || !key) throw new Error("Supabase not configured");
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.detail || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ([]));
  }

  function isMissingNotificationsSchema(error) {
    return String(error?.message || "").toLowerCase().includes("member_notifications");
  }

  function unreadCount() {
    return state.notifications.filter((row) => !row.is_read).length;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("de-DE");
  }

  async function loadNotifications() {
    if (!isLoggedIn()) {
      state.notifications = [];
      render();
      return;
    }

    try {
      const rows = await sb("/rest/v1/member_notifications?select=id,type,title,message,severity,source_kind,source_id,action_url,is_read,read_at,created_at&order=created_at.desc&limit=20", { method: "GET" }, true);
      state.notifications = Array.isArray(rows) ? rows : [];
      state.available = true;
    } catch (error) {
      if (!isMissingNotificationsSchema(error)) throw error;
      state.available = false;
      state.notifications = [];
    }

    render();
  }

  async function markRead(id) {
    await sb("/rest/v1/rpc/member_notification_mark_read", {
      method: "POST",
      body: JSON.stringify({ p_notification_id: id }),
    }, true);
    await loadNotifications();
  }

  async function markAllRead() {
    await sb("/rest/v1/rpc/member_notification_mark_all_read", {
      method: "POST",
      body: JSON.stringify({}),
    }, true);
    await loadNotifications();
  }

  function renderBadge() {
    const wrap = document.getElementById("headerNotificationWrap");
    const badge = document.getElementById("headerNotificationBadge");
    const toggle = document.getElementById("headerNotificationToggle");
    const enabled = isLoggedIn() && state.available;
    setHidden(wrap, !enabled);
    if (toggle) toggle.setAttribute("aria-expanded", state.open ? "true" : "false");

    const count = unreadCount();
    if (!enabled || !badge) return;
    badge.textContent = count > 99 ? "99+" : String(count);
    setHidden(badge, count <= 0);
  }

  function renderList() {
    const root = document.getElementById("memberNotificationsList");
    if (!root) return;

    if (!isLoggedIn()) {
      root.innerHTML = `<div class="member-notifications-empty">Melde dich an, um deine Hinweise zu sehen.</div>`;
      return;
    }

    if (!state.available) {
      root.innerHTML = `<div class="member-notifications-empty">Das Benachrichtigungssystem ist in dieser Umgebung noch nicht aktiv.</div>`;
      return;
    }

    if (!state.notifications.length) {
      root.innerHTML = `<div class="member-notifications-empty">Aktuell gibt es keine neuen Hinweise.</div>`;
      return;
    }

    root.innerHTML = state.notifications.map((row) => `
      <article class="member-notification-card ${row.is_read ? "" : "is-unread"}">
        <div class="member-notification-card__top">
          <div>
            <p class="member-notification-card__title">${esc(row.title || "Hinweis")}</p>
          </div>
          <p class="member-notification-card__time">${esc(formatDate(row.created_at))}</p>
        </div>
        <p class="member-notification-card__message">${esc(row.message || "")}</p>
        <div class="member-notification-card__actions">
          ${row.action_url ? `<a class="member-notification-card__open" href="${esc(row.action_url)}" data-notification-open="${esc(row.id)}">Öffnen</a>` : ""}
          ${row.is_read ? "" : `<button type="button" class="member-notification-card__read" data-notification-read="${esc(row.id)}">Als gelesen</button>`}
        </div>
      </article>
    `).join("");
  }

  function renderDrawer() {
    const drawer = document.getElementById("memberNotificationsDrawer");
    setHidden(drawer, !state.open || !isLoggedIn() || !state.available);
  }

  function render() {
    renderBadge();
    renderList();
    renderDrawer();
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();
    if (!isLoggedIn()) return;
    state.pollTimer = setInterval(() => {
      if (!document.hidden) loadNotifications().catch(() => {});
    }, 60 * 1000);
  }

  function closeDrawer() {
    state.open = false;
    renderDrawer();
    renderBadge();
  }

  async function init() {
    if (!isLoggedIn()) {
      state.available = true;
      state.notifications = [];
      closeDrawer();
      render();
      stopPolling();
      return;
    }
    await loadNotifications().catch(() => {});
    startPolling();
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("#headerNotificationToggle")) {
      if (!isLoggedIn() || !state.available) return;
      state.open = !state.open;
      renderDrawer();
      renderBadge();
      return;
    }

    if (target.closest("#memberNotificationsClose")) {
      closeDrawer();
      return;
    }

    if (target.closest("#memberNotificationsMarkAll")) {
      try {
        await markAllRead();
      } catch {
        // ignore
      }
      return;
    }

    const readBtn = target.closest("[data-notification-read]");
    if (readBtn) {
      const id = String(readBtn.getAttribute("data-notification-read") || "").trim();
      if (!id) return;
      try {
        await markRead(id);
      } catch {
        // ignore
      }
      return;
    }

    const openLink = target.closest("[data-notification-open]");
    if (openLink) {
      event.preventDefault();
      const id = String(openLink.getAttribute("data-notification-open") || "").trim();
      const href = String(openLink.getAttribute("href") || "").trim();
      if (!id) return;
      try {
        await markRead(id);
      } catch {
        // ignore
      }
      if (href) window.location.href = href;
      return;
    }

    const drawer = document.getElementById("memberNotificationsPanel");
    const toggle = document.getElementById("headerNotificationToggle");
    if (state.open && drawer && !drawer.contains(target) && toggle && !toggle.contains(target)) {
      closeDrawer();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadNotifications().catch(() => {});
  });

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  document.addEventListener("vdan:notifications-refresh", () => {
    loadNotifications().catch(() => {});
  });
})();
