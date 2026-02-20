;(() => {
  const ADMIN_ROLES = new Set(["admin"]);

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function currentUserId() {
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
    const el = document.getElementById("membersAdminMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function loadMyRoles() {
    const uid = currentUserId();
    if (!uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listProfiles() {
    const rows = await sb("/rest/v1/profiles?select=id,email,display_name,member_no,created_at&order=created_at.asc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function listRoles() {
    const rows = await sb("/rest/v1/user_roles?select=user_id,role&order=user_id.asc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function renderRows(profiles, roles) {
    const root = document.getElementById("membersAdminRows");
    if (!root) return;
    root.innerHTML = "";

    const roleMap = new Map();
    roles.forEach((r) => {
      const uid = String(r.user_id || "");
      if (!uid) return;
      const list = roleMap.get(uid) || [];
      list.push(String(r.role || ""));
      roleMap.set(uid, list);
    });

    const ids = new Set([
      ...profiles.map((p) => String(p.id || "")),
      ...roles.map((r) => String(r.user_id || "")),
    ]);

    const merged = [...ids]
      .filter(Boolean)
      .map((id) => {
        const p = profiles.find((x) => String(x.id) === id) || {};
        const rs = [...new Set((roleMap.get(id) || []).filter(Boolean))];
        return {
          id,
          name: String(p.display_name || "").trim(),
          email: String(p.email || "").trim(),
          memberNo: String(p.member_no || "").trim(),
          roles: rs,
        };
      })
      .sort((a, b) => {
        const ak = (a.name || a.email || a.id).toLowerCase();
        const bk = (b.name || b.email || b.id).toLowerCase();
        return ak.localeCompare(bk, "de");
      });

    if (!merged.length) {
      root.innerHTML = `<p class="small">Keine Benutzer gefunden.</p>`;
      return;
    }

    merged.forEach((u) => {
      const row = document.createElement("div");
      row.className = "catch-row";
      row.style.gridTemplateColumns = "2fr 2fr 1fr 1.3fr";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(u.name || u.email || u.id)}</strong>
          <div class="small">${escapeHtml(u.email || "-")}</div>
        </div>
        <div><code>${escapeHtml(u.id)}</code></div>
        <div>${escapeHtml(u.memberNo || "-")}</div>
        <div>${escapeHtml(u.roles.join(", ") || "-")}</div>
      `;
      root.appendChild(row);
    });
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
      const root = document.getElementById("membersAdminRows");
      if (root) root.innerHTML = "";
      return;
    }

    try {
      setMsg("Lade Benutzer...");
      const [profiles, userRoles] = await Promise.all([listProfiles(), listRoles()]);
      renderRows(profiles, userRoles);
      setMsg(`Benutzer geladen: ${profiles.length}`);
    } catch (err) {
      setMsg(err?.message || "Laden fehlgeschlagen");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
