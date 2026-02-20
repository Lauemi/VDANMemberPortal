;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
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
      throw new Error(err?.message || err?.hint || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
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
    const rows = await sb("/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status,created_at&order=starts_at.desc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function createEvent(payload) {
    return sb("/rest/v1/rpc/term_event_create", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  async function publishEvent(id) {
    return sb("/rest/v1/rpc/term_event_publish", { method: "POST", body: JSON.stringify({ p_event_id: id }) }, true);
  }

  async function patchStatus(id, status) {
    await sb(`/rest/v1/club_events?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }, true);
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
        await createEvent({
          p_title: String(document.getElementById("termTitle")?.value || "").trim(),
          p_description: String(document.getElementById("termDescription")?.value || "").trim() || null,
          p_location: String(document.getElementById("termLocation")?.value || "").trim() || null,
          p_starts_at: toIso(String(document.getElementById("termStartsAt")?.value || "")),
          p_ends_at: toIso(String(document.getElementById("termEndsAt")?.value || "")),
        });
        closeDialog();
        setMsg("Termin erstellt.");
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
        if (publishId) await publishEvent(publishId);
        if (cancelId) await patchStatus(cancelId, "cancelled");
        if (archiveId) await patchStatus(archiveId, "archived");
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
        await patchStatus(archiveId, "archived");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Aktion fehlgeschlagen");
      }
    });

    await refresh();
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
