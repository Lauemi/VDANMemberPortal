;(() => {
  let activeTaskId = null;
  let meetingTasks = [];

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
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
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

  function setMsg(text = "") {
    const el = document.getElementById("myRespMsg");
    if (el) el.textContent = text;
  }

  function setEditMsg(text = "") {
    const el = document.getElementById("myRespEditMsg");
    if (el) el.textContent = text;
  }

  async function loadResponsibilities() {
    const rows = await sb("/rest/v1/v_my_responsibilities?select=responsibility_type,source_id,title,status,due_date,status_note,starts_at,ends_at,location,created_at,updated_at&order=due_date.asc.nullslast,starts_at.asc.nullslast,created_at.desc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function renderMeetingTasks(rows) {
    const root = document.getElementById("myRespMeetingTasks");
    if (!root) return;
    meetingTasks = rows;
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine zugewiesenen Sitzungstasks.</p>`;
      return;
    }
    root.innerHTML = rows.map((r) => `
      <button type="button" class="catch-row resp-task-row" data-task-id="${esc(r.source_id)}" style="grid-template-columns:2fr 1fr 1fr;">
        <span>
          <strong>${esc(r.title || "Task")}</strong>
          ${r.status_note ? `<small class="small">Hinweis: ${esc(r.status_note)}</small>` : ""}
          <small class="small">Aktualisiert: ${esc(fmtTs(r.updated_at))}</small>
        </span>
        <span>${esc(r.status || "-")}</span>
        <span>${esc(fmtDate(r.due_date))}</span>
      </button>
    `).join("");
  }

  function renderWorkLeads(rows) {
    const root = document.getElementById("myRespWorkLeads");
    if (!root) return;
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine zugewiesenen Arbeitseinsätze.</p>`;
      return;
    }
    root.innerHTML = rows.map((r) => `
      <article class="card">
        <div class="card__body">
          <h3>${esc(r.title || "Arbeitseinsatz")}</h3>
          <p class="small">Status: <strong>${esc(r.status || "-")}</strong></p>
          <p class="small">Start: ${esc(fmtTs(r.starts_at))}</p>
          <p class="small">Ende: ${esc(fmtTs(r.ends_at))}</p>
          <p class="small">Ort: ${esc(r.location || "-")}</p>
        </div>
      </article>
    `).join("");
  }

  function openTaskDialog(taskId) {
    const task = meetingTasks.find((t) => String(t.source_id) === String(taskId));
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

  async function refresh() {
    const rows = await loadResponsibilities();
    const tasks = rows.filter((r) => r.responsibility_type === "meeting_task");
    const leads = rows.filter((r) => r.responsibility_type === "work_event_lead");
    renderMeetingTasks(tasks);
    renderWorkLeads(leads);
    setMsg(`Geladen: ${rows.length}`);
  }

  function bind() {
    document.getElementById("myRespMeetingTasks")?.addEventListener("click", (e) => {
      const row = e.target?.closest?.("[data-task-id]");
      if (!row) return;
      openTaskDialog(String(row.getAttribute("data-task-id") || ""));
    });

    document.getElementById("myRespEditClose")?.addEventListener("click", closeTaskDialog);

    document.getElementById("myRespEditSave")?.addEventListener("click", async () => {
      if (!activeTaskId) return;
      try {
        setEditMsg("Speichere...");
        await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(activeTaskId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: String(document.getElementById("myRespEditStatus")?.value || "open"),
            status_note: String(document.getElementById("myRespEditNote")?.value || "").trim() || null,
          }),
        }, true);
        await refresh();
        setEditMsg("Gespeichert.");
      } catch (err) {
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

    try {
      bind();
      await refresh();
    } catch (err) {
      setMsg(err?.message || "Konnte Zuständigkeiten nicht laden.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
