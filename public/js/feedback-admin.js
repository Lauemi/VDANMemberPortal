;(() => {
  const STATUS_VALUES = ["open", "in_progress", "needs_info", "fixed", "closed"];
  const PRIORITY_VALUES = ["low", "normal", "high", "critical"];

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

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
    return session()?.user?.id || "";
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    const token = session()?.access_token;
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  function esc(v) {
    return String(v || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function setMsg(text, tone = "muted") {
    const el = document.getElementById("bugAdminMsg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = tone === "danger" ? "var(--danger)" : tone === "ok" ? "var(--ok)" : "";
  }

  async function loadRoles() {
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid())}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listReports() {
    const status = String(document.getElementById("bugAdminStatus")?.value || "all");
    const priority = String(document.getElementById("bugAdminPriority")?.value || "all");
    const where = [];
    if (status !== "all") where.push(`status=eq.${encodeURIComponent(status)}`);
    if (priority !== "all") where.push(`priority=eq.${encodeURIComponent(priority)}`);
    where.push("order=created_at.desc");
    const query = where.join("&");
    return sb(`/rest/v1/bug_reports?select=id,created_at,reporter_user_id,title,description,status,priority,current_path,screenshot_url,admin_note,resolution_note&${query}`, { method: "GET" }, true);
  }

  async function processReport(payload) {
    return sb("/rest/v1/rpc/admin_process_bug_report", {
      method: "POST",
      body: JSON.stringify(payload),
    }, true);
  }

  function statusOptions(selected) {
    return STATUS_VALUES.map((s) => `<option value="${s}" ${s === selected ? "selected" : ""}>${s}</option>`).join("");
  }

  function priorityOptions(selected) {
    return PRIORITY_VALUES.map((p) => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`).join("");
  }

  function render(rows) {
    const root = document.getElementById("bugAdminList");
    if (!root) return;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      root.innerHTML = '<p class="small">Keine Meldungen für den aktuellen Filter.</p>';
      return;
    }
    root.innerHTML = list.map((r) => `
      <article class="card card--soft">
        <div class="card__body" data-report-id="${esc(r.id)}">
          <p class="small">#${esc(r.id)} · ${new Date(r.created_at).toLocaleString("de-DE")} · User: ${esc(r.reporter_user_id)}</p>
          <h3 style="margin:6px 0 8px;">${esc(r.title)}</h3>
          <p>${esc(r.description)}</p>
          ${r.current_path ? `<p class="small"><strong>Pfad:</strong> ${esc(r.current_path)}</p>` : ""}
          ${r.screenshot_url ? `<p class="small"><a href="${esc(r.screenshot_url)}" target="_blank" rel="noopener">Screenshot öffnen</a></p>` : ""}
          <div class="ui-filter-row" style="margin-top:8px;">
            <label>
              <span>Status</span>
              <select data-field="status">${statusOptions(String(r.status || "open"))}</select>
            </label>
            <label>
              <span>Priorität</span>
              <select data-field="priority">${priorityOptions(String(r.priority || "normal"))}</select>
            </label>
          </div>
          <label>
            <span>Rückfrage / Admin-Notiz</span>
            <textarea rows="2" data-field="admin_note" placeholder="Frage an den Melder oder interner Hinweis">${esc(r.admin_note || "")}</textarea>
          </label>
          <label>
            <span>Fix-Notiz</span>
            <textarea rows="2" data-field="resolution_note" placeholder="Kurz was gefixt wurde">${esc(r.resolution_note || "")}</textarea>
          </label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button type="button" class="feed-btn" data-action="save">Speichern</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  async function refresh() {
    const rows = await listReports();
    render(rows);
  }

  onReady(async () => {
    try {
      const roles = await loadRoles();
      const isManager = roles.includes("admin") || roles.includes("vorstand");
      if (!isManager) {
        setMsg("Kein Zugriff auf das Fehler-Cockpit.", "danger");
        return;
      }
    } catch {
      setMsg("Rollenprüfung fehlgeschlagen.", "danger");
      return;
    }

    document.getElementById("bugAdminReload")?.addEventListener("click", () => {
      refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", "danger"));
    });
    document.getElementById("bugAdminStatus")?.addEventListener("change", () => {
      refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", "danger"));
    });
    document.getElementById("bugAdminPriority")?.addEventListener("change", () => {
      refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", "danger"));
    });

    document.getElementById("bugAdminList")?.addEventListener("click", async (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest("[data-action='save']") : null;
      if (!btn) return;
      const host = btn.closest("[data-report-id]");
      if (!host) return;

      const reportId = String(host.getAttribute("data-report-id") || "").trim();
      const status = String(host.querySelector("[data-field='status']")?.value || "open").trim();
      const priority = String(host.querySelector("[data-field='priority']")?.value || "normal").trim();
      const adminNote = String(host.querySelector("[data-field='admin_note']")?.value || "").trim();
      const resolutionNote = String(host.querySelector("[data-field='resolution_note']")?.value || "").trim();

      if (!reportId) return;
      try {
        btn.setAttribute("disabled", "true");
        await processReport({
          p_report_id: reportId,
          p_status: status,
          p_admin_note: adminNote || null,
          p_resolution_note: resolutionNote || null,
          p_priority: priority || null,
        });
        setMsg("Meldung aktualisiert.", "ok");
        await refresh();
      } catch (e) {
        setMsg(e.message || "Speichern fehlgeschlagen", "danger");
      } finally {
        btn.removeAttribute("disabled");
      }
    });

    refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", "danger"));
  });
})();
