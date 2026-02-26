;(() => {
  const OFFLINE_NS = "my_responsibilities";
  const OFFLINE_LIST_KEY = "list";
  const VIEW_TASK_KEY = "app:viewMode:my-resp-task:v1";
  const VIEW_LEAD_KEY = "app:viewMode:my-resp-lead:v1";
  const FILTER_KEY = "app:viewFilter:my-resp:v1";

  let activeTaskId = null;
  let meetingTasks = [];
  let allMeetingTasks = [];
  let allWorkLeads = [];
  let filteredMeetingTasks = [];
  let filteredWorkLeads = [];
  let taskView = "zeile";
  let leadView = "zeile";
  let bound = false;

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

  function setMsg(text = "") {
    const el = document.getElementById("myRespMsg");
    if (el) el.textContent = text;
  }

  function setEditMsg(text = "") {
    const el = document.getElementById("myRespEditMsg");
    if (el) el.textContent = text;
  }

  function loadView(key, fallback = "zeile") {
    try {
      return String(localStorage.getItem(key) || fallback) === "karte" ? "karte" : "zeile";
    } catch {
      return fallback;
    }
  }

  function saveView(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function loadFilter() {
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveFilter(payload) {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(payload || {})); } catch {}
  }

  async function loadResponsibilities() {
    const path = "/rest/v1/v_my_responsibilities?select=responsibility_type,source_id,title,status,due_date,status_note,starts_at,ends_at,location,created_at,updated_at&order=due_date.asc.nullslast,starts_at.asc.nullslast,created_at.desc";
    try {
      const rows = await sb(path, { method: "GET" }, true);
      const list = Array.isArray(rows) ? rows : [];
      await saveCachedResponsibilities(list);
      return list;
    } catch (err) {
      const cached = await loadCachedResponsibilities();
      if (cached.length) return cached;
      throw err;
    }
  }

  function applyTaskPatchLocal(taskId, patch) {
    const id = String(taskId || "");
    const now = new Date().toISOString();
    meetingTasks = (meetingTasks || []).map((t) =>
      String(t.source_id) === id
        ? { ...t, ...patch, updated_at: now, _offline_pending: true }
        : t
    );
    allMeetingTasks = allMeetingTasks.map((t) =>
      String(t.source_id) === id
        ? { ...t, ...patch, updated_at: now, _offline_pending: true }
        : t
    );
    applyFilters();
    renderMeetingTasks();
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

  function applyView() {
    const taskCard = taskView === "karte";
    const leadCard = leadView === "karte";

    const tt = document.getElementById("myRespMeetingTasksTableWrap");
    const tc = document.getElementById("myRespMeetingTasksCards");
    tt?.classList.toggle("hidden", taskCard);
    tt?.toggleAttribute("hidden", taskCard);
    tc?.classList.toggle("hidden", !taskCard);
    tc?.toggleAttribute("hidden", !taskCard);

    const lt = document.getElementById("myRespWorkLeadsTableWrap");
    const lc = document.getElementById("myRespWorkLeadsCards");
    lt?.classList.toggle("hidden", leadCard);
    lt?.toggleAttribute("hidden", leadCard);
    lc?.classList.toggle("hidden", !leadCard);
    lc?.toggleAttribute("hidden", !leadCard);

    document.getElementById("myRespTaskViewZeileBtn")?.classList.toggle("feed-btn--ghost", taskCard);
    document.getElementById("myRespTaskViewKarteBtn")?.classList.toggle("feed-btn--ghost", !taskCard);
    document.getElementById("myRespLeadViewZeileBtn")?.classList.toggle("feed-btn--ghost", leadCard);
    document.getElementById("myRespLeadViewKarteBtn")?.classList.toggle("feed-btn--ghost", !leadCard);
  }

  function applyFilters() {
    const taskSearch = String(document.getElementById("myRespTaskSearch")?.value || "").trim().toLowerCase();
    const taskStatus = String(document.getElementById("myRespTaskStatusFilter")?.value || "alle").trim().toLowerCase();
    const leadSearch = String(document.getElementById("myRespLeadSearch")?.value || "").trim().toLowerCase();

    saveFilter({ taskSearch, taskStatus, leadSearch });

    filteredMeetingTasks = allMeetingTasks.filter((r) => {
      if (taskStatus !== "alle" && String(r.status || "").toLowerCase() !== taskStatus) return false;
      if (!taskSearch) return true;
      const hay = `${r.title || ""} ${r.status || ""} ${r.status_note || ""}`.toLowerCase();
      return hay.includes(taskSearch);
    });

    filteredWorkLeads = allWorkLeads.filter((r) => {
      if (!leadSearch) return true;
      const hay = `${r.title || ""} ${r.status || ""} ${r.location || ""}`.toLowerCase();
      return hay.includes(leadSearch);
    });

    meetingTasks = filteredMeetingTasks;
  }

  function renderMeetingTasks() {
    const tableRoot = document.getElementById("myRespMeetingTasksTable");
    const cardsRoot = document.getElementById("myRespMeetingTasksCards");
    if (!tableRoot || !cardsRoot) return;

    if (!filteredMeetingTasks.length) {
      tableRoot.innerHTML = `<p class="small" style="padding:12px;">Keine zugewiesenen Sitzungstasks.</p>`;
      cardsRoot.innerHTML = `<p class="small">Keine zugewiesenen Sitzungstasks.</p>`;
      return;
    }

    tableRoot.innerHTML = filteredMeetingTasks.map((r) => `
      <button type="button" class="catch-table__row resp-task-row" data-task-id="${esc(r.source_id)}" style="grid-template-columns:2fr 1fr 1fr;">
        <span>
          <strong>${esc(r.title || "Task")}</strong>
          ${r.status_note ? `<small class="small">Hinweis: ${esc(r.status_note)}</small>` : ""}
          <small class="small">Aktualisiert: ${esc(fmtTs(r.updated_at))}</small>
        </span>
        <span>${esc(statusLabel(r.status))}</span>
        <span>${esc(fmtDate(r.due_date))}</span>
      </button>
    `).join("");

    cardsRoot.innerHTML = filteredMeetingTasks.map((r) => `
      <button type="button" class="card" data-task-id="${esc(r.source_id)}" style="text-align:left;">
        <div class="card__body">
          <h3>${esc(r.title || "Task")}</h3>
          <p class="small">Status: <strong>${esc(statusLabel(r.status))}</strong></p>
          <p class="small">Fällig: ${esc(fmtDate(r.due_date))}</p>
          ${r.status_note ? `<p class="small">Hinweis: ${esc(r.status_note)}</p>` : ""}
          <p class="small">Aktualisiert: ${esc(fmtTs(r.updated_at))}</p>
        </div>
      </button>
    `).join("");
  }

  function renderLeadDetail(id) {
    const row = allWorkLeads.find((r) => String(r.source_id) === String(id));
    if (!row) return;
    const body = document.getElementById("myRespLeadDetailBody");
    const dlg = document.getElementById("myRespLeadDetailDialog");
    if (!body || !dlg) return;
    body.innerHTML = `
      <p><strong>Titel:</strong> ${esc(row.title || "Arbeitseinsatz")}</p>
      <p><strong>Status:</strong> ${esc(statusLabel(row.status))}</p>
      <p><strong>Start:</strong> ${esc(fmtTs(row.starts_at))}</p>
      <p><strong>Ende:</strong> ${esc(fmtTs(row.ends_at))}</p>
      <p><strong>Ort:</strong> ${esc(row.location || "-")}</p>
    `;
    dlg.showModal?.();
  }

  function renderWorkLeads() {
    const tableRoot = document.getElementById("myRespWorkLeadsTable");
    const cardsRoot = document.getElementById("myRespWorkLeadsCards");
    if (!tableRoot || !cardsRoot) return;

    if (!filteredWorkLeads.length) {
      tableRoot.innerHTML = `<p class="small" style="padding:12px;">Keine zugewiesenen Arbeitseinsätze.</p>`;
      cardsRoot.innerHTML = `<p class="small">Keine zugewiesenen Arbeitseinsätze.</p>`;
      return;
    }

    tableRoot.innerHTML = filteredWorkLeads.map((r) => `
      <button type="button" class="catch-table__row" data-lead-id="${esc(r.source_id)}" style="grid-template-columns:1.8fr 1fr 1fr 1fr;">
        <span>${esc(r.title || "Arbeitseinsatz")}</span>
        <span>${esc(statusLabel(r.status))}</span>
        <span>${esc(fmtTs(r.starts_at))}</span>
        <span>${esc(r.location || "-")}</span>
      </button>
    `).join("");

    cardsRoot.innerHTML = filteredWorkLeads.map((r) => `
      <button type="button" class="card" data-lead-id="${esc(r.source_id)}" style="text-align:left;">
        <div class="card__body">
          <h3>${esc(r.title || "Arbeitseinsatz")}</h3>
          <p class="small">Status: <strong>${esc(statusLabel(r.status))}</strong></p>
          <p class="small">Start: ${esc(fmtTs(r.starts_at))}</p>
          <p class="small">Ende: ${esc(fmtTs(r.ends_at))}</p>
          <p class="small">Ort: ${esc(r.location || "-")}</p>
        </div>
      </button>
    `).join("");
  }

  function openTaskDialog(taskId) {
    const task = meetingTasks.find((t) => String(t.source_id) === String(taskId)) || allMeetingTasks.find((t) => String(t.source_id) === String(taskId));
    if (!task) return;
    activeTaskId = String(taskId);

    const st = document.getElementById("myRespEditStatus");
    const nt = document.getElementById("myRespEditNote");
    if (st) st.value = String(task.status || "open");
    if (nt) nt.value = String(task.status_note || "");

    setEditMsg("");
    const dlg = document.getElementById("myRespTaskDialog");
    if (dlg && !dlg.open) dlg.showModal();
  }

  function closeTaskDialog() {
    const dlg = document.getElementById("myRespTaskDialog");
    if (dlg?.open) dlg.close();
    activeTaskId = null;
    setEditMsg("");
  }

  function renderAll() {
    applyFilters();
    renderMeetingTasks();
    renderWorkLeads();
    applyView();
  }

  async function refresh() {
    const rows = await loadResponsibilities();
    allMeetingTasks = rows.filter((r) => r.responsibility_type === "meeting_task");
    allWorkLeads = rows.filter((r) => r.responsibility_type === "work_event_lead");
    renderAll();
    setMsg(`Geladen: ${rows.length}`);
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", (e) => {
      const task = e.target?.closest?.("[data-task-id]");
      if (task) {
        openTaskDialog(String(task.getAttribute("data-task-id") || ""));
        return;
      }

      const lead = e.target?.closest?.("[data-lead-id]");
      if (lead) {
        renderLeadDetail(String(lead.getAttribute("data-lead-id") || ""));
        return;
      }

      if (e.target?.closest?.("#myRespTaskViewZeileBtn")) {
        taskView = "zeile";
        saveView(VIEW_TASK_KEY, taskView);
        applyView();
        return;
      }
      if (e.target?.closest?.("#myRespTaskViewKarteBtn")) {
        taskView = "karte";
        saveView(VIEW_TASK_KEY, taskView);
        applyView();
        return;
      }
      if (e.target?.closest?.("#myRespLeadViewZeileBtn")) {
        leadView = "zeile";
        saveView(VIEW_LEAD_KEY, leadView);
        applyView();
        return;
      }
      if (e.target?.closest?.("#myRespLeadViewKarteBtn")) {
        leadView = "karte";
        saveView(VIEW_LEAD_KEY, leadView);
        applyView();
      }
    });

    document.getElementById("myRespTaskSearch")?.addEventListener("input", renderAll);
    document.getElementById("myRespTaskStatusFilter")?.addEventListener("change", renderAll);
    document.getElementById("myRespLeadSearch")?.addEventListener("input", renderAll);

    document.getElementById("myRespEditClose")?.addEventListener("click", closeTaskDialog);

    document.getElementById("myRespEditSave")?.addEventListener("click", async () => {
      if (!activeTaskId) return;
      try {
        setEditMsg("Speichere...");
        const patch = {
          status: String(document.getElementById("myRespEditStatus")?.value || "open"),
          status_note: String(document.getElementById("myRespEditNote")?.value || "").trim() || null,
        };
        await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(activeTaskId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        }, true);
        await refresh();
        setEditMsg("Gespeichert.");
      } catch (err) {
        if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
          const patch = {
            status: String(document.getElementById("myRespEditStatus")?.value || "open"),
            status_note: String(document.getElementById("myRespEditNote")?.value || "").trim() || null,
          };
          applyTaskPatchLocal(activeTaskId, patch);
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

    taskView = loadView(VIEW_TASK_KEY, "zeile");
    leadView = loadView(VIEW_LEAD_KEY, "zeile");
    const filter = loadFilter();
    const taskSearch = document.getElementById("myRespTaskSearch");
    const taskStatus = document.getElementById("myRespTaskStatusFilter");
    const leadSearch = document.getElementById("myRespLeadSearch");
    if (taskSearch && filter.taskSearch) taskSearch.value = String(filter.taskSearch);
    if (taskStatus && (filter.taskStatus === "alle" || filter.taskStatus === "open" || filter.taskStatus === "done" || filter.taskStatus === "blocked")) {
      taskStatus.value = String(filter.taskStatus);
    }
    if (leadSearch && filter.leadSearch) leadSearch.value = String(filter.leadSearch);

    try {
      bind();
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
