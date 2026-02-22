;(() => {
  const ADMIN_ROLES = new Set(["admin"]);
  const state = {
    rows: [],
    search: "",
    filters: {
      name: "",
      memberNo: "",
      role: "all",
      card: "all",
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
    const rows = await sb("/rest/v1/profiles?select=id,email,display_name,member_no,member_card_valid,member_card_valid_from,member_card_valid_until,created_at&order=created_at.asc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function listRoles() {
    const rows = await sb("/rest/v1/user_roles?select=user_id,role&order=user_id.asc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function listOnlineUsage() {
    const rows = await sb("/rest/v1/v_admin_online_users?select=user_id,first_login_at,last_seen_at,is_online", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function primaryRole(roles) {
    const list = Array.isArray(roles) ? roles.map((r) => String(r || "").toLowerCase()) : [];
    if (list.includes("admin")) return "admin";
    if (list.includes("vorstand")) return "vorstand";
    return "member";
  }

  async function setSingleRole(userId, role) {
    await sb(`/rest/v1/user_roles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }, true);

    await sb("/rest/v1/user_roles", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ user_id: userId, role }]),
    }, true);
  }

  async function setCardValidity(userId, isValid) {
    const body = isValid
      ? {
          member_card_valid: true,
          member_card_valid_from: new Date().toISOString().slice(0, 10),
          member_card_valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        }
      : {
          member_card_valid: false,
          member_card_valid_from: null,
          member_card_valid_until: null,
        };

    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    }, true);
  }

  function mergeRows(profiles, roles, usageRows = []) {
    const roleMap = new Map();
    roles.forEach((r) => {
      const uid = String(r.user_id || "");
      if (!uid) return;
      const list = roleMap.get(uid) || [];
      list.push(String(r.role || ""));
      roleMap.set(uid, list);
    });

    const usageMap = new Map(
      (usageRows || [])
        .filter((r) => r?.user_id)
        .map((r) => [String(r.user_id), r])
    );

    const ids = new Set([
      ...profiles.map((p) => String(p.id || "")),
      ...roles.map((r) => String(r.user_id || "")),
      ...usageRows.map((r) => String(r.user_id || "")),
    ]);

    const merged = [...ids]
      .filter(Boolean)
      .map((id) => {
        const p = profiles.find((x) => String(x.id) === id) || {};
        const rs = [...new Set((roleMap.get(id) || []).filter(Boolean))];
        const u = usageMap.get(id) || {};
        return {
          id,
          name: String(p.display_name || "").trim(),
          email: String(p.email || "").trim(),
          memberNo: String(p.member_no || "").trim(),
          cardValid: Boolean(p.member_card_valid),
          cardValidUntil: String(p.member_card_valid_until || "").trim(),
          roles: rs,
          firstLoginAt: String(u.first_login_at || "").trim(),
          lastSeenAt: String(u.last_seen_at || "").trim(),
          isOnline: Boolean(u.is_online),
        };
      })
      .sort((a, b) => {
        const ak = (a.name || a.email || a.id).toLowerCase();
        const bk = (b.name || b.email || b.id).toLowerCase();
        return ak.localeCompare(bk, "de");
      });

    return merged;
  }

  function applyFilters(rows) {
    return rows.filter((u) => {
      const search = state.search.toLowerCase();
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const memberNo = (u.memberNo || "").toLowerCase();
      const role = primaryRole(u.roles);
      const card = u.cardValid ? "valid" : "invalid";

      if (search) {
        const hit = name.includes(search) || email.includes(search) || memberNo.includes(search);
        if (!hit) return false;
      }

      if (state.filters.name) {
        const q = state.filters.name.toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }

      if (state.filters.memberNo) {
        const q = state.filters.memberNo.toLowerCase();
        if (!memberNo.includes(q)) return false;
      }

      if (state.filters.role !== "all" && role !== state.filters.role) return false;
      if (state.filters.card !== "all" && card !== state.filters.card) return false;
      return true;
    });
  }

  function formatTs(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-DE");
  }

  function renderRows(rows) {
    const root = document.getElementById("membersAdminRows");
    if (!root) return;
    root.innerHTML = "";

    if (!rows.length) {
      root.innerHTML = `<p class="small">Keine Benutzer gefunden.</p>`;
      return;
    }

    rows.forEach((u) => {
      const row = document.createElement("div");
      row.className = "catch-row";
      row.style.gridTemplateColumns = "2fr 1fr 1.2fr 1.6fr";
      const selectedRole = primaryRole(u.roles);
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(u.name || u.email || u.id)}</strong>
          <div class="small">${escapeHtml(u.email || "-")}</div>
          <div class="small">${u.isOnline ? "Online" : "Offline"} • Letzte Aktivität: ${escapeHtml(formatTs(u.lastSeenAt))}</div>
          <div class="small">Erstlogin: ${escapeHtml(formatTs(u.firstLoginAt))}</div>
        </div>
        <div>${escapeHtml(u.memberNo || "-")}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select data-card-select="${escapeHtml(u.id)}">
            <option value="valid" ${u.cardValid ? "selected" : ""}>Gültig</option>
            <option value="invalid" ${u.cardValid ? "" : "selected"}>Ungültig</option>
          </select>
          <button type="button" class="feed-btn js-save-card" data-user-id="${escapeHtml(u.id)}">Speichern</button>
          <span class="small" data-card-msg="${escapeHtml(u.id)}">${u.cardValid && u.cardValidUntil ? `bis ${escapeHtml(u.cardValidUntil)}` : ""}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select data-role-select="${escapeHtml(u.id)}">
            <option value="member" ${selectedRole === "member" ? "selected" : ""}>Mitglied</option>
            <option value="vorstand" ${selectedRole === "vorstand" ? "selected" : ""}>Vorstand</option>
            <option value="admin" ${selectedRole === "admin" ? "selected" : ""}>Admin</option>
          </select>
          <button type="button" class="feed-btn js-save-role" data-user-id="${escapeHtml(u.id)}">Speichern</button>
          <span class="small" data-role-msg="${escapeHtml(u.id)}"></span>
        </div>
      `;
      root.appendChild(row);
    });
  }

  function renderFilteredRows() {
    renderRows(applyFilters(state.rows));
  }

  function openFilterPanel(name) {
    document.querySelectorAll("[data-filter-panel]").forEach((p) => {
      const show = p.getAttribute("data-filter-panel") === name;
      p.classList.toggle("hidden", !show);
      p.toggleAttribute("hidden", !show);
    });
  }

  function closeFilterPanels() {
    document.querySelectorAll("[data-filter-panel]").forEach((p) => {
      p.classList.add("hidden");
      p.setAttribute("hidden", "");
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
      const [profiles, userRoles, usageRows] = await Promise.all([listProfiles(), listRoles(), listOnlineUsage().catch(() => [])]);
      state.rows = mergeRows(profiles, userRoles, usageRows);
      renderFilteredRows();
      setMsg(`Benutzer geladen: ${profiles.length}`);
    } catch (err) {
      setMsg(err?.message || "Laden fehlgeschlagen");
    }
  }

  async function onRoleSaveClick(e) {
    const btn = e.target.closest(".js-save-role");
    if (!btn) return;
    const userId = String(btn.getAttribute("data-user-id") || "");
    if (!userId) return;
    const select = document.querySelector(`select[data-role-select="${CSS.escape(userId)}"]`);
    const msgEl = document.querySelector(`[data-role-msg="${CSS.escape(userId)}"]`);
    const role = String(select?.value || "member");
    if (!["member", "vorstand", "admin"].includes(role)) return;

    btn.disabled = true;
    if (msgEl) msgEl.textContent = "Speichere…";
    try {
      await setSingleRole(userId, role);
      if (msgEl) msgEl.textContent = "Gespeichert";
      setMsg(`Rolle aktualisiert: ${userId} -> ${role}`);
      await init();
    } catch (err) {
      if (msgEl) msgEl.textContent = "Fehler";
      setMsg(err?.message || "Rolle konnte nicht gespeichert werden.");
    } finally {
      btn.disabled = false;
    }
  }

  async function onCardSaveClick(e) {
    const btn = e.target.closest(".js-save-card");
    if (!btn) return;
    const userId = String(btn.getAttribute("data-user-id") || "");
    if (!userId) return;
    const select = document.querySelector(`select[data-card-select="${CSS.escape(userId)}"]`);
    const msgEl = document.querySelector(`[data-card-msg="${CSS.escape(userId)}"]`);
    const value = String(select?.value || "valid");
    const isValid = value === "valid";

    btn.disabled = true;
    if (msgEl) msgEl.textContent = "Speichere…";
    try {
      await setCardValidity(userId, isValid);
      if (msgEl) msgEl.textContent = isValid ? "Gespeichert (1 Jahr)" : "Gespeichert";
      setMsg(`Ausweisstatus aktualisiert: ${userId} -> ${isValid ? "gültig" : "ungültig"}`);
      await init();
    } catch (err) {
      if (msgEl) msgEl.textContent = "Fehler";
      setMsg(err?.message || "Ausweisstatus konnte nicht gespeichert werden.");
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  document.addEventListener("click", onRoleSaveClick);
  document.addEventListener("click", onCardSaveClick);

  document.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-filter-toggle]");
    if (toggle) {
      const key = String(toggle.getAttribute("data-filter-toggle") || "");
      const panel = document.querySelector(`[data-filter-panel="${CSS.escape(key)}"]`);
      const isOpen = panel && !panel.hasAttribute("hidden");
      if (isOpen) closeFilterPanels();
      else openFilterPanel(key);
      return;
    }
    if (!e.target.closest(".members-filter-cell")) closeFilterPanels();
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "membersAdminSearch") {
      state.search = String(e.target.value || "").trim();
      renderFilteredRows();
      return;
    }
    if (e.target.id === "membersFilterName") {
      state.filters.name = String(e.target.value || "").trim();
      renderFilteredRows();
      return;
    }
    if (e.target.id === "membersFilterNo") {
      state.filters.memberNo = String(e.target.value || "").trim();
      renderFilteredRows();
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "membersFilterRole") {
      state.filters.role = String(e.target.value || "all");
      renderFilteredRows();
      return;
    }
    if (e.target.id === "membersFilterCard") {
      state.filters.card = String(e.target.value || "all");
      renderFilteredRows();
    }
  });
})();
