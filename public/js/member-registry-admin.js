;(() => {
  const STORAGE_COLS = "admin:member_registry:cols:v1";
  const STORAGE_SORT = "admin:member_registry:sort:v1";
  const STORAGE_PAGE = "admin:member_registry:page:v1";
  const COLUMNS = [
    { key: "club_code", label: "Club", default: true, width: 100 },
    { key: "club_id", label: "ClubID", default: false, width: 220 },
    { key: "member_no", label: "Mitgliedsnummer", default: true, width: 150 },
    { key: "last_name", label: "Name", default: true, width: 160 },
    { key: "first_name", label: "Vorname", default: true, width: 150 },
    { key: "status", label: "Status", default: true, width: 120 },
    { key: "fishing_card_type", label: "Angelkarte", default: true, width: 140 },
    { key: "login_dot", label: "Login", default: true, width: 90 },
    { key: "last_sign_in_at", label: "Zuletzt angemeldet", default: false, width: 190 },
    { key: "street", label: "Adresse", default: false, width: 220 },
    { key: "zip", label: "PLZ", default: false, width: 110 },
    { key: "city", label: "Ort", default: false, width: 150 },
    { key: "phone", label: "Tel", default: false, width: 140 },
    { key: "mobile", label: "Mobil", default: false, width: 140 },
    { key: "birthdate", label: "Geburtstag", default: false, width: 140 },
    { key: "guardian_member_no", label: "Bezugsperson", default: false, width: 160 },
    { key: "sepa_approved", label: "SEPA", default: false, width: 110 },
    { key: "iban_last4", label: "IBAN (letzte 4)", default: false, width: 140 },
  ];

  const state = {
    rows: [],
    filtered: [],
    search: "",
    statusFilter: "all",
    clubFilter: "all",
    loginFilter: "all",
    visibleCols: new Set(COLUMNS.filter((c) => c.default).map((c) => c.key)),
    sortKey: "member_no",
    sortDir: "asc",
    page: 1,
    pageSize: 50,
    activeRow: null,
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
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    }[c]));
  }

  function setMsg(text = "", danger = false) {
    const el = document.getElementById("memberRegistryMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function setDialogMsg(text = "", danger = false) {
    const el = document.getElementById("memberRegistryDialogMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function fmtTs(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("de-DE");
  }

  function loadPrefs() {
    try {
      const cols = JSON.parse(localStorage.getItem(STORAGE_COLS) || "[]");
      if (Array.isArray(cols) && cols.length) state.visibleCols = new Set(cols.filter((k) => COLUMNS.some((c) => c.key === k)));
      state.visibleCols.delete("club_id");
      const sort = JSON.parse(localStorage.getItem(STORAGE_SORT) || "{}");
      if (sort?.key) state.sortKey = String(sort.key);
      if (sort?.dir === "desc") state.sortDir = "desc";
      const page = JSON.parse(localStorage.getItem(STORAGE_PAGE) || "{}");
      const size = Number(page?.size || 50);
      if ([25, 50, 100, 250].includes(size)) state.pageSize = size;
    } catch {
      // ignore
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_COLS, JSON.stringify([...state.visibleCols]));
      localStorage.setItem(STORAGE_SORT, JSON.stringify({ key: state.sortKey, dir: state.sortDir }));
      localStorage.setItem(STORAGE_PAGE, JSON.stringify({ size: state.pageSize }));
    } catch {
      // ignore
    }
  }

  async function loadRows() {
    const rows = await sb("/rest/v1/rpc/admin_member_registry", { method: "POST", body: "{}" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function applyFilterSort() {
    const q = state.search.trim().toLowerCase();
    let rows = [...state.rows];
    if (state.statusFilter !== "all") {
      rows = rows.filter((r) => String(r.status || "").toLowerCase() === state.statusFilter);
    }
    if (state.clubFilter !== "all") {
      rows = rows.filter((r) => String(r.club_code || "").toLowerCase() === state.clubFilter);
    }
    if (state.loginFilter === "yes") {
      rows = rows.filter((r) => Boolean(r.has_login));
    } else if (state.loginFilter === "no") {
      rows = rows.filter((r) => !r.has_login);
    }
    if (q) {
      rows = rows.filter((r) => [
        r.club_code, r.member_no, r.first_name, r.last_name, r.status, r.city, r.zip, r.fishing_card_type,
      ].some((v) => String(v || "").toLowerCase().includes(q)));
    }
    const key = state.sortKey;
    const dir = state.sortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const av = String(a?.[key] ?? "");
      const bv = String(b?.[key] ?? "");
      return av.localeCompare(bv, "de") * dir;
    });
    state.filtered = rows;
    const maxPage = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    if (state.page > maxPage) state.page = maxPage;
  }

  function columnLabel(key) {
    const c = COLUMNS.find((x) => x.key === key);
    return c ? c.label : key;
  }

  function loginDotCell(r) {
    const ok = Boolean(r.has_login);
    return `<span title="${ok ? "Login vorhanden" : "Kein Login"}" style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${ok ? "#16a34a" : "#dc2626"};"></span>`;
  }

  function pagedRows() {
    const start = (state.page - 1) * state.pageSize;
    return state.filtered.slice(start, start + state.pageSize);
  }

  function renderHead() {
    const head = document.getElementById("memberRegistryHead");
    const colgroup = document.getElementById("memberRegistryColgroup");
    if (!head) return;
    const visible = COLUMNS.filter((c) => state.visibleCols.has(c.key));
    if (colgroup) {
      colgroup.innerHTML = visible.map((c) => `<col style="width:${Math.max(80, Number(c.width || 120))}px" />`).join("");
    }
    head.innerHTML = visible.map((c) => {
      const arrow = state.sortKey === c.key ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
      return `<th scope="col"><button type="button" class="members-filter-toggle" data-sort="${esc(c.key)}">${esc(c.label)}${arrow}</button></th>`;
    }).join("");
  }

  function cellValue(r, key) {
    if (key === "login_dot") return loginDotCell(r);
    if (key === "last_sign_in_at") return esc(fmtTs(r.last_sign_in_at));
    if (key === "sepa_approved") return r.sepa_approved === null || r.sepa_approved === undefined ? "-" : (r.sepa_approved ? "Ja" : "Nein");
    return esc(r?.[key] ?? "-");
  }

  function renderRows() {
    const root = document.getElementById("memberRegistryRows");
    if (!root) return;
    const visible = COLUMNS.filter((c) => state.visibleCols.has(c.key));
    if (!state.filtered.length) {
      root.innerHTML = `<tr><td colspan="${Math.max(1, visible.length)}" class="small">Keine Mitglieder gefunden.</td></tr>`;
      return;
    }
    root.innerHTML = pagedRows().map((r) => `
      <tr data-open-member="${esc(r.member_no)}" style="cursor:pointer;">
        ${visible.map((c) => `<td>${cellValue(r, c.key)}</td>`).join("")}
      </tr>
    `).join("");
  }

  function renderClubFilter() {
    const el = document.getElementById("memberRegistryClubFilter");
    if (!el) return;
    const clubs = [...new Set(state.rows.map((r) => String(r.club_code || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
    const current = state.clubFilter;
    el.innerHTML = [`<option value="all">Alle</option>`, ...clubs.map((c) => `<option value="${esc(c.toLowerCase())}">${esc(c)}</option>`)].join("");
    el.value = clubs.some((c) => c.toLowerCase() === current) ? current : "all";
    if (el.value !== current) state.clubFilter = el.value;
  }

  function renderStatsAndPager() {
    const stats = document.getElementById("memberRegistryStats");
    const info = document.getElementById("memberRegistryPageInfo");
    const prev = document.getElementById("memberRegistryPrevPage");
    const next = document.getElementById("memberRegistryNextPage");
    const total = state.rows.length;
    const found = state.filtered.length;
    const pages = Math.max(1, Math.ceil(found / state.pageSize));
    if (stats) stats.textContent = `Gefunden: ${found} von ${total}`;
    if (info) info.textContent = `Seite ${state.page} / ${pages}`;
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= pages;
  }

  function renderColumnToggles() {
    const box = document.getElementById("memberRegistryColumnToggles");
    if (!box) return;
    box.innerHTML = COLUMNS.map((c) => `
      <label class="small" style="display:flex;align-items:center;gap:6px;">
        <input type="checkbox" data-col="${esc(c.key)}" ${state.visibleCols.has(c.key) ? "checked" : ""} />
        ${esc(c.label)}
      </label>
    `).join("");
  }

  function openDialog(memberNo) {
    const row = state.rows.find((r) => String(r.member_no) === String(memberNo));
    if (!row) return;
    state.activeRow = row;
    const dlg = document.getElementById("memberRegistryDialog");
    const body = document.getElementById("memberRegistryDialogBody");
    if (!dlg || !body) return;
    body.innerHTML = `
      <div class="grid cols2">
        <label><span>Mitgliedsnummer</span><input value="${esc(row.member_no)}" disabled /></label>
        <label><span>Club-Kürzel</span><input value="${esc(row.club_code || "-")}" disabled /></label>
        <label><span>ClubID</span><input value="${esc(row.club_id || "-")}" disabled /></label>
        <label><span>Vorname</span><input id="mrFirstName" value="${esc(row.first_name || "")}" /></label>
        <label><span>Name</span><input id="mrLastName" value="${esc(row.last_name || "")}" /></label>
        <label><span>Status</span><input id="mrStatus" value="${esc(row.status || "")}" /></label>
        <label><span>Angelkarte</span><input id="mrFishingCard" value="${esc(row.fishing_card_type || "")}" /></label>
        <label><span>Straße</span><input id="mrStreet" value="${esc(row.street || "")}" /></label>
        <label><span>PLZ</span><input id="mrZip" value="${esc(row.zip || "")}" /></label>
        <label><span>Ort</span><input id="mrCity" value="${esc(row.city || "")}" /></label>
        <label><span>Tel</span><input id="mrPhone" value="${esc(row.phone || "")}" /></label>
        <label><span>Mobil</span><input id="mrMobile" value="${esc(row.mobile || "")}" /></label>
        <label><span>Geburtstag</span><input value="${esc(row.birthdate || "-")}" disabled /></label>
        <label><span>Bezugsperson (Mitglieds-Nr.)</span><input id="mrGuardian" value="${esc(row.guardian_member_no || "")}" /></label>
        <label><span>SEPA bestätigt</span>
          <select id="mrSepaApproved">
            <option value="true" ${row.sepa_approved === true ? "selected" : ""}>Ja</option>
            <option value="false" ${row.sepa_approved === false ? "selected" : ""}>Nein</option>
          </select>
        </label>
        <label><span>IBAN (neu setzen)</span><input id="mrIban" placeholder="nur wenn ändern" /></label>
        <label><span>IBAN letzte 4</span><input value="${esc(row.iban_last4 || "-")}" disabled /></label>
        <label><span>Zuletzt angemeldet</span><input value="${esc(fmtTs(row.last_sign_in_at))}" disabled /></label>
      </div>
    `;
    setDialogMsg("");
    if (!dlg.open) dlg.showModal();
  }

  async function saveActive() {
    if (!state.activeRow) return;
    const memberNo = String(state.activeRow.member_no || "");
    const payload = {
      p_member_no: memberNo,
      p_first_name: String(document.getElementById("mrFirstName")?.value || "").trim() || null,
      p_last_name: String(document.getElementById("mrLastName")?.value || "").trim() || null,
      p_status: String(document.getElementById("mrStatus")?.value || "").trim() || null,
      p_fishing_card_type: String(document.getElementById("mrFishingCard")?.value || "").trim() || null,
      p_street: String(document.getElementById("mrStreet")?.value || "").trim() || null,
      p_zip: String(document.getElementById("mrZip")?.value || "").trim() || null,
      p_city: String(document.getElementById("mrCity")?.value || "").trim() || null,
      p_phone: String(document.getElementById("mrPhone")?.value || "").trim(),
      p_mobile: String(document.getElementById("mrMobile")?.value || "").trim(),
      p_guardian_member_no: String(document.getElementById("mrGuardian")?.value || "").trim(),
      p_sepa_approved: String(document.getElementById("mrSepaApproved")?.value || "true") === "true",
      p_iban: String(document.getElementById("mrIban")?.value || "").trim() || null,
    };
    await sb("/rest/v1/rpc/admin_member_registry_update", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  async function refresh() {
    setMsg("Lade Mitglieder...");
    state.rows = await loadRows();
    renderClubFilter();
    applyFilterSort();
    renderHead();
    renderRows();
    renderStatsAndPager();
    setMsg(`Mitglieder geladen: ${state.rows.length}`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadPrefs();
    renderColumnToggles();
    const pageSizeEl = document.getElementById("memberRegistryPageSize");
    if (pageSizeEl) pageSizeEl.value = String(state.pageSize);

    document.getElementById("memberRegistryReload")?.addEventListener("click", () => {
      refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", true));
    });
    document.getElementById("memberRegistrySearch")?.addEventListener("input", (e) => {
      state.search = String(e.target.value || "");
      state.page = 1;
      applyFilterSort();
      renderRows();
      renderStatsAndPager();
    });
    document.getElementById("memberRegistryStatusFilter")?.addEventListener("change", (e) => {
      state.statusFilter = String(e.target.value || "all").toLowerCase();
      state.page = 1;
      applyFilterSort();
      renderRows();
      renderStatsAndPager();
    });
    document.getElementById("memberRegistryClubFilter")?.addEventListener("change", (e) => {
      state.clubFilter = String(e.target.value || "all").toLowerCase();
      state.page = 1;
      applyFilterSort();
      renderRows();
      renderStatsAndPager();
    });
    document.getElementById("memberRegistryLoginFilter")?.addEventListener("change", (e) => {
      state.loginFilter = String(e.target.value || "all").toLowerCase();
      state.page = 1;
      applyFilterSort();
      renderRows();
      renderStatsAndPager();
    });
    document.getElementById("memberRegistryPageSize")?.addEventListener("change", (e) => {
      const size = Number(e.target.value || 50);
      state.pageSize = [25, 50, 100, 250].includes(size) ? size : 50;
      state.page = 1;
      savePrefs();
      applyFilterSort();
      renderRows();
      renderStatsAndPager();
    });
    document.getElementById("memberRegistryColumnToggles")?.addEventListener("change", (e) => {
      const key = e.target?.getAttribute?.("data-col");
      if (!key) return;
      if (e.target.checked) state.visibleCols.add(key);
      else state.visibleCols.delete(key);
      savePrefs();
      renderHead();
      renderRows();
    });
    document.getElementById("memberRegistryHead")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sort]");
      if (!btn) return;
      const key = String(btn.getAttribute("data-sort") || "");
      if (!key) return;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else { state.sortKey = key; state.sortDir = "asc"; }
      savePrefs();
      applyFilterSort();
      renderHead();
      renderRows();
      renderStatsAndPager();
    });
    document.getElementById("memberRegistryRows")?.addEventListener("click", (e) => {
      const row = e.target.closest("[data-open-member]");
      if (!row) return;
      openDialog(row.getAttribute("data-open-member"));
    });
    document.getElementById("memberRegistrySaveBtn")?.addEventListener("click", async () => {
      try {
        setDialogMsg("Speichere...");
        await saveActive();
        setDialogMsg("Gespeichert.");
        await refresh();
      } catch (e) {
        setDialogMsg(e.message || "Speichern fehlgeschlagen", true);
      }
    });
    document.getElementById("memberRegistryPrevPage")?.addEventListener("click", () => {
      if (state.page <= 1) return;
      state.page -= 1;
      renderRows();
      renderStatsAndPager();
    });
    document.getElementById("memberRegistryNextPage")?.addEventListener("click", () => {
      const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
      if (state.page >= pages) return;
      state.page += 1;
      renderRows();
      renderStatsAndPager();
    });

    refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", true));
  });
})();
