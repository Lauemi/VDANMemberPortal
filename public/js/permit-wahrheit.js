;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function userId() {
    return session()?.user?.id || null;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  function setMsg(text = "") {
    const el = document.getElementById("pwMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function statusBadge(status) {
    const map = {
      ok:              { cls: "pw-badge--ok",           label: "ok" },
      multi_area:      { cls: "pw-badge--multi-area",   label: "multi_area" },
      missing_area:    { cls: "pw-badge--missing-area", label: "missing_area" },
      inactive_water:  { cls: "pw-badge--inactive",     label: "inactive_water" },
      orphaned_link:   { cls: "pw-badge--orphaned",     label: "orphaned_link" },
    };
    const { cls, label } = map[status] || { cls: "", label: escapeHtml(status) };
    return `<span class="pw-badge ${cls}">${escapeHtml(label)}</span>`;
  }

  function activeDot(isActive) {
    const cls = isActive ? "pw-dot--active" : "pw-dot--inactive";
    const title = isActive ? "aktiv" : "inaktiv";
    return `<span class="pw-dot ${cls}" title="${title}"></span>`;
  }

  let allRows = [];

  function buildRow(r) {
    return `
      <tr
        data-card="${escapeHtml(r.card_type_key || "")}"
        data-status="${escapeHtml(r.mapping_status || "")}"
        data-search="${escapeHtml((r.card_title || "") + " " + (r.card_type_key || "") + " " + (r.water_name || "")).toLowerCase()}"
      >
        <td>${escapeHtml(r.card_title || "-")}</td>
        <td><code>${escapeHtml(r.card_type_key || "-")}</code></td>
        <td>${escapeHtml(r.water_name || "-")}</td>
        <td>${escapeHtml(r.water_area_kind || "-")}</td>
        <td>${r.area_count != null ? escapeHtml(String(r.area_count)) : "-"}</td>
        <td>${r.water_is_active != null ? activeDot(r.water_is_active) : "-"}</td>
        <td>${statusBadge(r.mapping_status || "")}</td>
      </tr>
    `;
  }

  function applyFilters() {
    const search = (document.getElementById("pwSearch")?.value || "").toLowerCase().trim();
    const filterCard = document.getElementById("pwFilterCard")?.value || "";
    const filterStatus = document.getElementById("pwFilterStatus")?.value || "";
    const tbody = document.getElementById("pwTableBody");
    if (!tbody) return;

    const rows = tbody.querySelectorAll("tr[data-card]");
    let visible = 0;
    rows.forEach((tr) => {
      const matchSearch = !search || (tr.dataset.search || "").includes(search);
      const matchCard = !filterCard || tr.dataset.card === filterCard;
      const matchStatus = !filterStatus || tr.dataset.status === filterStatus;
      const show = matchSearch && matchCard && matchStatus;
      tr.style.display = show ? "" : "none";
      if (show) visible++;
    });

    const countEl = document.getElementById("pwRowCount");
    if (countEl) countEl.textContent = `${visible} / ${allRows.length} Zeilen`;
  }

  function populateCardFilter(rows) {
    const select = document.getElementById("pwFilterCard");
    if (!select) return;
    const keys = [...new Set(rows.map((r) => r.card_type_key).filter(Boolean))].sort();
    keys.forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key;
      select.appendChild(opt);
    });
  }

  function renderTable(rows) {
    const tbody = document.getElementById("pwTableBody");
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="pw-empty">Keine Daten gefunden.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(buildRow).join("");
    const countEl = document.getElementById("pwRowCount");
    if (countEl) countEl.textContent = `${rows.length} / ${rows.length} Zeilen`;
  }

  async function loadClubId() {
    const uid = userId();
    if (!uid) return null;
    const rows = await sb(
      `/rest/v1/profiles?select=club_id&id=eq.${encodeURIComponent(uid)}&limit=1`,
      { method: "GET" },
      true,
    );
    return Array.isArray(rows) && rows[0]?.club_id ? String(rows[0].club_id) : null;
  }

  async function init() {
    if (!userId()) {
      setMsg("Nicht eingeloggt.");
      return;
    }
    try {
      setMsg("Lade Permit-Wahrheit…");
      const clubId = await loadClubId();
      if (!clubId) {
        setMsg("Kein Club-Profil gefunden.");
        return;
      }

      const rows = await sb(
        "/rest/v1/rpc/admin_permit_water_overview",
        { method: "POST", body: JSON.stringify({ p_club_id: clubId }) },
        true,
      );

      allRows = Array.isArray(rows) ? rows : [];
      setMsg("");
      populateCardFilter(allRows);
      renderTable(allRows);

      document.getElementById("pwSearch")?.addEventListener("input", applyFilters);
      document.getElementById("pwFilterCard")?.addEventListener("change", applyFilters);
      document.getElementById("pwFilterStatus")?.addEventListener("change", applyFilters);
    } catch (err) {
      setMsg(err?.message || "Fehler beim Laden.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
