;(() => {
  const STORAGE_COLS = "admin:member_registry:cols:v1";
  const STORAGE_SORT = "admin:member_registry:sort:v1";
  const COLUMNS = [
    { key: "club_code", label: "Club", default: true },
    { key: "club_id", label: "ClubID", default: true },
    { key: "member_no", label: "Mitgliedsnummer", default: true },
    { key: "last_name", label: "Name", default: true },
    { key: "first_name", label: "Vorname", default: true },
    { key: "status", label: "Status", default: true },
    { key: "fishing_card_type", label: "Angelkarte", default: true },
    { key: "login_dot", label: "Login", default: true },
    { key: "last_sign_in_at", label: "Zuletzt angemeldet", default: false },
    { key: "street", label: "Adresse", default: false },
    { key: "zip", label: "PLZ", default: false },
    { key: "city", label: "Ort", default: false },
    { key: "phone", label: "Tel", default: false },
    { key: "mobile", label: "Mobil", default: false },
    { key: "birthdate", label: "Geburtstag", default: false },
    { key: "guardian_member_no", label: "Bezugsperson", default: false },
    { key: "sepa_approved", label: "SEPA", default: false },
    { key: "iban_last4", label: "IBAN (letzte 4)", default: false },
  ];

  const state = {
    rows: [],
    filtered: [],
    search: "",
    statusFilter: "all",
    visibleCols: new Set(COLUMNS.filter((c) => c.default).map((c) => c.key)),
    sortKey: "member_no",
    sortDir: "asc",
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
      const sort = JSON.parse(localStorage.getItem(STORAGE_SORT) || "{}");
      if (sort?.key) state.sortKey = String(sort.key);
      if (sort?.dir === "desc") state.sortDir = "desc";
    } catch {
      // ignore
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_COLS, JSON.stringify([...state.visibleCols]));
      localStorage.setItem(STORAGE_SORT, JSON.stringify({ key: state.sortKey, dir: state.sortDir }));
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
  }

  function columnLabel(key) {
    const c = COLUMNS.find((x) => x.key === key);
    return c ? c.label : key;
  }

  function loginDotCell(r) {
    const ok = Boolean(r.has_login);
    return `<span title="${ok ? "Login vorhanden" : "Kein Login"}" style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${ok ? "#16a34a" : "#dc2626"};"></span>`;
  }

  function renderHead() {
    const head = document.getElementById("memberRegistryHead");
    if (!head) return;
    const visible = COLUMNS.filter((c) => state.visibleCols.has(c.key));
    head.style.gridTemplateColumns = `repeat(${Math.max(visible.length, 1)}, minmax(120px, 1fr))`;
    head.innerHTML = visible.map((c) => {
      const arrow = state.sortKey === c.key ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
      return `<button type="button" class="members-filter-toggle" data-sort="${esc(c.key)}">${esc(c.label)}${arrow}</button>`;
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
    if (!state.filtered.length) {
      root.innerHTML = `<p class="small">Keine Mitglieder gefunden.</p>`;
      return;
    }
    const visible = COLUMNS.filter((c) => state.visibleCols.has(c.key));
    const template = `repeat(${Math.max(visible.length, 1)}, minmax(120px, 1fr))`;
    root.innerHTML = state.filtered.map((r) => `
      <button type="button" class="catch-row" data-open-member="${esc(r.member_no)}" style="grid-template-columns:${template};text-align:left;">
        ${visible.map((c) => `<span>${cellValue(r, c.key)}</span>`).join("")}
      </button>
    `).join("");
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
    applyFilterSort();
    renderHead();
    renderRows();
    setMsg(`Mitglieder geladen: ${state.rows.length}`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadPrefs();
    renderColumnToggles();

    document.getElementById("memberRegistryReload")?.addEventListener("click", () => {
      refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", true));
    });
    document.getElementById("memberRegistrySearch")?.addEventListener("input", (e) => {
      state.search = String(e.target.value || "");
      applyFilterSort();
      renderRows();
    });
    document.getElementById("memberRegistryStatusFilter")?.addEventListener("change", (e) => {
      state.statusFilter = String(e.target.value || "all").toLowerCase();
      applyFilterSort();
      renderRows();
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

    refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", true));
  });
})();
