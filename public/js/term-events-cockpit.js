;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const OFFLINE_NS = "term_cockpit";
  let createDialog = null;
  let isManager = false;

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
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
      const e = new Error(err?.message || err?.hint || `Request failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return res.json().catch(() => ({}));
  }

  async function sbGetCached(cacheKey, path, withAuth = false, fallback = []) {
    try {
      const out = await sb(path, { method: "GET" }, withAuth);
      await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, cacheKey, out);
      return out;
    } catch (err) {
      const cached = await window.VDAN_OFFLINE_SYNC?.cacheGet?.(OFFLINE_NS, cacheKey, fallback);
      if (cached !== null && cached !== undefined) return cached;
      throw err;
    }
  }

  async function queueAction(type, payload) {
    await window.VDAN_OFFLINE_SYNC?.enqueue?.(OFFLINE_NS, { type, payload });
  }

  function setMsg(text = "") {
    const el = document.getElementById("termCockpitMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmt(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("de-DE");
  }

  async function loadRoles() {
    const uid = session()?.user?.id;
    if (!uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listEvents() {
    const rows = await sbGetCached(
      "events",
      "/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status,created_at&order=starts_at.desc",
      true,
      []
    );
    return Array.isArray(rows) ? rows : [];
  }

  async function createEvent(payload) {
    try {
      return await sb("/rest/v1/rpc/term_event_create", { method: "POST", body: JSON.stringify(payload) }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("create_event", payload);
        return { queued: true };
      }
      throw err;
    }
  }

  async function publishEvent(id) {
    try {
      return await sb("/rest/v1/rpc/term_event_publish", { method: "POST", body: JSON.stringify({ p_event_id: id }) }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("publish_event", { p_event_id: id });
        return { queued: true };
      }
      throw err;
    }
  }

  async function patchStatus(id, status) {
    try {
      await sb(`/rest/v1/club_events?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }, true);
      return { queued: false };
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("patch_status", { id, status });
        return { queued: true };
      }
      throw err;
    }
  }

  async function flushOfflineQueue() {
    if (!window.VDAN_OFFLINE_SYNC?.flush) return;
    await window.VDAN_OFFLINE_SYNC.flush(OFFLINE_NS, async (op) => {
      const p = op?.payload || {};
      if (op?.type === "create_event") {
        await sb("/rest/v1/rpc/term_event_create", { method: "POST", body: JSON.stringify(p) }, true);
        return;
      }
      if (op?.type === "publish_event") {
        await sb("/rest/v1/rpc/term_event_publish", { method: "POST", body: JSON.stringify(p) }, true);
        return;
      }
      if (op?.type === "patch_status") {
        await sb(`/rest/v1/club_events?id=eq.${encodeURIComponent(p.id || "")}`, { method: "PATCH", body: JSON.stringify({ status: p.status }) }, true);
      }
    });
  }

  function render(rows) {
    const activeRoot = document.getElementById("termCockpitActive");
    const historyRoot = document.getElementById("termCockpitHistory");
    if (!activeRoot || !historyRoot) return;

    const now = Date.now();
    const active = rows.filter((r) => new Date(r.ends_at).getTime() >= now && r.status !== "archived");
    const history = rows.filter((r) => new Date(r.ends_at).getTime() < now || r.status === "archived");

    const renderList = (list, root) => {
      root.innerHTML = "";
      if (!list.length) {
        root.innerHTML = `<p class="small">Keine Einträge.</p>`;
        return;
      }
      list.forEach((row) => {
        const item = document.createElement("article");
        item.className = "card term-card";
        item.innerHTML = `
          <div class="card__body">
            <h3>${escapeHtml(row.title)}</h3>
            <p class="small">${escapeHtml(fmt(row.starts_at))} - ${escapeHtml(fmt(row.ends_at))}</p>
            <p class="small">${escapeHtml(row.location || "Ort offen")} | Status: ${escapeHtml(row.status)}</p>
            ${row.description ? `<p class="small">${escapeHtml(row.description)}</p>` : ""}
            <div class="work-actions">
              <button class="feed-btn" type="button" data-publish="${row.id}" ${row.status === "draft" ? "" : "disabled"}>Publish</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-cancel="${row.id}" ${row.status === "published" ? "" : "disabled"}>Cancel</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-archive="${row.id}" ${row.status !== "archived" ? "" : "disabled"}>Archive</button>
            </div>
          </div>
        `;
        root.appendChild(item);
      });
    };

    renderList(active, activeRoot);
    renderList(history, historyRoot);
  }

  function toIso(local) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function openDialog() {
    document.getElementById("termCreateForm")?.reset();
    if (!createDialog?.open) createDialog.showModal();
  }

  function closeDialog() {
    if (createDialog?.open) createDialog.close();
  }

  async function refresh() {
    const rows = await listEvents();
    render(rows);
  }

  async function init() {
    const { url, key } = cfg();
    createDialog = document.getElementById("termCreateDialog");

    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    const roles = await loadRoles().catch(() => []);
    isManager = roles.some((r) => MANAGER_ROLES.has(r));
    if (!isManager) {
      setMsg("Kein Zugriff: nur Vorstand/Admin.");
      return;
    }

    document.getElementById("termCreateOpenTop")?.addEventListener("click", openDialog);
    document.getElementById("termCreateOpenFab")?.addEventListener("click", openDialog);
    document.getElementById("termCreateClose")?.addEventListener("click", closeDialog);

    document.getElementById("termCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        setMsg("Termin wird erstellt...");
        const out = await createEvent({
          p_title: String(document.getElementById("termTitle")?.value || "").trim(),
          p_description: String(document.getElementById("termDescription")?.value || "").trim() || null,
          p_location: String(document.getElementById("termLocation")?.value || "").trim() || null,
          p_starts_at: toIso(String(document.getElementById("termStartsAt")?.value || "")),
          p_ends_at: toIso(String(document.getElementById("termEndsAt")?.value || "")),
        });
        closeDialog();
        setMsg(out?.queued ? "Offline gespeichert. Termin wird bei Empfang übertragen." : "Termin erstellt.");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Erstellen fehlgeschlagen");
      }
    });

    document.getElementById("termCockpitActive")?.addEventListener("click", async (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const publishId = t.getAttribute("data-publish");
      const cancelId = t.getAttribute("data-cancel");
      const archiveId = t.getAttribute("data-archive");
      try {
        if (publishId) {
          const out = await publishEvent(publishId);
          setMsg(out?.queued ? "Offline gespeichert. Veröffentlichung folgt bei Empfang." : "Termin veröffentlicht.");
        }
        if (cancelId) {
          const out = await patchStatus(cancelId, "cancelled");
          setMsg(out?.queued ? "Offline gespeichert. Absage folgt bei Empfang." : "Termin abgesagt.");
        }
        if (archiveId) {
          const out = await patchStatus(archiveId, "archived");
          setMsg(out?.queued ? "Offline gespeichert. Archivierung folgt bei Empfang." : "Termin archiviert.");
        }
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Aktion fehlgeschlagen");
      }
    });

    document.getElementById("termCockpitHistory")?.addEventListener("click", async (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const archiveId = t.getAttribute("data-archive");
      if (!archiveId) return;
      try {
        const out = await patchStatus(archiveId, "archived");
        setMsg(out?.queued ? "Offline gespeichert. Archivierung folgt bei Empfang." : "Termin archiviert.");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Aktion fehlgeschlagen");
      }
    });

    await flushOfflineQueue().catch(() => {});
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  window.addEventListener("online", () => {
    flushOfflineQueue().then(() => refresh()).catch(() => {});
  });
})();
