;(() => {
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
    const el = document.getElementById("bugReportMsg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = tone === "danger" ? "var(--danger)" : tone === "ok" ? "var(--ok)" : "";
  }

  function statusLabel(v) {
    const map = {
      open: "Open",
      in_progress: "In Progress",
      needs_info: "Rückfrage",
      fixed: "Fixed",
      closed: "Closed",
    };
    return map[String(v || "").trim()] || String(v || "-");
  }

  function prioLabel(v) {
    const map = { critical: "Critical", high: "High", normal: "Normal", low: "Low" };
    return map[String(v || "").trim()] || String(v || "-");
  }

  async function createReport(payload) {
    return sb("/rest/v1/bug_reports", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    }, true);
  }

  async function listOwnReports() {
    const q = [
      "id,created_at,title,description,status,priority,admin_note,resolution_note,current_path,screenshot_url",
      `reporter_user_id=eq.${encodeURIComponent(uid())}`,
      "order=created_at.desc",
    ].join("&");
    return sb(`/rest/v1/bug_reports?select=${q}`, { method: "GET" }, true);
  }

  function render(rows) {
    const root = document.getElementById("bugReportList");
    if (!root) return;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      root.innerHTML = '<p class="small">Noch keine Meldungen.</p>';
      return;
    }
    root.innerHTML = list.map((r) => `
      <article class="card card--soft">
        <div class="card__body">
          <p class="small">#${esc(r.id)} · ${new Date(r.created_at).toLocaleString("de-DE")}</p>
          <h3 style="margin:6px 0 8px;">${esc(r.title)}</h3>
          <p>${esc(r.description)}</p>
          <p class="small"><strong>Status:</strong> ${esc(statusLabel(r.status))} · <strong>Priorität:</strong> ${esc(prioLabel(r.priority))}</p>
          ${r.current_path ? `<p class="small"><strong>Pfad:</strong> ${esc(r.current_path)}</p>` : ""}
          ${r.screenshot_url ? `<p class="small"><a href="${esc(r.screenshot_url)}" target="_blank" rel="noopener">Screenshot öffnen</a></p>` : ""}
          ${r.admin_note ? `<p class="small"><strong>Admin-Rückfrage:</strong> ${esc(r.admin_note)}</p>` : ""}
          ${r.resolution_note ? `<p class="small"><strong>Fix-Notiz:</strong> ${esc(r.resolution_note)}</p>` : ""}
        </div>
      </article>
    `).join("");
  }

  async function refresh() {
    const rows = await listOwnReports();
    render(rows);
  }

  onReady(() => {
    const form = document.getElementById("bugReportForm");
    const reload = document.getElementById("bugReloadBtn");

    reload?.addEventListener("click", () => {
      refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", "danger"));
    });

    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setMsg("");
      const title = String(document.getElementById("bugTitle")?.value || "").trim();
      const description = String(document.getElementById("bugDescription")?.value || "").trim();
      const screenshotUrl = String(document.getElementById("bugScreenshotUrl")?.value || "").trim();

      if (!title || !description) {
        setMsg("Titel und Beschreibung sind Pflicht.", "danger");
        return;
      }

      const payload = {
        reporter_user_id: uid(),
        title,
        description,
        screenshot_url: screenshotUrl || null,
        current_path: window.location.pathname,
        app_channel: String(window.__APP_CHANNEL || "").trim() || null,
        app_version: String(document.body?.dataset?.appVersion || "").trim() || null,
      };

      try {
        const btn = document.getElementById("bugSubmitBtn");
        if (btn) btn.setAttribute("disabled", "true");
        await createReport(payload);
        form.reset();
        setMsg("Fehler wurde gemeldet. Danke!", "ok");
        await refresh();
      } catch (e) {
        setMsg(e.message || "Meldung fehlgeschlagen", "danger");
      } finally {
        document.getElementById("bugSubmitBtn")?.removeAttribute("disabled");
      }
    });

    refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", "danger"));
  });
})();
