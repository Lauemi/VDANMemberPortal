;(() => {
  const ROLE_MATRIX_STORAGE_KEY = "vdan_role_page_matrix_v1";
  const ROLE_KEYS = ["guest", "member", "manager", "admin", "superadmin"];
  const PAGE_INDEX = [
    { route: "/app/", kind: "PORTAL", label: "App Start" },
    { route: "/app/admin-panel/", kind: "PORTAL", label: "Admin Board" },
    { route: "/app/arbeitseinsaetze/", kind: "PORTAL", label: "Arbeitseinsätze" },
    { route: "/app/arbeitseinsaetze/cockpit", kind: "PORTAL", label: "Arbeitseinsätze Cockpit" },
    { route: "/app/ausweis/", kind: "PORTAL", label: "Ausweis" },
    { route: "/app/ausweis/verifizieren", kind: "PORTAL", label: "Ausweis Verifizieren" },
    { route: "/app/bewerbungen/", kind: "PORTAL", label: "Bewerbungen" },
    { route: "/app/component-library/", kind: "PORTAL", label: "Component Library" },
    { route: "/app/dokumente/", kind: "PORTAL", label: "Dokumente" },
    { route: "/app/einstellungen/", kind: "PORTAL", label: "Einstellungen" },
    { route: "/app/fangliste/", kind: "PORTAL", label: "Fangliste" },
    { route: "/app/fangliste/cockpit", kind: "PORTAL", label: "Fangliste Cockpit" },
    { route: "/app/gewaesserkarte/", kind: "PORTAL", label: "Gewässerkarte" },
    { route: "/app/mitglieder/", kind: "PORTAL", label: "Mitglieder" },
    { route: "/app/mitgliederverwaltung/", kind: "PORTAL", label: "Mitgliederverwaltung" },
    { route: "/app/notes/", kind: "PORTAL", label: "Notes" },
    { route: "/app/passwort-aendern/", kind: "PORTAL", label: "Passwort ändern" },
    { route: "/app/sitzungen/", kind: "PORTAL", label: "Sitzungen" },
    { route: "/app/template-studio/", kind: "PORTAL", label: "Template Studio" },
    { route: "/app/termine/cockpit", kind: "PORTAL", label: "Termine Cockpit" },
    { route: "/app/ui-neumorph-demo/", kind: "PORTAL", label: "UI Neumorph Demo" },
    { route: "/app/vereine/", kind: "PORTAL", label: "Vereine" },
    { route: "/app/zustaendigkeiten/", kind: "PORTAL", label: "Zuständigkeiten" },
    { route: "/", kind: "WEB", label: "Startseite" },
    { route: "/anglerheim-ottenheim", kind: "WEB", label: "Anglerheim Ottenheim" },
    { route: "/datenschutz", kind: "WEB", label: "Datenschutz" },
    { route: "/docs", kind: "WEB", label: "Docs" },
    { route: "/downloads", kind: "WEB", label: "Downloads" },
    { route: "/fischereipruefung", kind: "WEB", label: "Fischereiprüfung" },
    { route: "/impressum", kind: "WEB", label: "Impressum" },
    { route: "/kontakt", kind: "WEB", label: "Kontakt" },
    { route: "/login", kind: "WEB", label: "Login" },
    { route: "/mitglied-werden", kind: "WEB", label: "Mitglied werden" },
    { route: "/nutzungsbedingungen", kind: "WEB", label: "Nutzungsbedingungen" },
    { route: "/offline", kind: "WEB", label: "Offline" },
    { route: "/passwort-vergessen", kind: "WEB", label: "Passwort vergessen" },
    { route: "/registrieren", kind: "WEB", label: "Registrieren" },
    { route: "/termine", kind: "WEB", label: "Termine" },
    { route: "/vdan-jugend", kind: "WEB", label: "VDAN Jugend" },
    { route: "/veranstaltungen", kind: "WEB", label: "Veranstaltungen" },
    { route: "/vereinsshop", kind: "WEB", label: "Vereinsshop" },
  ];

  const state = {
    clubs: [],
    memberships: [],
    users: [],
    membersFiltered: [],
    loginSignalAvailable: false,
    sources: [],
    diagnostics: [],
  };
  let rolePageMatrix = {};

  function cfg() {
    const body = document.body;
    const bodyUrl = String(body?.getAttribute("data-supabase-url") || "").trim();
    const bodyKey = String(body?.getAttribute("data-supabase-key") || "").trim();
    return {
      url: String(window.__APP_SUPABASE_URL || bodyUrl).trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || bodyKey).trim(),
      superadmins: String(document.body?.getAttribute("data-superadmin-user-ids") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };
  }

  function hasRuntimeConfig() {
    const { url, key } = cfg();
    if (!url || !key) return false;
    if (/YOUR-|YOUR_|example/i.test(url)) return false;
    if (/YOUR-|YOUR_|example/i.test(key)) return false;
    if (!/^https?:\/\//i.test(url)) return false;
    return true;
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function waitForAuthReady(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.VDAN_AUTH?.loadSession) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return Boolean(window.VDAN_AUTH?.loadSession);
  }

  function setMsg(text = "", isError = false) {
    const el = document.getElementById("adminBoardMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "var(--danger)" : "";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function roleMatrixDefaultFor(route, kind) {
    const r = String(route || "");
    if (kind === "WEB") return { guest: true, member: true, manager: true, admin: true, superadmin: true };
    if (r === "/app/") return { guest: false, member: true, manager: true, admin: true, superadmin: true };
    if (/\/app\/(component-library|template-studio|admin-panel|vereine)\//.test(r)) return { guest: false, member: false, manager: false, admin: false, superadmin: true };
    if (/\/app\/(mitglieder|dokumente|fangliste\/cockpit)/.test(r)) return { guest: false, member: false, manager: true, admin: true, superadmin: true };
    if (/\/cockpit/.test(r)) return { guest: false, member: false, manager: true, admin: true, superadmin: true };
    return { guest: false, member: true, manager: true, admin: true, superadmin: true };
  }

  function buildDefaultRoleMatrix() {
    const out = {};
    PAGE_INDEX.forEach((page) => {
      out[page.route] = roleMatrixDefaultFor(page.route, page.kind);
    });
    return out;
  }

  function loadRoleMatrix() {
    const fallback = buildDefaultRoleMatrix();
    try {
      const raw = localStorage.getItem(ROLE_MATRIX_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return fallback;
      PAGE_INDEX.forEach((page) => {
        const row = parsed[page.route];
        if (!row || typeof row !== "object") {
          parsed[page.route] = fallback[page.route];
          return;
        }
        ROLE_KEYS.forEach((role) => {
          parsed[page.route][role] = Boolean(row[role]);
        });
      });
      return parsed;
    } catch {
      return fallback;
    }
  }

  function saveRoleMatrix() {
    try {
      localStorage.setItem(ROLE_MATRIX_STORAGE_KEY, JSON.stringify(rolePageMatrix));
      return true;
    } catch {
      return false;
    }
  }

  function roleMatrixAsJson(kind) {
    const pages = PAGE_INDEX.filter((page) => page.kind === kind).reduce((acc, page) => {
      acc[page.route] = rolePageMatrix[page.route] || roleMatrixDefaultFor(page.route, page.kind);
      return acc;
    }, {});
    return JSON.stringify(
      {
        version: "1.0",
        kind,
        generated_at: new Date().toISOString(),
        pages,
      },
      null,
      2,
    );
  }

  async function copyText(button, text, okText) {
    const payload = String(text || "");
    if (!payload) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        window.prompt("JSON kopieren:", payload);
      }
    } catch {
      window.prompt("JSON kopieren:", payload);
    }
    if (!(button instanceof HTMLButtonElement)) return;
    const prev = button.textContent;
    button.textContent = okText;
    window.setTimeout(() => {
      button.textContent = prev || "Kopieren";
    }, 900);
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
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.message || data?.hint || `request_failed_${res.status}`);
      err.status = res.status;
      err.path = path;
      throw err;
    }
    return res.json().catch(() => []);
  }

  function recordDiag(source, err) {
    const status = Number(err?.status || 0) || 0;
    const code = status ? `HTTP ${status}` : "ERR";
    const msg = String(err?.message || "request_failed");
    const path = String(err?.path || "");
    state.diagnostics.push(`${source}: ${code}${path ? ` ${path}` : ""} (${msg})`);
  }

  function normalizeDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-DE");
  }

  function userName(row) {
    const name = String(row.display_name || "").trim();
    if (name) return name;
    return String(row.email || row.id || "-");
  }

  function userLastLogin(user) {
    return user.last_login_at || user.last_seen_at || user.last_sign_in_at || null;
  }

  function pushSource(label) {
    if (!label) return;
    if (!state.sources.includes(label)) state.sources.push(label);
  }

  function normalizeMemberNo(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeClubId(value) {
    return String(value || "").trim();
  }

  function syntheticClubId(code, name) {
    const byCode = String(code || "").trim().toUpperCase();
    if (byCode) return `club-code:${byCode}`;
    const byName = String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (byName) return `club-name:${byName}`;
    return `club-unknown:${Math.random().toString(36).slice(2, 10)}`;
  }

  function dedupeMemberships(rows) {
    const seen = new Set();
    const out = [];
    rows.forEach((row) => {
      const userId = String(row?.user_id || "").trim();
      const clubId = normalizeClubId(row?.club_id);
      if (!userId || !clubId) return;
      const key = `${userId}::${clubId}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        user_id: userId,
        club_id: clubId,
        status: String(row?.status || "active").toLowerCase(),
        updated_at: row?.updated_at || row?.created_at || null,
      });
    });
    return out;
  }

  async function loadProfiles() {
    let rows = [];
    try {
      rows = await sb("/rest/v1/profiles?select=*&order=created_at.desc", { method: "GET" }, true);
    } catch (err) {
      recordDiag("profiles", err);
      rows = [];
    }

    const hasAnyLoginField = rows.some((r) =>
      Object.prototype.hasOwnProperty.call(r || {}, "last_login_at")
      || Object.prototype.hasOwnProperty.call(r || {}, "last_seen_at")
      || Object.prototype.hasOwnProperty.call(r || {}, "last_sign_in_at")
    );
    state.loginSignalAvailable = hasAnyLoginField;
    pushSource("profiles");
    return rows;
  }

  async function loadAuthLastSignins() {
    let rows = null;
    try {
      rows = await sb("/rest/v1/rpc/admin_user_last_signins", { method: "POST", body: "{}" }, true);
    } catch (err) {
      recordDiag("admin_user_last_signins", err);
      rows = null;
    }
    if (Array.isArray(rows)) pushSource("admin_user_last_signins");
    return Array.isArray(rows) ? rows : null;
  }

  async function loadClubsAndMembershipsFallback(profiles) {
    let clubRows = [];
    try {
      clubRows = await sb("/rest/v1/club_members?select=*", { method: "GET" }, true);
    } catch (err) {
      recordDiag("club_members", err);
      clubRows = [];
    }
    if (Array.isArray(clubRows) && clubRows.length) pushSource("club_members");
    let roleRows = [];
    try {
      roleRows = await sb("/rest/v1/user_roles?select=user_id,club_id,role,created_at", { method: "GET" }, true);
    } catch (err) {
      recordDiag("user_roles", err);
      roleRows = [];
    }
    if (Array.isArray(roleRows) && roleRows.length) pushSource("user_roles");

    const clubMap = new Map();

    (Array.isArray(clubRows) ? clubRows : []).forEach((row) => {
      const id = normalizeClubId(row?.club_id) || syntheticClubId(row?.club_code, row?.club_name);
      const existing = clubMap.get(id) || {};
      clubMap.set(id, {
        id,
        name: String(existing.name || row?.club_name || row?.club_code || `Club ${id.slice(0, 8)}`),
        status: String(existing.status || "active"),
        created_at: existing.created_at || row?.created_at || null,
      });
    });

    profiles.forEach((profile) => {
      const clubId = normalizeClubId(profile?.club_id);
      if (!clubId) return;
      if (!clubMap.has(clubId)) {
        clubMap.set(clubId, {
          id: clubId,
          name: `Club ${clubId.slice(0, 8)}`,
          status: "active",
          created_at: null,
        });
      }
    });

    (Array.isArray(roleRows) ? roleRows : []).forEach((row) => {
      const clubId = normalizeClubId(row?.club_id);
      if (!clubId) return;
      if (!clubMap.has(clubId)) {
        clubMap.set(clubId, {
          id: clubId,
          name: `Club ${clubId.slice(0, 8)}`,
          status: "active",
          created_at: row?.created_at || null,
        });
      }
    });

    if (!clubMap.size) {
      clubMap.set("legacy-single-club", {
        id: "legacy-single-club",
        name: "Standard Club",
        status: "active",
        created_at: null,
      });
    }

    const profileByMemberNo = new Map();
    profiles.forEach((profile) => {
      const m = normalizeMemberNo(profile?.member_no);
      if (!m) return;
      if (!profileByMemberNo.has(m)) profileByMemberNo.set(m, String(profile.id));
    });

    const membershipRows = [];
    (Array.isArray(clubRows) ? clubRows : []).forEach((row) => {
      const clubId = normalizeClubId(row?.club_id)
        || syntheticClubId(row?.club_code, row?.club_name)
        || "legacy-single-club";
      const memberNo = normalizeMemberNo(row?.member_no);
      const userId = memberNo ? profileByMemberNo.get(memberNo) : "";
      if (!clubId || !userId) return;
      membershipRows.push({
        user_id: userId,
        club_id: clubId,
        status: row?.status || "active",
        updated_at: row?.updated_at || row?.created_at || null,
      });
    });

    profiles.forEach((profile) => {
      const clubId = normalizeClubId(profile?.club_id) || "legacy-single-club";
      if (!clubId) return;
      membershipRows.push({
        user_id: String(profile.id),
        club_id: clubId,
        status: "active",
        updated_at: profile?.created_at || null,
      });
    });

    (Array.isArray(roleRows) ? roleRows : []).forEach((row) => {
      const clubId = normalizeClubId(row?.club_id);
      const userId = String(row?.user_id || "").trim();
      if (!clubId || !userId) return;
      membershipRows.push({
        user_id: userId,
        club_id: clubId,
        status: "active",
        updated_at: row?.created_at || null,
      });
    });

    return {
      clubs: [...clubMap.values()],
      memberships: dedupeMemberships(membershipRows),
    };
  }

  function switchSection(section) {
    document.querySelectorAll(".admin-nav-btn").forEach((btn) => btn.classList.toggle("is-active", btn.getAttribute("data-admin-section") === section));
    document.querySelectorAll(".admin-section").forEach((panel) => panel.classList.toggle("is-active", panel.getAttribute("data-admin-panel") === section));
  }

  function renderModulesTables() {
    const moduleBody = document.querySelector("#adminModulesTable tbody");
    const webBody = document.querySelector("#adminWebModulesTable tbody");
    const renderRows = (kind) =>
      PAGE_INDEX.filter((page) => page.kind === kind)
        .map((page) => {
          const row = rolePageMatrix[page.route] || roleMatrixDefaultFor(page.route, page.kind);
          const cells = ROLE_KEYS.map((role) => {
            const checked = row[role] ? "checked" : "";
            return `<td><input type="checkbox" data-role-matrix-route="${esc(page.route)}" data-role-matrix-role="${role}" ${checked} /></td>`;
          }).join("");
          return `
            <tr>
              <td>${esc(page.label)}</td>
              <td><code>${esc(page.route)}</code></td>
              <td>${esc(page.kind)}</td>
              ${cells}
              <td><a class="feed-btn feed-btn--ghost" href="${esc(page.route)}">Öffnen</a></td>
            </tr>
          `;
        })
        .join("");

    if (moduleBody) {
      moduleBody.innerHTML = renderRows("PORTAL");
    }
    if (webBody) {
      webBody.innerHTML = renderRows("WEB");
    }
  }

  function computeClubMetrics() {
    const byClub = new Map();
    state.clubs.forEach((club) => {
      byClub.set(String(club.id), {
        ...club,
        members: 0,
        activeMembers: 0,
        neverLoggedIn: 0,
        lastActivity: null,
      });
    });

    const usersById = new Map(state.users.map((u) => [String(u.id), u]));
    state.memberships.forEach((m) => {
      const club = byClub.get(String(m.club_id));
      if (!club) return;
      club.members += 1;
      const u = usersById.get(String(m.user_id));
      const lastLogin = userLastLogin(u || {});
      if (lastLogin) club.activeMembers += 1;
      else club.neverLoggedIn += 1;
      const ts = lastLogin || m.updated_at || null;
      if (ts && (!club.lastActivity || new Date(ts).getTime() > new Date(club.lastActivity).getTime())) club.lastActivity = ts;
    });

    return [...byClub.values()].sort((a, b) => b.members - a.members);
  }

  function computeUserMetrics() {
    const clubCountByUser = new Map();
    state.memberships.forEach((m) => {
      const key = String(m.user_id);
      clubCountByUser.set(key, (clubCountByUser.get(key) || 0) + 1);
    });

    return state.users
      .map((u) => {
        const count = clubCountByUser.get(String(u.id)) || 0;
        const lastLogin = userLastLogin(u);
        return {
          ...u,
          clubCount: count,
          neverLoggedIn: !lastLogin,
          lastLogin,
          status: count > 0 ? "active" : "pending",
        };
      })
      .sort((a, b) => {
        const at = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bt = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return bt - at;
      });
  }

  function renderDashboard(clubsRows, userRows) {
    const kpiClubs = document.getElementById("kpiClubs");
    const kpiMembersActive = document.getElementById("kpiMembersActive");
    const kpiNeverLogin = document.getElementById("kpiNeverLogin");
    const kpiUsersNoClub = document.getElementById("kpiUsersNoClub");
    const kpiUsersWithClub = document.getElementById("kpiUsersWithClub");

    const usersWithClub = userRows.filter((u) => u.clubCount > 0).length;
    const usersNoClub = userRows.filter((u) => u.clubCount === 0).length;
    const neverLogin = userRows.filter((u) => u.neverLoggedIn).length;
    const active = userRows.filter((u) => !u.neverLoggedIn).length;

    if (kpiClubs) kpiClubs.textContent = String(clubsRows.length);
    if (kpiMembersActive) kpiMembersActive.textContent = state.loginSignalAvailable ? String(active) : "n/a";
    if (kpiNeverLogin) kpiNeverLogin.textContent = state.loginSignalAvailable ? String(neverLogin) : "n/a";
    if (kpiUsersNoClub) kpiUsersNoClub.textContent = String(usersNoClub);
    if (kpiUsersWithClub) kpiUsersWithClub.textContent = String(usersWithClub);

    const clubsBody = document.querySelector("#adminClubsTopTable tbody");
    if (clubsBody) {
      clubsBody.innerHTML = clubsRows.slice(0, 12).map((c) => `
        <tr>
          <td>${esc(c.name || "-")}</td>
          <td class="small">${esc(c.id)}</td>
          <td>${c.members}</td>
          <td>${state.loginSignalAvailable ? c.activeMembers : "n/a"}</td>
          <td>${normalizeDate(c.lastActivity)}</td>
          <td>${esc(c.status || "active")}</td>
        </tr>
      `).join("") || `<tr><td colspan="6" class="small">Keine Daten.</td></tr>`;
    }

    const usersBody = document.querySelector("#adminUsersTopTable tbody");
    if (usersBody) {
      usersBody.innerHTML = userRows.slice(0, 12).map((u) => `
        <tr>
          <td>${esc(userName(u))}</td>
          <td class="small">${esc(u.id)}</td>
          <td>${state.loginSignalAvailable ? normalizeDate(u.lastLogin) : "n/a"}</td>
          <td>${u.clubCount}</td>
          <td>${esc(u.status)}</td>
        </tr>
      `).join("") || `<tr><td colspan="5" class="small">Keine Daten.</td></tr>`;
    }
  }

  function renderClubs(clubsRows) {
    const body = document.querySelector("#adminClubsTable tbody");
    if (!body) return;
    body.innerHTML = clubsRows.map((c) => `
      <tr>
        <td>${esc(c.name || "-")}</td>
        <td class="small">${esc(c.id)}</td>
        <td>${normalizeDate(c.created_at)}</td>
        <td>${c.members}</td>
        <td>${state.loginSignalAvailable ? c.activeMembers : "n/a"}</td>
        <td>${state.loginSignalAvailable ? c.neverLoggedIn : "n/a"}</td>
        <td>${esc(c.status || "active")}</td>
        <td>
          <button type="button" class="feed-btn feed-btn--ghost" disabled>Öffnen</button>
          <button type="button" class="feed-btn feed-btn--ghost" disabled>Bearbeiten</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="8" class="small">Keine Vereine gefunden.</td></tr>`;
  }

  function renderMembers(rows) {
    const body = document.querySelector("#adminMembersTable tbody");
    if (!body) return;
    body.innerHTML = rows.map((u) => `
      <tr>
        <td>${esc(userName(u))}</td>
        <td>${esc(u.email || "-")}</td>
        <td class="small">${esc(u.id)}</td>
        <td>${state.loginSignalAvailable ? normalizeDate(u.lastLogin) : "n/a"}</td>
        <td>${state.loginSignalAvailable ? (u.neverLoggedIn ? "Ja" : "Nein") : "n/a"}</td>
        <td>${u.clubCount}</td>
        <td>${esc(u.status)}</td>
        <td>
          <button type="button" class="feed-btn feed-btn--ghost" disabled>Profil</button>
          <button type="button" class="feed-btn feed-btn--ghost" disabled>Sperren</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="8" class="small">Keine User gefunden.</td></tr>`;
  }

  function applyMemberFilter() {
    const search = String(document.getElementById("adminMemberSearch")?.value || "").trim().toLowerCase();
    const mode = String(document.getElementById("adminMemberFilter")?.value || "all");
    let rows = [...state.membersFiltered];

    if (mode === "no_club") rows = rows.filter((u) => u.clubCount === 0);
    if (mode === "with_club") rows = rows.filter((u) => u.clubCount > 0);
    if (mode === "never_login") rows = rows.filter((u) => u.neverLoggedIn);

    if (search) {
      rows = rows.filter((u) => `${userName(u)} ${u.email || ""} ${u.id}`.toLowerCase().includes(search));
    }
    renderMembers(rows);
  }

  async function loadCoreData() {
    state.sources = [];
    const profiles = await loadProfiles();
    const authRows = await loadAuthLastSignins();

    const authByUser = new Map((authRows || []).map((row) => [String(row.user_id || ""), row]));
    state.users = profiles.map((p) => {
      const auth = authByUser.get(String(p.id)) || {};
      return {
        ...p,
        email: p?.email || auth?.email || "",
        last_sign_in_at: auth?.last_sign_in_at || p?.last_sign_in_at || null,
      };
    });

    const hasAnyLoginSignal = state.users.some((u) => Boolean(userLastLogin(u)));
    if (!hasAnyLoginSignal) state.loginSignalAvailable = false;
    const fallback = await loadClubsAndMembershipsFallback(state.users);
    state.clubs = fallback.clubs;
    state.memberships = fallback.memberships;
  }

  async function loadRoles(uid) {
    let rows = [];
    try {
      rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true);
    } catch (err) {
      recordDiag("user_roles(enforce)", err);
      rows = [];
    }
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function enforceSuperadmin() {
    await waitForAuthReady();
    let s = session();
    if (!s?.user?.id && navigator.onLine && window.VDAN_AUTH?.refreshSession) {
      s = await window.VDAN_AUTH.refreshSession().catch(() => null);
    }
    if (!s?.user?.id) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login/?next=${next}`);
      return false;
    }
    const uid = String(s.user.id);
    const { superadmins } = cfg();
    if (superadmins.length > 0) {
      if (!superadmins.includes(uid)) {
        window.location.replace("/app/?forbidden=1");
        return false;
      }
      return true;
    }
    const roles = await loadRoles(uid);
    if (!roles.includes("admin")) {
      window.location.replace("/app/?forbidden=1");
      return false;
    }
    setMsg("Hinweis: PUBLIC_SUPERADMIN_USER_IDS ist nicht gesetzt. Fallback aktuell auf admin-Rolle.", false);
    return true;
  }

  async function init() {
    state.diagnostics = [];
    rolePageMatrix = loadRoleMatrix();
    renderModulesTables();
    if (!hasRuntimeConfig()) {
      setMsg("Preflight: Supabase Runtime-Config fehlt oder ist Platzhalter. Admin-Board läuft im Readiness-Modus (kein Live-Connect).", true);
      document.querySelectorAll(".admin-card").forEach((card) => card.classList.add("is-missing"));
      return;
    }

    await waitForAuthReady();
    const allowed = await enforceSuperadmin();
    if (!allowed) return;

    document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchSection(String(btn.getAttribute("data-admin-section") || "dashboard")));
    });

    document.getElementById("adminMemberSearch")?.addEventListener("input", applyMemberFilter);
    document.getElementById("adminMemberFilter")?.addEventListener("change", applyMemberFilter);
    document.querySelector("#adminModulesTable tbody")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('input[type="checkbox"][data-role-matrix-route][data-role-matrix-role]')) return;
      const route = String(target.getAttribute("data-role-matrix-route") || "").trim();
      const role = String(target.getAttribute("data-role-matrix-role") || "").trim();
      const page = PAGE_INDEX.find((p) => p.route === route);
      if (!page || !ROLE_KEYS.includes(role)) return;
      if (!rolePageMatrix[route] || typeof rolePageMatrix[route] !== "object") {
        rolePageMatrix[route] = roleMatrixDefaultFor(route, page.kind);
      }
      rolePageMatrix[route][role] = Boolean(target.checked);
      saveRoleMatrix();
    });
    document.querySelector("#adminWebModulesTable tbody")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('input[type="checkbox"][data-role-matrix-route][data-role-matrix-role]')) return;
      const route = String(target.getAttribute("data-role-matrix-route") || "").trim();
      const role = String(target.getAttribute("data-role-matrix-role") || "").trim();
      const page = PAGE_INDEX.find((p) => p.route === route);
      if (!page || !ROLE_KEYS.includes(role)) return;
      if (!rolePageMatrix[route] || typeof rolePageMatrix[route] !== "object") {
        rolePageMatrix[route] = roleMatrixDefaultFor(route, page.kind);
      }
      rolePageMatrix[route][role] = Boolean(target.checked);
      saveRoleMatrix();
    });

    document.getElementById("adminRoleMatrixSavePortal")?.addEventListener("click", async (event) => {
      const ok = saveRoleMatrix();
      await copyText(event.currentTarget, roleMatrixAsJson("PORTAL"), ok ? "Portal gespeichert+kopiert" : "Portal JSON kopiert");
    });
    document.getElementById("adminRoleMatrixSaveWeb")?.addEventListener("click", async (event) => {
      const ok = saveRoleMatrix();
      await copyText(event.currentTarget, roleMatrixAsJson("WEB"), ok ? "Web gespeichert+kopiert" : "Web JSON kopiert");
    });
    document.getElementById("adminRoleMatrixCopyPortal")?.addEventListener("click", async (event) => {
      await copyText(event.currentTarget, roleMatrixAsJson("PORTAL"), "Portal JSON kopiert");
    });
    document.getElementById("adminRoleMatrixCopyWeb")?.addEventListener("click", async (event) => {
      await copyText(event.currentTarget, roleMatrixAsJson("WEB"), "Web JSON kopiert");
    });
    document.getElementById("adminRoleMatrixResetPortal")?.addEventListener("click", () => {
      PAGE_INDEX.filter((page) => page.kind === "PORTAL").forEach((page) => {
        rolePageMatrix[page.route] = roleMatrixDefaultFor(page.route, page.kind);
      });
      saveRoleMatrix();
      renderModulesTables();
    });
    document.getElementById("adminRoleMatrixResetWeb")?.addEventListener("click", () => {
      PAGE_INDEX.filter((page) => page.kind === "WEB").forEach((page) => {
        rolePageMatrix[page.route] = roleMatrixDefaultFor(page.route, page.kind);
      });
      saveRoleMatrix();
      renderModulesTables();
    });

    setMsg("Admin-Board lädt...");
    await loadCoreData();
    if (state.users.length === 0 && state.clubs.length === 0) {
      const diag = state.diagnostics.length ? ` Diagnose: ${state.diagnostics.slice(0, 4).join(" | ")}` : "";
      setMsg("Keine Datensaetze sichtbar. Wahrscheinlich fehlen Select-Policies (RLS) oder Profile/Club-Daten fuer diesen User." + diag, true);
    }
    const clubRows = computeClubMetrics();
    const userRows = computeUserMetrics();
    state.membersFiltered = userRows;
    renderDashboard(clubRows, userRows);
    renderClubs(clubRows);
    applyMemberFilter();

    if (!state.loginSignalAvailable) {
      const sourceLabel = state.sources.length ? ` Quellen: ${state.sources.join(", ")}.` : "";
      const diag = state.diagnostics.length ? ` Diagnose: ${state.diagnostics.slice(0, 3).join(" | ")}` : "";
      setMsg(`Hinweis: Last-Login-Signal nicht verfügbar. KPIs/Spalten wurden als n/a markiert.${sourceLabel}${diag}`, false);
      document.querySelectorAll('[data-admin-panel="dashboard"] .admin-card').forEach((card) => card.classList.add("is-missing"));
    } else {
      const sourceLabel = state.sources.length ? ` Datenquellen: ${state.sources.join(", ")}.` : "";
      const diag = state.diagnostics.length ? ` Warnungen: ${state.diagnostics.slice(0, 3).join(" | ")}` : "";
      setMsg(`Admin-Board bereit.${sourceLabel}${diag}`);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init().catch((err) => setMsg(`Fehler: ${err?.message || err}`, true)), { once: true });
  else init().catch((err) => setMsg(`Fehler: ${err?.message || err}`, true));
})();
