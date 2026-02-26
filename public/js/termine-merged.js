;(() => {
  const VIEW_KEY = "app:viewMode:termine:v1";
  const FILTER_KEY = "app:viewFilter:termine:v1";
  const state = {
    all: [],
    rows: [],
    ansicht: "zeile",
  };

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

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmt(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso || "-") : d.toLocaleString("de-DE");
  }

  function setMsg(text = "") {
    const el = document.getElementById("termineMsg");
    if (el) el.textContent = text;
  }

  function loadView() {
    try {
      return String(localStorage.getItem(VIEW_KEY) || "zeile") === "karte" ? "karte" : "zeile";
    } catch {
      return "zeile";
    }
  }

  function saveView(v) {
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
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

  async function listCombinedUpcoming() {
    const nowIso = new Date().toISOString();
    const [terms, works] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`),
      sb(`/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,status&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`),
    ]);

    const t = (Array.isArray(terms) ? terms : []).map((x) => ({ ...x, kind: "termin", badge: "Termin", row_id: `termin:${x.id}` }));
    const w = (Array.isArray(works) ? works : []).map((x) => ({ ...x, kind: "arbeitseinsatz", badge: "Arbeitseinsatz", row_id: `arbeit:${x.id}` }));
    return [...t, ...w].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  function applyFilters() {
    const search = String(document.getElementById("termineSearch")?.value || "").trim().toLowerCase();
    const kind = String(document.getElementById("termineTypeFilter")?.value || "alle");
    saveFilter({ search, kind });
    state.rows = state.all.filter((row) => {
      if (kind !== "alle" && row.kind !== kind) return false;
      if (!search) return true;
      const hay = `${row.title || ""} ${row.location || ""}`.toLowerCase();
      return hay.includes(search);
    });
  }

  function renderDetail(rowId) {
    const row = state.rows.find((r) => r.row_id === rowId) || state.all.find((r) => r.row_id === rowId);
    if (!row) return;
    const box = document.getElementById("termineDetailBody");
    if (!box) return;
    box.innerHTML = `
      <p><strong>Titel:</strong> ${esc(row.title || "-")}</p>
      <p><strong>Art:</strong> ${esc(row.badge)}</p>
      <p><strong>Start:</strong> ${esc(fmt(row.starts_at))}</p>
      <p><strong>Ende:</strong> ${esc(fmt(row.ends_at))}</p>
      <p><strong>Ort:</strong> ${esc(row.location || "-")}</p>
      <p><strong>Beschreibung:</strong> ${esc(row.description || "-")}</p>
    `;
    document.getElementById("termineDetailDialog")?.showModal?.();
  }

  function renderTable(rows) {
    const body = document.getElementById("termineTableBody");
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = `<p class="small" style="padding:12px;">Keine kommenden Termine vorhanden.</p>`;
      return;
    }
    body.innerHTML = rows.map((row) => `
      <button type="button" class="catch-table__row" data-open-row="${esc(row.row_id)}" style="grid-template-columns:1.2fr 1.6fr 1fr 1fr;">
        <span>${esc(fmt(row.starts_at))}</span>
        <span>${esc(row.title || "-")}</span>
        <span>${esc(row.badge)}</span>
        <span>${esc(row.location || "-")}</span>
      </button>
    `).join("");
  }

  function renderCards(rows) {
    const root = document.getElementById("termineCards");
    if (!root) return;
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine kommenden Termine vorhanden.</p>`;
      return;
    }
    root.innerHTML = rows.map((row) => `
      <button type="button" class="card term-card" data-open-row="${esc(row.row_id)}" style="text-align:left;">
        <div class="card__body">
          <h3>${esc(row.title)}</h3>
          <p class="small"><span class="feed-chip">${esc(row.badge)}</span></p>
          <p class="small">${esc(fmt(row.starts_at))} - ${esc(fmt(row.ends_at))}</p>
          <p class="small">${esc(row.location || "Ort offen")}</p>
          ${row.description ? `<p class="small">${esc(row.description)}</p>` : ""}
        </div>
      </button>
    `).join("");
  }

  function applyView() {
    const tableWrap = document.getElementById("termineTableWrap");
    const cardsWrap = document.getElementById("termineCards");
    const zeileBtn = document.getElementById("termineViewZeileBtn");
    const karteBtn = document.getElementById("termineViewKarteBtn");
    const isCard = state.ansicht === "karte";
    tableWrap?.classList.toggle("hidden", isCard);
    tableWrap?.toggleAttribute("hidden", isCard);
    cardsWrap?.classList.toggle("hidden", !isCard);
    cardsWrap?.toggleAttribute("hidden", !isCard);
    zeileBtn?.classList.toggle("feed-btn--ghost", isCard);
    karteBtn?.classList.toggle("feed-btn--ghost", !isCard);
  }

  function renderAll() {
    applyFilters();
    renderTable(state.rows);
    renderCards(state.rows);
    applyView();
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    state.ansicht = loadView();
    const filter = loadFilter();
    const searchEl = document.getElementById("termineSearch");
    const typeEl = document.getElementById("termineTypeFilter");
    if (searchEl && filter.search) searchEl.value = String(filter.search);
    if (typeEl && (filter.kind === "termin" || filter.kind === "arbeitseinsatz" || filter.kind === "alle")) typeEl.value = filter.kind;

    try {
      setMsg("");
      state.all = await listCombinedUpcoming();
      renderAll();
    } catch (err) {
      setMsg(err?.message || "Termine konnten nicht geladen werden");
    }

    document.addEventListener("click", (e) => {
      const openRow = e.target.closest?.("[data-open-row]");
      if (openRow) {
        renderDetail(String(openRow.getAttribute("data-open-row") || ""));
        return;
      }
      if (e.target.closest?.("#termineViewZeileBtn")) {
        state.ansicht = "zeile";
        saveView(state.ansicht);
        applyView();
        return;
      }
      if (e.target.closest?.("#termineViewKarteBtn")) {
        state.ansicht = "karte";
        saveView(state.ansicht);
        applyView();
      }
    });

    searchEl?.addEventListener("input", renderAll);
    typeEl?.addEventListener("change", renderAll);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
