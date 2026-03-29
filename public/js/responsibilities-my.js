;(() => {
  const OFFLINE_NS = "my_responsibilities";
  const OFFLINE_LIST_KEY = "list";
  const TABLE_PREF_KEY = "app:viewSettings:my-resp-table:v2";

  let activeTaskId = null;
  let allResponsibilities = [];
  let visibleResponsibilities = [];
  let tableSearch = "";
  let toolbarFiltersOpen = false;
  let responsibilityTable = null;
  let bound = false;
  let didAutoRecoverEmptyView = false;

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
      const e = new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return res.json().catch(() => []);
  }

  async function loadCachedResponsibilities() {
    return await window.VDAN_OFFLINE_SYNC?.cacheGet?.(OFFLINE_NS, OFFLINE_LIST_KEY, []) || [];
  }

  async function saveCachedResponsibilities(rows) {
    await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, OFFLINE_LIST_KEY, Array.isArray(rows) ? rows : []);
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("de-DE");
  }

  function fmtTs(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-DE");
  }

  function statusLabel(value) {
    const v = String(value || "").toLowerCase();
    if (v === "done") return "erledigt";
    if (v === "blocked") return "blockiert";
    if (v === "open") return "offen";
    return value || "-";
  }

  function responsibilityTypeLabel(type) {
    return String(type || "") === "meeting_task" ? "Aufgabe" : "Zuständigkeit";
  }

  function setMsg(text = "") {
    const el = document.getElementById("myRespMsg");
    if (el) el.textContent = text;
  }

  function setEditMsg(text = "") {
    const el = document.getElementById("myRespEditMsg");
    if (el) el.textContent = text;
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
  }

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(TABLE_PREF_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function savePrefs(extra = {}) {
    const state = responsibilityTable?.getState?.() || {};
    const payload = {
      search: tableSearch,
      sortKey: state.sortKey || "due_at",
      sortDir: state.sortDir || "asc",
      filters: state.filters || {},
      ...extra,
    };
    try {
      localStorage.setItem(TABLE_PREF_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  function loadTableSearch() {
    const prefs = loadPrefs();
    tableSearch = String(prefs.search || "");
  }

  function normalizeResponsibility(row) {
    const type = String(row?.responsibility_type || "").trim();
    const dueAt = String(row?.due_date || row?.starts_at || row?.created_at || "").trim();
    return {
      ...row,
      responsibility_type: type,
      due_at: dueAt,
      due_display: row?.due_date ? fmtDate(row.due_date) : fmtTs(row?.starts_at || row?.created_at || ""),
      title_display: row?.title || (type === "meeting_task" ? "Aufgabe" : "Zuständigkeit"),
      location_display: row?.location || "-",
      status_display: statusLabel(row?.status),
      type_label: responsibilityTypeLabel(type),
      is_task: type === "meeting_task",
      is_done: String(row?.status || "").toLowerCase() === "done",
      can_complete: type === "meeting_task" && String(row?.status || "").toLowerCase() !== "done",
    };
  }

  async function loadResponsibilities() {
    const path = "/rest/v1/v_my_responsibilities?select=responsibility_type,source_id,title,status,due_date,status_note,starts_at,ends_at,location,created_at,updated_at&order=due_date.asc.nullslast,starts_at.asc.nullslast,created_at.desc";
    try {
      const rows = await sb(path, { method: "GET" }, true);
      const list = (Array.isArray(rows) ? rows : []).map(normalizeResponsibility);
      await saveCachedResponsibilities(list);
      return list;
    } catch (err) {
      const cached = await loadCachedResponsibilities();
      if (cached.length) return cached.map(normalizeResponsibility);
      throw err;
    }
  }

  async function queueTaskPatch(taskId, patch) {
    await window.VDAN_OFFLINE_SYNC?.enqueue?.(OFFLINE_NS, {
      type: "meeting_task_patch",
      task_id: String(taskId || ""),
      patch,
    });
  }

  async function flushOfflineQueue() {
    if (!window.VDAN_OFFLINE_SYNC?.flush) return;
    await window.VDAN_OFFLINE_SYNC.flush(OFFLINE_NS, async (op) => {
      if (op?.type !== "meeting_task_patch") return;
      await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(op.task_id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(op.patch || {}),
      }, true);
    });
  }

  function setToolbarFiltersOpen(nextOpen) {
    toolbarFiltersOpen = Boolean(nextOpen);
    const panel = document.getElementById("myRespColumnFiltersPanel");
    const btn = document.getElementById("myRespColumnFiltersToggle");
    if (panel) {
      panel.classList.toggle("hidden", !toolbarFiltersOpen);
      panel.toggleAttribute("hidden", !toolbarFiltersOpen);
    }
    if (btn) btn.setAttribute("aria-expanded", toolbarFiltersOpen ? "true" : "false");
  }

  function syncFilterMeta() {
    const meta = document.getElementById("myRespActiveFilterCount");
    if (!meta) return;
    let count = 0;
    if (String(tableSearch || "").trim()) count += 1;
    count += responsibilityTable?.getActiveFilterCount?.() || 0;
    meta.textContent = `${count} Filter aktiv`;
    meta.classList.toggle("hidden", count === 0);
  }

  function ensureTable() {
    if (responsibilityTable || !window.FCPDataTable || typeof window.FCPDataTable.createStandardV1 !== "function") return responsibilityTable;
    const root = document.getElementById("myRespTable");
    const filterPanel = document.getElementById("myRespColumnFiltersPanel");
    if (!(root instanceof HTMLElement)) return null;

    const prefs = loadPrefs();
    responsibilityTable = window.FCPDataTable.createStandardV1({
      root,
      filterPanel,
      componentId: "my-resp-open-items",
      ariaLabel: "Offene Aufgaben und Zuständigkeiten",
      viewMode: "table",
      rowKey: (row) => `${String(row?.responsibility_type || "row")}:${String(row?.source_id || "")}`,
      gridTemplateColumns: "1.15fr .9fr 2.1fr 1.2fr 112px",
      tableClassName: "data-table--my-resp",
      rowClassName: "data-table__row--my-resp",
      emptyStateHtml: `<p class="small">Keine offenen Aufgaben oder Zuständigkeiten vorhanden.</p>`,
      initialState: {
        sortKey: String(prefs.sortKey || "due_at"),
        sortDir: String(prefs.sortDir || "asc"),
        filters: prefs.filters || {},
      },
      columns: [
        {
          key: "due_at",
          label: "Fälligkeit",
          type: "date",
          sortable: true,
          filterable: true,
          align: "left",
          emptyValue: "-",
          cellClass: "data-table__cell--primary fangliste-table__cell fangliste-table__cell--trip_date",
          value: (row) => row.due_display || "-",
          sortValue: (row) => row.due_at || "",
          filterValue: (row) => `${row.due_display || ""} ${row.due_at || ""}`,
        },
        {
          key: "status",
          label: "Status",
          type: "meta",
          sortable: true,
          filterable: true,
          align: "left",
          emptyValue: "-",
          cellClass: "data-table__cell--meta fangliste-table__cell",
          value: (row) => row.status_display || "-",
          sortValue: (row) => row.status_display || "",
        },
        {
          key: "title",
          label: "Aufgabe",
          type: "text",
          sortable: true,
          filterable: true,
          align: "left",
          emptyValue: "-",
          cellClass: "fangliste-table__cell",
          value: (row) => row.title_display || "-",
          sortValue: (row) => row.title_display || "",
          filterValue: (row) => `${row.title_display || ""} ${row.status_note || ""} ${row.type_label || ""}`,
        },
        {
          key: "location",
          label: "Ort",
          type: "text",
          sortable: true,
          filterable: true,
          align: "left",
          emptyValue: "-",
          cellClass: "fangliste-table__cell",
          value: (row) => row.location_display || "-",
          sortValue: (row) => row.location_display || "",
        },
        {
          key: "actions",
          label: "Aktionen",
          type: "text",
          sortable: false,
          filterable: false,
          align: "right",
          emptyValue: "",
          cellClass: "data-table__cell--numeric fangliste-table__cell my-resp-table__actions",
          value: () => "",
          renderHtml: (row) => {
            if (!row.is_task) return `<span class="my-resp-table__action-placeholder">-</span>`;
            return `
              <button
                type="button"
                class="feed-btn feed-btn--ghost trip-toolbar-btn trip-toolbar-btn--icon fcp-table-icon-btn fcp-table-icon-btn--success"
                data-fcp-action="done"
                aria-label="Erledigt"
                title="Erledigt"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"></path>
                </svg>
              </button>
              <button
                type="button"
                class="feed-btn feed-btn--ghost trip-toolbar-btn trip-toolbar-btn--icon fcp-table-icon-btn fcp-table-icon-btn--danger"
                data-fcp-action="undone"
                aria-label="Nicht erledigt"
                title="Nicht erledigt"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"></path>
                </svg>
              </button>
            `;
          },
        },
      ],
      onRowClick(row) {
        if (String(row.responsibility_type || "") === "meeting_task") {
          openTaskDialog(String(row.source_id || ""));
          return;
        }
        renderLeadDetail(String(row.source_id || ""));
      },
      onRowAction({ action, row }) {
        if (action === "done") {
          void markTaskDone(row);
          return;
        }
        if (action === "undone") {
          void markTaskOpen(row);
        }
      },
      onStateChange() {
        savePrefs();
        syncFilterMeta();
      },
      onFilterChange() {
        syncFilterMeta();
      },
      onReset() {
        syncFilterMeta();
      },
    });

    return responsibilityTable;
  }

  function applySearchFilter() {
    const q = String(tableSearch || "").trim().toLowerCase();
    if (!q) {
      visibleResponsibilities = allResponsibilities.slice();
      return;
    }
    visibleResponsibilities = allResponsibilities.filter((row) => {
      const hay = [
        row.due_display,
        row.status_display,
        row.title_display,
        row.location_display,
        row.status_note,
        row.type_label,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function renderLeadDetail(id) {
    const row = allResponsibilities.find((item) => String(item.source_id) === String(id));
    if (!row) return;
    const body = document.getElementById("myRespLeadDetailBody");
    const dlg = document.getElementById("myRespLeadDetailDialog");
    if (!body || !dlg) return;
    body.innerHTML = `
      <p><strong>Aufgabe:</strong> ${esc(row.title_display || "Zuständigkeit")}</p>
      <p><strong>Status:</strong> ${esc(row.status_display || "-")}</p>
      <p><strong>Fälligkeit:</strong> ${esc(row.due_display || "-")}</p>
      <p><strong>Ort:</strong> ${esc(row.location_display || "-")}</p>
    `;
    openDialog(dlg);
  }

  function openTaskDialog(taskId) {
    const task = allResponsibilities.find((row) => String(row.source_id) === String(taskId));
    if (!task) return;
    activeTaskId = String(taskId);

    const st = document.getElementById("myRespEditStatus");
    const nt = document.getElementById("myRespEditNote");
    if (st) st.value = String(task.status || "open");
    if (nt) nt.value = String(task.status_note || "");

    setEditMsg("");
    const dlg = document.getElementById("myRespTaskDialog");
    openDialog(dlg);
  }

  function closeTaskDialog() {
    const dlg = document.getElementById("myRespTaskDialog");
    closeDialog(dlg);
    activeTaskId = null;
    setEditMsg("");
  }

  function patchResponsibilityLocal(taskId, patch) {
    const id = String(taskId || "");
    const now = new Date().toISOString();
    allResponsibilities = allResponsibilities.map((row) => (
      String(row.source_id) === id
        ? normalizeResponsibility({ ...row, ...patch, updated_at: now, _offline_pending: true })
        : row
    ));
    renderAll();
  }

  async function markTaskDone(row) {
    const taskId = String(row?.source_id || "").trim();
    if (!taskId) return;
    const patch = { status: "done" };
    patchResponsibilityLocal(taskId, patch);
    try {
      setMsg("Aufgabe wird als erledigt markiert...");
      await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      }, true);
      setMsg("Aufgabe als erledigt markiert.");
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueTaskPatch(taskId, patch);
        setMsg("Aufgabe offline als erledigt markiert. Wird synchronisiert.");
        return;
      }
      await refresh().catch(() => {});
      setMsg(err?.message || "Aktion konnte nicht gespeichert werden.");
    }
  }

  async function markTaskOpen(row) {
    const taskId = String(row?.source_id || "").trim();
    if (!taskId) return;
    const patch = { status: "open" };
    patchResponsibilityLocal(taskId, patch);
    try {
      setMsg("Aufgabe wird als nicht erledigt markiert...");
      await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      }, true);
      setMsg("Aufgabe als nicht erledigt markiert.");
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueTaskPatch(taskId, patch);
        setMsg("Aufgabe offline als nicht erledigt markiert. Wird synchronisiert.");
        return;
      }
      await refresh().catch(() => {});
      setMsg(err?.message || "Aktion konnte nicht gespeichert werden.");
    }
  }

  function renderAll() {
    ensureTable();
    applySearchFilter();
    if (!visibleResponsibilities.length && allResponsibilities.length > 0 && !didAutoRecoverEmptyView) {
      didAutoRecoverEmptyView = true;
      tableSearch = "";
      const search = document.getElementById("myRespSearch");
      if (search) search.value = "";
      responsibilityTable?.resetFilters({ render: false, silent: true });
      savePrefs({ search: "", filters: {} });
      applySearchFilter();
      setToolbarFiltersOpen(false);
      setMsg("Filter wurden zurückgesetzt, um vorhandene Einträge anzuzeigen.");
    }
    responsibilityTable?.setRows(visibleResponsibilities);
    syncFilterMeta();
  }

  async function refresh() {
    allResponsibilities = await loadResponsibilities();
    renderAll();
    setMsg(`Geladen: ${allResponsibilities.length}`);
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.getElementById("myRespSearch")?.addEventListener("input", (event) => {
      tableSearch = String(event.target?.value || "");
      savePrefs();
      renderAll();
    });

    document.getElementById("myRespColumnFiltersToggle")?.addEventListener("click", () => {
      setToolbarFiltersOpen(!toolbarFiltersOpen);
      if (!toolbarFiltersOpen) return;
      const firstInput = document.querySelector("#myRespColumnFiltersPanel [data-fcp-col-filter]");
      if (firstInput instanceof HTMLElement) firstInput.focus();
    });

    document.getElementById("myRespResetFiltersBtn")?.addEventListener("click", () => {
      tableSearch = "";
      const search = document.getElementById("myRespSearch");
      if (search) search.value = "";
      responsibilityTable?.resetFilters({ render: false, silent: true });
      setToolbarFiltersOpen(false);
      savePrefs({ filters: {} });
      renderAll();
    });

    document.getElementById("myRespEditClose")?.addEventListener("click", closeTaskDialog);

    document.getElementById("myRespEditSave")?.addEventListener("click", async () => {
      if (!activeTaskId) return;
      const patch = {
        status: String(document.getElementById("myRespEditStatus")?.value || "open"),
        status_note: String(document.getElementById("myRespEditNote")?.value || "").trim() || null,
      };
      try {
        setEditMsg("Speichere...");
        await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(activeTaskId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        }, true);
        await refresh();
        setEditMsg("Gespeichert.");
      } catch (err) {
        if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
          patchResponsibilityLocal(activeTaskId, patch);
          await queueTaskPatch(activeTaskId, patch);
          setEditMsg("Offline gespeichert. Wird bei Empfang synchronisiert.");
          return;
        }
        setEditMsg(err?.message || "Speichern fehlgeschlagen.");
      }
    });
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }
    if (!session()?.access_token) {
      setMsg("Bitte einloggen.");
      return;
    }

    loadTableSearch();
    const search = document.getElementById("myRespSearch");
    if (search) search.value = tableSearch;

    bind();

    try {
      await flushOfflineQueue().catch(() => {});
      await refresh();
    } catch (err) {
      setMsg(err?.message || "Konnte Zuständigkeiten nicht laden.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  window.addEventListener("online", () => {
    flushOfflineQueue().then(() => refresh()).catch(() => {});
  });
})();
