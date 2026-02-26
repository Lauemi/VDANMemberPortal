;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const VIEW_KEY = "app:viewMode:dokumente:v2";
  const TABLE_KEY_PREFIX = "app:viewSettings:dokumente:user:v2";
  const COLUMNS_DEFAULT = [
    { key: "title", label: "Titel", visible: true, kind: "text" },
    { key: "category", label: "Kategorie", visible: true, kind: "text" },
    { key: "source", label: "Quelle", visible: true, kind: "status" },
    { key: "status", label: "Status", visible: true, kind: "status" },
    { key: "updated_at", label: "Stand", visible: true, kind: "date" },
  ];
  const DOCUMENT_CATEGORIES = [
    "Formulare",
    "Mitgliedschaft",
    "Gewässer",
    "Termine",
    "Jugend",
    "Rechtliches",
    "Admin",
  ];

  const state = {
    rows: [],
    search: "",
    ansicht: "zeile",
    currentId: null,
    bound: false,
    uid: null,
    columns: COLUMNS_DEFAULT.map((c) => ({ ...c })),
    sort: { key: "title", dir: "asc" },
    columnFilter: {
      title: "",
      category: "",
      source: "",
      status: "",
      updated_at: "",
    },
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

  function uid() {
    return session()?.user?.id || null;
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setMsg(text = "") {
    const el = document.getElementById("documentsAdminMsg");
    if (el) el.textContent = text;
  }

  function setDialogMsg(text = "") {
    const el = document.getElementById("documentsDialogMsg");
    if (el) el.textContent = text;
  }

  function tableKey() {
    return `${TABLE_KEY_PREFIX}:${state.uid || "anon"}`;
  }

  function sourceKey(row) {
    if (row.public_url) return "link";
    if (row.storage_bucket && row.storage_path) return "datei";
    return "unvollstaendig";
  }

  function sourceLabel(row) {
    const k = sourceKey(row);
    if (k === "link") return "Direkter Link";
    if (k === "datei") return "Dateispeicher";
    return "Unvollständig";
  }

  function formatDate(v) {
    const s = String(v || "").slice(0, 10);
    return s || "-";
  }

  function loadAnsicht() {
    try {
      const v = String(localStorage.getItem(VIEW_KEY) || "zeile").trim().toLowerCase();
      return v === "karte" ? "karte" : "zeile";
    } catch {
      return "zeile";
    }
  }

  function saveAnsicht(v) {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
  }

  function loadTablePrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(tableKey()) || "{}") || {};
      const order = Array.isArray(raw.columns) ? raw.columns.map((x) => String(x || "")) : [];
      const visible = raw.visible && typeof raw.visible === "object" ? raw.visible : {};
      const byKey = new Map(COLUMNS_DEFAULT.map((c) => [c.key, { ...c }]));
      const ordered = [];
      order.forEach((k) => {
        if (!byKey.has(k)) return;
        const c = byKey.get(k);
        c.visible = visible[k] !== false;
        ordered.push(c);
        byKey.delete(k);
      });
      byKey.forEach((c) => {
        c.visible = visible[c.key] !== false;
        ordered.push(c);
      });
      if (Array.isArray(ordered) && ordered.length) state.columns = ordered;

      const sortKey = String(raw.sortKey || "title");
      const sortDir = String(raw.sortDir || "asc") === "desc" ? "desc" : "asc";
      if (state.columns.some((c) => c.key === sortKey)) state.sort.key = sortKey;
      state.sort.dir = sortDir;

      const f = raw.filter && typeof raw.filter === "object" ? raw.filter : {};
      state.columnFilter = {
        title: String(f.title || ""),
        category: String(f.category || ""),
        source: String(f.source || ""),
        status: String(f.status || ""),
        updated_at: String(f.updated_at || ""),
      };
    } catch {
      state.columns = COLUMNS_DEFAULT.map((c) => ({ ...c }));
    }
  }

  function saveTablePrefs() {
    try {
      const payload = {
        columns: state.columns.map((c) => c.key),
        visible: state.columns.reduce((acc, c) => ({ ...acc, [c.key]: Boolean(c.visible) }), {}),
        sortKey: state.sort.key,
        sortDir: state.sort.dir,
        filter: state.columnFilter,
      };
      localStorage.setItem(tableKey(), JSON.stringify(payload));
    } catch {
      // ignore
    }
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
      throw new Error(err?.message || err?.hint || err?.error_description || `Anfrage fehlgeschlagen (${res.status})`);
    }
    return res.json().catch(() => ({}));
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

  function visibleColumns() {
    const cols = state.columns.filter((c) => c.visible);
    return cols.length ? cols : [state.columns[0]];
  }

  function rowValue(row, key) {
    if (key === "source") return sourceLabel(row);
    if (key === "status") return row.is_active ? "Aktiv" : "Inaktiv";
    if (key === "updated_at") return formatDate(row.updated_at);
    if (key === "title") return String(row.title || "");
    if (key === "category") return String(row.category || "");
    return "";
  }

  function applyRows(rows) {
    const q = state.search.trim().toLowerCase();
    let out = rows.filter((r) => {
      const hitsSearch = !q || `${r.title || ""} ${r.category || ""} ${r.description || ""}`.toLowerCase().includes(q);
      if (!hitsSearch) return false;

      const fTitle = state.columnFilter.title.trim().toLowerCase();
      if (fTitle && !String(r.title || "").toLowerCase().includes(fTitle)) return false;

      const fCategory = state.columnFilter.category.trim().toLowerCase();
      if (fCategory && !String(r.category || "").toLowerCase().includes(fCategory)) return false;

      const fSource = state.columnFilter.source;
      if (fSource && sourceKey(r) !== fSource) return false;

      const fStatus = state.columnFilter.status;
      if (fStatus === "aktiv" && !r.is_active) return false;
      if (fStatus === "inaktiv" && r.is_active) return false;

      const fDate = state.columnFilter.updated_at;
      if (fDate && !String(r.updated_at || "").startsWith(fDate)) return false;

      return true;
    });

    const dir = state.sort.dir === "desc" ? -1 : 1;
    out = out.slice().sort((a, b) => {
      const av = String(rowValue(a, state.sort.key) || "").toLowerCase();
      const bv = String(rowValue(b, state.sort.key) || "").toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return out;
  }

  function tableGridTemplate() {
    return `repeat(${visibleColumns().length}, minmax(0, 1fr))`;
  }

  function renderTableHead() {
    const head = document.getElementById("documentsTableHead");
    if (!head) return;
    const cols = visibleColumns();
    head.style.gridTemplateColumns = tableGridTemplate();
    head.innerHTML = "";
    cols.forEach((col) => {
      const cell = document.createElement("div");
      cell.className = "documents-head__cell";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "documents-head__button";
      btn.setAttribute("data-sort-key", col.key);
      const active = state.sort.key === col.key;
      const arrow = active ? (state.sort.dir === "asc" ? "↑" : "↓") : "";
      btn.textContent = arrow ? `${col.label} ${arrow}` : col.label;
      cell.appendChild(btn);
      head.appendChild(cell);
    });
  }

  function renderZeilen(rows) {
    const root = document.getElementById("documentsAdminRowsZeile");
    if (!root) return;
    root.innerHTML = "";

    if (!rows.length) {
      root.innerHTML = '<p class="small">Keine Dokumente gefunden.</p>';
      return;
    }

    const cols = visibleColumns();
    rows.forEach((doc) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "catch-row documents-row";
      row.setAttribute("data-open-id", doc.id);
      row.style.gridTemplateColumns = tableGridTemplate();

      row.innerHTML = cols.map((col) => {
        if (col.key === "title") {
          return `<div><p class="documents-row__title">${esc(doc.title || "Dokument")}</p><p class="documents-row__desc">${esc(doc.description || "-")}</p></div>`;
        }
        return `<div>${esc(rowValue(doc, col.key))}</div>`;
      }).join("");

      root.appendChild(row);
    });
  }

  function renderKarten(rows) {
    const root = document.getElementById("documentsAdminRowsKarte");
    if (!root) return;
    root.innerHTML = "";
    if (!rows.length) {
      root.innerHTML = '<p class="small">Keine Dokumente gefunden.</p>';
      return;
    }

    rows.forEach((doc) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ui-karte";
      card.setAttribute("data-open-id", doc.id);
      card.innerHTML = `
        <div class="ui-karte__kopf">
          <h3 class="ui-karte__titel">${esc(doc.title || "Dokument")}</h3>
          <span class="ui-chip ${doc.is_active ? "" : "is-inaktiv"}">${doc.is_active ? "Aktiv" : "Inaktiv"}</span>
        </div>
        <p class="small">${esc(doc.description || "Keine Beschreibung")}</p>
        <div class="ui-karte__meta">
          <span class="ui-chip">${esc(doc.category || "-")}</span>
          <span class="ui-chip">${esc(sourceLabel(doc))}</span>
        </div>
        <p class="ui-karte__stand">Stand: ${esc(formatDate(doc.updated_at))}</p>
      `;
      root.appendChild(card);
    });
  }

  function renderColumnsPanel() {
    const visRoot = document.getElementById("documentsColumnVisibility");
    const orderRoot = document.getElementById("documentsColumnOrder");
    const filterRoot = document.getElementById("documentsColumnFilters");
    if (!visRoot || !orderRoot || !filterRoot) return;

    visRoot.innerHTML = "";
    orderRoot.innerHTML = "";
    filterRoot.innerHTML = "";

    state.columns.forEach((col, idx) => {
      const v = document.createElement("label");
      v.className = "ui-column-item";
      v.innerHTML = `<span>${col.label}</span><input type="checkbox" data-col-visible="${col.key}" ${col.visible ? "checked" : ""} />`;
      visRoot.appendChild(v);

      const o = document.createElement("div");
      o.className = "ui-column-item";
      o.innerHTML = `
        <span>${col.label}</span>
        <div class="ui-column-item__actions">
          <button type="button" class="feed-btn feed-btn--ghost" data-col-move="up" data-col-key="${col.key}" ${idx > 0 ? "" : "disabled"}>Nach oben</button>
          <button type="button" class="feed-btn feed-btn--ghost" data-col-move="down" data-col-key="${col.key}" ${idx < state.columns.length - 1 ? "" : "disabled"}>Nach unten</button>
        </div>
      `;
      orderRoot.appendChild(o);

      const fWrap = document.createElement("label");
      fWrap.innerHTML = `<span class="small">Filter ${col.label}</span>`;
      let control = "";
      if (col.key === "source") {
        control = `
          <select data-col-filter="source">
            <option value="">Standard (alle)</option>
            <option value="link" ${state.columnFilter.source === "link" ? "selected" : ""}>Direkter Link</option>
            <option value="datei" ${state.columnFilter.source === "datei" ? "selected" : ""}>Dateispeicher</option>
            <option value="unvollstaendig" ${state.columnFilter.source === "unvollstaendig" ? "selected" : ""}>Unvollständig</option>
          </select>
        `;
      } else if (col.key === "status") {
        control = `
          <select data-col-filter="status">
            <option value="">Standard (alle)</option>
            <option value="aktiv" ${state.columnFilter.status === "aktiv" ? "selected" : ""}>Aktiv</option>
            <option value="inaktiv" ${state.columnFilter.status === "inaktiv" ? "selected" : ""}>Inaktiv</option>
          </select>
        `;
      } else if (col.key === "updated_at") {
        control = `<input type="date" data-col-filter="updated_at" value="${esc(state.columnFilter.updated_at)}" />`;
      } else {
        control = `<input type="text" data-col-filter="${col.key}" value="${esc(state.columnFilter[col.key] || "")}" />`;
      }
      fWrap.insertAdjacentHTML("beforeend", control);
      filterRoot.appendChild(fWrap);
    });
  }

  function render() {
    const rows = applyRows(state.rows);
    const zeileWrap = document.getElementById("documentsTableWrap");
    const karteWrap = document.getElementById("documentsAdminRowsKarte");
    const zeileBtn = document.getElementById("documentsViewZeileBtn");
    const karteBtn = document.getElementById("documentsViewKarteBtn");

    if (state.ansicht === "karte") {
      zeileWrap?.classList.add("hidden");
      zeileWrap?.setAttribute("hidden", "");
      karteWrap?.classList.remove("hidden");
      karteWrap?.removeAttribute("hidden");
      zeileBtn?.classList.add("feed-btn--ghost");
      karteBtn?.classList.remove("feed-btn--ghost");
    } else {
      zeileWrap?.classList.remove("hidden");
      zeileWrap?.removeAttribute("hidden");
      karteWrap?.classList.add("hidden");
      karteWrap?.setAttribute("hidden", "");
      zeileBtn?.classList.remove("feed-btn--ghost");
      karteBtn?.classList.add("feed-btn--ghost");
    }

    renderTableHead();
    renderZeilen(rows);
    renderKarten(rows);
    renderColumnsPanel();
  }

  function findRow(id) {
    return state.rows.find((r) => String(r.id) === String(id)) || null;
  }

  function syncSourceInputs() {
    const mode = String(document.getElementById("docDialogSourceMode")?.value || "link");
    const link = document.getElementById("docDialogPublicUrl");
    const bucket = document.getElementById("docDialogBucket");
    const path = document.getElementById("docDialogPath");
    const linkMode = mode === "link";
    if (link) link.disabled = !linkMode;
    if (bucket) bucket.disabled = linkMode;
    if (path) path.disabled = linkMode;
  }

  function fillDialog(doc) {
    document.getElementById("docDialogTitle").value = String(doc.title || "");
    setCategoryValue(String(doc.category || DOCUMENT_CATEGORIES[0]));
    document.getElementById("docDialogDescription").value = String(doc.description || "");
    document.getElementById("docDialogSortOrder").value = String(Number(doc.sort_order || 100));
    document.getElementById("docDialogStatus").value = doc.is_active ? "true" : "false";
    const mode = doc.public_url ? "link" : "datei";
    document.getElementById("docDialogSourceMode").value = mode;
    document.getElementById("docDialogPublicUrl").value = String(doc.public_url || "");
    document.getElementById("docDialogBucket").value = String(doc.storage_bucket || "");
    document.getElementById("docDialogPath").value = String(doc.storage_path || "");
    syncSourceInputs();
  }

  function setCategoryValue(value) {
    const select = document.getElementById("docDialogCategory");
    if (!select) return;
    const category = String(value || "").trim();
    if (!category) {
      select.value = DOCUMENT_CATEGORIES[0];
      return;
    }
    const exists = Array.from(select.options).some((opt) => String(opt.value || "") === category);
    if (!exists) {
      const custom = document.createElement("option");
      custom.value = category;
      custom.textContent = category;
      custom.setAttribute("data-legacy-category", "true");
      select.appendChild(custom);
    }
    select.value = category;
  }

  function openDialogFor(id) {
    const doc = findRow(id);
    if (!doc) return;
    state.currentId = String(id);
    fillDialog(doc);
    setDialogMsg("");
    const dlg = document.getElementById("documentsAdminDialog");
    if (dlg?.showModal) dlg.showModal();
  }

  function closeDialog() {
    const dlg = document.getElementById("documentsAdminDialog");
    if (dlg?.open) dlg.close();
  }

  function collectDialogPayload() {
    const title = String(document.getElementById("docDialogTitle")?.value || "").trim();
    const category = String(document.getElementById("docDialogCategory")?.value || "").trim();
    const description = String(document.getElementById("docDialogDescription")?.value || "").trim();
    const sortRaw = String(document.getElementById("docDialogSortOrder")?.value || "100").trim();
    const isActive = String(document.getElementById("docDialogStatus")?.value || "true") === "true";
    const sourceMode = String(document.getElementById("docDialogSourceMode")?.value || "link");
    const publicUrl = String(document.getElementById("docDialogPublicUrl")?.value || "").trim();
    const storageBucket = String(document.getElementById("docDialogBucket")?.value || "").trim();
    const storagePath = String(document.getElementById("docDialogPath")?.value || "").trim();
    const sortOrder = Number.parseInt(sortRaw, 10);

    if (!title) throw new Error("Titel fehlt");
    if (!category) throw new Error("Kategorie fehlt");
    if (!DOCUMENT_CATEGORIES.includes(category)) {
      const select = document.getElementById("docDialogCategory");
      const knownLegacy = Array.from(select?.options || []).some((opt) => String(opt.value || "") === category);
      if (!knownLegacy) throw new Error("Kategorie ist ungültig.");
    }
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

    if (sourceMode === "link") {
      if (!publicUrl) throw new Error("Direkter Link fehlt");
      if (/\/$/.test(publicUrl)) throw new Error("Direkter Link muss auf eine Datei oder Seite zeigen, nicht auf einen Ordner.");
      payload.public_url = publicUrl;
    } else {
      if (!storageBucket || !storagePath) throw new Error("Dateispeicher Bereich und Pfad fehlen");
      payload.storage_bucket = storageBucket;
      payload.storage_path = storagePath;
    }

    return payload;
  }

  async function refresh() {
    const rows = await listDocuments();
    state.rows = rows;
    render();
    setMsg(`Dokumente geladen: ${rows.length}`);
  }

  async function saveCurrent() {
    if (!state.currentId) return;
    const btn = document.getElementById("documentsDialogSaveBtn");
    btn.disabled = true;
    setDialogMsg("Speichere...");
    try {
      const payload = collectDialogPayload();
      await sb(`/rest/v1/documents?id=eq.${encodeURIComponent(state.currentId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      }, true);
      setDialogMsg("Gespeichert");
      await refresh();
    } catch (err) {
      setDialogMsg(err?.message || "Speichern fehlgeschlagen");
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteCurrent() {
    if (!state.currentId) return;
    if (!window.confirm("Dokument wirklich löschen?")) return;
    const btn = document.getElementById("documentsDialogDeleteBtn");
    btn.disabled = true;
    try {
      await sb(`/rest/v1/documents?id=eq.${encodeURIComponent(state.currentId)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      }, true);
      closeDialog();
      await refresh();
    } catch (err) {
      setDialogMsg(err?.message || "Löschen fehlgeschlagen");
    } finally {
      btn.disabled = false;
    }
  }

  async function onAddClick() {
    const defaults = {
      title: "Neues Dokument",
      category: "Formulare",
      description: null,
      public_url: null,
      storage_bucket: null,
      storage_path: null,
      sort_order: 100,
      is_active: false,
    };
    try {
      await sb("/rest/v1/documents", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([defaults]),
      }, true);
      await refresh();
      const first = state.rows.find((r) => String(r.title || "") === "Neues Dokument");
      if (first) openDialogFor(first.id);
    } catch (err) {
      setMsg(err?.message || "Anlegen fehlgeschlagen");
    }
  }

  function bindUi() {
    if (state.bound) return;
    state.bound = true;

    document.getElementById("documentsAdminSearch")?.addEventListener("input", (e) => {
      state.search = String(e.target?.value || "");
      render();
    });

    document.getElementById("documentsViewZeileBtn")?.addEventListener("click", () => {
      state.ansicht = "zeile";
      saveAnsicht(state.ansicht);
      render();
    });

    document.getElementById("documentsViewKarteBtn")?.addEventListener("click", () => {
      state.ansicht = "karte";
      saveAnsicht(state.ansicht);
      render();
    });

    document.getElementById("documentsColumnsToggleBtn")?.addEventListener("click", () => {
      const btn = document.getElementById("documentsColumnsToggleBtn");
      const p = document.getElementById("documentsColumnsPanel");
      const hidden = p?.hasAttribute("hidden");
      if (!p) return;
      p.classList.toggle("hidden", !hidden);
      if (hidden) {
        p.removeAttribute("hidden");
        btn?.setAttribute("aria-expanded", "true");
      } else {
        p.setAttribute("hidden", "");
        btn?.setAttribute("aria-expanded", "false");
      }
    });

    document.getElementById("documentsAdminAddBtn")?.addEventListener("click", onAddClick);
    document.getElementById("documentsDialogSaveBtn")?.addEventListener("click", saveCurrent);
    document.getElementById("documentsDialogDeleteBtn")?.addEventListener("click", deleteCurrent);
    document.getElementById("documentsDialogCloseBtn")?.addEventListener("click", closeDialog);
    document.getElementById("docDialogSourceMode")?.addEventListener("change", syncSourceInputs);

    document.addEventListener("click", (e) => {
      const open = e.target.closest("[data-open-id]");
      if (open) {
        const id = String(open.getAttribute("data-open-id") || "");
        if (id) openDialogFor(id);
        return;
      }

      const sortBtn = e.target.closest("[data-sort-key]");
      if (sortBtn) {
        const key = String(sortBtn.getAttribute("data-sort-key") || "");
        if (!key) return;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else {
          state.sort.key = key;
          state.sort.dir = "asc";
        }
        saveTablePrefs();
        render();
        return;
      }

      const moveBtn = e.target.closest("[data-col-move][data-col-key]");
      if (moveBtn) {
        const dir = String(moveBtn.getAttribute("data-col-move") || "");
        const key = String(moveBtn.getAttribute("data-col-key") || "");
        const idx = state.columns.findIndex((c) => c.key === key);
        if (idx < 0) return;
        if (dir === "up" && idx > 0) {
          [state.columns[idx - 1], state.columns[idx]] = [state.columns[idx], state.columns[idx - 1]];
        }
        if (dir === "down" && idx < state.columns.length - 1) {
          [state.columns[idx + 1], state.columns[idx]] = [state.columns[idx], state.columns[idx + 1]];
        }
        saveTablePrefs();
        render();
      }
    });

    document.addEventListener("change", (e) => {
      const vis = e.target.closest("[data-col-visible]");
      if (vis) {
        const key = String(vis.getAttribute("data-col-visible") || "");
        const col = state.columns.find((c) => c.key === key);
        if (!col) return;
        col.visible = Boolean(vis.checked);
        saveTablePrefs();
        render();
        return;
      }

      const f = e.target.closest("[data-col-filter]");
      if (f) {
        const key = String(f.getAttribute("data-col-filter") || "");
        if (!(key in state.columnFilter)) return;
        state.columnFilter[key] = String(f.value || "");
        saveTablePrefs();
        render();
      }
    });

    document.addEventListener("input", (e) => {
      const f = e.target.closest("[data-col-filter]");
      if (!f) return;
      const key = String(f.getAttribute("data-col-filter") || "");
      if (!(key in state.columnFilter)) return;
      if (e.target.tagName === "SELECT") return;
      state.columnFilter[key] = String(f.value || "");
      saveTablePrefs();
      render();
    });
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    state.uid = uid();
    state.ansicht = loadAnsicht();
    loadTablePrefs();
    bindUi();

    const roles = await loadMyRoles().catch(() => []);
    const isManager = roles.some((r) => MANAGER_ROLES.has(r));
    if (!isManager) {
      setMsg("Kein Zugriff: nur Vorstand/Admin.");
      document.getElementById("documentsAdminRowsZeile").innerHTML = "";
      document.getElementById("documentsAdminRowsKarte").innerHTML = "";
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
})();
