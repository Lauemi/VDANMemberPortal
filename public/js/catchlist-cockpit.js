;(() => {
  const ADMIN_ROLES = new Set(["admin"]);
  const VIEW_KEY = "app:viewMode:fangliste-cockpit:v1";
  const PREF_KEY_PREFIX = "app:viewSettings:fangliste-cockpit:user:v1";
  const COLUMNS_DEFAULT = [
    { key: "name", label: "Mitglied", visible: true },
    { key: "member_no", label: "Mitglieds-Nr.", visible: true },
    { key: "trips_total", label: "Angeltage", visible: true },
    { key: "no_catch_days", label: "Kein Fang", visible: true },
    { key: "catches_total", label: "Fänge gesamt", visible: true },
    { key: "last_entry_at", label: "Letzter Eintrag", visible: true },
    { key: "status", label: "Status", visible: true },
  ];

  const state = {
    uid: null,
    rows: [],
    search: "",
    ansicht: "zeile",
    columns: COLUMNS_DEFAULT.map((c) => ({ ...c })),
    sort: { key: "name", dir: "asc" },
    filters: {
      name: "",
      member_no: "",
      trips_total: "",
      no_catch_days: "",
      catches_total: "",
      last_entry_at: "",
      status: "",
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

  function prefsKey() {
    return `${PREF_KEY_PREFIX}:${state.uid || "anon"}`;
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtTs(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-DE");
  }

  function setMsg(text = "") {
    const el = document.getElementById("catchCockpitMsg");
    if (el) el.textContent = text;
  }

  function statusText(r) {
    return r.is_online ? "Online" : `Offline (${fmtTs(r.last_seen_at)})`;
  }

  function rowValue(r, key) {
    if (key === "status") return statusText(r);
    if (key === "last_entry_at") return fmtTs(r.last_entry_at);
    return String(r?.[key] ?? "");
  }

  function loadAnsicht() {
    try {
      const v = String(localStorage.getItem(VIEW_KEY) || "zeile").toLowerCase();
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

  function loadPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(prefsKey()) || "{}") || {};
      const byKey = new Map(COLUMNS_DEFAULT.map((c) => [c.key, { ...c }]));
      const order = Array.isArray(raw.columns) ? raw.columns.map((x) => String(x || "")) : [];
      const visible = raw.visible && typeof raw.visible === "object" ? raw.visible : {};
      const out = [];
      order.forEach((k) => {
        if (!byKey.has(k)) return;
        const c = byKey.get(k);
        c.visible = visible[k] !== false;
        out.push(c);
        byKey.delete(k);
      });
      byKey.forEach((c) => {
        c.visible = visible[c.key] !== false;
        out.push(c);
      });
      if (out.length) state.columns = out;

      const sortKey = String(raw.sortKey || "name");
      const sortDir = String(raw.sortDir || "asc") === "desc" ? "desc" : "asc";
      if (state.columns.some((c) => c.key === sortKey)) state.sort.key = sortKey;
      state.sort.dir = sortDir;

      const f = raw.filter && typeof raw.filter === "object" ? raw.filter : {};
      Object.keys(state.filters).forEach((k) => { state.filters[k] = String(f[k] || ""); });
      state.search = String(raw.search || "");
    } catch {
      state.columns = COLUMNS_DEFAULT.map((c) => ({ ...c }));
    }
  }

  function savePrefs() {
    try {
      const payload = {
        columns: state.columns.map((c) => c.key),
        visible: state.columns.reduce((acc, c) => ({ ...acc, [c.key]: Boolean(c.visible) }), {}),
        sortKey: state.sort.key,
        sortDir: state.sort.dir,
        filter: state.filters,
        search: state.search,
      };
      localStorage.setItem(prefsKey(), JSON.stringify(payload));
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
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  async function loadMyRoles() {
    if (!state.uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(state.uid)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function loadProfiles() {
    const rows = await sb("/rest/v1/profiles?select=id,display_name,email,member_no&order=member_no.asc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function loadStats() {
    try {
      const rows = await sb("/rest/v1/v_admin_member_catch_stats?select=user_id,member_name,display_name,email,member_no,trips_total,no_catch_days,catches_total,last_entry_at", { method: "GET" }, true);
      return Array.isArray(rows) ? rows : [];
    } catch {
      const rows = await sb("/rest/v1/rpc/admin_catch_member_stats", { method: "POST", body: JSON.stringify({}) }, true);
      return Array.isArray(rows) ? rows : [];
    }
  }

  async function loadOnlineUsage() {
    const rows = await sb("/rest/v1/v_admin_online_users?select=user_id,is_online,last_seen_at", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function normalizeStatsRow(r) {
    return {
      user_id: String(r.user_id || ""),
      trips_total: Number(r.trips_total ?? r.angeltage_count ?? 0),
      no_catch_days: Number(r.no_catch_days ?? r.no_catch_count ?? 0),
      catches_total: Number(r.catches_total ?? r.catches_total_qty ?? 0),
      last_entry_at: r.last_entry_at || null,
    };
  }

  function mergeRows(profiles, statsRows, onlineRows = []) {
    const statMap = new Map(
      statsRows.map(normalizeStatsRow).filter((r) => r.user_id).map((r) => [r.user_id, r])
    );
    const onlineMap = new Map(
      (onlineRows || []).filter((r) => r?.user_id).map((r) => [String(r.user_id), r])
    );

    return (profiles || []).map((p) => {
      const key = String(p.id || "");
      const s = statMap.get(key) || {};
      const o = onlineMap.get(key) || {};
      return {
        user_id: key,
        member_no: String(p.member_no || ""),
        name: String(p.display_name || p.email || key),
        email: String(p.email || ""),
        trips_total: Number(s.trips_total || 0),
        no_catch_days: Number(s.no_catch_days || 0),
        catches_total: Number(s.catches_total || 0),
        last_entry_at: s.last_entry_at || null,
        is_online: Boolean(o.is_online),
        last_seen_at: o.last_seen_at || null,
      };
    });
  }

  function visibleColumns() {
    const cols = state.columns.filter((c) => c.visible);
    return cols.length ? cols : [state.columns[0]];
  }

  function filteredRows() {
    const q = state.search.trim().toLowerCase();
    let rows = state.rows.filter((r) => {
      if (q) {
        const hit = [r.name, r.email, r.member_no].some((v) => String(v || "").toLowerCase().includes(q));
        if (!hit) return false;
      }
      for (const [k, v] of Object.entries(state.filters)) {
        const fv = String(v || "").trim().toLowerCase();
        if (!fv) continue;
        if (k === "last_entry_at") {
          const iso = String(r.last_entry_at || "").slice(0, 10).toLowerCase();
          if (!iso.includes(fv)) return false;
          continue;
        }
        const rv = String(rowValue(r, k) || "").toLowerCase();
        if (!rv.includes(fv)) return false;
      }
      return true;
    });

    const dir = state.sort.dir === "desc" ? -1 : 1;
    rows = rows.slice().sort((a, b) => {
      const av = String(rowValue(a, state.sort.key) || "").toLowerCase();
      const bv = String(rowValue(b, state.sort.key) || "").toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return rows;
  }

  function renderHead() {
    const head = document.getElementById("catchCockpitHead");
    if (!head) return;
    const cols = visibleColumns();
    head.style.gridTemplateColumns = `repeat(${cols.length}, minmax(0, 1fr))`;
    head.innerHTML = cols
      .map((c) => {
        const active = state.sort.key === c.key;
        const arrow = active ? (state.sort.dir === "asc" ? "↑" : "↓") : "";
        return `<button type="button" class="documents-head__button" data-sort-key="${esc(c.key)}">${esc(c.label)} ${arrow}</button>`;
      })
      .join("");
  }

  function renderRows(rows) {
    const root = document.getElementById("catchCockpitRows");
    if (!root) return;
    root.innerHTML = "";
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine Mitglieder gefunden.</p>`;
      return;
    }
    const cols = visibleColumns();
    rows.forEach((r) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "catch-row";
      btn.setAttribute("data-open-member-id", esc(r.user_id));
      btn.style.gridTemplateColumns = `repeat(${cols.length}, minmax(0, 1fr))`;
      btn.innerHTML = cols
        .map((c) => {
          if (c.key === "name") {
            return `<div><strong>${esc(r.name)}</strong><div class="small">${esc(r.email || "-")}</div></div>`;
          }
          return `<div>${esc(rowValue(r, c.key))}</div>`;
        })
        .join("");
      root.appendChild(btn);
    });
  }

  function renderCards(rows) {
    const root = document.getElementById("catchCockpitCards");
    if (!root) return;
    root.innerHTML = "";
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine Mitglieder gefunden.</p>`;
      return;
    }
    rows.forEach((r) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ui-karte";
      card.setAttribute("data-open-member-id", esc(r.user_id));
      card.innerHTML = `
        <div class="ui-karte__kopf">
          <h3 class="ui-karte__titel">${esc(r.name)}</h3>
          <span class="ui-chip">${r.is_online ? "Online" : "Offline"}</span>
        </div>
        <p class="small">${esc(r.email || "-")}</p>
        <p class="small">Nr: ${esc(r.member_no || "-")}</p>
        <div class="ui-karte__meta">
          <span class="ui-chip">Angeltage: ${r.trips_total}</span>
          <span class="ui-chip">Kein Fang: ${r.no_catch_days}</span>
          <span class="ui-chip">Fänge: ${r.catches_total}</span>
        </div>
        <p class="ui-karte__stand">Letzter Eintrag: ${esc(fmtTs(r.last_entry_at))}</p>
      `;
      root.appendChild(card);
    });
  }

  function findRowByUserId(userId) {
    return state.rows.find((r) => String(r.user_id) === String(userId)) || null;
  }

  function openDetailDialog(userId) {
    const row = findRowByUserId(userId);
    const dlg = document.getElementById("catchCockpitDetailDialog");
    const body = document.getElementById("catchCockpitDetailBody");
    if (!row || !dlg || !body) return;
    body.innerHTML = `
      <div class="grid cols2">
        <p><strong>Mitglied</strong><br>${esc(row.name)}</p>
        <p><strong>E-Mail</strong><br>${esc(row.email || "-")}</p>
        <p><strong>Mitglieds-Nr.</strong><br>${esc(row.member_no || "-")}</p>
        <p><strong>Status</strong><br>${esc(statusText(row))}</p>
        <p><strong>Angeltage</strong><br>${esc(row.trips_total)}</p>
        <p><strong>Kein Fang</strong><br>${esc(row.no_catch_days)}</p>
        <p><strong>Fänge gesamt</strong><br>${esc(row.catches_total)}</p>
        <p><strong>Letzter Eintrag</strong><br>${esc(fmtTs(row.last_entry_at))}</p>
      </div>
    `;
    if (!dlg.open) dlg.showModal();
  }

  function renderColumnsPanel() {
    const visRoot = document.getElementById("catchCockpitColumnVisibility");
    const orderRoot = document.getElementById("catchCockpitColumnOrder");
    const filterRoot = document.getElementById("catchCockpitColumnFilters");
    if (!visRoot || !orderRoot || !filterRoot) return;
    visRoot.innerHTML = "";
    orderRoot.innerHTML = "";
    filterRoot.innerHTML = "";

    state.columns.forEach((col, idx) => {
      const v = document.createElement("label");
      v.className = "ui-column-item";
      v.innerHTML = `<span>${esc(col.label)}</span><input type="checkbox" data-col-visible="${esc(col.key)}" ${col.visible ? "checked" : ""} />`;
      visRoot.appendChild(v);

      const o = document.createElement("div");
      o.className = "ui-column-item";
      o.innerHTML = `
        <span>${esc(col.label)}</span>
        <div class="ui-column-item__actions">
          <button type="button" class="feed-btn feed-btn--ghost" data-col-move="up" data-col-key="${esc(col.key)}" ${idx > 0 ? "" : "disabled"}>Nach oben</button>
          <button type="button" class="feed-btn feed-btn--ghost" data-col-move="down" data-col-key="${esc(col.key)}" ${idx < state.columns.length - 1 ? "" : "disabled"}>Nach unten</button>
        </div>
      `;
      orderRoot.appendChild(o);

      const f = document.createElement("label");
      f.innerHTML = `<span class="small">Filter ${esc(col.label)}</span>`;
      if (col.key === "status") {
        f.insertAdjacentHTML("beforeend", `
          <select data-col-filter="status">
            <option value="">Standard (alle)</option>
            <option value="online" ${state.filters.status.toLowerCase() === "online" ? "selected" : ""}>Online</option>
            <option value="offline" ${state.filters.status.toLowerCase() === "offline" ? "selected" : ""}>Offline</option>
          </select>
        `);
      } else if (col.key === "last_entry_at") {
        f.insertAdjacentHTML("beforeend", `<input type="date" data-col-filter="last_entry_at" value="${esc(state.filters.last_entry_at)}" />`);
      } else {
        f.insertAdjacentHTML("beforeend", `<input type="text" data-col-filter="${esc(col.key)}" value="${esc(state.filters[col.key] || "")}" />`);
      }
      filterRoot.appendChild(f);
    });
  }

  function render() {
    const tableWrap = document.getElementById("catchCockpitTableWrap");
    const cardsWrap = document.getElementById("catchCockpitCards");
    const zeileBtn = document.getElementById("catchCockpitViewZeileBtn");
    const karteBtn = document.getElementById("catchCockpitViewKarteBtn");
    const rows = filteredRows();
    const cardActive = state.ansicht === "karte";

    tableWrap?.classList.toggle("hidden", cardActive);
    tableWrap?.toggleAttribute("hidden", cardActive);
    cardsWrap?.classList.toggle("hidden", !cardActive);
    cardsWrap?.toggleAttribute("hidden", !cardActive);
    zeileBtn?.classList.toggle("feed-btn--ghost", cardActive);
    karteBtn?.classList.toggle("feed-btn--ghost", !cardActive);

    renderHead();
    renderRows(rows);
    renderCards(rows);
    renderColumnsPanel();
  }

  async function init() {
    const { url, key } = cfg();
    state.uid = uid();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    state.ansicht = loadAnsicht();
    loadPrefs();
    const searchEl = document.getElementById("catchCockpitSearch");
    if (searchEl) searchEl.value = state.search;

    const roles = await loadMyRoles().catch(() => []);
    if (!roles.some((r) => ADMIN_ROLES.has(r))) {
      setMsg("Kein Zugriff: nur Admin.");
      render();
      return;
    }

    try {
      setMsg("Lade Gesamtübersicht...");
      const [profiles, stats, onlineRows] = await Promise.all([
        loadProfiles(),
        loadStats(),
        loadOnlineUsage().catch(() => []),
      ]);
      state.rows = mergeRows(profiles, stats, onlineRows);
      render();
      setMsg(`Mitglieder geladen: ${state.rows.length}`);
    } catch (err) {
      setMsg(err?.message || "Laden fehlgeschlagen.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);

  document.addEventListener("input", (e) => {
    if (e.target?.id === "catchCockpitSearch") {
      state.search = String(e.target.value || "");
      savePrefs();
      render();
      return;
    }
    const filterKey = e.target?.getAttribute?.("data-col-filter");
    if (!filterKey) return;
    state.filters[filterKey] = String(e.target.value || "");
    savePrefs();
    render();
  });

  document.addEventListener("click", (e) => {
    const detailClose = e.target.closest("#catchCockpitDetailCloseBtn");
    if (detailClose) {
      document.getElementById("catchCockpitDetailDialog")?.close?.();
      return;
    }

    const zeile = e.target.closest("#catchCockpitViewZeileBtn");
    if (zeile) {
      state.ansicht = "zeile";
      saveAnsicht(state.ansicht);
      render();
      return;
    }

    const karte = e.target.closest("#catchCockpitViewKarteBtn");
    if (karte) {
      state.ansicht = "karte";
      saveAnsicht(state.ansicht);
      render();
      return;
    }

    const columnsToggle = e.target.closest("#catchCockpitColumnsToggleBtn");
    if (columnsToggle) {
      const panel = document.getElementById("catchCockpitColumnsPanel");
      const hidden = panel?.hasAttribute("hidden");
      if (!panel) return;
      panel.classList.toggle("hidden", !hidden);
      panel.toggleAttribute("hidden", !hidden);
      columnsToggle.setAttribute("aria-expanded", hidden ? "true" : "false");
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
      savePrefs();
      render();
      return;
    }

    const vis = e.target.closest("[data-col-visible]");
    if (vis) {
      const key = String(vis.getAttribute("data-col-visible") || "");
      const col = state.columns.find((c) => c.key === key);
      if (!col) return;
      col.visible = Boolean(vis.checked);
      savePrefs();
      render();
      return;
    }

    const move = e.target.closest("[data-col-move][data-col-key]");
    if (move) {
      const dir = String(move.getAttribute("data-col-move") || "");
      const key = String(move.getAttribute("data-col-key") || "");
      const idx = state.columns.findIndex((c) => c.key === key);
      if (idx < 0) return;
      const next = dir === "up" ? idx - 1 : idx + 1;
      if (next < 0 || next >= state.columns.length) return;
      const tmp = state.columns[idx];
      state.columns[idx] = state.columns[next];
      state.columns[next] = tmp;
      savePrefs();
      render();
      return;
    }

    const open = e.target.closest("[data-open-member-id]");
    if (open) {
      const userId = String(open.getAttribute("data-open-member-id") || "");
      if (!userId) return;
      openDetailDialog(userId);
    }
  });
})();
