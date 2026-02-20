;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const state = {
    rows: [],
    search: "",
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

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  function setMsg(text = "") {
    const el = document.getElementById("documentsAdminMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function uid() {
    return session()?.user?.id || null;
  }

  async function loadMyRoles() {
    const userId = uid();
    if (!userId) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listDocuments() {
    const rows = await sb("/rest/v1/documents?select=id,title,category,description,public_url,storage_bucket,storage_path,sort_order,is_active,updated_at&order=category.asc,sort_order.asc,title.asc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function filterRows(rows) {
    const q = state.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.title || ""} ${r.category || ""} ${r.description || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderRows(rows) {
    const root = document.getElementById("documentsAdminRows");
    if (!root) return;
    root.innerHTML = "";

    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine Dokumente gefunden.</p>`;
      return;
    }

    rows.forEach((doc) => {
      const row = document.createElement("div");
      row.className = "catch-row";
      row.style.gridTemplateColumns = "1.4fr 1fr 1.3fr .9fr .9fr";
      const source = doc.public_url
        ? "public_url"
        : doc.storage_bucket && doc.storage_path
          ? "storage"
          : "none";

      row.innerHTML = `
        <div style="display:grid;gap:6px;">
          <input data-f="title" data-id="${escapeHtml(doc.id)}" value="${escapeHtml(doc.title || "")}" placeholder="Titel" />
          <textarea data-f="description" data-id="${escapeHtml(doc.id)}" placeholder="Beschreibung" rows="2">${escapeHtml(doc.description || "")}</textarea>
          <input data-f="sort_order" data-id="${escapeHtml(doc.id)}" type="number" value="${Number(doc.sort_order || 100)}" placeholder="Sortierung" />
        </div>
        <div>
          <input data-f="category" data-id="${escapeHtml(doc.id)}" value="${escapeHtml(doc.category || "")}" placeholder="Kategorie" />
        </div>
        <div style="display:grid;gap:6px;">
          <select data-f="source_mode" data-id="${escapeHtml(doc.id)}">
            <option value="public_url" ${source === "public_url" ? "selected" : ""}>Public URL</option>
            <option value="storage" ${source === "storage" ? "selected" : ""}>Storage</option>
          </select>
          <input data-f="public_url" data-id="${escapeHtml(doc.id)}" value="${escapeHtml(doc.public_url || "")}" placeholder="/Downloads/Datei.pdf oder https://..." />
          <input data-f="storage_bucket" data-id="${escapeHtml(doc.id)}" value="${escapeHtml(doc.storage_bucket || "")}" placeholder="storage bucket" />
          <input data-f="storage_path" data-id="${escapeHtml(doc.id)}" value="${escapeHtml(doc.storage_path || "")}" placeholder="storage path" />
        </div>
        <div style="display:grid;gap:6px;align-content:start;">
          <select data-f="is_active" data-id="${escapeHtml(doc.id)}">
            <option value="true" ${doc.is_active ? "selected" : ""}>Aktiv</option>
            <option value="false" ${doc.is_active ? "" : "selected"}>Inaktiv</option>
          </select>
          <span class="small">Upd: ${escapeHtml(String(doc.updated_at || "").slice(0, 10) || "-")}</span>
        </div>
        <div style="display:grid;gap:6px;align-content:start;">
          <button type="button" class="feed-btn js-doc-save" data-id="${escapeHtml(doc.id)}">Speichern</button>
          <button type="button" class="feed-btn feed-btn--ghost js-doc-delete" data-id="${escapeHtml(doc.id)}">Löschen</button>
          <span class="small" data-doc-msg="${escapeHtml(doc.id)}"></span>
        </div>
      `;

      root.appendChild(row);
      syncSourceInputs(doc.id);
    });
  }

  function renderFiltered() {
    renderRows(filterRows(state.rows));
  }

  function readField(docId, field) {
    return document.querySelector(`[data-f="${CSS.escape(field)}"][data-id="${CSS.escape(docId)}"]`);
  }

  function syncSourceInputs(docId) {
    const mode = String(readField(docId, "source_mode")?.value || "public_url");
    const urlEl = readField(docId, "public_url");
    const bucketEl = readField(docId, "storage_bucket");
    const pathEl = readField(docId, "storage_path");
    const useUrl = mode === "public_url";
    if (urlEl) urlEl.disabled = !useUrl;
    if (bucketEl) bucketEl.disabled = useUrl;
    if (pathEl) pathEl.disabled = useUrl;
  }

  function collectPayload(docId) {
    const title = String(readField(docId, "title")?.value || "").trim();
    const category = String(readField(docId, "category")?.value || "").trim();
    const description = String(readField(docId, "description")?.value || "").trim();
    const sortOrderRaw = String(readField(docId, "sort_order")?.value || "100").trim();
    const isActive = String(readField(docId, "is_active")?.value || "true") === "true";
    const mode = String(readField(docId, "source_mode")?.value || "public_url");
    const publicUrl = String(readField(docId, "public_url")?.value || "").trim();
    const storageBucket = String(readField(docId, "storage_bucket")?.value || "").trim();
    const storagePath = String(readField(docId, "storage_path")?.value || "").trim();
    const sortOrder = Number.parseInt(sortOrderRaw, 10);

    if (!title) throw new Error("Titel fehlt");
    if (!category) throw new Error("Kategorie fehlt");
    if (!Number.isFinite(sortOrder)) throw new Error("Sortierung ist ungültig");

    const payload = {
      title,
      category,
      description: description || null,
      sort_order: sortOrder,
      is_active: isActive,
      public_url: null,
      storage_bucket: null,
      storage_path: null,
    };

    if (mode === "public_url") {
      if (!publicUrl) throw new Error("Public URL fehlt");
      payload.public_url = publicUrl;
    } else {
      if (!storageBucket || !storagePath) throw new Error("Storage Bucket/Pfad fehlt");
      payload.storage_bucket = storageBucket;
      payload.storage_path = storagePath;
    }

    return payload;
  }

  async function refresh() {
    const rows = await listDocuments();
    state.rows = rows;
    renderFiltered();
    setMsg(`Dokumente geladen: ${rows.length}`);
  }

  async function onSaveClick(e) {
    const btn = e.target.closest(".js-doc-save");
    if (!btn) return;
    const docId = String(btn.getAttribute("data-id") || "");
    if (!docId) return;
    const msg = document.querySelector(`[data-doc-msg="${CSS.escape(docId)}"]`);
    btn.disabled = true;
    if (msg) msg.textContent = "Speichere…";
    try {
      const payload = collectPayload(docId);
      await sb(`/rest/v1/documents?id=eq.${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      }, true);
      if (msg) msg.textContent = "Gespeichert";
      await refresh();
    } catch (err) {
      if (msg) msg.textContent = "Fehler";
      setMsg(err?.message || "Speichern fehlgeschlagen");
    } finally {
      btn.disabled = false;
    }
  }

  async function onDeleteClick(e) {
    const btn = e.target.closest(".js-doc-delete");
    if (!btn) return;
    const docId = String(btn.getAttribute("data-id") || "");
    if (!docId) return;
    if (!window.confirm("Dokument wirklich löschen?")) return;
    btn.disabled = true;
    try {
      await sb(`/rest/v1/documents?id=eq.${encodeURIComponent(docId)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      }, true);
      await refresh();
    } catch (err) {
      setMsg(err?.message || "Löschen fehlgeschlagen");
    } finally {
      btn.disabled = false;
    }
  }

  async function onAddClick() {
    const defaults = {
      title: "Neues Dokument",
      category: "Allgemein",
      description: null,
      public_url: "/Downloads/",
      storage_bucket: null,
      storage_path: null,
      sort_order: 100,
      is_active: true,
    };
    try {
      await sb("/rest/v1/documents", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([defaults]),
      }, true);
      await refresh();
    } catch (err) {
      setMsg(err?.message || "Anlegen fehlgeschlagen");
    }
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }
    const roles = await loadMyRoles().catch(() => []);
    const isManager = roles.some((r) => MANAGER_ROLES.has(r));
    if (!isManager) {
      setMsg("Kein Zugriff: nur Vorstand/Admin.");
      const root = document.getElementById("documentsAdminRows");
      if (root) root.innerHTML = "";
      return;
    }
    try {
      setMsg("Lade Dokumente...");
      await refresh();
    } catch (err) {
      setMsg(err?.message || "Laden fehlgeschlagen");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  document.addEventListener("click", (e) => {
    onSaveClick(e);
    onDeleteClick(e);
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#documentsAdminAddBtn");
    if (btn) onAddClick();
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest('[data-f="source_mode"]');
    if (!el) return;
    const id = String(el.getAttribute("data-id") || "");
    if (!id) return;
    syncSourceInputs(id);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "documentsAdminSearch") return;
    state.search = String(e.target.value || "");
    renderFiltered();
  });
})();
