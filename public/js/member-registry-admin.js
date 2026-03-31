;(() => {
  const STORAGE_COLS = "admin:member_registry:cols:v1";
  const STORAGE_SORT = "admin:member_registry:sort:v1";
  const STORAGE_PAGE = "admin:member_registry:page:v1";
  const STORAGE_ACL = "club:registry:acl_stub:v1";
  const STORAGE_CLUB_DATA_DRAFT_PREFIX = "club:registry:club_data_draft:v1:";
  const ACL_EDITABLE_KEYS = ["write", "update", "delete"];
  const ACL_PERMISSION_KEYS = ["read", "write", "update", "delete"];
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const ROLE_PRIORITY = ["admin", "vorstand", "member"];
  const ACL_MODULES = [
    { id: "club_data", label: "Vereinsdaten", hint: "Stammdaten und Kerninfos des Vereins" },
    { id: "members", label: "Mitglieder", hint: "Mitgliederstammdaten und Pflege" },
    { id: "roles_acl", label: "Rollen / Rechte", hint: "Rollenverwaltung und ACL-Matrix" },
    { id: "waters", label: "Gewässer", hint: "Gewässerdaten und Zustände" },
    { id: "rules", label: "Regelwerke", hint: "Vereinsregeln und Freigabe" },
    { id: "cards", label: "Ausweise", hint: "Mitgliedsausweise und Gültigkeiten" },
    { id: "work_events", label: "Arbeitseinsätze", hint: "Planung und Verwaltung von Arbeitseinsätzen" },
    { id: "catch_approvals", label: "Fangfreigaben", hint: "Prüfung und Freigabe von Fangmeldungen" },
    { id: "settings", label: "Einstellungen", hint: "Vereinsbezogene Konfiguration" },
  ];
  const CORE_ROLE_IDS = new Set(["member", "vorstand", "admin"]);
  const COLUMNS = [
    { key: "club_code", label: "Club", default: true, width: 100 },
    { key: "club_member_no", label: "Vereins-Nr.", default: true, width: 150 },
    { key: "member_no", label: "FCP-ID", default: false, width: 170 },
    { key: "last_name", label: "Name", default: true, width: 160 },
    { key: "first_name", label: "Vorname", default: true, width: 150 },
    { key: "role", label: "Rolle", default: true, width: 150 },
    { key: "status", label: "Status", default: true, width: 120 },
    { key: "fishing_card_type", label: "Angelkarte", default: true, width: 140 },
    { key: "login_dot", label: "Login", default: true, width: 90 },
    { key: "last_sign_in_at", label: "Zuletzt angemeldet", default: false, width: 190 },
    { key: "street", label: "Adresse", default: false, width: 220 },
    { key: "email", label: "E-Mail", default: true, width: 220 },
    { key: "zip", label: "PLZ", default: false, width: 110 },
    { key: "city", label: "Ort", default: false, width: 150 },
    { key: "phone", label: "Tel", default: false, width: 140 },
    { key: "mobile", label: "Mobil", default: false, width: 140 },
    { key: "birthdate", label: "Geburtstag", default: false, width: 140 },
    { key: "guardian_member_no", label: "Bezugsperson", default: false, width: 160 },
    { key: "sepa_approved", label: "SEPA", default: false, width: 110 },
    { key: "iban_last4", label: "IBAN (letzte 4)", default: false, width: 140 },
    { key: "club_id", label: "ClubID", default: false, width: 220 },
  ];

  const state = {
    rows: [],
    filtered: [],
    search: "",
    statusFilter: "all",
    clubFilter: "all",
    loginFilter: "all",
    visibleCols: new Set(COLUMNS.filter((c) => c.default).map((c) => c.key)),
    sortKey: "club_member_no",
    sortDir: "asc",
    page: 1,
    pageSize: 50,
    activeRow: null,
    section: "club",
    clubIdFilter: "",
    acl: { roles: [], matrix: {} },
    aclRole: "admin",
    clubContext: { club_id: "", club_code: "" },
    clubOptions: [],
    selectedInviteClubId: "",
    clubIdentityById: new Map(),
    clubAclCountsById: new Map(),
    clubWorkspaceById: new Map(),
    dialogMode: "edit",
  };
  let watersTable = null;
  let membersTable = null;

  function rowKey(r) {
    const memberNo = String(r?.member_no || "").trim();
    if (memberNo) return `member:${memberNo}`;
    const clubId = String(r?.club_id || "").trim();
    const userId = String(r?.profile_user_id || "").trim();
    return `role:${clubId}:${userId}`;
  }

  function toRoleOnlyStatusText() {
    return "ohne_mitgliedsnummer";
  }

  function switchSection(section) {
    const availableSections = Array.from(document.querySelectorAll("[data-registry-section]"))
      .map((btn) => String(btn.getAttribute("data-registry-section") || "").trim())
      .filter(Boolean);
    const fallback = availableSections[0] || "club";
    const next = availableSections.includes(section) ? section : fallback;
    state.section = next;
    document.querySelectorAll("[data-registry-section]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-registry-section") === next);
    });
    document.querySelectorAll("[data-registry-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.getAttribute("data-registry-panel") === next);
    });
    if (window.location.hash !== `#${next}`) {
      history.replaceState(null, "", `#${next}`);
    }
    if (next === "roles") refreshAclUi();
  }

  function cfg() {
    const body = document.body;
    const bodyUrl = String(body?.getAttribute("data-supabase-url") || "").trim();
    const bodyKey = String(body?.getAttribute("data-supabase-key") || "").trim();
    return {
      url: String(window.__APP_SUPABASE_URL || bodyUrl).trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || bodyKey).trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function ensureAccessToken({ forceRefresh = false } = {}) {
    const auth = window.VDAN_AUTH || {};
    if (forceRefresh && auth?.refreshSession) {
      const refreshed = await auth.refreshSession().catch(() => null);
      const refreshToken = String(refreshed?.access_token || "").trim();
      if (refreshToken) return refreshToken;
    }
    const currentToken = String(session()?.access_token || "").trim();
    if (currentToken) return currentToken;
    if (auth?.refreshSession) {
      const refreshed = await auth.refreshSession().catch(() => null);
      return String(refreshed?.access_token || session()?.access_token || "").trim();
    }
    return "";
  }

  function isLocalDev() {
    const host = String(window.location.hostname || "").trim().toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  }

  async function waitForAuthReady(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.VDAN_AUTH?.loadSession) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return Boolean(window.VDAN_AUTH?.loadSession);
  }

  async function sb(path, init = {}, withAuth = false) {
    await waitForAuthReady();
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    let token = session()?.access_token;
    if (withAuth && !token && navigator.onLine && window.VDAN_AUTH?.refreshSession) {
      const refreshed = await window.VDAN_AUTH.refreshSession().catch(() => null);
      token = refreshed?.access_token || session()?.access_token || "";
    }
    if (withAuth && !token) throw new Error("login_required");
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  async function callFn(functionName, payload) {
    const { url, key } = cfg();
    await waitForAuthReady();
    if (!url || !key) throw new Error("supabase_config_missing");
    const attempts = [];
    const runRequest = async ({ forceRefresh = false, useCustomTokenHeader = false } = {}) => {
      const accessToken = await ensureAccessToken({ forceRefresh });
      if (!accessToken) throw new Error("login_required");
      const authMode = useCustomTokenHeader ? "anon-plus-x-vdan-access-token" : "bearer-access-token";
      const res = await fetch(`${url}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: useCustomTokenHeader ? `Bearer ${key}` : `Bearer ${accessToken}`,
          ...(useCustomTokenHeader ? { "x-vdan-access-token": accessToken } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(() => ({}));
      attempts.push({
        status: res.status,
        authMode,
        response: data,
      });
      return { res, data, accessToken, authMode };
    };

    let { res, data, accessToken, authMode } = await runRequest({
      forceRefresh: false,
      useCustomTokenHeader: false,
    });
    if (res.status === 401) {
      ({ res, data, accessToken, authMode } = await runRequest({
        forceRefresh: true,
        useCustomTokenHeader: false,
      }));
    }

    if (!res.ok || data?.ok === false) {
      console.error(`[member-registry:${functionName}] request failed`, {
        status: res.status,
        url: `${url}/functions/v1/${functionName}`,
        authMode,
        tokenPresent: Boolean(accessToken),
        tokenPreview: accessToken ? `${String(accessToken).slice(0, 16)}...` : "",
        attempts,
        payload,
        response: data,
      });
      if (res.status === 401) throw new Error("unauthorized");
      if (res.status === 403) throw new Error("forbidden");
      throw new Error(String(data?.error || `${functionName}_failed_${res.status}`));
    }
    return data;
  }

  async function callWorkspace(action, clubId, payload = {}) {
    const cid = String(clubId || "").trim();
    if (!cid) throw new Error("club_id_required");
    return await callFn("club-onboarding-workspace", {
      action,
      club_id: cid,
      ...payload,
    });
  }

  function esc(v) {
    return String(v || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    }[c]));
  }

  function clubOptionLabelById(clubId) {
    const entry = state.clubOptions.find((c) => c.club_id === clubId) || {};
    const meta = state.clubIdentityById.get(clubId) || {};
    const code = String(entry.club_code || meta.code || "Club").trim();
    const name = String(meta.name || "").trim();
    return name ? `${code} • ${name}` : code;
  }

  function dialogUiForMode(mode) {
    const title = document.getElementById("memberRegistryDialogTitle");
    const deleteBtn = document.getElementById("memberRegistryDeleteBtn");
    const isCreate = mode === "create";
    if (title) title.textContent = isCreate ? "Mitglied anlegen" : "Mitglied verwalten";
    if (deleteBtn) deleteBtn.hidden = isCreate;
  }

  function setMsg(text = "", danger = false) {
    const el = document.getElementById("memberRegistryMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function setInviteMsg(text = "", danger = false) {
    const el = document.getElementById("clubInviteMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function setClubDataMsg(text = "", danger = false) {
    const el = document.getElementById("clubDataFormMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function setWatersMsg(text = "", danger = false) {
    const el = document.getElementById("memberRegistryWatersMsg");
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

  function setAclMsg(text = "", danger = false) {
    const el = document.getElementById("roleAclMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  async function copyText(value) {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fallback below
    }
    window.prompt("Bitte kopieren:", text);
  }

  function setInviteResult(data) {
    const panel = document.getElementById("clubInvitePanel");
    const qr = document.getElementById("clubInviteQr");
    const tokenInput = document.getElementById("clubInviteToken");
    const urlInput = document.getElementById("clubInviteUrl");
    const expiresEl = document.getElementById("clubInviteExpires");
    const openLink = document.getElementById("clubInviteOpenUrl");
    const copyTokenBtn = document.getElementById("clubInviteCopyToken");
    const copyUrlBtn = document.getElementById("clubInviteCopyUrl");

    if (!panel || !qr || !tokenInput || !urlInput || !expiresEl || !openLink || !copyTokenBtn || !copyUrlBtn) return;

    const inviteToken = String(data?.invite_token || "").trim();
    const inviteUrl = String(data?.invite_register_url || "").trim();
    const inviteQr = String(data?.invite_qr_url || "").trim();
    const expiresRaw = String(data?.invite_expires_at || "").trim();
    const expires = expiresRaw ? new Date(expiresRaw).toLocaleString("de-DE") : "-";

    panel.classList.remove("hidden");
    panel.removeAttribute("hidden");
    if (inviteQr) qr.setAttribute("src", inviteQr);
    tokenInput.value = inviteToken;
    urlInput.value = inviteUrl;
    expiresEl.textContent = `Gültig bis: ${expires}`;
    openLink.setAttribute("href", inviteUrl || "#");

    copyTokenBtn.onclick = async () => copyText(inviteToken);
    copyUrlBtn.onclick = async () => copyText(inviteUrl);
  }

  function updateInviteClubCodeField() {
    const input = document.getElementById("clubInviteCreateCode");
    if (!input) return;
    const club = state.clubOptions.find((c) => c.club_id === state.selectedInviteClubId);
    input.value = String(club?.club_code || "");
  }

  function renderInviteClubSelect() {
    const select = document.getElementById("clubInviteClubSelect");
    if (!select) return;
    const options = state.clubOptions;
    const hasCurrent = options.some((o) => o.club_id === state.selectedInviteClubId);
    if (!hasCurrent) {
      state.selectedInviteClubId = options.length === 1 ? options[0].club_id : "";
    }
    select.innerHTML = [
      `<option value="">Bitte Verein wählen</option>`,
      ...options.map((o) => {
        const meta = state.clubIdentityById.get(o.club_id) || {};
        const code = String(o.club_code || meta.code || "Club").trim();
        const name = String(meta.name || "").trim();
        const label = name ? `${code} • ${name}` : code;
        return `<option value="${esc(o.club_id)}">${esc(label)}</option>`;
      }),
    ].join("");
    select.value = state.selectedInviteClubId || "";
    updateInviteClubCodeField();
  }

  function normalizeRoleId(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    const ascii = raw
      .replaceAll("ä", "ae")
      .replaceAll("ö", "oe")
      .replaceAll("ü", "ue")
      .replaceAll("ß", "ss");
    return ascii
      .replace(/[^a-z0-9 _-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function defaultAclState() {
    const roles = ["member", "vorstand", "admin", "gewaesserwart", "rechner", "beisitzer"];
    const matrix = {};
    roles.forEach((roleId) => {
      matrix[roleId] = {};
      ACL_MODULES.forEach((m) => {
        let perms = { view: false, read: false, write: false, update: false, delete: false };
        if (roleId === "admin") {
          perms = { view: true, read: true, write: true, update: true, delete: true };
        } else if (roleId === "vorstand") {
          perms = { view: true, read: true, write: true, update: true, delete: false };
          if (m.id === "roles_acl") perms = { view: true, read: true, write: false, update: false, delete: false };
        } else if (roleId === "member") {
          perms = m.id === "members"
            ? { view: true, read: true, write: false, update: false, delete: false }
            : { view: false, read: false, write: false, update: false, delete: false };
        } else if (["gewaesserwart", "rechner", "beisitzer"].includes(roleId)) {
          perms = { view: true, read: true, write: false, update: false, delete: false };
        }
        matrix[roleId][m.id] = perms;
      });
    });
    return { roles, matrix };
  }

  function aclPermsFromLegacyLevel(levelRaw) {
    const level = String(levelRaw || "").toLowerCase().trim();
    if (level === "manage") return { view: true, read: true, write: true, update: true, delete: true };
    if (level === "approve") return { view: true, read: true, write: true, update: true, delete: false };
    if (level === "write") return { view: true, read: true, write: true, update: false, delete: false };
    if (level === "read") return { view: true, read: true, write: false, update: false, delete: false };
    return { view: false, read: false, write: false, update: false, delete: false };
  }

  function aclSanitizePerms(input) {
    const raw = input && typeof input === "object" ? input : {};
    const view = Boolean(raw.view);
    const normalized = {
      view,
      read: view,
      write: view ? Boolean(raw.write) : false,
      update: view ? Boolean(raw.update) : false,
      delete: view ? Boolean(raw.delete) : false,
    };
    return normalized;
  }

  function aclNormalizePermObject(value, fallback) {
    const base = (fallback && typeof fallback === "object")
      ? fallback
      : { view: false, read: false, write: false, update: false, delete: false };
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const merged = {
        view: Boolean(value.view ?? value.read ?? base.view ?? base.read),
        read: Boolean(value.read ?? base.read),
        write: Boolean(value.write ?? base.write),
        update: Boolean(value.update ?? base.update),
        delete: Boolean(value.delete ?? base.delete),
      };
      return aclSanitizePerms(merged);
    }
    if (typeof value === "string") return aclPermsFromLegacyLevel(value);
    return aclSanitizePerms(base);
  }

  function ensureAclShape(input) {
    const base = defaultAclState();
    const raw = (input && typeof input === "object") ? input : {};
    const list = Array.isArray(raw.roles) ? raw.roles : base.roles;
    const unique = [];
    list.forEach((idRaw) => {
      const id = normalizeRoleId(idRaw);
      if (!id || unique.includes(id)) return;
      unique.push(id);
    });
    if (!unique.length) unique.push(...base.roles);

    const matrix = {};
    unique.forEach((roleId) => {
      matrix[roleId] = {};
      ACL_MODULES.forEach((m) => {
        const v = raw?.matrix?.[roleId]?.[m.id];
        matrix[roleId][m.id] = aclNormalizePermObject(v, base?.matrix?.[roleId]?.[m.id]);
      });
    });
    return { roles: unique, matrix };
  }

  function loadAcl() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_ACL) || "{}");
      state.acl = ensureAclShape(raw);
    } catch {
      state.acl = ensureAclShape(null);
    }
    if (!state.acl.roles.includes(state.aclRole)) {
      state.aclRole = state.acl.roles.includes("admin") ? "admin" : state.acl.roles[0];
    }
  }

  function saveAcl() {
    localStorage.setItem(STORAGE_ACL, JSON.stringify(state.acl));
  }

  function isCoreRole(roleId) {
    return CORE_ROLE_IDS.has(String(roleId || "").toLowerCase());
  }

  function renderAclRoleSelect() {
    const select = document.getElementById("roleAclRoleSelect");
    if (!select) return;
    select.innerHTML = state.acl.roles
      .map((roleId) => `<option value="${esc(roleId)}">${esc(roleId)}</option>`)
      .join("");
    if (!state.acl.roles.includes(state.aclRole)) {
      state.aclRole = state.acl.roles[0] || "admin";
    }
    select.value = state.aclRole;
    const deleteBtn = document.getElementById("roleAclDeleteRoleBtn");
    if (deleteBtn) deleteBtn.disabled = isCoreRole(state.aclRole);
  }

  function renderAclMatrix() {
    const root = document.getElementById("roleAclMatrixRows");
    if (!root) return;
    const roleId = state.aclRole;
    if (!roleId) {
      root.innerHTML = `<tr><td colspan="7" class="small">Keine Rolle ausgewählt.</td></tr>`;
      return;
    }
    root.innerHTML = ACL_MODULES.map((m) => {
      const current = aclNormalizePermObject(state.acl?.matrix?.[roleId]?.[m.id], null);
      const viewChecked = current?.view ? "checked" : "";
      const viewTitle = current?.view ? "Nicht anzeigen" : "Anzeigen";
      const viewCell = `<td><input type="checkbox" data-acl-module="${esc(m.id)}" data-acl-perm="view" ${viewChecked} title="${esc(viewTitle)}" aria-label="${esc(viewTitle)}" /></td>`;
      const readChecked = current?.read ? "checked" : "";
      const readCell = `<td><input type="checkbox" ${readChecked} disabled title="Lesen folgt Anzeigen" aria-label="Lesen folgt Anzeigen" /></td>`;
      const disabledByView = current?.view ? "" : "disabled";
      const checks = ACL_PERMISSION_KEYS.map((perm) => {
        if (perm === "read") return readCell;
        const checked = current?.[perm] ? "checked" : "";
        return `<td><input type="checkbox" data-acl-module="${esc(m.id)}" data-acl-perm="${esc(perm)}" ${checked} ${disabledByView} /></td>`;
      }).join("");
      return `
        <tr>
          <td>${esc(m.label)}</td>
          ${viewCell}
          ${checks}
          <td class="small">${esc(m.hint)}</td>
        </tr>
      `;
    }).join("");
  }

  function refreshAclUi() {
    if (!document.getElementById("roleAclRoleSelect")) return;
    renderAclRoleSelect();
    renderAclMatrix();
  }

  function addAclRole(labelRaw) {
    const roleId = normalizeRoleId(labelRaw);
    if (!roleId) throw new Error("Bitte einen Rollennamen eingeben.");
    if (state.acl.roles.includes(roleId)) throw new Error("Diese Rolle existiert bereits.");
    state.acl.roles.push(roleId);
    state.acl.matrix[roleId] = {};
    ACL_MODULES.forEach((m) => {
      state.acl.matrix[roleId][m.id] = { view: false, read: false, write: false, update: false, delete: false };
    });
    state.aclRole = roleId;
    saveAcl();
    refreshAclUi();
    setAclMsg(`Rolle angelegt: ${roleId}`);
  }

  function deleteAclRole(roleIdRaw) {
    const roleId = normalizeRoleId(roleIdRaw);
    if (!roleId || !state.acl.roles.includes(roleId)) return;
    if (isCoreRole(roleId)) throw new Error("Kernrollen können nicht gelöscht werden.");
    state.acl.roles = state.acl.roles.filter((id) => id !== roleId);
    delete state.acl.matrix[roleId];
    state.aclRole = state.acl.roles.includes("admin") ? "admin" : (state.acl.roles[0] || "member");
    saveAcl();
    refreshAclUi();
    setAclMsg(`Rolle gelöscht: ${roleId}`);
  }

  function updateAclPermission(moduleId, permissionKey, value) {
    if (!ACL_MODULES.some((m) => m.id === moduleId)) return;
    if (permissionKey !== "view" && !ACL_EDITABLE_KEYS.includes(permissionKey)) return;
    const roleId = state.aclRole;
    if (!roleId) return;
    if (!state.acl.matrix[roleId]) state.acl.matrix[roleId] = {};
    const current = aclNormalizePermObject(state.acl.matrix[roleId][moduleId], null);
    if (permissionKey === "view") {
      current.view = Boolean(value);
      current.read = current.view;
      if (!current.view) {
        current.write = false;
        current.update = false;
        current.delete = false;
      }
    } else {
      if (!current.view) return;
      current[permissionKey] = Boolean(value);
    }
    state.acl.matrix[roleId][moduleId] = aclSanitizePerms(current);
    saveAcl();
    const stateLabel = Boolean(value) ? "an" : "aus";
    setAclMsg(`Rechte gespeichert: ${roleId} -> ${moduleId}.${permissionKey} = ${stateLabel}`);
    refreshAclUi();
  }

  function fmtTs(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("de-DE");
  }

  function toDateInputValue(v) {
    const raw = String(v || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  function loadPrefs() {
    try {
      const cols = JSON.parse(localStorage.getItem(STORAGE_COLS) || "[]");
      if (Array.isArray(cols) && cols.length) state.visibleCols = new Set(cols.filter((k) => COLUMNS.some((c) => c.key === k)));
      state.visibleCols.add("role");
      state.visibleCols.add("email");
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

  async function loadCurrentProfileClubId() {
    const uid = String(session()?.user?.id || "").trim();
    if (!uid) return "";
    const rows = await sb(`/rest/v1/profiles?select=club_id&id=eq.${encodeURIComponent(uid)}&limit=1`, { method: "GET" }, true).catch(() => []);
    return String(rows?.[0]?.club_id || "").trim();
  }

  async function loadManagedClubIds() {
    const uid = String(session()?.user?.id || "").trim();
    if (!uid) return new Set();

    const managed = new Set();
    const [aclRows, legacyRows, profileClubId] = await Promise.all([
      sb(`/rest/v1/club_user_roles?select=club_id,role_key&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true).catch(() => []),
      sb(`/rest/v1/user_roles?select=club_id,role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true).catch(() => []),
      loadCurrentProfileClubId().catch(() => ""),
    ]);

    (Array.isArray(aclRows) ? aclRows : []).forEach((row) => {
      const clubId = String(row?.club_id || "").trim();
      const roleKey = String(row?.role_key || "").trim().toLowerCase();
      if (!clubId) return;
      if (MANAGER_ROLES.has(roleKey)) managed.add(clubId);
    });

    (Array.isArray(legacyRows) ? legacyRows : []).forEach((row) => {
      const clubId = String(row?.club_id || "").trim();
      const roleKey = String(row?.role || "").trim().toLowerCase();
      if (!clubId) return;
      if (MANAGER_ROLES.has(roleKey)) managed.add(clubId);
    });

    if (profileClubId) managed.add(profileClubId);
    return managed;
  }

  function filterRowsByClubIds(rows, allowedClubIds) {
    if (!(allowedClubIds instanceof Set) || !allowedClubIds.size) return Array.isArray(rows) ? rows : [];
    return (Array.isArray(rows) ? rows : []).filter((row) => allowedClubIds.has(String(row?.club_id || "").trim()));
  }

  function filterMapByClubIds(mapLike, allowedClubIds) {
    const out = new Map();
    if (!(mapLike instanceof Map)) return out;
    if (!(allowedClubIds instanceof Set) || !allowedClubIds.size) return new Map(mapLike);
    mapLike.forEach((value, key) => {
      if (allowedClubIds.has(String(key || "").trim())) out.set(key, value);
    });
    return out;
  }

  async function loadClubIdentityMap() {
    const byId = new Map();
    try {
      const rows = await sb("/rest/v1/rpc/get_club_identity_map", { method: "POST", body: "{}" }, true);
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const clubId = String(row?.club_id || "").trim();
        const code = String(row?.club_code || "").trim().toUpperCase();
        const name = String(row?.club_name || "").trim();
        if (!clubId) return;
        const prev = byId.get(clubId) || {};
        byId.set(clubId, {
          ...prev,
          ...(code ? { code } : {}),
          ...(name ? { name } : {}),
        });
      });
    } catch {
      // non-fatal
    }
    return byId;
  }

  async function loadClubAclCounts() {
    const byClubUsers = new Map();
    try {
      const rows = await sb("/rest/v1/club_user_roles?select=club_id,user_id", { method: "GET" }, true);
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const clubId = String(row?.club_id || "").trim();
        const userId = String(row?.user_id || "").trim();
        if (!clubId || !userId) return;
        if (!byClubUsers.has(clubId)) byClubUsers.set(clubId, new Set());
        byClubUsers.get(clubId).add(userId);
      });
    } catch {
      // non-fatal
    }
    const result = new Map();
    byClubUsers.forEach((users, clubId) => result.set(clubId, users.size));
    return result;
  }

  function normalizeRoleValue(roleId) {
    return String(roleId || "").trim().toLowerCase();
  }

  function clubUserRoleMapKey(clubId, userId) {
    const cid = String(clubId || "").trim();
    const uid = String(userId || "").trim();
    return cid && uid ? `${cid}:${uid}` : "";
  }

  function pickPrimaryRole(roleIds, fallback = "member") {
    const normalized = [...new Set((Array.isArray(roleIds) ? roleIds : []).map(normalizeRoleValue).filter(Boolean))];
    if (!normalized.length) return normalizeRoleValue(fallback) || "member";
    for (const roleId of ROLE_PRIORITY) {
      if (normalized.includes(roleId)) return roleId;
    }
    return normalized.sort((a, b) => a.localeCompare(b, "de"))[0] || normalizeRoleValue(fallback) || "member";
  }

  async function loadClubUserRoleAssignments() {
    try {
      const rows = await sb("/rest/v1/club_user_roles?select=club_id,user_id,role_key", { method: "GET" }, true);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function buildEffectiveRoleMap(roleRows) {
    const byClubUser = new Map();
    (Array.isArray(roleRows) ? roleRows : []).forEach((row) => {
      const key = clubUserRoleMapKey(row?.club_id, row?.user_id);
      const roleId = normalizeRoleValue(row?.role_key);
      if (!key || !roleId) return;
      if (!byClubUser.has(key)) byClubUser.set(key, new Set());
      byClubUser.get(key).add(roleId);
    });
    const result = new Map();
    byClubUser.forEach((roles, key) => {
      result.set(key, pickPrimaryRole([...roles]));
    });
    return result;
  }

  function applyEffectiveRoles(rows, effectiveRoleByClubUser) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const effective = effectiveRoleByClubUser.get(clubUserRoleMapKey(row?.club_id, row?.profile_user_id));
      if (!effective) return {
        ...row,
        role: normalizeRoleValue(row?.role) || "member",
      };
      return {
        ...row,
        role: effective,
      };
    });
  }

  async function loadRoleOnlyRows(baseRows, clubIdentityById, roleRowsInput = null) {
    const rowKeys = new Set(
      (Array.isArray(baseRows) ? baseRows : []).map((r) => {
        const clubId = String(r?.club_id || "").trim();
        const userId = String(r?.profile_user_id || "").trim();
        return clubId && userId ? `${clubId}:${userId}` : "";
      }).filter(Boolean),
    );

    let roleRows = [];
    let profileRows = [];
    let signinRows = [];
    roleRows = Array.isArray(roleRowsInput) ? roleRowsInput : [];
    if (!roleRows.length) {
      try {
        roleRows = await sb("/rest/v1/club_user_roles?select=club_id,user_id,role_key", { method: "GET" }, true);
      } catch {
        roleRows = [];
      }
    }
    try {
      profileRows = await sb("/rest/v1/profiles?select=id,first_name,last_name,member_no", { method: "GET" }, true);
    } catch {
      profileRows = [];
    }
    try {
      signinRows = await sb("/rest/v1/rpc/admin_user_last_signins", { method: "POST", body: "{}" }, true);
    } catch {
      signinRows = [];
    }

    const profileById = new Map();
    (Array.isArray(profileRows) ? profileRows : []).forEach((row) => {
      const id = String(row?.id || "").trim();
      if (!id) return;
      profileById.set(id, {
        first_name: String(row?.first_name || "").trim(),
        last_name: String(row?.last_name || "").trim(),
        member_no: String(row?.member_no || "").trim(),
      });
    });
    const lastSigninByUser = new Map();
    (Array.isArray(signinRows) ? signinRows : []).forEach((row) => {
      const id = String(row?.user_id || "").trim();
      if (!id) return;
      lastSigninByUser.set(id, row?.last_sign_in_at || null);
    });

    const seenRoleUsers = new Set();
    const out = [];
    (Array.isArray(roleRows) ? roleRows : []).forEach((row) => {
      const clubId = String(row?.club_id || "").trim();
      const userId = String(row?.user_id || "").trim();
      if (!clubId || !userId) return;
      const roleKey = normalizeRoleValue(row?.role_key);
      if (!CORE_ROLE_IDS.has(roleKey)) return;

      const k = `${clubId}:${userId}`;
      if (seenRoleUsers.has(k)) return;
      seenRoleUsers.add(k);
      if (rowKeys.has(k)) return;

      const profile = profileById.get(userId) || {};
      const identity = clubIdentityById.get(clubId) || {};
      const clubCode = String(identity?.code || "").trim();
      const memberNo = String(profile?.member_no || "").trim();
      const lastSignInAt = lastSigninByUser.get(userId) || null;
      out.push({
        club_id: clubId,
        club_code: clubCode,
        member_no: memberNo || "",
        first_name: String(profile?.first_name || "").trim(),
        last_name: String(profile?.last_name || "").trim(),
        role: roleKey || "member",
        status: toRoleOnlyStatusText(),
        fishing_card_type: "-",
        has_login: Boolean(lastSignInAt),
        last_sign_in_at: lastSignInAt,
        profile_user_id: userId,
        street: "",
        email: "",
        zip: "",
        city: "",
        phone: "",
        mobile: "",
        birthdate: null,
        sepa_approved: null,
        iban_last4: "",
        guardian_member_no: "",
        club_member_no: "",
        row_kind: "role_only",
      });
    });
    return out;
  }

  function applyFilterSort() {
    const q = state.search.trim().toLowerCase();
    let rows = [...state.rows];
    if (state.statusFilter !== "all") {
      rows = rows.filter((r) => String(r.status || "").toLowerCase() === state.statusFilter);
    }
    if (state.clubIdFilter) {
      rows = rows.filter((r) => String(r.club_id || "").trim() === state.clubIdFilter);
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
        r.club_code, r.club_member_no, r.member_no, r.first_name, r.last_name, r.email, r.status, r.city, r.zip, r.fishing_card_type, r.role,
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

  function currentFocusClubCode() {
    const clubId = currentFocusClubId();
    if (!clubId) return String(state.clubContext?.club_code || "").trim();
    return String(state.clubOptions.find((entry) => entry.club_id === clubId)?.club_code || state.clubContext?.club_code || "").trim();
  }

  function renderMemberCell(column, row) {
    if (column.key === "login_dot") return loginDotCell(row);
    if (column.key === "last_sign_in_at") return esc(fmtTs(row.last_sign_in_at));
    if (column.key === "status" && String(row?.status || "").toLowerCase() === toRoleOnlyStatusText()) return "Ohne Mitgliedsnummer";
    if (column.key === "sepa_approved") return row.sepa_approved === null || row.sepa_approved === undefined ? "-" : (row.sepa_approved ? "Ja" : "Nein");
    if (column.key === "role") return esc(String(row?.role || "member").trim() || "member");
    return esc(row?.[column.key] ?? "-");
  }

  function memberInlineColumns() {
    const visible = COLUMNS.filter((c) => state.visibleCols.has(c.key));
    const roleOptions = state.acl.roles.map((roleId) => ({ value: roleId, label: roleId }));
    const base = visible.map((column) => {
      if (column.key === "login_dot") {
        return {
          key: column.key,
          label: column.label,
          type: "meta",
          width: `${Math.max(80, Number(column.width || 120))}px`,
          editable: false,
          sortable: true,
          renderHtml: (row) => loginDotCell(row),
          sortValue: (row) => (row?.has_login ? "1" : "0"),
        };
      }
      if (column.key === "member_no") {
        return {
          key: column.key,
          label: column.label,
          type: "meta",
          width: `${Math.max(80, Number(column.width || 120))}px`,
          editable: false,
          editorType: "readonly",
          value: (row) => String(row?.club_member_no || row?.member_no || "").trim(),
          sortValue: (row) => String(row?.club_member_no || row?.member_no || "").trim(),
          renderHtml: (row) => esc(String(row?.club_member_no || row?.member_no || "-").trim() || "-"),
        };
      }
      if (column.key === "status") {
        return {
          key: column.key,
          label: column.label,
          type: "select",
          width: `${Math.max(80, Number(column.width || 120))}px`,
          editorType: "select",
          options: [
            { value: "Aktiv", label: "Aktiv" },
            { value: "Passiv", label: "Passiv" },
          ],
          renderHtml: (row) => renderMemberCell(column, row),
        };
      }
      if (column.key === "role") {
        return {
          key: column.key,
          label: column.label,
          type: "select",
          width: `${Math.max(110, Number(column.width || 150))}px`,
          editorType: "select",
          options: roleOptions.length ? roleOptions : [{ value: "member", label: "member" }],
          renderHtml: (row) => renderMemberCell(column, row),
        };
      }
      if (column.key === "sepa_approved") {
        return {
          key: column.key,
          label: column.label,
          type: "boolean",
          width: `${Math.max(80, Number(column.width || 120))}px`,
          editorType: "select",
          options: [
            { value: "true", label: "Ja" },
            { value: "false", label: "Nein" },
          ],
          renderHtml: (row) => renderMemberCell(column, row),
        };
      }
      return {
        key: column.key,
        label: column.label,
        type: column.key === "first_name" || column.key === "last_name" ? "primary" : "text",
        width: `${Math.max(80, Number(column.width || 120))}px`,
        editable: !["club_code", "member_no", "club_id", "last_sign_in_at", "login_dot"].includes(column.key),
        editorType: ["birthdate"].includes(column.key) ? "date" : "text",
        renderHtml: (row) => renderMemberCell(column, row),
      };
    });

    base.push({
      key: "actions",
      label: "Aktionen",
      type: "actions",
      width: "104px",
      editable: false,
      sortable: false,
      filterable: false,
    });
    return base;
  }

  async function createMemberInline(draft) {
    const clubId = currentFocusClubId();
    const clubCode = currentFocusClubCode();
    if (!clubId || !clubCode) throw new Error("club_context_missing");
    const created = await sb("/rest/v1/rpc/admin_member_registry_create", {
      method: "POST",
      body: JSON.stringify({
        p_club_id: clubId,
        p_club_code: clubCode,
        p_club_member_no: String(draft?.club_member_no || "").trim().toUpperCase() || null,
        p_first_name: String(draft?.first_name || "").trim() || null,
        p_last_name: String(draft?.last_name || "").trim() || null,
        p_role: String(draft?.role || "member").trim().toLowerCase() || "member",
        p_status: String(draft?.status || "Aktiv").trim() || null,
        p_fishing_card_type: String(draft?.fishing_card_type || "").trim() || null,
        p_street: String(draft?.street || "").trim() || null,
        p_email: String(draft?.email || "").trim().toLowerCase() || null,
        p_zip: String(draft?.zip || "").trim() || null,
        p_city: String(draft?.city || "").trim() || null,
        p_phone: String(draft?.phone || "").trim() || null,
        p_mobile: String(draft?.mobile || "").trim() || null,
        p_birthdate: String(draft?.birthdate || "").trim() || null,
        p_guardian_member_no: String(draft?.guardian_member_no || "").trim() || null,
        p_sepa_approved: String(draft?.sepa_approved || "true") === "true" || Boolean(draft?.sepa_approved),
      }),
    }, true);
    return Array.isArray(created) && created.length ? created[0] : null;
  }

  async function updateMemberInline(row, draft) {
    await sb("/rest/v1/rpc/admin_member_registry_update", {
      method: "POST",
      body: JSON.stringify({
        p_member_no: String(row?.member_no || "").trim(),
        p_club_member_no: String(draft?.club_member_no || "").trim().toUpperCase() || null,
        p_first_name: String(draft?.first_name || "").trim() || null,
        p_last_name: String(draft?.last_name || "").trim() || null,
        p_role: String(draft?.role || "member").trim().toLowerCase() || "member",
        p_status: String(draft?.status || "").trim() || null,
        p_fishing_card_type: String(draft?.fishing_card_type || "").trim() || null,
        p_street: String(draft?.street || "").trim() || null,
        p_email: String(draft?.email || "").trim().toLowerCase() || null,
        p_zip: String(draft?.zip || "").trim() || null,
        p_city: String(draft?.city || "").trim() || null,
        p_phone: String(draft?.phone || "").trim() || null,
        p_mobile: String(draft?.mobile || "").trim() || null,
        p_birthdate: String(draft?.birthdate || "").trim() || null,
        p_guardian_member_no: String(draft?.guardian_member_no || "").trim() || null,
        p_sepa_approved: String(draft?.sepa_approved || "true") === "true" || Boolean(draft?.sepa_approved),
      }),
    }, true);
  }

  async function deleteMemberInline(row) {
    await sb("/rest/v1/rpc/admin_member_registry_delete", {
      method: "POST",
      body: JSON.stringify({
        p_club_id: String(row?.club_id || "").trim(),
        p_member_no: String(row?.member_no || "").trim(),
      }),
    }, true);
  }

  function renderMembersInlineTable() {
    const mount = document.getElementById("memberRegistryInlineTableMount");
    if (!mount) return;
    mount.innerHTML = `<div id="memberRegistryInlineTableRoot"></div>`;
    membersTable = null;
    const root = document.getElementById("memberRegistryInlineTableRoot");
    if (!root || !window.FCPInlineDataTable?.createStandardV2) return;

    const clubOptions = [...new Set(state.rows.map((row) => String(row?.club_code || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "de"));
    const rows = state.clubIdFilter
      ? state.rows.filter((row) => String(row?.club_id || "").trim() === state.clubIdFilter)
      : state.rows.slice();
    membersTable = window.FCPInlineDataTable.createStandardV2({
      root,
      tableId: "member-registry-inline",
      viewMode: "table",
      title: "Mitglieder",
      description: "Registry-Ansicht mit Suche, Filtern und Stammdatenpflege.",
      showToolbar: true,
      showCreateButton: true,
      showResetButton: true,
      showViewSwitch: true,
      utilityActions: [
        { key: "reload", label: "Neu laden", variant: "ghost" },
      ],
      onUtilityAction: async (actionKey) => {
        if (actionKey !== "reload") return;
        try {
          setMsg("Mitglieder werden geladen ...");
          await refresh();
          setMsg("Mitglieder geladen.");
        } catch (err) {
          setMsg(err?.message || "Laden fehlgeschlagen.", true);
        }
      },
      showMetaBar: false,
      createLabel: "＋ Neuer Eintrag",
      sortKey: state.sortKey,
      sortDir: state.sortDir,
      rowClickOpensEditor: false,
      searchPlaceholder: "Mitglieds-Nr., Name, Status, Ort...",
      filterFields: [
        {
          key: "status",
          label: "Status",
          type: "select",
          defaultValue: "all",
          options: [
            { value: "all", label: "Alle" },
            { value: "aktiv", label: "Aktiv" },
            { value: "passiv", label: "Passiv" },
          ],
          value: (row) => {
            const raw = String(row?.status || "").trim().toLowerCase();
            if (raw === "active" || raw === "aktiv") return "aktiv";
            if (raw === "inactive" || raw === "passive" || raw === "passiv" || raw === "inaktiv") return "passiv";
            return raw;
          },
        },
        {
          key: "club_code",
          label: "Club",
          type: "select",
          defaultValue: "all",
          options: [
            { value: "all", label: "Alle" },
            ...clubOptions.map((code) => ({ value: code.toLowerCase(), label: code })),
          ],
          value: (row) => String(row?.club_code || "").trim().toLowerCase(),
        },
        {
          key: "role",
          label: "Rolle",
          type: "select",
          defaultValue: "all",
          options: [
            { value: "all", label: "Alle" },
            ...state.acl.roles.map((roleId) => ({ value: roleId, label: roleId })),
          ],
          value: (row) => String(row?.role || "member").trim().toLowerCase(),
        },
        {
          key: "login_dot",
          label: "Login",
          type: "select",
          defaultValue: "all",
          options: [
            { value: "all", label: "Alle" },
            { value: "yes", label: "Mit Login" },
            { value: "no", label: "Ohne Login" },
          ],
          value: (row) => row?.has_login ? "yes" : "no",
        },
      ],
      emptyStateDescription: 'Lege den ersten Eintrag direkt inline ueber "＋ Neuer Eintrag" an.',
      rows,
      rowKey: (row) => rowKey(row),
      getCreateDefaults: () => ({
        club_member_no: "",
        first_name: "",
        last_name: "",
        role: "member",
        status: "Aktiv",
        fishing_card_type: "",
        street: "",
        email: "",
        zip: "",
        city: "",
        phone: "",
        mobile: "",
        birthdate: "",
        guardian_member_no: "",
        sepa_approved: true,
      }),
      columns: memberInlineColumns(),
      onCreateSubmit: async (draft) => {
        try {
          setMsg("Mitglied wird angelegt ...");
          await createMemberInline(draft);
          await refresh();
          setMsg("Mitglied angelegt.");
          return true;
        } catch (err) {
          setMsg(err?.message || "Anlegen fehlgeschlagen.", true);
          return false;
        }
      },
      onEditSubmit: async (row, draft) => {
        try {
          if (String(row?.row_kind || "") === "role_only") throw new Error("role_only_row_not_editable");
          setMsg("Mitglied wird gespeichert ...");
          await updateMemberInline(row, draft);
          await refresh();
          setMsg("Mitglied gespeichert.");
          return true;
        } catch (err) {
          setMsg(err?.message || "Speichern fehlgeschlagen.", true);
          return false;
        }
      },
      onDelete: async (row) => {
        try {
          if (String(row?.row_kind || "") === "role_only") throw new Error("role_only_row_not_deletable");
          if (!window.confirm(`Mitglied ${String(row?.member_no || "").trim()} wirklich löschen?`)) return;
          setMsg("Mitglied wird gelöscht ...");
          await deleteMemberInline(row);
          await refresh();
          setMsg("Mitglied gelöscht.");
        } catch (err) {
          setMsg(err?.message || "Löschen fehlgeschlagen.", true);
        }
      },
      onDuplicate: async (row) => {
        try {
          if (String(row?.row_kind || "") === "role_only") throw new Error("role_only_row_not_duplicable");
          setMsg("Mitglied wird dupliziert ...");
          await createMemberInline({
            ...row,
            member_no: "",
            club_member_no: "",
          });
          await refresh();
          setMsg("Mitglied dupliziert.");
        } catch (err) {
          setMsg(err?.message || "Duplizieren fehlgeschlagen.", true);
        }
      },
      onSortChange: ({ sortKey, sortDir }) => {
        state.sortKey = sortKey;
        state.sortDir = sortDir;
        savePrefs();
        renderRows();
      },
    });
  }

  function renderHead() {
    renderMembersInlineTable();
  }

  function cellValue(r, key) {
    if (key === "login_dot") return loginDotCell(r);
    if (key === "last_sign_in_at") return esc(fmtTs(r.last_sign_in_at));
    if (key === "status" && String(r?.status || "").toLowerCase() === toRoleOnlyStatusText()) {
      return "Ohne Mitgliedsnummer";
    }
    if (key === "sepa_approved") return r.sepa_approved === null || r.sepa_approved === undefined ? "-" : (r.sepa_approved ? "Ja" : "Nein");
    if (key === "role") return esc(String(r?.role || "member").trim() || "member");
    return esc(r?.[key] ?? "-");
  }

  function renderRows() {
    renderMembersInlineTable();
  }

  function renderClubFilter() {
    const el = document.getElementById("memberRegistryClubFilter");
    if (!el) return;
    const clubs = new Set(state.rows.map((r) => String(r.club_code || "").trim()).filter(Boolean));
    state.clubIdentityById.forEach((entry) => {
      const code = String(entry?.code || "").trim();
      if (code) clubs.add(code);
    });
    const sorted = [...clubs].sort((a, b) => a.localeCompare(b, "de"));
    const current = state.clubFilter;
    el.innerHTML = [`<option value="all">Alle</option>`, ...sorted.map((c) => `<option value="${esc(c.toLowerCase())}">${esc(c)}</option>`)].join("");
    el.value = sorted.some((c) => c.toLowerCase() === current) ? current : "all";
    if (el.value !== current) state.clubFilter = el.value;
  }

  function renderStatsAndPager() {
    const stats = document.getElementById("memberRegistryStats");
    const info = document.getElementById("memberRegistryPageInfo");
    const prev = document.getElementById("memberRegistryPrevPage");
    const next = document.getElementById("memberRegistryNextPage");
    const scopedRowsTotal = state.clubIdFilter
      ? state.rows.filter((r) => String(r.club_id || "").trim() === state.clubIdFilter).length
      : state.rows.length;
    const aclTotal = state.clubIdFilter
      ? Number(state.clubAclCountsById.get(state.clubIdFilter) || 0)
      : 0;
    const total = state.clubIdFilter ? Math.max(scopedRowsTotal, aclTotal) : scopedRowsTotal;
    const found = state.filtered.length;
    const pages = Math.max(1, Math.ceil(found / state.pageSize));
    if (stats) {
      let clubHint = "";
      if (state.clubIdFilter) {
        const meta = state.clubIdentityById.get(state.clubIdFilter) || {};
        const label = String(meta.name || meta.code || state.clubIdFilter).trim();
        clubHint = ` • Club-Fokus: ${label}`;
      }
      const provisionHint = state.clubIdFilter && scopedRowsTotal === 0 && aclTotal > 0
        ? " • Verzeichnisaufbau aus Rollen läuft/fehlt"
        : "";
      stats.textContent = `Gefunden: ${found} von ${total}${clubHint}${provisionHint}`;
    }
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

  function renderClubOverview() {
    const nameEl = document.getElementById("clubDataName");
    const idEl = document.getElementById("clubDataClubId");
    const membersEl = document.getElementById("clubDataMembers");
    const scopedRows = state.clubIdFilter
      ? state.rows.filter((r) => String(r.club_id || "").trim() === state.clubIdFilter)
      : state.rows;
    const clubIds = [...new Set(scopedRows.map((r) => String(r.club_id || "").trim()).filter(Boolean))];
    const clubCodes = [...new Set(scopedRows.map((r) => String(r.club_code || "").trim()).filter(Boolean))];
    const focusClubId = String(state.clubIdFilter || (clubIds.length === 1 ? clubIds[0] : "") || "").trim();
    const meta = focusClubId ? (state.clubIdentityById.get(focusClubId) || {}) : {};
    const code = String((clubCodes.length === 1 ? clubCodes[0] : "") || meta.code || "").trim();
    const membersCount = focusClubId ? scopedRows.length : scopedRows.length;

    if (nameEl) {
      if (focusClubId) {
        nameEl.textContent = String(meta.name || code || "Unbenannter Verein");
      } else {
        nameEl.textContent = clubCodes.length === 1
          ? clubCodes[0]
          : (clubCodes.length > 1 ? `${clubCodes.length} Vereine` : "-");
      }
    }
    if (idEl) {
      idEl.textContent = focusClubId || (clubIds.length === 1
        ? clubIds[0]
        : (clubIds.length > 1 ? "Mehrere Club-IDs" : "-"));
    }
    if (membersEl) membersEl.textContent = String(membersCount || 0);

    state.clubContext = {
      club_id: focusClubId || (clubIds.length === 1 ? clubIds[0] : ""),
      club_code: code || (clubCodes.length === 1 ? clubCodes[0] : ""),
    };

    const optionMap = new Map();
    state.rows.forEach((row) => {
      const clubId = String(row.club_id || "").trim();
      if (!clubId) return;
      if (!optionMap.has(clubId)) {
        optionMap.set(clubId, {
          club_id: clubId,
          club_code: String(row.club_code || "").trim(),
        });
      }
    });
    state.clubIdentityById.forEach((entry, clubId) => {
      if (!clubId) return;
      if (!optionMap.has(clubId)) {
        optionMap.set(clubId, {
          club_id: clubId,
          club_code: String(entry?.code || "").trim(),
        });
      }
    });
    state.clubOptions = [...optionMap.values()].sort((a, b) => String(a.club_code || "").localeCompare(String(b.club_code || ""), "de"));
    if (!state.selectedInviteClubId && state.clubContext.club_id) {
      state.selectedInviteClubId = state.clubContext.club_id;
    }
    if (state.clubContext.club_id && !state.clubOptions.some((o) => o.club_id === state.selectedInviteClubId)) {
      state.selectedInviteClubId = state.clubContext.club_id;
    }
    renderInviteClubSelect();
    renderClubDataForm();
  }

  function currentFocusClubId() {
    return String(state.clubContext?.club_id || state.clubIdFilter || "").trim();
  }

  function currentClubWorkspace() {
    const clubId = currentFocusClubId();
    return clubId ? state.clubWorkspaceById.get(clubId) || null : null;
  }

  function waterTypeOptions() {
    return [
      { value: "", label: "Optional" },
      { value: "see", label: "See" },
      { value: "fluss", label: "Fluss" },
      { value: "weiher", label: "Weiher" },
    ];
  }

  function waterStatusOptions() {
    return [
      { value: "active", label: "aktiv" },
      { value: "draft", label: "Entwurf" },
      { value: "inactive", label: "inaktiv" },
    ];
  }

  function waterCardOptions(workspace) {
    const cards = Array.isArray(workspace?.cards) ? workspace.cards : [];
    return cards
      .map((card) => ({
        value: String(card?.id || "").trim(),
        label: String(card?.name || "").trim(),
      }))
      .filter((card) => card.value && card.label);
  }

  function hydrateWaterRows(workspace) {
    const cardOptions = waterCardOptions(workspace);
    const cardMap = new Map(cardOptions.map((card) => [card.value, card.label]));
    return (Array.isArray(workspace?.waters) ? workspace.waters : []).map((row) => {
      const cardIds = Array.isArray(row?.water_cards) ? row.water_cards.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
      return {
        ...row,
        water_status: String(row?.water_status || (row?.is_active ? "active" : "inactive") || "active").trim(),
        water_type: String(row?.water_type || "").trim(),
        is_youth_allowed: Boolean(row?.is_youth_allowed),
        requires_board_approval: Boolean(row?.requires_board_approval),
        water_cards: cardIds,
        water_cards_display: cardIds.map((id) => ({ id, label: cardMap.get(id) || id })),
      };
    });
  }

  async function syncWatersWorkspace(action, payload = {}) {
    const clubId = currentFocusClubId();
    if (!clubId) throw new Error("club_id_required");
    const data = await callWorkspace(action, clubId, payload);
    if (data?.workspace) state.clubWorkspaceById.set(clubId, data.workspace);
    renderWatersPanel();
    return data;
  }

  function renderWatersPanel() {
    const mount = document.getElementById("memberRegistryWatersMount");
    if (!mount) return;
    const workspace = currentClubWorkspace();
    const clubId = currentFocusClubId();

    if (!clubId) {
      mount.innerHTML = `<p class="small">Kein Vereinskontext aktiv.</p>`;
      return;
    }

    mount.innerHTML = `
      <p id="memberRegistryWatersMsg" class="small" aria-live="polite"></p>
      <div id="memberRegistryWatersTable"></div>
    `;
    watersTable = null;

    if (!window.FCPInlineDataTable?.createStandardV2) {
      setWatersMsg("Inline Data Table v2 ist nicht verfügbar.", true);
      return;
    }

    const tableRoot = document.getElementById("memberRegistryWatersTable");
    const rows = hydrateWaterRows(workspace);
    const cardOptions = waterCardOptions(workspace);
    const hasCardOptions = cardOptions.length > 0;
    const metaHint = cardOptions.length
      ? `${cardOptions.length} Angelkarten verfügbar`
      : (workspace ? "Noch keine Angelkarten im Verein hinterlegt" : "Workspace noch nicht geladen");

    if (!workspace) {
      setWatersMsg("Für Live-Daten bitte einmal 'Neu laden' ausführen.");
    }

    if (!watersTable) {
      watersTable = window.FCPInlineDataTable.createStandardV2({
        root: tableRoot,
        tableId: "registry-waters",
        viewMode: "table",
        title: "Gewässer",
        description: "Inline-Anlage und Pflege der vereinsbezogenen Gewässer inkl. Kartenzuordnung.",
        utilityActions: [
          { key: "reload", label: "Neu laden", variant: "ghost" },
        ],
        onUtilityAction: async (actionKey) => {
          if (actionKey !== "reload") return;
          try {
            setWatersMsg("Gewässer werden geladen ...");
            await loadClubWorkspace(clubId);
            setWatersMsg("Gewässer geladen.");
          } catch (err) {
            setWatersMsg(err?.message || "Laden fehlgeschlagen.", true);
          }
        },
        metaLabel: "Gewässer",
        metaHint,
        searchPlaceholder: "Gewässer suchen ...",
        showCreateButton: Boolean(workspace),
        createLabel: "Neuer Eintrag",
        emptyStateDescription: workspace
          ? 'Lege den ersten Eintrag direkt inline ueber "Neuer Eintrag" an.'
          : "Lade zuerst den Vereins-Workspace, damit vorhandene Gewässer und Angelkarten verfuegbar sind.",
        rows,
        rowKey: (row) => String(row?.id || "").trim(),
        filterFields: [
          { key: "name", label: "Gewässer", type: "text", placeholder: "z. B. Angelweiher" },
          { key: "water_status", label: "Status", type: "text", placeholder: "z. B. aktiv" },
          { key: "water_type", label: "Typ", type: "text", placeholder: "z. B. See" },
          { key: "is_youth_allowed", label: "Jugend", type: "text", placeholder: "Ja / Nein" },
          { key: "requires_board_approval", label: "Vorstand", type: "text", placeholder: "Ja / Nein" },
        ],
        getCreateDefaults: () => ({
          name: "",
          area_kind: "vereins_gemeinschaftsgewaesser",
          water_type: "",
          water_status: "active",
          is_youth_allowed: false,
          requires_board_approval: false,
          water_cards: [],
        }),
        columns: [
          {
            key: "name",
            label: "Gewässer",
            type: "primary",
            width: "minmax(180px, 1.45fr)",
            placeholder: "z. B. Angelweiher",
          },
          {
            key: "water_type",
            label: "Typ",
            type: "select",
            width: "minmax(120px, .8fr)",
            editorType: "select",
            options: waterTypeOptions(),
            renderHtml: (row) => {
              const found = waterTypeOptions().find((entry) => entry.value === String(row?.water_type || ""));
              return esc(found?.label || "-");
            },
          },
          {
            key: "water_status",
            label: "Status",
            type: "select",
            width: "minmax(110px, .78fr)",
            editorType: "select",
            options: waterStatusOptions(),
            renderHtml: (row) => {
              const found = waterStatusOptions().find((entry) => entry.value === String(row?.water_status || ""));
              return esc(found?.label || row?.water_status || "-");
            },
          },
          {
            key: "is_youth_allowed",
            label: "Jugend",
            type: "boolean",
            width: "minmax(90px, .6fr)",
            editorType: "select",
            options: [
              { value: "true", label: "Ja" },
              { value: "false", label: "Nein" },
            ],
            renderHtml: (row) => esc(row?.is_youth_allowed ? "Ja" : "Nein"),
          },
          {
            key: "requires_board_approval",
            label: "Vorstand",
            type: "boolean",
            width: "minmax(90px, .6fr)",
            editorType: "select",
            options: [
              { value: "true", label: "Ja" },
              { value: "false", label: "Nein" },
            ],
            renderHtml: (row) => esc(row?.requires_board_approval ? "Ja" : "Nein"),
          },
          {
            key: "water_cards",
            label: "Angelkarten",
            type: "meta",
            width: hasCardOptions ? "minmax(180px, .95fr)" : "minmax(90px, .45fr)",
            editorType: hasCardOptions ? "select-multi" : "readonly",
            options: cardOptions,
            value: (row) => Array.isArray(row?.water_cards) ? row.water_cards : [],
            renderHtml: (row) => {
              const items = Array.isArray(row?.water_cards_display) ? row.water_cards_display : [];
              if (!hasCardOptions) return "—";
              if (!items.length) return "-";
              return items.map((item) => `<span class="inline-token">${esc(item?.label || item?.name || item)}</span>`).join("");
            },
          },
          {
            key: "actions",
            label: "Aktionen",
            type: "actions",
            width: "120px",
            editable: false,
            sortable: false,
            filterable: false,
          },
        ],
        onCreateSubmit: async (draft) => {
          try {
            setWatersMsg("Gewässer wird angelegt ...");
            await syncWatersWorkspace("create_water", {
              name: String(draft?.name || "").trim(),
              area_kind: String(draft?.area_kind || "vereins_gemeinschaftsgewaesser").trim(),
              water_type: String(draft?.water_type || "").trim(),
              water_status: String(draft?.water_status || "active").trim(),
              is_youth_allowed: String(draft?.is_youth_allowed || "false") === "true" || Boolean(draft?.is_youth_allowed),
              requires_board_approval: String(draft?.requires_board_approval || "false") === "true" || Boolean(draft?.requires_board_approval),
              water_cards: Array.isArray(draft?.water_cards) ? draft.water_cards : [],
            });
            setWatersMsg("Gewässer angelegt.");
            return true;
          } catch (err) {
            setWatersMsg(err?.message || "Anlegen fehlgeschlagen.", true);
            return false;
          }
        },
        onEditSubmit: async (row, draft) => {
          try {
            setWatersMsg("Gewässer wird gespeichert ...");
            await syncWatersWorkspace("update_water", {
              water_id: String(row?.id || "").trim(),
              name: String(draft?.name || "").trim(),
              area_kind: String(draft?.area_kind || "vereins_gemeinschaftsgewaesser").trim(),
              water_type: String(draft?.water_type || "").trim(),
              water_status: String(draft?.water_status || "active").trim(),
              is_youth_allowed: String(draft?.is_youth_allowed || "false") === "true" || Boolean(draft?.is_youth_allowed),
              requires_board_approval: String(draft?.requires_board_approval || "false") === "true" || Boolean(draft?.requires_board_approval),
              water_cards: Array.isArray(draft?.water_cards) ? draft.water_cards : [],
            });
            setWatersMsg("Gewässer gespeichert.");
            return true;
          } catch (err) {
            setWatersMsg(err?.message || "Speichern fehlgeschlagen.", true);
            return false;
          }
        },
        onDelete: async (row) => {
          const ok = window.confirm(`Gewässer "${String(row?.name || "").trim()}" wirklich löschen?`);
          if (!ok) return;
          try {
            setWatersMsg("Gewässer wird gelöscht ...");
            await syncWatersWorkspace("delete_water", {
              water_id: String(row?.id || "").trim(),
            });
            setWatersMsg("Gewässer gelöscht.");
          } catch (err) {
            setWatersMsg(err?.message || "Löschen fehlgeschlagen.", true);
          }
        },
        onDuplicate: async (row) => {
          try {
            setWatersMsg("Gewässer wird dupliziert ...");
            await syncWatersWorkspace("create_water", {
              name: `${String(row?.name || "").trim()} (Kopie)`,
              area_kind: String(row?.area_kind || "vereins_gemeinschaftsgewaesser").trim(),
              water_type: String(row?.water_type || "").trim(),
              water_status: String(row?.water_status || "active").trim(),
              is_youth_allowed: Boolean(row?.is_youth_allowed),
              requires_board_approval: Boolean(row?.requires_board_approval),
              water_cards: Array.isArray(row?.water_cards) ? row.water_cards : [],
            });
            setWatersMsg("Gewässer dupliziert.");
          } catch (err) {
            setWatersMsg(err?.message || "Duplizieren fehlgeschlagen.", true);
          }
        },
      });
    } else {
      watersTable.setRows(rows);
      watersTable.setMeta({ metaLabel: "Gewässer", metaHint });
    }
  }

  function fillValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(value || "");
  }

  function clubDataDraftKey(clubId) {
    return `${STORAGE_CLUB_DATA_DRAFT_PREFIX}${String(clubId || "").trim()}`;
  }

  function loadLocalClubDataDraft(clubId) {
    const cid = String(clubId || "").trim();
    if (!cid) return null;
    try {
      const raw = JSON.parse(localStorage.getItem(clubDataDraftKey(cid)) || "{}");
      return raw && typeof raw === "object" ? raw : null;
    } catch {
      return null;
    }
  }

  function saveLocalClubDataDraft(clubId, payload) {
    const cid = String(clubId || "").trim();
    if (!cid) return;
    const draft = {
      club_data: { ...(payload || {}) },
      saved_locally_at: new Date().toISOString(),
    };
    localStorage.setItem(clubDataDraftKey(cid), JSON.stringify(draft));
    state.clubWorkspaceById.set(cid, draft);
  }

  function renderClubDataForm() {
    const clubId = currentFocusClubId();
    const workspace = currentClubWorkspace() || loadLocalClubDataDraft(clubId);
    const clubData = workspace?.club_data || {};
    const fallbackMeta = state.clubIdentityById.get(currentFocusClubId()) || {};
    fillValue("clubDataEditName", clubData.club_name || fallbackMeta.name || "");
    fillValue("clubDataEditStreet", clubData.street || "");
    fillValue("clubDataEditZip", clubData.zip || "");
    fillValue("clubDataEditCity", clubData.city || "");
    fillValue("clubDataEditContactName", clubData.contact_name || "");
    fillValue("clubDataEditContactEmail", clubData.contact_email || "");
    fillValue("clubDataEditContactPhone", clubData.contact_phone || "");
  }

  async function loadClubWorkspace(clubId) {
    const cid = String(clubId || "").trim();
    if (!cid) return null;
    try {
      const data = await callWorkspace("get", cid);
      if (data?.workspace) {
        state.clubWorkspaceById.set(cid, data.workspace);
        renderClubDataForm();
        renderWatersPanel();
      }
      return data?.workspace || null;
    } catch (err) {
      const draft = loadLocalClubDataDraft(cid);
      if (draft) {
        state.clubWorkspaceById.set(cid, draft);
        renderClubDataForm();
        renderWatersPanel();
        return draft;
      }
      throw err;
    }
  }

  async function saveClubData() {
    const clubId = currentFocusClubId();
    if (!clubId) throw new Error("club_id_required");
    const payload = {
      club_name: String(document.getElementById("clubDataEditName")?.value || "").trim(),
      street: String(document.getElementById("clubDataEditStreet")?.value || "").trim(),
      zip: String(document.getElementById("clubDataEditZip")?.value || "").trim(),
      city: String(document.getElementById("clubDataEditCity")?.value || "").trim(),
      contact_name: String(document.getElementById("clubDataEditContactName")?.value || "").trim(),
      contact_email: String(document.getElementById("clubDataEditContactEmail")?.value || "").trim(),
      contact_phone: String(document.getElementById("clubDataEditContactPhone")?.value || "").trim(),
    };
    if (!payload.club_name) throw new Error("club_name_required");
    try {
      const data = await callWorkspace("save_club_data", clubId, payload);
      if (data?.workspace) {
        state.clubWorkspaceById.set(clubId, data.workspace);
        const meta = state.clubIdentityById.get(clubId) || {};
        state.clubIdentityById.set(clubId, {
          ...meta,
          name: String(data.workspace?.club_data?.club_name || payload.club_name).trim(),
        });
        renderClubOverview();
      }
      return data;
    } catch (err) {
      saveLocalClubDataDraft(clubId, payload);
      const meta = state.clubIdentityById.get(clubId) || {};
      state.clubIdentityById.set(clubId, {
        ...meta,
        name: String(payload.club_name || meta.name || "").trim(),
      });
      renderClubOverview();
      return {
        ok: true,
        local_only: true,
        fallback_reason: err instanceof Error ? err.message : "workspace_save_failed",
        workspace: state.clubWorkspaceById.get(clubId),
      };
    }
  }

  async function submitInviteCreate() {
    setInviteMsg("Invite-Link wird erzeugt ...");
    try {
      const clubId = String(state.selectedInviteClubId || state.clubContext.club_id || "").trim();
      const maxUses = Number(document.getElementById("clubInviteCreateMaxUses")?.value || 25);
      const expiresInDays = Number(document.getElementById("clubInviteCreateDays")?.value || 14);

      if (!clubId) throw new Error("club_selection_required");
      const selected = state.clubOptions.find((c) => c.club_id === clubId);

      const payload = {
        club_id: clubId,
        club_code: String(selected?.club_code || "").trim().toUpperCase() || undefined,
        max_uses: maxUses,
        expires_in_days: expiresInDays,
      };

      const data = await callFn("club-invite-create", payload);
      setInviteResult(data);
      setInviteMsg("Einladungslink erfolgreich erzeugt.");
    } catch (err) {
      const code = err instanceof Error ? err.message : "unexpected_error";
      const msg =
        code === "supabase_config_missing"
          ? "Supabase-Konfiguration fehlt."
          : code === "login_required"
            ? "Bitte zuerst einloggen."
            : code === "club_selection_required"
              ? "Bitte zuerst den Verein auswählen."
              : code === "club_not_found"
                ? "Verein nicht gefunden."
                : code === "forbidden"
                  ? "Keine Berechtigung (403). Nur Vereinsadmin/Vorstand."
                  : code === "unauthorized"
                    ? "Nicht autorisiert (401)."
                    : `Fehler: ${code}`;
      setInviteMsg(msg, true);
    }
  }

  function openDialog(targetRowKey) {
    const row = state.rows.find((r) => rowKey(r) === String(targetRowKey || ""));
    if (!row) return;
    if (row.row_kind === "role_only") {
      setMsg("Für diese Person fehlt noch ein Vereins-Mitgliedssatz inkl. Mitgliedsnummer.");
      return;
    }
    state.activeRow = row;
    state.dialogMode = "edit";
    const dlg = document.getElementById("memberRegistryDialog");
    const body = document.getElementById("memberRegistryDialogBody");
    if (!dlg || !body) return;
    dialogUiForMode("edit");
    body.innerHTML = `
      <div class="grid cols2">
        <label><span>Vereins-Mitgliedsnummer</span><input id="mrClubMemberNo" value="${esc(row.club_member_no || row.member_no || "")}" /></label>
        <label><span>FCP-ID</span><input value="${esc(row.member_no)}" disabled /></label>
        <label><span>Club-Kürzel</span><input value="${esc(row.club_code || "-")}" disabled /></label>
        <label><span>ClubID</span><input value="${esc(row.club_id || "-")}" disabled /></label>
        <label><span>Vorname</span><input id="mrFirstName" value="${esc(row.first_name || "")}" /></label>
        <label><span>Name</span><input id="mrLastName" value="${esc(row.last_name || "")}" /></label>
        <label><span>Status</span>
          <select id="mrStatus">
            <option value="active" ${String(row.status || "").toLowerCase() === "active" ? "selected" : ""}>Aktiv</option>
            <option value="inactive" ${String(row.status || "").toLowerCase() === "inactive" ? "selected" : ""}>Passiv</option>
          </select>
        </label>
        <label><span>Angelkarte</span><input id="mrFishingCard" value="${esc(row.fishing_card_type || "")}" /></label>
        <label><span>Straße</span><input id="mrStreet" value="${esc(row.street || "")}" /></label>
        <label><span>E-Mail</span><input id="mrEmail" type="email" value="${esc(row.email || "")}" /></label>
        <label><span>PLZ</span><input id="mrZip" value="${esc(row.zip || "")}" /></label>
        <label><span>Ort</span><input id="mrCity" value="${esc(row.city || "")}" /></label>
        <label><span>Tel</span><input id="mrPhone" value="${esc(row.phone || "")}" /></label>
        <label><span>Mobil</span><input id="mrMobile" value="${esc(row.mobile || "")}" /></label>
        <label><span>Geburtstag</span><input id="mrBirthdate" type="date" value="${esc(toDateInputValue(row.birthdate))}" /></label>
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

  function openCreateDialog() {
    const dlg = document.getElementById("memberRegistryDialog");
    const body = document.getElementById("memberRegistryDialogBody");
    if (!dlg || !body) return;
    state.activeRow = null;
    state.dialogMode = "create";
    dialogUiForMode("create");

    const defaultClubId = String(state.clubIdFilter || state.clubContext.club_id || state.clubOptions[0]?.club_id || "").trim();
    const options = state.clubOptions.map((c) => {
      const selected = c.club_id === defaultClubId ? "selected" : "";
      return `<option value="${esc(c.club_id)}" ${selected}>${esc(clubOptionLabelById(c.club_id))}</option>`;
    }).join("");
    const defaultCode = String((state.clubOptions.find((c) => c.club_id === defaultClubId)?.club_code) || "").trim();

    body.innerHTML = `
      <div class="grid cols2">
        <label>
          <span>Verein</span>
          <select id="mrCreateClubId">${options}</select>
        </label>
        <label><span>Club-Code</span><input id="mrCreateClubCode" value="${esc(defaultCode)}" readonly /></label>
        <label><span>Vereins-Mitgliedsnummer (optional)</span><input id="mrClubMemberNo" placeholder="z. B. 598" /></label>
        <label><span>Status</span>
          <select id="mrStatus">
            <option value="active" selected>Aktiv</option>
            <option value="inactive">Passiv</option>
          </select>
        </label>
        <label><span>Vorname</span><input id="mrFirstName" /></label>
        <label><span>Name</span><input id="mrLastName" /></label>
        <label><span>Angelkarte</span><input id="mrFishingCard" value="-" /></label>
        <label><span>Geburtstag</span><input id="mrBirthdate" type="date" /></label>
        <label><span>Straße</span><input id="mrStreet" /></label>
        <label><span>E-Mail</span><input id="mrEmail" type="email" autocomplete="email" /></label>
        <label><span>PLZ</span><input id="mrZip" /></label>
        <label><span>Ort</span><input id="mrCity" /></label>
        <label><span>Tel</span><input id="mrPhone" /></label>
        <label><span>Mobil</span><input id="mrMobile" /></label>
        <label><span>Bezugsperson (Mitglieds-Nr.)</span><input id="mrGuardian" /></label>
        <label><span>SEPA bestätigt</span>
          <select id="mrSepaApproved">
            <option value="false" selected>Nein</option>
            <option value="true">Ja</option>
          </select>
        </label>
        <label><span>IBAN (optional)</span><input id="mrIban" /></label>
      </div>
    `;
    body.querySelector("#mrCreateClubId")?.addEventListener("change", (e) => {
      const clubId = String(e.target?.value || "").trim();
      const code = String((state.clubOptions.find((c) => c.club_id === clubId)?.club_code) || "").trim();
      const codeEl = body.querySelector("#mrCreateClubCode");
      if (codeEl) codeEl.value = code;
    });

    setDialogMsg("");
    if (!dlg.open) dlg.showModal();
  }

  async function saveActive() {
    if (state.dialogMode === "create") {
      const clubId = String(document.getElementById("mrCreateClubId")?.value || "").trim();
      const clubCode = String(document.getElementById("mrCreateClubCode")?.value || "").trim().toUpperCase();
      const payloadCreate = {
        p_club_id: clubId || null,
        p_club_code: clubCode || null,
        p_member_no: null,
        p_club_member_no: String(document.getElementById("mrClubMemberNo")?.value || "").trim().toUpperCase() || null,
        p_first_name: String(document.getElementById("mrFirstName")?.value || "").trim() || null,
        p_last_name: String(document.getElementById("mrLastName")?.value || "").trim() || null,
        p_status: String(document.getElementById("mrStatus")?.value || "").trim() || "active",
        p_fishing_card_type: String(document.getElementById("mrFishingCard")?.value || "").trim() || "-",
        p_street: String(document.getElementById("mrStreet")?.value || "").trim() || null,
        p_email: String(document.getElementById("mrEmail")?.value || "").trim().toLowerCase() || null,
        p_zip: String(document.getElementById("mrZip")?.value || "").trim() || null,
        p_city: String(document.getElementById("mrCity")?.value || "").trim() || null,
        p_phone: String(document.getElementById("mrPhone")?.value || "").trim() || null,
        p_mobile: String(document.getElementById("mrMobile")?.value || "").trim() || null,
        p_guardian_member_no: String(document.getElementById("mrGuardian")?.value || "").trim() || null,
        p_sepa_approved: String(document.getElementById("mrSepaApproved")?.value || "true") === "true",
        p_iban: String(document.getElementById("mrIban")?.value || "").trim() || null,
        p_birthdate: String(document.getElementById("mrBirthdate")?.value || "").trim() || null,
      };
      const created = await sb("/rest/v1/rpc/admin_member_registry_create", {
        method: "POST",
        body: JSON.stringify(payloadCreate),
      }, true);
      const createdNo = Array.isArray(created) && created.length ? String(created[0]?.member_no || "").trim() : "";
      setDialogMsg(createdNo ? `Angelegt: ${createdNo}` : "Mitglied angelegt.");
      return;
    }

    if (!state.activeRow) return;
    const memberNo = String(state.activeRow.member_no || "");
    const payload = {
      p_member_no: memberNo,
      p_club_member_no: String(document.getElementById("mrClubMemberNo")?.value || "").trim().toUpperCase() || null,
      p_first_name: String(document.getElementById("mrFirstName")?.value || "").trim() || null,
      p_last_name: String(document.getElementById("mrLastName")?.value || "").trim() || null,
      p_status: String(document.getElementById("mrStatus")?.value || "").trim() || null,
      p_fishing_card_type: String(document.getElementById("mrFishingCard")?.value || "").trim() || null,
      p_street: String(document.getElementById("mrStreet")?.value || "").trim() || null,
      p_email: String(document.getElementById("mrEmail")?.value || "").trim().toLowerCase() || null,
      p_zip: String(document.getElementById("mrZip")?.value || "").trim() || null,
      p_city: String(document.getElementById("mrCity")?.value || "").trim() || null,
      p_phone: String(document.getElementById("mrPhone")?.value || "").trim(),
      p_mobile: String(document.getElementById("mrMobile")?.value || "").trim(),
      p_guardian_member_no: String(document.getElementById("mrGuardian")?.value || "").trim(),
      p_sepa_approved: String(document.getElementById("mrSepaApproved")?.value || "true") === "true",
      p_iban: String(document.getElementById("mrIban")?.value || "").trim() || null,
      p_birthdate: String(document.getElementById("mrBirthdate")?.value || "").trim() || null,
    };
    await sb("/rest/v1/rpc/admin_member_registry_update", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  async function deleteActive() {
    if (!state.activeRow || state.dialogMode !== "edit") return;
    const memberNo = String(state.activeRow.member_no || "").trim();
    const clubId = String(state.activeRow.club_id || "").trim();
    if (!memberNo || !clubId) return;
    const ok = window.confirm(`Mitglied ${memberNo} wirklich aus diesem Verein löschen?`);
    if (!ok) return;
    await sb("/rest/v1/rpc/admin_member_registry_delete", {
      method: "POST",
      body: JSON.stringify({
        p_club_id: clubId,
        p_member_no: memberNo,
      }),
    }, true);
  }

  async function refresh() {
    setMsg("Lade Mitglieder...");
    const [profileClubId, managedClubIds, rows, clubIdentityById, clubAclCountsById, clubUserRoleAssignments] = await Promise.all([
      loadCurrentProfileClubId().catch(() => ""),
      loadManagedClubIds().catch(() => new Set()),
      loadRows(),
      loadClubIdentityMap(),
      loadClubAclCounts(),
      loadClubUserRoleAssignments(),
    ]);
    if (!state.clubIdFilter) {
      state.clubIdFilter = profileClubId || "";
    }
    if (managedClubIds.size && state.clubIdFilter && !managedClubIds.has(state.clubIdFilter)) {
      state.clubIdFilter = profileClubId && managedClubIds.has(profileClubId)
        ? profileClubId
        : [...managedClubIds][0] || "";
    }

    const effectiveRoleByClubUser = buildEffectiveRoleMap(clubUserRoleAssignments);
    const scopedRows = applyEffectiveRoles(
      filterRowsByClubIds(rows, managedClubIds),
      effectiveRoleByClubUser,
    );
    const scopedClubIdentityById = filterMapByClubIds(clubIdentityById, managedClubIds);
    const scopedClubAclCountsById = filterMapByClubIds(clubAclCountsById, managedClubIds);
    const roleOnlyRows = filterRowsByClubIds(
      await loadRoleOnlyRows(scopedRows, scopedClubIdentityById, clubUserRoleAssignments),
      managedClubIds,
    );

    state.rows = [...scopedRows, ...roleOnlyRows];
    state.clubIdentityById = scopedClubIdentityById;
    state.clubAclCountsById = scopedClubAclCountsById;
    renderClubOverview();
    await loadClubWorkspace(currentFocusClubId()).catch(() => {
      renderWatersPanel();
    });
    renderClubFilter();
    applyFilterSort();
    renderHead();
    renderRows();
    renderStatsAndPager();
    const focusedRows = state.clubIdFilter
      ? state.rows.filter((r) => String(r.club_id || "").trim() === state.clubIdFilter)
      : state.rows;
    if (roleOnlyRows.length) {
      setMsg(`Mitglieder geladen im aktuellen Vereinskontext: ${focusedRows.length} (${roleOnlyRows.length} ohne Vereins-Mitgliedsnummer).`);
    } else {
      setMsg(`Mitglieder geladen im aktuellen Vereinskontext: ${focusedRows.length}`);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search || "");
    const urlClubId = String(params.get("club_id") || "").trim();
    if (urlClubId) state.clubIdFilter = urlClubId;

    const hashSection = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
    switchSection(hashSection || "club");
    document.querySelectorAll("[data-registry-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchSection(String(btn.getAttribute("data-registry-section") || "club"));
      });
    });
    window.addEventListener("hashchange", () => {
      const sec = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
      switchSection(sec || "club");
    });

    loadPrefs();
    loadAcl();
    refreshAclUi();
    renderColumnToggles();
    const pageSizeEl = document.getElementById("memberRegistryPageSize");
    if (pageSizeEl) pageSizeEl.value = String(state.pageSize);

    document.getElementById("clubDataReloadBtn")?.addEventListener("click", async () => {
      try {
        setClubDataMsg("Vereinsdaten werden geladen ...");
        await loadClubWorkspace(currentFocusClubId());
        setClubDataMsg("Vereinsdaten geladen.");
      } catch (e) {
        setClubDataMsg(e.message || "Laden fehlgeschlagen", true);
      }
    });
    document.getElementById("clubDataSaveBtn")?.addEventListener("click", async () => {
      try {
        setClubDataMsg("Vereinsdaten werden gespeichert ...");
        const result = await saveClubData();
        setClubDataMsg(result?.local_only
          ? "Vereinsdaten lokal gespeichert. Remote-Sync greift erst nach Deploy der Club-Function."
          : "Vereinsdaten gespeichert.");
      } catch (e) {
        setClubDataMsg(e.message || "Speichern fehlgeschlagen", true);
      }
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
    document.getElementById("memberRegistrySaveBtn")?.addEventListener("click", async () => {
      try {
        setDialogMsg("Speichere...");
        const wasCreate = state.dialogMode === "create";
        await saveActive();
        setDialogMsg(wasCreate ? "Mitglied angelegt." : "Gespeichert.");
        await refresh();
      } catch (e) {
        setDialogMsg(e.message || "Speichern fehlgeschlagen", true);
      }
    });
    document.getElementById("memberRegistryDeleteBtn")?.addEventListener("click", async () => {
      try {
        setDialogMsg("Lösche...");
        await deleteActive();
        setDialogMsg("Gelöscht.");
        await refresh();
      } catch (e) {
        setDialogMsg(e.message || "Löschen fehlgeschlagen", true);
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
    document.getElementById("roleAclRoleSelect")?.addEventListener("change", (e) => {
      state.aclRole = String(e.target.value || "");
      refreshAclUi();
      setAclMsg("");
    });
    document.getElementById("roleAclAddRoleBtn")?.addEventListener("click", () => {
      try {
        const input = document.getElementById("roleAclNewRole");
        addAclRole(input?.value || "");
        if (input) input.value = "";
      } catch (err) {
        setAclMsg(err?.message || "Rolle konnte nicht angelegt werden.", true);
      }
    });
    document.getElementById("roleAclDeleteRoleBtn")?.addEventListener("click", () => {
      try {
        deleteAclRole(state.aclRole);
      } catch (err) {
        setAclMsg(err?.message || "Rolle konnte nicht gelöscht werden.", true);
      }
    });
    document.getElementById("roleAclMatrixRows")?.addEventListener("change", (e) => {
      const check = e.target.closest("input[type='checkbox'][data-acl-module][data-acl-perm]");
      if (!check) return;
      const moduleId = String(check.getAttribute("data-acl-module") || "");
      const permissionKey = String(check.getAttribute("data-acl-perm") || "");
      updateAclPermission(moduleId, permissionKey, Boolean(check.checked));
    });
    document.getElementById("clubInviteCreateBtn")?.addEventListener("click", () => {
      submitInviteCreate();
    });
    document.getElementById("clubInviteClubSelect")?.addEventListener("change", (e) => {
      state.selectedInviteClubId = String(e.target?.value || "").trim();
      updateInviteClubCodeField();
      setInviteMsg("");
    });

    refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", true));
  });
})();
