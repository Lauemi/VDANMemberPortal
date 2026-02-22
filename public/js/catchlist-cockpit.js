;(() => {
  const ADMIN_ROLES = new Set(["admin"]);
  let allRows = [];
  let search = "";

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

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

  async function loadMyRoles() {
    const userId = uid();
    if (!userId) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }, true);
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
      statsRows
        .map(normalizeStatsRow)
        .filter((r) => r.user_id)
        .map((r) => [r.user_id, r])
    );
    const onlineMap = new Map(
      (onlineRows || [])
        .filter((r) => r?.user_id)
        .map((r) => [String(r.user_id), r])
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

  function filteredRows() {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => {
      return (
        String(r.name || "").toLowerCase().includes(q) ||
        String(r.email || "").toLowerCase().includes(q) ||
        String(r.member_no || "").toLowerCase().includes(q)
      );
    });
  }

  function render() {
    const root = document.getElementById("catchCockpitTable");
    if (!root) return;
    const rows = filteredRows();
    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine Mitglieder gefunden.</p>`;
      return;
    }

    root.innerHTML = `
      <div class="fangliste-admin-wrap">
        <table class="fangliste-admin-table">
          <thead>
            <tr>
              <th>Mitglied</th>
              <th>Angeltage</th>
              <th>Kein Fang</th>
                <th>Fänge gesamt</th>
                <th>Letzter Eintrag</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
            ${rows.map((r) => `
              <tr>
                <td>
                  <strong>${esc(r.name)}</strong>
                  <div class="small">${esc(r.email || "-")}</div>
                  <div class="small">Nr: ${esc(r.member_no || "-")}</div>
                </td>
                <td>${r.trips_total}</td>
                <td>${r.no_catch_days}</td>
                <td>${r.catches_total}</td>
                <td>${esc(fmtTs(r.last_entry_at))}</td>
                <td>${r.is_online ? "Online" : `Offline (${esc(fmtTs(r.last_seen_at))})`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    const roles = await loadMyRoles().catch(() => []);
    const isAdmin = roles.some((r) => ADMIN_ROLES.has(r));
    if (!isAdmin) {
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
      allRows = mergeRows(profiles, stats, onlineRows);
      render();
      setMsg(`Mitglieder geladen: ${allRows.length}`);
    } catch (err) {
      setMsg(err?.message || "Laden fehlgeschlagen.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  document.addEventListener("input", (e) => {
    if (e.target?.id === "catchCockpitSearch") {
      search = String(e.target.value || "");
      render();
    }
  });
})();
