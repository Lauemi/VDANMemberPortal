;(() => {
  // ── club-roles-admin.js ──────────────────────────────────────────────────
  // Rollen / Rechte UX — ADM Section Handler
  // Hängt sich nach Aktivierung der Section "club_settings_roles" ein.
  // Bietet:
  //   Tab 1: Rechte-Matrix (Modul × Rechte, read-only)
  //   Tab 2: Mitglieder-Zuweisung (Auswahl-Dialog, assign / remove)
  //
  // Abhängigkeiten:
  //   window.__APP_SUPABASE_URL, window.__APP_SUPABASE_KEY
  //   window.VDAN_AUTH.loadSession()
  //   window.AdminPanelMask (Renderer — nur für club_id-Kontext)
  // ─────────────────────────────────────────────────────────────────────────

  const SECTION_ID = "club_settings_roles";

  // ── Supabase-Fetch-Helper ────────────────────────────────────────────────

  function sbUrl() {
    return String(window.__APP_SUPABASE_URL || "").replace(/\/+$/, "");
  }
  function sbKey() {
    return String(window.__APP_SUPABASE_KEY || "");
  }
  function authToken() {
    return window.VDAN_AUTH?.loadSession?.()?.access_token || null;
  }

  async function rpc(fnName, params = {}) {
    const token = authToken();
    const res = await fetch(`${sbUrl()}/rest/v1/rpc/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": sbKey(),
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || `RPC ${fnName} failed (${res.status})`);
    }
    return res.json();
  }

  // ── DOM-Helpers ──────────────────────────────────────────────────────────

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "cls") node.className = v;
      else node.setAttribute(k, v);
    }
    children.forEach(c => c && node.append(c));
    return node;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function msg(container, text, type = "info") {
    container.innerHTML = `<p class="small qfp-status-line is-${type}">${esc(text)}</p>`;
  }

  // ── State ────────────────────────────────────────────────────────────────

  const state = {
    clubId: null,
    roles: [],
    activeRole: null,
    activeTab: 0, // 0 = Rechte, 1 = Mitglieder
    permRows: [],
    memberRows: [],
    assignRows: [],
    loadingPerms: false,
    loadingMembers: false,
    assignFilter: "",
    dialogOpen: false,
  };

  // ── Club-ID aus Mask-Kontext lesen ───────────────────────────────────────

  function resolveClubId() {
    // Versuche club_id aus dem Mask-State zu lesen
    const cfgEl = document.getElementById("clubSettingsAdmConfig");
    if (cfgEl) {
      try {
        const cfg = JSON.parse(cfgEl.textContent || "{}");
        if (cfg.clubId) return cfg.clubId;
        // Fallback: Suche in globalem ADM-State
        if (window.__ADM_CLUB_ID) return window.__ADM_CLUB_ID;
      } catch { /**/ }
    }
    // Fallback: aus dem Domain-Adapter
    const adapter = window.VdanDomainAdapterVereinsverwaltung;
    if (adapter?.getActiveClubId) return adapter.getActiveClubId();
    return null;
  }

  // ── Rollen-Übersicht rendern ─────────────────────────────────────────────

  function renderRolesOverview(root) {
    root.innerHTML = "";

    if (!state.roles.length) {
      root.append(el("p", { cls: "small", text: "Keine Rollen geladen." }));
      return;
    }

    const table = el("table", { cls: "fcp-inline-table roles-overview-table" });
    const head = el("thead");
    head.innerHTML = `<tr>
      <th>Rolle</th><th>Bezeichnung</th><th>Kernrolle</th>
      <th>Aktiv</th><th>Module</th><th>Mitglieder</th>
    </tr>`;
    table.append(head);

    const body = el("tbody");
    state.roles.forEach(row => {
      const tr = el("tr", {
        cls: `roles-overview-row${state.activeRole?.role_key === row.role_key ? " is-selected" : ""}`,
        style: "cursor:pointer",
      });
      tr.dataset.roleKey = row.role_key;
      tr.innerHTML = `
        <td><strong>${esc(row.role_key)}</strong></td>
        <td>${esc(row.role_label)}</td>
        <td>${row.is_core ? "✓" : "—"}</td>
        <td>${row.is_active ? "✓" : "—"}</td>
        <td>${esc(String(row.module_count ?? "—"))}</td>
        <td>${esc(String(row.member_count ?? "—"))}</td>
      `;
      tr.addEventListener("click", () => selectRole(row));
      body.append(tr);
    });
    table.append(body);
    root.append(table);
  }

  // ── Detail-Panel: Tabs ───────────────────────────────────────────────────

  function renderDetailPanel(container) {
    container.innerHTML = "";
    if (!state.activeRole) return;

    const role = state.activeRole;

    // Header
    const header = el("div", { cls: "roles-detail-header" });
    header.innerHTML = `<h3 class="roles-detail-title">
      ${esc(role.role_label || role.role_key)}
      <span class="roles-detail-rolekey">(${esc(role.role_key)})</span>
    </h3>`;
    container.append(header);

    // Tabs
    const tabStrip = el("div", { cls: "adm-section-tabs" });
    const tabLabels = ["Rechte-Matrix", "Mitglieder-Zuweisung"];
    const tabPanels = [
      el("div", { cls: "roles-tab-panel", id: "roles-tab-perms" }),
      el("div", { cls: "roles-tab-panel", id: "roles-tab-members" }),
    ];

    tabLabels.forEach((label, idx) => {
      const btn = el("button", {
        cls: `adm-section-tab${idx === state.activeTab ? " is-active" : ""}`,
        text: label,
        type: "button",
      });
      btn.addEventListener("click", () => {
        state.activeTab = idx;
        tabStrip.querySelectorAll(".adm-section-tab").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        tabPanels.forEach((p, i) => {
          p.hidden = i !== idx;
        });
        if (idx === 0 && !state.permRows.length) loadPermissions(tabPanels[0]);
        if (idx === 1 && !state.memberRows.length) loadMembers(tabPanels[1]);
      });
      tabStrip.append(btn);
    });

    tabPanels.forEach((p, i) => { p.hidden = i !== state.activeTab; });

    container.append(tabStrip);
    tabPanels.forEach(p => container.append(p));

    // Initial load
    if (state.activeTab === 0) loadPermissions(tabPanels[0]);
    else loadMembers(tabPanels[1]);
  }

  // ── Tab 1: Rechte-Matrix ─────────────────────────────────────────────────

  async function loadPermissions(panel) {
    if (state.loadingPerms) return;
    state.loadingPerms = true;
    msg(panel, "Lade Rechte…");
    try {
      const rows = await rpc("admin_club_role_permissions_read", {
        p_club_id: state.clubId,
        p_role_key: state.activeRole.role_key,
      });
      state.permRows = Array.isArray(rows) ? rows : [];
      renderPermissions(panel);
    } catch (e) {
      msg(panel, `Fehler: ${e.message}`, "error");
    } finally {
      state.loadingPerms = false;
    }
  }

  function renderPermissions(panel) {
    panel.innerHTML = "";
    if (!state.permRows.length) {
      panel.append(el("p", { cls: "small", text: "Keine Module gefunden." }));
      return;
    }

    const table = el("table", { cls: "fcp-inline-table roles-perms-table" });
    table.innerHTML = `
      <thead><tr>
        <th>Modul</th>
        <th title="Sichtbar">Sicht</th>
        <th title="Lesen">Lesen</th>
        <th title="Schreiben">Schreib.</th>
        <th title="Ändern">Ändern</th>
        <th title="Löschen">Lösch.</th>
      </tr></thead>
    `;
    const body = el("tbody");
    state.permRows.forEach(row => {
      const flag = v => v ? "✓" : "—";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(row.module_label || row.module_key)}</td>
        <td class="${row.can_view ? "perm-yes" : "perm-no"}">${flag(row.can_view)}</td>
        <td class="${row.can_read ? "perm-yes" : "perm-no"}">${flag(row.can_read)}</td>
        <td class="${row.can_write ? "perm-yes" : "perm-no"}">${flag(row.can_write)}</td>
        <td class="${row.can_update ? "perm-yes" : "perm-no"}">${flag(row.can_update)}</td>
        <td class="${row.can_delete ? "perm-yes" : "perm-no"}">${flag(row.can_delete)}</td>
      `;
      body.append(tr);
    });
    table.append(body);
    panel.append(table);
    panel.append(el("p", { cls: "small roles-readonly-hint", text: "Rechte-Konfiguration: kommt in Phase 2." }));
  }

  // ── Tab 2: Mitglieder-Zuweisung ──────────────────────────────────────────

  async function loadMembers(panel) {
    if (state.loadingMembers) return;
    state.loadingMembers = true;
    msg(panel, "Lade Mitglieder…");
    try {
      const rows = await rpc("admin_club_role_members_read", {
        p_club_id: state.clubId,
        p_role_key: state.activeRole.role_key,
      });
      state.memberRows = Array.isArray(rows) ? rows : [];
      renderMembers(panel);
    } catch (e) {
      msg(panel, `Fehler: ${e.message}`, "error");
    } finally {
      state.loadingMembers = false;
    }
  }

  function renderMembers(panel) {
    panel.innerHTML = "";

    const toolbar = el("div", { cls: "roles-members-toolbar" });
    const assignBtn = el("button", {
      cls: "feed-btn feed-btn--ghost roles-assign-btn",
      type: "button",
      text: "Mitglied zuweisen / entfernen",
    });
    assignBtn.addEventListener("click", () => openAssignDialog(panel));
    toolbar.append(assignBtn);
    panel.append(toolbar);

    if (!state.memberRows.length) {
      panel.append(el("p", { cls: "small", text: "Noch keine Mitglieder mit dieser Rolle." }));
      return;
    }

    const table = el("table", { cls: "fcp-inline-table roles-members-table" });
    table.innerHTML = `
      <thead><tr>
        <th>Name</th><th>Mitglieds-Nr.</th><th>Login</th><th>Aktion</th>
      </tr></thead>
    `;
    const body = el("tbody");
    state.memberRows.forEach(row => {
      const tr = document.createElement("tr");
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
      const removeBtn = el("button", {
        cls: "feed-btn feed-btn--ghost feed-btn--small roles-remove-btn",
        type: "button",
        text: "Entfernen",
      });
      removeBtn.dataset.memberId = row.club_member_id;
      removeBtn.addEventListener("click", async () => {
        removeBtn.disabled = true;
        removeBtn.textContent = "…";
        try {
          await rpc("admin_club_role_member_remove", {
            p_club_id: state.clubId,
            p_club_member_id: row.club_member_id,
            p_role_key: state.activeRole.role_key,
          });
          state.memberRows = state.memberRows.filter(r => r.club_member_id !== row.club_member_id);
          // Roles overview count aktualisieren
          const roleInState = state.roles.find(r => r.role_key === state.activeRole.role_key);
          if (roleInState) roleInState.member_count = Math.max(0, (roleInState.member_count || 1) - 1);
          renderMembers(panel);
        } catch (e) {
          removeBtn.disabled = false;
          removeBtn.textContent = "Entfernen";
          alert(`Fehler: ${e.message}`);
        }
      });
      tr.innerHTML = `
        <td>${esc(fullName)}</td>
        <td>${esc(row.member_no || "—")}</td>
        <td>${row.has_login ? "✓" : "—"}</td>
        <td></td>
      `;
      tr.querySelector("td:last-child").append(removeBtn);
      body.append(tr);
    });
    table.append(body);
    panel.append(table);
  }

  // ── Zuweisungs-Dialog ────────────────────────────────────────────────────

  async function openAssignDialog(memberPanel) {
    if (state.dialogOpen) return;
    state.dialogOpen = true;

    // Alle Mitglieder laden für den Dialog
    let allRows = [];
    try {
      allRows = await rpc("admin_club_members_for_role_assign", {
        p_club_id: state.clubId,
        p_role_key: state.activeRole.role_key,
      });
    } catch (e) {
      state.dialogOpen = false;
      alert(`Fehler beim Laden: ${e.message}`);
      return;
    }
    state.assignRows = Array.isArray(allRows) ? allRows : [];
    state.assignFilter = "";
    renderAssignDialog(memberPanel);
  }

  function renderAssignDialog(memberPanel) {
    // Bestehenden Dialog entfernen
    document.getElementById("rolesAssignDialog")?.remove();

    const overlay = el("div", { cls: "roles-dialog-overlay", id: "rolesAssignDialog" });

    const dialog = el("div", { cls: "roles-dialog" });

    const head = el("div", { cls: "roles-dialog__head" });
    head.innerHTML = `<h3>Mitglieder zuweisen — ${esc(state.activeRole.role_label || state.activeRole.role_key)}</h3>`;
    const closeBtn = el("button", { cls: "roles-dialog__close", type: "button", text: "✕", "aria-label": "Schließen" });
    closeBtn.addEventListener("click", () => { overlay.remove(); state.dialogOpen = false; });
    head.append(closeBtn);

    const search = el("input", {
      cls: "roles-dialog__search",
      type: "search",
      placeholder: "Mitglied suchen…",
    });
    search.addEventListener("input", () => {
      state.assignFilter = search.value.toLowerCase();
      renderAssignList(listEl);
    });

    const listEl = el("div", { cls: "roles-dialog__list" });
    renderAssignList(listEl);

    dialog.append(head, search, listEl);
    overlay.append(dialog);
    document.body.append(overlay);

    // Schließen bei Klick auf Overlay-Hintergrund
    overlay.addEventListener("click", e => {
      if (e.target === overlay) { overlay.remove(); state.dialogOpen = false; }
    });
  }

  function renderAssignList(listEl) {
    listEl.innerHTML = "";
    const filter = state.assignFilter;
    const filtered = filter
      ? state.assignRows.filter(r => {
          const name = `${r.first_name || ""} ${r.last_name || ""} ${r.member_no || ""}`.toLowerCase();
          return name.includes(filter);
        })
      : state.assignRows;

    if (!filtered.length) {
      listEl.append(el("p", { cls: "small", text: "Keine Mitglieder gefunden." }));
      return;
    }

    filtered.forEach(row => {
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
      const item = el("div", { cls: `roles-dialog__item${row.has_role ? " is-assigned" : ""}` });

      const info = el("span", { cls: "roles-dialog__item-info" });
      info.innerHTML = `${esc(fullName)} <span class="small">${esc(row.member_no || "")}</span>`;
      if (!row.has_login) info.append(el("span", { cls: "roles-no-login-hint", text: " (kein Login)" }));

      const toggle = el("button", {
        cls: `feed-btn feed-btn--small ${row.has_role ? "feed-btn--destructive" : ""}`,
        type: "button",
        text: row.has_role ? "Entfernen" : "Zuweisen",
      });
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        toggle.textContent = "…";
        try {
          const fn = row.has_role ? "admin_club_role_member_remove" : "admin_club_role_member_assign";
          await rpc(fn, {
            p_club_id: state.clubId,
            p_club_member_id: row.club_member_id,
            p_role_key: state.activeRole.role_key,
          });
          // State aktualisieren
          row.has_role = !row.has_role;
          item.classList.toggle("is-assigned", row.has_role);
          toggle.textContent = row.has_role ? "Entfernen" : "Zuweisen";
          toggle.className = `feed-btn feed-btn--small ${row.has_role ? "feed-btn--destructive" : ""}`;
          toggle.disabled = false;
          // memberRows im Tab 2 invalidieren → neu laden beim nächsten Öffnen
          state.memberRows = [];
          // Roles overview count aktualisieren
          const roleInState = state.roles.find(r => r.role_key === state.activeRole.role_key);
          if (roleInState) roleInState.member_count = (roleInState.member_count || 0) + (row.has_role ? 1 : -1);
        } catch (e) {
          toggle.disabled = false;
          toggle.textContent = row.has_role ? "Entfernen" : "Zuweisen";
          alert(`Fehler: ${e.message}`);
        }
      });

      item.append(info, toggle);
      listEl.append(item);
    });
  }

  // ── Haupt-Init: Section aufbauen ─────────────────────────────────────────

  async function selectRole(role) {
    state.activeRole = role;
    state.activeTab = 0;
    state.permRows = [];
    state.memberRows = [];

    // Overview: aktive Zeile markieren
    document.querySelectorAll(".roles-overview-row").forEach(tr => {
      tr.classList.toggle("is-selected", tr.dataset.roleKey === role.role_key);
    });

    const detailEl = document.getElementById("roles-detail-panel");
    if (detailEl) renderDetailPanel(detailEl);
  }

  async function initRolesSection(sectionNode) {
    sectionNode.dataset.rolesAdminMounted = "1";

    state.clubId = resolveClubId();

    // Warte kurz bis der Mask-Renderer seinen Inhalt gesetzt hat
    await new Promise(r => setTimeout(r, 80));

    // Baue eigene UI in den section-node
    const wrap = el("div", { cls: "roles-admin-wrap" });

    // Rollen-Übersicht
    const overviewWrap = el("div", { cls: "roles-overview-wrap" });
    const overviewTitle = el("h4", { cls: "roles-overview-title", text: "Rollen im Überblick" });
    const overviewTable = el("div", { id: "roles-overview-table" });
    const overviewStatus = el("div", { cls: "roles-overview-status" });
    overviewWrap.append(overviewTitle, overviewTable, overviewStatus);

    // Detail-Panel
    const detailPanel = el("div", { cls: "roles-detail-panel", id: "roles-detail-panel" });
    detailPanel.append(el("p", { cls: "small roles-select-hint", text: "↑ Rolle auswählen um Details zu sehen." }));

    wrap.append(overviewWrap, detailPanel);

    // Bestehenden Mask-Content erhalten aber ergänzen
    // Wir suchen den content-Bereich in der Section
    const existingContent = sectionNode.querySelector(".admin-section-panels, .admin-section-content");
    if (existingContent) {
      existingContent.append(wrap);
    } else {
      sectionNode.append(wrap);
    }

    // Rollen laden
    if (!state.clubId) {
      msg(overviewStatus, "Club-Kontext nicht verfügbar. Bitte Seite neu laden.", "error");
      return;
    }
    msg(overviewStatus, "Lade Rollen…");
    try {
      const rows = await rpc("admin_club_roles_read", { p_club_id: state.clubId });
      state.roles = Array.isArray(rows) ? rows : [];
      overviewStatus.innerHTML = "";
      renderRolesOverview(overviewTable);
    } catch (e) {
      msg(overviewStatus, `Fehler: ${e.message}`, "error");
    }
  }

  // ── MutationObserver: auf Section-Aktivierung warten ─────────────────────

  function observe() {
    const root = document.getElementById("clubSettingsAdmRoot");
    if (!root) return;

    const tryMount = () => {
      const sectionNode = root.querySelector(`[data-section-id="${SECTION_ID}"]`);
      if (sectionNode && !sectionNode.dataset.rolesAdminMounted) {
        initRolesSection(sectionNode);
      }
    };

    // Sofort prüfen (falls Section schon aktiv)
    tryMount();

    // Beobachten
    const obs = new MutationObserver(tryMount);
    obs.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observe);
  } else {
    observe();
  }

})();
