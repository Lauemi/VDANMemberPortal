;(() => {
  const FALLBACK_KEY = "vdan_portal_quick_settings_v1";
  const HANDEDNESS_VALUES = new Set(["left", "right", "auto"]);
  const MAX_FAVORITES = 3;
  const DEFAULT_FAVORITES = ["fangliste", "ausweis", "gewaesserkarte"];
  const LABELS = {
    openPortal: "Portal öffnen",
    login: "Login",
    logout: "Logout",
    settings: "Einstellungen",
    terms: "Nutzungsbedingungen",
    notLoggedIn: "Nicht eingeloggt",
    welcome: "Willkommen",
    memberNo: "Mitgliedsnummer",
    createPost: "Post erstellen",
    pin: "Als Favorit markieren",
    unpin: "Favorit entfernen",
    group_member: "Mitglied",
    group_manager: "Vorstand",
    group_admin: "Admin",
  };

  const MODULES = [
    { id: "fangliste", href: "/app/fangliste/", label: "Fangliste", short: "FL", access: "member", group: "member" },
    { id: "arbeitseinsaetze", href: "/app/arbeitseinsaetze/", label: "Arbeitseinsätze", short: "AS", access: "member", group: "member" },
    { id: "ausweis", href: "/app/ausweis/", label: "Mitgliedsausweis", short: "ID", access: "member", group: "member" },
    { id: "gewaesserkarte", href: "/app/gewaesserkarte/", label: "Gewässerkarte", short: "GK", access: "member", group: "member" },
    { id: "zustaendigkeiten", href: "/app/zustaendigkeiten/", label: "Zuständigkeiten", short: "ZU", access: "member", group: "member" },
    { id: "einstellungen", href: "/app/einstellungen/", label: "Einstellungen", short: "ES", access: "member", group: "member" },

    { id: "scanner", href: "/app/ausweis/verifizieren/", label: "Scanner", short: "SC", access: "manager", group: "manager" },
    { id: "as_cockpit", href: "/app/arbeitseinsaetze/cockpit/", label: "Arbeitseinsatz Cockpit", short: "AC", access: "manager", group: "manager" },
    { id: "termine_cockpit", href: "/app/termine/cockpit/", label: "Termine Cockpit", short: "TC", access: "manager", group: "manager" },
    { id: "sitzungen", href: "/app/sitzungen/", label: "Sitzungen", short: "SI", access: "manager", group: "manager" },
    { id: "bewerbungen", href: "/app/bewerbungen/", label: "Bewerbungen", short: "BW", access: "manager", group: "manager" },
    { id: "dokumente", href: "/app/dokumente/", label: "Dokumente", short: "DV", access: "manager", group: "manager" },

    { id: "mitglieder", href: "/app/mitglieder/", label: "Mitglieder", short: "MV", access: "admin", group: "admin" },
    { id: "fangliste_cockpit", href: "/app/fangliste/cockpit/", label: "Fangliste Cockpit", short: "FC", access: "admin", group: "admin" },
  ];

  const GROUP_ORDER = ["member", "manager", "admin"];

  const state = {
    loggedIn: false,
    uid: null,
    profileName: "",
    profileMemberNo: "",
    roles: [],
    visibleModules: [],
    settings: { nav_handedness: "right", portal_favorites: [...DEFAULT_FAVORITES] },
    drawerOpen: false,
    initialized: false,
  };
  let drawerCloseTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function isManager(roles) {
    return roles.includes("admin") || roles.includes("vorstand");
  }

  function canAccess(access, roles) {
    if (access === "admin") return roles.includes("admin");
    if (access === "manager") return isManager(roles);
    return true;
  }

  function normalizePath(path) {
    const p = String(path || "").trim();
    if (!p) return "/";
    return p.endsWith("/") ? p : `${p}/`;
  }

  function moduleForHref(href) {
    const path = normalizePath(new URL(href, window.location.origin).pathname);
    return MODULES.find((m) => normalizePath(m.href) === path) || null;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", hidden);
    el.toggleAttribute("hidden", hidden);
  }

  function accountNameFromSession(s) {
    const user = s?.user || {};
    const meta = user.user_metadata || {};
    const fullFromParts = [meta.first_name, meta.last_name].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
    return String(meta.display_name || meta.full_name || fullFromParts || meta.name || user.email || LABELS.notLoggedIn).trim();
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function accountName() {
    if (state.profileName) return state.profileName;
    return accountNameFromSession(session());
  }

  function presenceInfo() {
    const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    return {
      label: online ? "Online" : "Offline",
      className: online ? "is-online" : "is-offline",
    };
  }

  function initialsFromName(nameRaw) {
    const name = String(nameRaw || "").trim();
    if (!name) return "";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    return String(parts[0].slice(0, 2) || "").toUpperCase();
  }

  function fallbackKeyForUser(userId) {
    return `${FALLBACK_KEY}:${userId || "anon"}`;
  }

  function loadFallback(userId) {
    try {
      return JSON.parse(localStorage.getItem(fallbackKeyForUser(userId)) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveFallback(userId, payload) {
    try {
      localStorage.setItem(fallbackKeyForUser(userId), JSON.stringify(payload || {}));
    } catch {
      // ignore
    }
  }

  function visibleIdSet(visibleModules) {
    return new Set((visibleModules || []).map((m) => m.id));
  }

  function normalizeFavorites(input, visibleModules, options = {}) {
    const withDefaults = Boolean(options.withDefaults);
    const allowed = visibleIdSet(visibleModules);
    const base = Array.isArray(input) ? input : [];
    const cleaned = [];
    base.forEach((idRaw) => {
      const id = String(idRaw || "").trim();
      if (!id || !allowed.has(id) || cleaned.includes(id)) return;
      cleaned.push(id);
    });
    if (!cleaned.length && withDefaults) {
      DEFAULT_FAVORITES.forEach((id) => {
        if (allowed.has(id) && !cleaned.includes(id)) cleaned.push(id);
      });
    }
    return cleaned;
  }

  function orderedVisibleModules() {
    const byGroup = new Map(GROUP_ORDER.map((g) => [g, []]));
    state.visibleModules.forEach((m) => {
      const g = GROUP_ORDER.includes(m.group) ? m.group : "member";
      byGroup.get(g).push(m);
    });
    return GROUP_ORDER.flatMap((g) => byGroup.get(g));
  }

  function mobileFavorites(modules, favorites) {
    const byId = new Map(modules.map((m) => [m.id, m]));
    return favorites.filter((id) => byId.has(id)).slice(0, MAX_FAVORITES);
  }

  function normalizeHandedness(value) {
    const v = String(value || "").toLowerCase();
    return HANDEDNESS_VALUES.has(v) ? v : "right";
  }

  function resolvedSide(handedness) {
    if (handedness === "left" || handedness === "right") return handedness;
    return "right";
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  async function loadRoles() {
    const uid = state.uid;
    if (!uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function loadProfileData() {
    const uid = state.uid;
    if (!uid) return { name: "", memberNo: "" };
    try {
      const rows = await sb(
        `/rest/v1/profiles?select=display_name,first_name,last_name,email,member_no&id=eq.${encodeURIComponent(uid)}&limit=1`,
        { method: "GET" },
        true
      );
      const p = Array.isArray(rows) ? rows[0] : null;
      if (!p) return { name: "", memberNo: "" };
      const byNames = [p.first_name, p.last_name].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
      return {
        name: String(p.display_name || byNames || p.email || "").trim(),
        memberNo: String(p.member_no || "").trim(),
      };
    } catch {
      try {
        const rows = await sb(
          `/rest/v1/profiles?select=display_name,email,member_no&id=eq.${encodeURIComponent(uid)}&limit=1`,
          { method: "GET" },
          true
        );
        const p = Array.isArray(rows) ? rows[0] : null;
        return {
          name: String(p?.display_name || p?.email || "").trim(),
          memberNo: String(p?.member_no || "").trim(),
        };
      } catch {
        return { name: "", memberNo: "" };
      }
    }
  }

  function hasMissingColumnError(err) {
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("column") || msg.includes("portal_favorites") || msg.includes("nav_handedness");
  }

  async function loadSettingsRemote() {
    const uid = state.uid;
    if (!uid) return null;
    const rows = await sb(`/rest/v1/user_settings?select=nav_handedness,portal_favorites&user_id=eq.${encodeURIComponent(uid)}&limit=1`, { method: "GET" }, true);
    if (!Array.isArray(rows) || !rows[0]) return null;
    return rows[0];
  }

  async function saveSettingsRemote(payload) {
    const uid = state.uid;
    if (!uid) return;
    await sb("/rest/v1/user_settings", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ user_id: uid, ...payload }]),
    }, true);
  }

  function currentSettingsPayload() {
    return {
      nav_handedness: normalizeHandedness(state.settings.nav_handedness),
      portal_favorites: normalizeFavorites(state.settings.portal_favorites, state.visibleModules),
    };
  }

  async function persistSettings() {
    const payload = currentSettingsPayload();
    saveFallback(state.uid, payload);
    try {
      await saveSettingsRemote(payload);
    } catch (err) {
      if (!hasMissingColumnError(err)) throw err;
    }
  }

  function renderRail() {
    const rail = document.getElementById("portalRail");
    const root = document.getElementById("portalRailItems");
    if (!rail || !root) return;
    root.innerHTML = "";

    const modules = orderedVisibleModules();
    const favorites = mobileFavorites(modules, normalizeFavorites(state.settings.portal_favorites, modules));

    if (!favorites.length) {
      setHidden(rail, true);
      document.body.classList.remove("portal-fav-open");
      return;
    }

    const byId = new Map(modules.map((m) => [m.id, m]));
    favorites.forEach((id) => {
      const mod = byId.get(id);
      if (!mod) return;
      const a = document.createElement("a");
      a.className = "portal-rail__item";
      a.href = mod.href;
      a.title = mod.label;
      a.textContent = mod.short;
      root.appendChild(a);
    });

    setHidden(rail, false);
    document.body.classList.add("portal-fav-open");
  }

  function groupLabel(group) {
    if (group === "manager") return LABELS.group_manager;
    if (group === "admin") return LABELS.group_admin;
    return LABELS.group_member;
  }

  function renderDrawer() {
    const root = document.getElementById("portalQuickList");
    if (!root) return;
    root.innerHTML = "";

    const account = document.createElement("section");
    account.className = "portal-quick-group";
    const accountLabel = state.loggedIn ? accountName() : LABELS.notLoggedIn;
    const memberNo = String(state.profileMemberNo || "").trim();
    const presence = presenceInfo();
    account.innerHTML = `
      <h3 class="portal-quick-group__title">Konto</h3>
      <div class="portal-quick-group__list">
        <article class="portal-quick-row portal-quick-row--account">
          <div class="portal-quick-row__line">
            <div>
              <p class="portal-quick-row__title">${LABELS.welcome}</p>
              <p class="small portal-quick-account-name">${esc(accountLabel)}</p>
              ${memberNo ? `<p class="small">${LABELS.memberNo}: ${esc(memberNo)}</p>` : ""}
              ${state.loggedIn ? `<p class="small portal-quick-presence"><span class="portal-quick-presence-dot ${presence.className}" aria-hidden="true"></span>${presence.label}</p>` : ""}
              ${state.loggedIn ? `<p class="small"><a class="portal-quick-legal-link" href="/nutzungsbedingungen.html/">${LABELS.terms}</a></p>` : ""}
            </div>
            ${state.loggedIn ? `<a class="portal-quick-settings-link" href="/app/einstellungen/" aria-label="${LABELS.settings}" title="${LABELS.settings}">⚙</a>` : ""}
          </div>
          ${state.loggedIn ? "" : `<div class="portal-quick-row__actions"><a class="feed-btn" href="/login/">${LABELS.login}</a></div>`}
        </article>
      </div>
    `;
    root.appendChild(account);

    const actions = document.createElement("div");
    actions.className = "portal-quick-actions";
    if (state.loggedIn) {
      actions.innerHTML = `<button type="button" class="feed-btn" data-action="create-post">${LABELS.createPost}</button>`;
      root.appendChild(actions);
    }

    const modules = orderedVisibleModules();
    const favorites = new Set(normalizeFavorites(state.settings.portal_favorites, modules));

    GROUP_ORDER.forEach((group) => {
      const items = modules.filter((m) => m.group === group);
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "portal-quick-group";
      section.innerHTML = `<h3 class="portal-quick-group__title">${groupLabel(group)}</h3>`;

      const list = document.createElement("div");
      list.className = "portal-quick-group__list";

      items.forEach((mod) => {
        const fav = favorites.has(mod.id);
        const row = document.createElement("article");
        row.className = "portal-quick-row";
        row.setAttribute("data-open-url", mod.href);
        row.setAttribute("role", "link");
        row.setAttribute("tabindex", "0");
        row.innerHTML = `
          <div class="portal-quick-row__line">
            <p class="portal-quick-row__title">${mod.label}</p>
            <button type="button" class="portal-quick-star ${fav ? "is-active" : ""}" data-action="toggle" data-module-id="${mod.id}" aria-label="${fav ? LABELS.unpin : LABELS.pin}" title="${fav ? LABELS.unpin : LABELS.pin}">${fav ? "★" : "☆"}</button>
          </div>
        `;
        list.appendChild(row);
      });

      section.appendChild(list);
      root.appendChild(section);
    });
  }

  function applySide() {
    const side = resolvedSide(normalizeHandedness(state.settings.nav_handedness));
    document.body.setAttribute("data-portal-rail-side", side);
  }

  function setDrawerOpen(open, options = {}) {
    const immediate = Boolean(options.immediate);
    state.drawerOpen = Boolean(open);
    const drawer = document.getElementById("portalQuickDrawer");
    const toggle = document.getElementById("portalQuickToggle");
    if (drawerCloseTimer) {
      clearTimeout(drawerCloseTimer);
      drawerCloseTimer = null;
    }

    if (!drawer) {
      toggle?.setAttribute("aria-expanded", state.drawerOpen ? "true" : "false");
      document.body.classList.toggle("portal-quick-open", state.drawerOpen);
      return;
    }

    if (state.drawerOpen) {
      setHidden(drawer, false);
      if (immediate) {
        document.body.classList.add("portal-quick-open");
      } else {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!state.drawerOpen) return;
            document.body.classList.add("portal-quick-open");
          });
        });
      }
      toggle?.setAttribute("aria-expanded", "true");
      return;
    }

    document.body.classList.remove("portal-quick-open");
    toggle?.setAttribute("aria-expanded", "false");

    if (immediate) {
      setHidden(drawer, true);
      return;
    }

    drawerCloseTimer = window.setTimeout(() => {
      if (state.drawerOpen) return;
      setHidden(drawer, true);
    }, 260);
  }

  async function toggleFavorite(moduleId) {
    const mod = state.visibleModules.find((m) => m.id === moduleId);
    if (!mod) return;
    const favorites = normalizeFavorites(state.settings.portal_favorites, state.visibleModules);
    const idx = favorites.indexOf(moduleId);
    if (idx >= 0) favorites.splice(idx, 1);
    else {
      if (favorites.length >= MAX_FAVORITES) return;
      favorites.push(moduleId);
    }
    state.settings.portal_favorites = favorites;
    await persistSettings().catch(() => {});
    renderRail();
    renderDrawer();
    enhanceAppTiles();
  }

  function enhanceAppTiles() {
    const path = normalizePath(window.location.pathname);
    if (path !== "/app/") return;
    const favorites = new Set(normalizeFavorites(state.settings.portal_favorites, state.visibleModules));

    document.querySelectorAll(".app-entry").forEach((entry) => {
      const tile = entry.querySelector(".app-tile[href]");
      if (!tile) return;
      const mod = moduleForHref(tile.getAttribute("href"));
      if (!mod) return;
      const allowed = state.visibleModules.some((m) => m.id === mod.id);
      if (!allowed) return;

      tile.classList.add("portal-tile");
      let star = tile.querySelector(`.portal-tile-star[data-module-id="${mod.id}"]`);
      if (!star) {
        star = document.createElement("button");
        star.type = "button";
        star.className = "portal-tile-star";
        star.setAttribute("data-action", "toggle");
        star.setAttribute("data-module-id", mod.id);
        tile.appendChild(star);
      }

      const isFav = favorites.has(mod.id);
      star.textContent = isFav ? "★" : "☆";
      star.classList.toggle("is-active", isFav);
      star.setAttribute("aria-label", isFav ? LABELS.unpin : LABELS.pin);
      star.setAttribute("title", isFav ? LABELS.unpin : LABELS.pin);
    });

    document.querySelectorAll(".portal-fav-toggle").forEach((n) => n.remove());
  }

  function bindEvents() {
    if (state.initialized) return;
    state.initialized = true;

    document.addEventListener("click", (e) => {
      const openBtn = e.target.closest("#portalQuickToggle");
      if (openBtn) {
        if (!state.loggedIn) {
          window.location.assign("/login/");
          return;
        }
        setDrawerOpen(!state.drawerOpen);
        return;
      }

      const closeBtn = e.target.closest("#portalQuickClose");
      if (closeBtn) {
        setDrawerOpen(false);
        return;
      }

      const drawer = document.getElementById("portalQuickDrawer");
      const panel = document.getElementById("portalQuickPanel");
      if (drawer && panel && drawer.contains(e.target) && !panel.contains(e.target)) {
        setDrawerOpen(false);
        return;
      }

      const actionBtn = e.target.closest("[data-action='toggle'][data-module-id]");
      if (actionBtn) {
        e.preventDefault();
        e.stopPropagation();
        const moduleId = String(actionBtn.getAttribute("data-module-id") || "");
        if (!moduleId) return;
        toggleFavorite(moduleId).catch(() => {});
        return;
      }

      const createPostBtn = e.target.closest("[data-action='create-post']");
      if (createPostBtn) {
        setDrawerOpen(false, { immediate: true });
        const path = normalizePath(window.location.pathname);
        if (path === "/" || path === "/vdan-jugend.html/") {
          document.dispatchEvent(new CustomEvent("vdan:open-post-composer"));
          return;
        }
        try {
          sessionStorage.setItem("vdan_open_post_composer", "1");
        } catch {
          // ignore
        }
        window.location.assign("/?compose=1");
        return;
      }

      const logoutBtn = e.target.closest("[data-action='logout']");
      if (logoutBtn) {
        setDrawerOpen(false, { immediate: true });
        window.VDAN_AUTH?.logout?.()
          .catch(() => {})
          .finally(() => {
            document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: false } }));
            window.location.assign("/");
          });
        return;
      }

      const openRow = e.target.closest("[data-open-url]");
      if (openRow) {
        const href = String(openRow.getAttribute("data-open-url") || "").trim();
        if (!href) return;
        setDrawerOpen(false, { immediate: true });
        window.location.assign(href);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (e.key !== "Enter" && e.key !== " ") return;
      const openRow = e.target.closest?.("[data-open-url]");
      if (!openRow) return;
      e.preventDefault();
      const href = String(openRow.getAttribute("data-open-url") || "").trim();
      if (!href) return;
      setDrawerOpen(false, { immediate: true });
      window.location.assign(href);
    });

    document.addEventListener("touchstart", (e) => {
      if (!state.drawerOpen) return;
      const t = e.changedTouches?.[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!state.drawerOpen) return;
      const drawer = document.getElementById("portalQuickDrawer");
      const panel = document.getElementById("portalQuickPanel");
      const target = e.target;
      if (!drawer || !panel || !(target instanceof Node) || !drawer.contains(target)) return;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = Math.abs(t.clientX - touchStartX);
      const dy = Math.abs(t.clientY - touchStartY);
      const inPanel = panel.contains(target);

      // Block edge/back-forward swipe while drawer is open.
      if (!inPanel || dx > dy) {
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener("resize", () => {
      if (normalizeHandedness(state.settings.nav_handedness) === "auto") applySide();
      renderRail();
    });
    window.addEventListener("online", () => {
      if (state.loggedIn) renderDrawer();
    });
    window.addEventListener("offline", () => {
      if (state.loggedIn) renderDrawer();
    });

    window.addEventListener("pagehide", () => {
      setDrawerOpen(false, { immediate: true });
      document.body.classList.remove("portal-fav-open");
    });
  }

  async function init() {
    bindEvents();
    const s = session();
    state.loggedIn = Boolean(s);
    state.uid = s?.user?.id || null;
    state.profileName = "";
    state.profileMemberNo = "";

    const toggle = document.getElementById("portalQuickToggle");
    const rail = document.getElementById("portalRail");
    const badge = document.getElementById("portalQuickUserBadge");
    if (!state.loggedIn) {
      setHidden(toggle, false);
      setHidden(rail, true);
      setHidden(badge, true);
      if (badge) badge.textContent = "";
      document.body.classList.remove("portal-fav-open");
      setDrawerOpen(false, { immediate: true });
      renderDrawer();
      toggle?.setAttribute("aria-label", LABELS.login);
      toggle?.setAttribute("aria-expanded", "false");
      document.body.classList.add("portal-quick-ready");
      return;
    }

    state.roles = await loadRoles().catch(() => []);
    const profile = await loadProfileData().catch(() => ({ name: "", memberNo: "" }));
    state.profileName = String(profile?.name || "").trim();
    state.profileMemberNo = String(profile?.memberNo || "").trim();
    state.visibleModules = MODULES.filter((m) => canAccess(m.access, state.roles));

    const fallback = loadFallback(state.uid);
    let remote = null;
    try {
      remote = await loadSettingsRemote();
    } catch (err) {
      if (!hasMissingColumnError(err)) {
        // ignore transient network/db errors
      }
    }

    const rawFavorites = remote?.portal_favorites ?? fallback?.portal_favorites;
    const shouldUseDefaultFavorites =
      rawFavorites === undefined ||
      (Array.isArray(rawFavorites) && rawFavorites.length === 0 && fallback?.portal_favorites === undefined);
    state.settings = {
      nav_handedness: normalizeHandedness(remote?.nav_handedness ?? fallback?.nav_handedness ?? "right"),
      portal_favorites: normalizeFavorites(rawFavorites, state.visibleModules, { withDefaults: shouldUseDefaultFavorites }),
    };

    applySide();
    renderRail();
    renderDrawer();
    enhanceAppTiles();

    setHidden(toggle, false);
    setDrawerOpen(false, { immediate: true });
    toggle?.setAttribute("aria-label", LABELS.openPortal);
    toggle?.setAttribute("aria-expanded", "false");
    const initials = initialsFromName(accountName());
    if (badge) {
      badge.textContent = initials;
      setHidden(badge, !initials);
    }
    document.body.classList.add("portal-quick-ready");
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  document.addEventListener("vdan:portal-settings", (e) => {
    const handed = normalizeHandedness(e?.detail?.nav_handedness || state.settings.nav_handedness);
    state.settings.nav_handedness = handed;
    applySide();
  });
})();
