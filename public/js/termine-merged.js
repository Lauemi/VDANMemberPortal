;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  async function sb(path) {
    const { url, key } = cfg();
    const headers = new Headers();
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    const res = await fetch(`${url}${path}`, { method: "GET", headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  function setMsg(text = "") {
    const el = document.getElementById("termineMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmt(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("de-DE");
  }

  async function listCombinedUpcoming() {
    const nowIso = new Date().toISOString();
    const [terms, works] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`),
      sb(`/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,status&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`),
    ]);

    const t = (Array.isArray(terms) ? terms : []).map((x) => ({ ...x, kind: "termin", badge: "Termin" }));
    const w = (Array.isArray(works) ? works : []).map((x) => ({ ...x, kind: "arbeitseinsatz", badge: "Arbeitseinsatz" }));
    return [...t, ...w].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  function render(rows) {
    const root = document.getElementById("termineList");
    if (!root) return;
    root.innerHTML = "";

    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine kommenden Termine vorhanden.</p>`;
      return;
    }

    rows.forEach((row) => {
      const article = document.createElement("article");
      article.className = "card term-card";
      article.innerHTML = `
        <div class="card__body">
          <h3>${escapeHtml(row.title)}</h3>
          <p class="small"><span class="feed-chip">${escapeHtml(row.badge)}</span></p>
          <p class="small">${escapeHtml(fmt(row.starts_at))} - ${escapeHtml(fmt(row.ends_at))}</p>
          <p class="small">${escapeHtml(row.location || "Ort offen")}</p>
          ${row.description ? `<p class="small">${escapeHtml(row.description)}</p>` : ""}
        </div>
      `;
      root.appendChild(article);
    });
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    try {
      setMsg("");
      const rows = await listCombinedUpcoming();
      render(rows);
    } catch (err) {
      setMsg(err?.message || "Termine konnten nicht geladen werden");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
