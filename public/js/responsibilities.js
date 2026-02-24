;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  let activeTaskId = null;

  let profiles = [];
  let roleRows = [];
  let sessions = [];
  let attendees = [];
  let agendaItems = [];
  let meetingTasks = [];
  let taskAssignees = [];

  const managerChipState = new Map();

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

  function setMsg(text = "") {
    const el = document.getElementById("respMsg");
    if (el) el.textContent = text;
  }

  function setAdminMsg(text = "") {
    const el = document.getElementById("respAdminMsg");
    if (el) el.textContent = text;
  }

  function setEditMsg(text = "") {
    const el = document.getElementById("respEditMsg");
    if (el) el.textContent = text;
  }

  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("de-DE");
  }

  function fmtDateYmd(value) {
    if (!value) return "";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function fmtTs(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-DE");
  }

  function profileLabel(p) {
    const name = String(p.display_name || "").trim();
    const no = String(p.member_no || "").trim();
    const email = String(p.email || "").trim();
    return name || no || email || String(p.id || "");
  }

  function roleMap() {
    const map = new Map();
    roleRows.forEach((r) => {
      const id = String(r.user_id || "");
      const role = String(r.role || "").toLowerCase();
      if (!id || !role) return;
      const set = map.get(id) || new Set();
      set.add(role);
      map.set(id, set);
    });
    return map;
  }

  function managers() {
    const rm = roleMap();
    return profiles.filter((p) => {
      const roles = rm.get(String(p.id)) || new Set();
      return [...roles].some((r) => MANAGER_ROLES.has(r));
    });
  }

  function membersOnly() {
    const rm = roleMap();
    return profiles.filter((p) => {
      const roles = rm.get(String(p.id)) || new Set();
      return ![...roles].some((r) => MANAGER_ROLES.has(r));
    });
  }

  function asTaskAssigneeMap() {
    const map = new Map();
    taskAssignees.forEach((r) => {
      const key = String(r.task_id || "");
      const userId = String(r.user_id || "");
      if (!key || !userId) return;
      const arr = map.get(key) || [];
      arr.push(userId);
      map.set(key, arr);
    });
    return map;
  }

  function selectedMulti(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return [];
    return [...sel.selectedOptions].map((o) => String(o.value || "")).filter(Boolean);
  }

  function setMultiOptions(selectId, rows, selectedUserIds = []) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const selected = new Set((selectedUserIds || []).map(String));
    sel.innerHTML = rows.map((p) => {
      const id = String(p.id || "");
      return `<option value="${esc(id)}" ${selected.has(id) ? "selected" : ""}>${esc(profileLabel(p))}</option>`;
    }).join("");
  }

  function renderManagerChips() {
    const root = document.getElementById("respManagerChips");
    if (!root) return;
    const rows = managers();
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine Vorstände/Admins gefunden.</p>`;
      return;
    }
    root.innerHTML = rows.map((p) => {
      const id = String(p.id || "");
      const state = managerChipState.get(id) || "absent";
      return `
        <button type="button" class="resp-chip ${state === "present" ? "is-present" : "is-absent"}" data-manager-chip="${esc(id)}" data-status="${esc(state)}">
          <span>${esc(profileLabel(p))}</span>
          <small>${state === "present" ? "anwesend" : "abwesend"}</small>
        </button>
      `;
    }).join("");
  }

  function renderSessionOptions(selectId, selected = "") {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const ordered = [...sessions].sort((a, b) => String(b.meeting_date || "").localeCompare(String(a.meeting_date || "")));
    sel.innerHTML = `<option value="">Bitte wählen</option>` + ordered.map((s) => {
      const label = `${fmtDate(s.meeting_date)} · ${String(s.id).slice(0, 8)}`;
      return `<option value="${esc(s.id)}" ${String(s.id) === String(selected) ? "selected" : ""}>${esc(label)}</option>`;
    }).join("");
  }

  function agendaForSession(sessionId) {
    return agendaItems
      .filter((a) => String(a.session_id) === String(sessionId || ""))
      .sort((a, b) => Number(a.item_no || 0) - Number(b.item_no || 0));
  }

  function renderAgendaOptions(selectId, sessionId, selectedAgendaId = "") {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const rows = agendaForSession(sessionId);
    sel.innerHTML = `<option value="">Bitte wählen</option>` + rows.map((a) => {
      const label = `TOP ${a.item_no}: ${a.title}`;
      return `<option value="${esc(a.id)}" ${String(a.id) === String(selectedAgendaId) ? "selected" : ""}>${esc(label)}</option>`;
    }).join("");
  }

  function renderAgendaRows() {
    const root = document.getElementById("respAgendaRows");
    if (!root) return;
    if (!agendaItems.length) {
      root.innerHTML = `<p class="small">Noch keine Sitzungspunkte.</p>`;
      return;
    }
    const bySession = new Map();
    agendaItems.forEach((a) => {
      const key = String(a.session_id || "");
      const arr = bySession.get(key) || [];
      arr.push(a);
      bySession.set(key, arr);
    });

    root.innerHTML = sessions
      .slice()
      .sort((a, b) => String(b.meeting_date || "").localeCompare(String(a.meeting_date || "")))
      .map((s) => {
        const rows = (bySession.get(String(s.id)) || []).sort((a, b) => Number(a.item_no || 0) - Number(b.item_no || 0));
        if (!rows.length) return "";
        return `
          <article class="card">
            <div class="card__body">
              <h3>Sitzung ${esc(fmtDate(s.meeting_date))}</h3>
              <ul class="resp-agenda-list">
                ${rows.map((a) => `<li><strong>TOP ${Number(a.item_no || 0)}:</strong> ${esc(a.title || "-")}</li>`).join("")}
              </ul>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderTaskRows() {
    const root = document.getElementById("respTaskRows");
    const empty = document.getElementById("respTaskEmpty");
    if (!root) return;

    if (!meetingTasks.length) {
      root.innerHTML = "";
      if (empty) {
        empty.classList.remove("hidden");
        empty.removeAttribute("hidden");
      }
      return;
    }
    if (empty) {
      empty.classList.add("hidden");
      empty.setAttribute("hidden", "");
    }

    const sessionMap = new Map(sessions.map((s) => [String(s.id), s]));
    const agendaMap = new Map(agendaItems.map((a) => [String(a.id), a]));
    const profileMap = new Map(profiles.map((p) => [String(p.id), profileLabel(p)]));
    const aMap = asTaskAssigneeMap();

    root.innerHTML = meetingTasks.map((t) => {
      const assigned = (aMap.get(String(t.id)) || []).map((id) => profileMap.get(id) || id);
      const sess = sessionMap.get(String(t.meeting_session_id || ""));
      const ag = agendaMap.get(String(t.agenda_item_id || ""));
      return `
        <tr data-task-id="${t.id}" style="cursor:pointer;">
          <td>
            <strong>${esc(t.title)}</strong><br />
            <span class="small">${ag ? `TOP ${ag.item_no}: ${esc(ag.title)}` : "Kein Sitzungspunkt"}</span><br />
            <span class="small">Sitzung: ${esc(sess ? fmtDate(sess.meeting_date) : "-")}</span>
          </td>
          <td>${esc(t.status || "open")}</td>
          <td>${esc(fmtDate(t.due_date))}</td>
          <td class="small">${esc(assigned.length ? assigned.join(", ") : "-")}</td>
        </tr>
      `;
    }).join("");
  }

  async function loadMyRoles() {
    const userId = uid();
    if (!userId) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function loadProfiles() {
    const rows = await sb("/rest/v1/profiles?select=id,display_name,email,member_no&order=display_name.asc", { method: "GET" }, true);
    profiles = Array.isArray(rows) ? rows : [];
  }

  async function loadRoleRows() {
    const rows = await sb("/rest/v1/user_roles?select=user_id,role", { method: "GET" }, true);
    roleRows = Array.isArray(rows) ? rows : [];
  }

  async function loadSessions() {
    const rows = await sb("/rest/v1/meeting_sessions?select=id,meeting_date,created_at&order=meeting_date.desc", { method: "GET" }, true).catch(() => []);
    sessions = Array.isArray(rows) ? rows : [];
  }

  async function loadAttendees() {
    const rows = await sb("/rest/v1/meeting_session_attendees?select=session_id,user_id,attendance_status", { method: "GET" }, true).catch(() => []);
    attendees = Array.isArray(rows) ? rows : [];
  }

  async function loadAgendaItems() {
    const rows = await sb("/rest/v1/meeting_agenda_items?select=id,session_id,item_no,title,created_at&order=session_id.asc,item_no.asc", { method: "GET" }, true).catch(() => []);
    agendaItems = Array.isArray(rows) ? rows : [];
  }

  async function loadTasksAndAssignees() {
    const [tasks, ass] = await Promise.all([
      sb("/rest/v1/meeting_tasks?select=id,meeting_session_id,agenda_item_id,title,status,due_date,status_note,created_at,updated_at&order=due_date.asc.nullslast,created_at.desc", { method: "GET" }, true).catch(() => []),
      sb("/rest/v1/task_assignees?select=task_id,user_id", { method: "GET" }, true).catch(() => []),
    ]);
    meetingTasks = Array.isArray(tasks) ? tasks : [];
    taskAssignees = Array.isArray(ass) ? ass : [];
  }

  async function replaceAssignees(taskId, userIds) {
    await sb(`/rest/v1/task_assignees?task_id=eq.${encodeURIComponent(taskId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }, true);

    const rows = [...new Set((userIds || []).map(String).filter(Boolean))].map((u) => ({ task_id: taskId, user_id: u, assigned_by: uid() }));
    if (!rows.length) return;

    await sb("/rest/v1/task_assignees", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    }, true);
  }

  async function refreshAdminData() {
    await Promise.all([loadProfiles(), loadRoleRows(), loadSessions(), loadAttendees(), loadAgendaItems(), loadTasksAndAssignees()]);

    managers().forEach((p) => {
      if (!managerChipState.has(String(p.id))) managerChipState.set(String(p.id), "absent");
    });

    renderManagerChips();
    renderSessionOptions("respAgendaSession");
    renderSessionOptions("respTaskSession");
    renderSessionOptions("respEditSession");
    renderAgendaOptions("respTaskAgendaItem", document.getElementById("respTaskSession")?.value || "");
    renderAgendaOptions("respEditAgendaItem", document.getElementById("respEditSession")?.value || "");
    renderAgendaRows();
    renderTaskRows();
    setMultiOptions("respTaskManagerAssignees", managers(), []);
    setMultiOptions("respTaskMemberAssignees", membersOnly(), []);
  }

  function taskById(taskId) {
    return meetingTasks.find((t) => String(t.id) === String(taskId)) || null;
  }

  function openEditDialog(taskId) {
    const t = taskById(taskId);
    if (!t) return;

    activeTaskId = String(t.id);
    renderSessionOptions("respEditSession", t.meeting_session_id || "");
    renderAgendaOptions("respEditAgendaItem", t.meeting_session_id || "", t.agenda_item_id || "");

    const assMap = asTaskAssigneeMap();
    const selected = new Set((assMap.get(String(t.id)) || []).map(String));
    const managerIds = managers().map((p) => String(p.id));
    const memberIds = membersOnly().map((p) => String(p.id));

    setMultiOptions("respEditManagerAssignees", managers(), managerIds.filter((id) => selected.has(id)));
    setMultiOptions("respEditMemberAssignees", membersOnly(), memberIds.filter((id) => selected.has(id)));

    const v = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };

    v("respEditTitle", t.title || "");
    v("respEditStatus", t.status || "open");
    v("respEditDueDate", fmtDateYmd(t.due_date || ""));
    v("respEditStatusNote", t.status_note || "");

    setEditMsg("");
    const dlg = document.getElementById("respTaskDialog");
    if (dlg && !dlg.open) dlg.showModal();
  }

  function closeEditDialog() {
    const dlg = document.getElementById("respTaskDialog");
    if (dlg?.open) dlg.close();
    activeTaskId = null;
    setEditMsg("");
  }

  async function loadResponsibilities() {
    const rows = await sb("/rest/v1/v_my_responsibilities?select=responsibility_type,source_id,title,status,due_date,status_note,starts_at,ends_at,location,created_at,updated_at&order=due_date.asc.nullslast,starts_at.asc.nullslast,created_at.desc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function renderMeetingTasks(rows) {
    const root = document.getElementById("respMeetingTasks");
    if (!root) return;
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine zugewiesenen Sitzungstasks.</p>`;
      return;
    }
    root.innerHTML = rows.map((r) => `
      <article class="card">
        <div class="card__body">
          <h3>${esc(r.title || "Task")}</h3>
          <p class="small">Status: <strong>${esc(r.status || "-")}</strong></p>
          <p class="small">Fällig: ${esc(fmtDate(r.due_date))}</p>
          ${r.status_note ? `<p class="small">Hinweis: ${esc(r.status_note)}</p>` : ""}
          <p class="small">Aktualisiert: ${esc(fmtTs(r.updated_at))}</p>
        </div>
      </article>
    `).join("");
  }

  function renderWorkLeads(rows) {
    const root = document.getElementById("respWorkLeads");
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

  async function refreshMyResponsibilities() {
    const rows = await loadResponsibilities();
    renderMeetingTasks(rows.filter((r) => r.responsibility_type === "meeting_task"));
    renderWorkLeads(rows.filter((r) => r.responsibility_type === "work_event_lead"));
    setMsg(`Geladen: ${rows.length}`);
  }

  function bindAdminUi() {
    document.getElementById("respManagerChips")?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-manager-chip]");
      if (!btn) return;
      const id = String(btn.getAttribute("data-manager-chip") || "");
      if (!id) return;
      const next = (managerChipState.get(id) || "absent") === "present" ? "absent" : "present";
      managerChipState.set(id, next);
      renderManagerChips();
    });

    document.getElementById("respSessionCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const meetingDate = String(document.getElementById("respSessionDate")?.value || "").trim();
        if (!meetingDate) throw new Error("Sitzungsdatum ist erforderlich.");

        setAdminMsg("Sitzung wird gespeichert...");
        const created = await sb("/rest/v1/meeting_sessions", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ meeting_date: meetingDate, created_by: uid() }),
        }, true);

        const row = Array.isArray(created) ? created[0] : created;
        if (!row?.id) throw new Error("Sitzung konnte nicht angelegt werden.");

        const attendeeRows = managers().map((p) => ({
          session_id: row.id,
          user_id: p.id,
          attendance_status: managerChipState.get(String(p.id)) || "absent",
        }));

        if (attendeeRows.length) {
          await sb("/rest/v1/meeting_session_attendees", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(attendeeRows),
          }, true);
        }

        await refreshAdminData();
        setAdminMsg("Sitzung gespeichert.");
      } catch (err) {
        setAdminMsg(err?.message || "Sitzung konnte nicht gespeichert werden.");
      }
    });

    document.getElementById("respAgendaCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const sessionId = String(document.getElementById("respAgendaSession")?.value || "").trim();
        const title = String(document.getElementById("respAgendaTitle")?.value || "").trim();
        if (!sessionId) throw new Error("Bitte Sitzung wählen.");
        if (title.length < 2) throw new Error("Sitzungspunkt ist zu kurz.");

        setAdminMsg("Sitzungspunkt wird gespeichert...");
        await sb("/rest/v1/meeting_agenda_items", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ session_id: sessionId, title, item_no: null, created_by: uid() }),
        }, true);

        const titleEl = document.getElementById("respAgendaTitle");
        if (titleEl) titleEl.value = "";

        await refreshAdminData();
        renderAgendaOptions("respTaskAgendaItem", sessionId, "");
        setAdminMsg("Sitzungspunkt angelegt.");
      } catch (err) {
        setAdminMsg(err?.message || "Sitzungspunkt konnte nicht angelegt werden.");
      }
    });

    document.getElementById("respTaskSession")?.addEventListener("change", (e) => {
      renderAgendaOptions("respTaskAgendaItem", e.target.value || "", "");
    });

    document.getElementById("respEditSession")?.addEventListener("change", (e) => {
      renderAgendaOptions("respEditAgendaItem", e.target.value || "", "");
    });

    document.getElementById("respTaskCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const meetingSessionId = String(document.getElementById("respTaskSession")?.value || "").trim();
        const agendaItemId = String(document.getElementById("respTaskAgendaItem")?.value || "").trim();
        const title = String(document.getElementById("respTaskTitle")?.value || "").trim();
        if (!meetingSessionId) throw new Error("Bitte Sitzung wählen.");
        if (!agendaItemId) throw new Error("Bitte Sitzungspunkt wählen.");
        if (title.length < 3) throw new Error("Task-Titel muss mindestens 3 Zeichen haben.");

        setAdminMsg("Task wird gespeichert...");
        const out = await sb("/rest/v1/meeting_tasks", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            meeting_session_id: meetingSessionId,
            agenda_item_id: agendaItemId,
            title,
            status: String(document.getElementById("respTaskStatus")?.value || "open"),
            due_date: String(document.getElementById("respTaskDueDate")?.value || "").trim() || null,
            status_note: String(document.getElementById("respTaskStatusNote")?.value || "").trim() || null,
            created_by: uid(),
          }),
        }, true);

        const task = Array.isArray(out) ? out[0] : out;
        if (!task?.id) throw new Error("Task konnte nicht angelegt werden.");

        const assignees = [...selectedMulti("respTaskManagerAssignees"), ...selectedMulti("respTaskMemberAssignees")];
        await replaceAssignees(task.id, assignees);

        e.target.reset();
        renderAgendaOptions("respTaskAgendaItem", document.getElementById("respTaskSession")?.value || "", "");
        setMultiOptions("respTaskManagerAssignees", managers(), []);
        setMultiOptions("respTaskMemberAssignees", membersOnly(), []);

        await refreshAdminData();
        await refreshMyResponsibilities();
        setAdminMsg("Task angelegt.");
      } catch (err) {
        setAdminMsg(err?.message || "Task konnte nicht angelegt werden.");
      }
    });

    document.getElementById("respTaskRows")?.addEventListener("click", (e) => {
      const row = e.target?.closest?.("tr[data-task-id]");
      if (!row) return;
      const id = row.getAttribute("data-task-id");
      if (id) openEditDialog(id);
    });

    document.getElementById("respEditClose")?.addEventListener("click", closeEditDialog);

    document.getElementById("respEditSave")?.addEventListener("click", async () => {
      if (!activeTaskId) return;
      try {
        setEditMsg("Speichere...");
        await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(activeTaskId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            meeting_session_id: String(document.getElementById("respEditSession")?.value || "").trim() || null,
            agenda_item_id: String(document.getElementById("respEditAgendaItem")?.value || "").trim() || null,
            title: String(document.getElementById("respEditTitle")?.value || "").trim(),
            status: String(document.getElementById("respEditStatus")?.value || "open"),
            due_date: String(document.getElementById("respEditDueDate")?.value || "").trim() || null,
            status_note: String(document.getElementById("respEditStatusNote")?.value || "").trim() || null,
          }),
        }, true);

        const assignees = [...selectedMulti("respEditManagerAssignees"), ...selectedMulti("respEditMemberAssignees")];
        await replaceAssignees(activeTaskId, assignees);

        await refreshAdminData();
        await refreshMyResponsibilities();
        setEditMsg("Gespeichert.");
      } catch (err) {
        setEditMsg(err?.message || "Speichern fehlgeschlagen.");
      }
    });

    document.getElementById("respEditDelete")?.addEventListener("click", async () => {
      if (!activeTaskId) return;
      try {
        setEditMsg("Lösche...");
        await sb(`/rest/v1/meeting_tasks?id=eq.${encodeURIComponent(activeTaskId)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        }, true);
        closeEditDialog();
        await refreshAdminData();
        await refreshMyResponsibilities();
        setAdminMsg("Task gelöscht.");
      } catch (err) {
        setEditMsg(err?.message || "Löschen fehlgeschlagen.");
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

    const roles = await loadMyRoles().catch(() => []);
    const isManager = roles.some((r) => MANAGER_ROLES.has(r));

    try {
      if (isManager) {
        setAdminMsg("Lade Sitzungen...");
        await refreshAdminData();
        bindAdminUi();
        setAdminMsg(`Geladen: ${sessions.length} Sitzungen, ${agendaItems.length} Sitzungspunkte, ${meetingTasks.length} Tasks`);
      } else {
        const sec = document.querySelector("[data-manager-only]");
        if (sec) {
          sec.classList.add("hidden");
          sec.setAttribute("hidden", "");
        }
      }
      await refreshMyResponsibilities();
    } catch (err) {
      setAdminMsg(err?.message || "Sitzungs-Cockpit konnte nicht geladen werden.");
      setMsg(err?.message || "Konnte Zuständigkeiten nicht laden.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
