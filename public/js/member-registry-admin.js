;(() => {
  const STORAGE_COLS = "admin:member_registry:cols:v1";
  const STORAGE_SORT = "admin:member_registry:sort:v1";
  const STORAGE_PAGE = "admin:member_registry:page:v1";
  const STORAGE_ACL = "club:registry:acl_stub:v1";
  const ACL_EDITABLE_KEYS = ["write", "update", "delete"];
  const ACL_PERMISSION_KEYS = ["read", "write", "update", "delete"];
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
    sortKey: "member_no",
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
    dialogMode: "edit",
  };

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

  async function callFn(functionName, payload) {
    const { url, key } = cfg();
    const token = session()?.access_token || "";
    if (!url || !key) throw new Error("supabase_config_missing");
    if (!token) throw new Error("login_required");

    const res = await fetch(`${url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      if (res.status === 401) throw new Error("unauthorized");
      if (res.status === 403) throw new Error("forbidden");
      throw new Error(String(data?.error || `${functionName}_failed_${res.status}`));
    }
    return data;
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

  async function loadRoleOnlyRows(baseRows, clubIdentityById) {
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
    try {
      roleRows = await sb("/rest/v1/club_user_roles?select=club_id,user_id,role_key", { method: "GET" }, true);
    } catch {
      roleRows = [];
    }
    try {
      profileRows = await sb("/rest/v1/profiles?select=id,first_name,last_name,member_no", { method: "GET" }, true);
    } catch {
      profileRows = [];
    }
    try {
      signinRows = await sb("/rest/v1/admin_user_last_signins?select=user_id,last_sign_in_at", { method: "GET" }, true);
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
      const roleKey = String(row?.role_key || "").trim().toLowerCase();
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
        status: toRoleOnlyStatusText(),
        fishing_card_type: "-",
        has_login: Boolean(lastSignInAt),
        last_sign_in_at: lastSignInAt,
        profile_user_id: userId,
        street: "",
        zip: "",
        city: "",
        phone: "",
        mobile: "",
        birthdate: null,
        sepa_approved: null,
        iban_last4: "",
        guardian_member_no: "",
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
    if (key === "status" && String(r?.status || "").toLowerCase() === toRoleOnlyStatusText()) {
      return "Ohne Mitgliedsnummer";
    }
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
      <tr ${r.row_kind === "role_only" ? "" : `data-open-member="${esc(rowKey(r))}"`} style="cursor:${r.row_kind === "role_only" ? "default" : "pointer"};">
        ${visible.map((c) => `<td>${cellValue(r, c.key)}</td>`).join("")}
      </tr>
    `).join("");
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
    const aclCount = focusClubId ? Number(state.clubAclCountsById.get(focusClubId) || 0) : 0;
    const membersCount = focusClubId ? Math.max(scopedRows.length, aclCount) : scopedRows.length;

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
        <label><span>Mitgliedsnummer</span><input value="${esc(row.member_no)}" disabled /></label>
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
        <label><span>Mitgliedsnummer (optional)</span><input id="mrCreateMemberNo" placeholder="z. B. VD02-0003" /></label>
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
        <label><span>PLZ</span><input id="mrZip" /></label>
        <label><span>Ort</span><input id="mrCity" /></label>
        <label><span>Tel</span><input id="mrPhone" /></label>
        <label><span>Mobil</span><input id="mrMobile" /></label>
        <label><span>Bezugsperson (Mitglieds-Nr.)</span><input id="mrGuardian" /></label>
        <label><span>SEPA bestätigt</span>
          <select id="mrSepaApproved">
            <option value="true" selected>Ja</option>
            <option value="false">Nein</option>
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
        p_member_no: String(document.getElementById("mrCreateMemberNo")?.value || "").trim().toUpperCase() || null,
        p_first_name: String(document.getElementById("mrFirstName")?.value || "").trim() || null,
        p_last_name: String(document.getElementById("mrLastName")?.value || "").trim() || null,
        p_status: String(document.getElementById("mrStatus")?.value || "").trim() || "active",
        p_fishing_card_type: String(document.getElementById("mrFishingCard")?.value || "").trim() || "-",
        p_street: String(document.getElementById("mrStreet")?.value || "").trim() || null,
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
    const [rows, clubIdentityById, clubAclCountsById] = await Promise.all([
      loadRows(),
      loadClubIdentityMap(),
      loadClubAclCounts(),
    ]);
    const roleOnlyRows = await loadRoleOnlyRows(rows, clubIdentityById);
    state.rows = [...rows, ...roleOnlyRows];
    state.clubIdentityById = clubIdentityById;
    state.clubAclCountsById = clubAclCountsById;
    renderClubOverview();
    renderClubFilter();
    applyFilterSort();
    renderHead();
    renderRows();
    renderStatsAndPager();
    if (roleOnlyRows.length) {
      setMsg(`Mitglieder geladen: ${state.rows.length} (${roleOnlyRows.length} ohne Vereins-Mitgliedsnummer).`);
    } else {
      setMsg(`Mitglieder geladen: ${state.rows.length}`);
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

    document.getElementById("memberRegistryReload")?.addEventListener("click", () => {
      refresh().catch((e) => setMsg(e.message || "Laden fehlgeschlagen", true));
    });
    document.getElementById("memberRegistryCreateBtn")?.addEventListener("click", () => {
      openCreateDialog();
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
