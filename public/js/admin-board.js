;(() => {
  const ROLE_MATRIX_STORAGE_KEY = "vdan_role_page_matrix_v1";
  const ROLE_KEYS = ["guest", "member", "manager", "admin", "superadmin"];
  const MODULE_CATALOG_STORAGE_KEY = "vdan_module_catalog_v1";
  const MODULE_DEFAULT_RIGHTS_STORAGE_KEY = "vdan_module_default_rights_v1";
  const CLUB_MODULE_CONFIG_STORAGE_KEY = "vdan_club_module_config_v1";
  const STATIC_WEB_MATRIX_STORAGE_KEY = "vdan_static_web_matrix_v1";
  const APP_MASK_BRAND_STORAGE_KEY = "vdan_app_mask_brand_matrix_v1";
  const CORE_ROLES = ["member", "vorstand", "admin"];
  const PAGE_INDEX_BASE = [
    { route: "/app/", kind: "PORTAL", label: "App Start" },
    { route: "/app/admin-panel/", kind: "PORTAL", label: "Admin Board" },
    { route: "/app/arbeitseinsaetze/", kind: "PORTAL", label: "Termine / Events" },
    { route: "/app/arbeitseinsaetze/cockpit", kind: "PORTAL", label: "ArbeitseinsÃ¤tze Cockpit" },
    { route: "/app/ausweis/", kind: "PORTAL", label: "Ausweis" },
    { route: "/app/ausweis/verifizieren", kind: "PORTAL", label: "Ausweis Verifizieren" },
    { route: "/app/bewerbungen/", kind: "PORTAL", label: "Bewerbungen" },
    { route: "/app/component-library/", kind: "PORTAL", label: "Component Library" },
    { route: "/app/dokumente/", kind: "PORTAL", label: "Dokumente" },
    { route: "/app/einstellungen/", kind: "PORTAL", label: "Einstellungen" },
    { route: "/app/eventplaner/", kind: "PORTAL", label: "Eventplaner" },
    { route: "/app/eventplaner/mitmachen/", kind: "PORTAL", label: "Eventplaner Mitmachen" },
    { route: "/app/feedback/", kind: "PORTAL", label: "Feedback" },
    { route: "/app/feedback/cockpit", kind: "PORTAL", label: "Feedback Cockpit" },
    { route: "/app/fangliste/", kind: "PORTAL", label: "Fangliste" },
    { route: "/app/fangliste/cockpit", kind: "PORTAL", label: "Fangliste Cockpit" },
    { route: "/app/gewaesserkarte/", kind: "PORTAL", label: "GewÃ¤sserkarte" },
    { route: "/app/kontrollboard/", kind: "PORTAL", label: "Kontrollboard" },
    { route: "/app/lizenzen/", kind: "PORTAL", label: "Wetter & Karten API" },
    { route: "/app/mitglieder/", kind: "PORTAL", label: "Mitglieder" },
    { route: "/app/mitgliederverwaltung/", kind: "PORTAL", label: "Mitgliederverwaltung" },
    { route: "/app/notes/", kind: "PORTAL", label: "Notes" },
    { route: "/app/passwort-aendern/", kind: "PORTAL", label: "Passwort Ã¤ndern" },
    { route: "/app/rechtliches-bestaetigen/", kind: "PORTAL", label: "Rechtliches bestÃ¤tigen" },
    { route: "/app/sitzungen/", kind: "PORTAL", label: "Sitzungen" },
    { route: "/app/template-studio/", kind: "PORTAL", label: "Template Studio" },
    { route: "/app/termine/cockpit", kind: "PORTAL", label: "Termine Cockpit" },
    { route: "/app/ui-neumorph-demo/", kind: "PORTAL", label: "UI Neumorph Demo" },
    { route: "/app/vereine/", kind: "PORTAL", label: "Vereine" },
    { route: "/app/zugang-pruefen/", kind: "PORTAL", label: "Zugang prÃ¼fen" },
    { route: "/app/zustaendigkeiten/", kind: "PORTAL", label: "ZustÃ¤ndigkeiten" },
    { route: "/", kind: "WEB", label: "Startseite" },
    { route: "/anglerheim-ottenheim", kind: "WEB", label: "Anglerheim Ottenheim" },
    { route: "/datenschutz", kind: "WEB", label: "Datenschutz" },
    { route: "/docs", kind: "WEB", label: "Docs" },
    { route: "/downloads", kind: "WEB", label: "Downloads" },
    { route: "/fischereipruefung", kind: "WEB", label: "FischereiprÃ¼fung" },
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

  function siteMode() {
    return String(document.body?.getAttribute("data-site-mode") || window.__APP_SITE_MODE || "").trim().toLowerCase();
  }

  function isLocalDev() {
    const host = String(window.location.hostname || "").trim().toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  }

  const PAGE_INDEX = PAGE_INDEX_BASE.filter((page) => {
    const mode = siteMode();
    if (mode === "fcp" && page.route === "/app/gewaesserkarte/") return false;
    if (mode === "vdan" && (page.route === "/app/lizenzen/" || page.route === "/app/feedback/" || page.route === "/app/feedback/cockpit")) return false;
    return true;
  });

  const state = {
    clubs: [],
    memberships: [],
    clubRoleAssignments: [],
    users: [],
    clubMetrics: [],
    membersFiltered: [],
    loginSignalAvailable: false,
    sources: [],
    diagnostics: [],
    selectedClubId: "",
    moduleCatalog: [],
    moduleDefaultRights: {},
    clubModuleConfig: {},
    governanceHealth: [],
    governanceIssues: [],
    staticWebPages: [],
    staticWebMatrix: {},
    appMaskPages: [],
    appMaskMatrix: {},
    clubRequests: [],
  };
  let rolePageMatrix = {};

  function sanitizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("Ã¤", "ae")
      .replaceAll("Ã¶", "oe")
      .replaceAll("Ã¼", "ue")
      .replaceAll("ÃŸ", "ss")
      .replace(/[^a-z0-9 _-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function rightSet(input = {}) {
    const v = Boolean(input.view);
    return {
      view: v,
      read: v,
      write: v ? Boolean(input.write) : false,
      update: v ? Boolean(input.update) : false,
      delete: v ? Boolean(input.delete) : false,
    };
  }

  function defaultModuleCatalog() {
    return [
      { id: "fishing", label: "Fishing", active: true, usecases: ["fangliste", "go_fishing", "fangliste_cockpit"] },
      { id: "work", label: "ArbeitseinsÃ¤tze", active: true, usecases: ["arbeitseinsaetze", "arbeitseinsaetze_cockpit"] },
      { id: "eventplaner", label: "Eventplaner", active: true, usecases: ["eventplaner", "eventplaner_mitmachen"] },
      { id: "feed", label: "Feed", active: true, usecases: ["feed"] },
      { id: "members", label: "Mitglieder", active: true, usecases: ["mitglieder", "mitglieder_registry"] },
      { id: "documents", label: "Dokumente", active: true, usecases: ["dokumente"] },
      { id: "meetings", label: "Sitzungen", active: true, usecases: ["sitzungen"] },
      { id: "settings", label: "Einstellungen", active: true, usecases: ["einstellungen"] },
    ];
  }

  function normalizeCatalogEntry(raw) {
    const id = sanitizeKey(raw?.id);
    if (!id) return null;
    const label = String(raw?.label || id).trim() || id;
    const active = raw?.active !== false;
    const usecasesRaw = Array.isArray(raw?.usecases) ? raw.usecases : [];
    const usecases = [...new Set(usecasesRaw.map((u) => sanitizeKey(u)).filter(Boolean))];
    return { id, label, active, usecases };
  }

  function normalizeModuleCatalog(input) {
    const base = Array.isArray(input) ? input : defaultModuleCatalog();
    const out = [];
    const seen = new Set();
    base.forEach((entry) => {
      const n = normalizeCatalogEntry(entry);
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      out.push(n);
    });
    return out.length ? out : defaultModuleCatalog();
  }

  function mergeModuleCatalog(...sources) {
    const merged = [];
    sources.forEach((source) => {
      if (!Array.isArray(source)) return;
      source.forEach((entry) => merged.push(entry));
    });
    return normalizeModuleCatalog(merged);
  }

  function loadModuleCatalog() {
    try {
      const raw = JSON.parse(localStorage.getItem(MODULE_CATALOG_STORAGE_KEY) || "null");
      return normalizeModuleCatalog(raw);
    } catch {
      return defaultModuleCatalog();
    }
  }

  function saveModuleCatalog(catalog) {
    try {
      localStorage.setItem(MODULE_CATALOG_STORAGE_KEY, JSON.stringify(normalizeModuleCatalog(catalog)));
      return true;
    } catch {
      return false;
    }
  }

  function allUsecasesWithModule(catalog) {
    const out = [];
    normalizeModuleCatalog(catalog).forEach((m) => {
      m.usecases.forEach((u) => out.push({ moduleId: m.id, moduleLabel: m.label, usecaseId: u }));
    });
    return out;
  }

  function defaultRightsForRoleUsecase(role, usecaseId) {
    const r = String(role || "");
    const uc = String(usecaseId || "");
    if (r === "admin") return rightSet({ view: true, write: true, update: true, delete: true });
    if (r === "vorstand") {
      if (/cockpit/.test(uc)) return rightSet({ view: true, write: true, update: true, delete: false });
      if (uc === "mitglieder_registry") return rightSet({ view: true, write: true, update: true, delete: false });
      return rightSet({ view: true, write: true, update: true, delete: false });
    }
    if (r === "member") {
      if (uc === "eventplaner_mitmachen") return rightSet({ view: true, write: true, update: true, delete: false });
      if (["fangliste", "go_fishing", "arbeitseinsaetze", "feed", "einstellungen"].includes(uc)) return rightSet({ view: true });
      return rightSet({ view: false });
    }
    return rightSet({ view: false });
  }

  function defaultModuleRights(catalog) {
    const out = {};
    const usecases = allUsecasesWithModule(catalog);
    CORE_ROLES.forEach((role) => {
      out[role] = {};
      usecases.forEach((u) => {
        out[role][u.usecaseId] = defaultRightsForRoleUsecase(role, u.usecaseId);
      });
    });
    return out;
  }

  function normalizeModuleRights(input, catalog) {
    const base = defaultModuleRights(catalog);
    const out = {};
    CORE_ROLES.forEach((role) => {
      out[role] = {};
      const source = input?.[role] || {};
      Object.keys(base[role]).forEach((usecaseId) => {
        out[role][usecaseId] = rightSet(source[usecaseId] || base[role][usecaseId]);
      });
    });
    return out;
  }

  function loadModuleRights(catalog) {
    try {
      const raw = JSON.parse(localStorage.getItem(MODULE_DEFAULT_RIGHTS_STORAGE_KEY) || "{}");
      return normalizeModuleRights(raw, catalog);
    } catch {
      return defaultModuleRights(catalog);
    }
  }

  function saveModuleRights(rights, catalog) {
    try {
      localStorage.setItem(MODULE_DEFAULT_RIGHTS_STORAGE_KEY, JSON.stringify(normalizeModuleRights(rights, catalog)));
      return true;
    } catch {
      return false;
    }
  }

  function defaultClubConfigFor(catalog) {
    const cfg = { modules: {} };
    normalizeModuleCatalog(catalog).forEach((m) => {
      cfg.modules[m.id] = {
        enabled: Boolean(m.active),
        usecases: Object.fromEntries(m.usecases.map((u) => [u, true])),
      };
    });
    return cfg;
  }

  function normalizeClubConfig(input, catalog) {
    const base = defaultClubConfigFor(catalog);
    const source = input && typeof input === "object" ? input : {};
    const out = { modules: {} };
    Object.keys(base.modules).forEach((moduleId) => {
      const b = base.modules[moduleId];
      const s = source?.modules?.[moduleId] || {};
      const usecases = {};
      Object.keys(b.usecases).forEach((u) => {
        usecases[u] = Boolean(s?.usecases?.[u] ?? b.usecases[u]);
      });
      out.modules[moduleId] = {
        enabled: Boolean(s.enabled ?? b.enabled),
        usecases,
      };
      if (!out.modules[moduleId].enabled) {
        Object.keys(out.modules[moduleId].usecases).forEach((u) => { out.modules[moduleId].usecases[u] = false; });
      }
    });
    return out;
  }

  function loadAllClubConfigs(catalog) {
    try {
      const raw = JSON.parse(localStorage.getItem(CLUB_MODULE_CONFIG_STORAGE_KEY) || "{}");
      const out = {};
      Object.keys(raw || {}).forEach((clubId) => {
        out[clubId] = normalizeClubConfig(raw[clubId], catalog);
      });
      return out;
    } catch {
      return {};
    }
  }

  function saveAllClubConfigs(configs, catalog) {
    try {
      const payload = {};
      Object.keys(configs || {}).forEach((clubId) => {
        payload[clubId] = normalizeClubConfig(configs[clubId], catalog);
      });
      localStorage.setItem(CLUB_MODULE_CONFIG_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function buildCatalogFromDb(moduleRows, usecaseRows) {
    const moduleMap = new Map();
    (Array.isArray(moduleRows) ? moduleRows : []).forEach((row) => {
      const id = sanitizeKey(row?.module_key);
      if (!id) return;
      moduleMap.set(id, {
        id,
        label: String(row?.label || id),
        active: row?.is_active !== false,
        sort_order: Number(row?.sort_order || 100),
        usecases: [],
      });
    });
    (Array.isArray(usecaseRows) ? usecaseRows : []).forEach((row) => {
      const moduleId = sanitizeKey(row?.module_key);
      const usecaseId = sanitizeKey(row?.usecase_key);
      if (!moduleId || !usecaseId) return;
      if (!moduleMap.has(moduleId)) {
        moduleMap.set(moduleId, {
          id: moduleId,
          label: moduleId,
          active: true,
          sort_order: 100,
          usecases: [],
        });
      }
      if (row?.is_active === false) return;
      const entry = moduleMap.get(moduleId);
      if (!entry.usecases.includes(usecaseId)) entry.usecases.push(usecaseId);
    });
    return [...moduleMap.values()]
      .sort((a, b) => (a.sort_order - b.sort_order) || a.id.localeCompare(b.id))
      .map((row) => ({ id: row.id, label: row.label, active: row.active, usecases: row.usecases }));
  }

  function buildClubConfigMapFromDb(rows, catalog, clubs) {
    const out = {};
    (Array.isArray(clubs) ? clubs : []).forEach((club) => {
      const clubId = String(club?.id || "");
      if (!clubId) return;
      const cfg = defaultClubConfigFor(catalog);
      Object.keys(cfg.modules).forEach((moduleId) => {
        cfg.modules[moduleId].enabled = false;
        Object.keys(cfg.modules[moduleId].usecases).forEach((u) => { cfg.modules[moduleId].usecases[u] = false; });
      });
      out[clubId] = cfg;
    });

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const clubId = String(row?.club_id || "");
      const moduleId = sanitizeKey(row?.module_key);
      const usecaseId = sanitizeKey(row?.usecase_key);
      if (!clubId || !moduleId || !usecaseId) return;
      if (!out[clubId]) out[clubId] = defaultClubConfigFor(catalog);
      if (!out[clubId]?.modules?.[moduleId]) return;
      if (!(usecaseId in out[clubId].modules[moduleId].usecases)) return;
      const enabled = Boolean(row?.is_enabled);
      out[clubId].modules[moduleId].usecases[usecaseId] = enabled;
    });

    Object.keys(out).forEach((clubId) => {
      Object.keys(out[clubId].modules).forEach((moduleId) => {
        const vals = Object.values(out[clubId].modules[moduleId].usecases || {}).map(Boolean);
        out[clubId].modules[moduleId].enabled = vals.some(Boolean);
        if (!out[clubId].modules[moduleId].enabled) {
          Object.keys(out[clubId].modules[moduleId].usecases).forEach((u) => { out[clubId].modules[moduleId].usecases[u] = false; });
        }
      });
      out[clubId] = normalizeClubConfig(out[clubId], catalog);
    });

    return out;
  }

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

  function normalizeStaticWebPages() {
    const host = document.getElementById("adminStaticWebConfig");
    const raw = String(host?.getAttribute("data-static-web-pages") || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function normalizeAppMaskPages() {
    const host = document.getElementById("adminStaticWebConfig");
    const raw = String(host?.getAttribute("data-app-mask-brand-pages") || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function defaultStaticWebMatrix() {
    const out = {};
    normalizeStaticWebPages().forEach((page) => {
      const route = String(page?.route || "").trim();
      if (!route) return;
      out[route] = {
        fcp: {
          visible: Boolean(page?.targets?.fcp?.visible),
          brand: String(page?.targets?.fcp?.brand || "fcp").trim().toLowerCase() === "vdan" ? "vdan" : "fcp",
        },
        vdan: {
          visible: Boolean(page?.targets?.vdan?.visible),
          brand: String(page?.targets?.vdan?.brand || "vdan").trim().toLowerCase() === "fcp" ? "fcp" : "vdan",
        },
      };
    });
    return out;
  }

  function normalizeStaticWebMatrix(input) {
    const fallback = defaultStaticWebMatrix();
    const source = input && typeof input === "object" ? input : {};
    Object.keys(fallback).forEach((route) => {
      const row = source?.[route] || {};
      fallback[route] = {
        fcp: {
          visible: Boolean(row?.fcp?.visible ?? fallback[route].fcp.visible),
          brand: String(row?.fcp?.brand || fallback[route].fcp.brand).trim().toLowerCase() === "vdan" ? "vdan" : "fcp",
        },
        vdan: {
          visible: Boolean(row?.vdan?.visible ?? fallback[route].vdan.visible),
          brand: String(row?.vdan?.brand || fallback[route].vdan.brand).trim().toLowerCase() === "fcp" ? "fcp" : "vdan",
        },
      };
    });
    return fallback;
  }

  function loadStaticWebMatrix() {
    try {
      const raw = JSON.parse(localStorage.getItem(STATIC_WEB_MATRIX_STORAGE_KEY) || "{}");
      return normalizeStaticWebMatrix(raw);
    } catch {
      return defaultStaticWebMatrix();
    }
  }

  function saveStaticWebMatrix() {
    try {
      localStorage.setItem(STATIC_WEB_MATRIX_STORAGE_KEY, JSON.stringify(normalizeStaticWebMatrix(state.staticWebMatrix)));
      return true;
    } catch {
      return false;
    }
  }

  function staticWebMatrixAsJson() {
    return JSON.stringify({
      version: "1.0",
      generated_at: new Date().toISOString(),
      pages: normalizeStaticWebMatrix(state.staticWebMatrix),
    }, null, 2);
  }

  function defaultAppMaskMatrix() {
    const out = {};
    normalizeAppMaskPages().forEach((page) => {
      const route = String(page?.route || "").trim();
      if (!route) return;
      const brand = String(page?.default_brand || "fcp_tactical").trim().toLowerCase();
      out[route] = brand === "vdan_default" || brand === "fcp_brand" ? brand : "fcp_tactical";
    });
    return out;
  }

  function normalizeAppMaskMatrix(input) {
    const fallback = defaultAppMaskMatrix();
    const source = input && typeof input === "object" ? input : {};
    Object.keys(fallback).forEach((route) => {
      const raw = String(source?.[route] || fallback[route]).trim().toLowerCase();
      fallback[route] = raw === "vdan_default" || raw === "fcp_brand" ? raw : "fcp_tactical";
    });
    return fallback;
  }

  function loadAppMaskMatrix() {
    try {
      const raw = JSON.parse(localStorage.getItem(APP_MASK_BRAND_STORAGE_KEY) || "{}");
      return normalizeAppMaskMatrix(raw);
    } catch {
      return defaultAppMaskMatrix();
    }
  }

  function saveAppMaskMatrixLocal() {
    try {
      localStorage.setItem(APP_MASK_BRAND_STORAGE_KEY, JSON.stringify(normalizeAppMaskMatrix(state.appMaskMatrix)));
      return true;
    } catch {
      return false;
    }
  }

  function appMaskMatrixAsJson() {
    return JSON.stringify({
      version: "1.0",
      generated_at: new Date().toISOString(),
      pages: normalizeAppMaskMatrix(state.appMaskMatrix),
    }, null, 2);
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

  async function callAdminWebConfig(action, payload = {}, withAuth = false) {
    if (isLocalDev()) {
      const err = new Error("admin_web_config_local_dev_skip");
      err.status = 0;
      throw err;
    }
    const { url, key } = cfg();
    const headers = new Headers({
      apikey: key,
      "Content-Type": "application/json",
    });
    const token = session()?.access_token;
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}/functions/v1/admin-web-config`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, scope: siteMode(), ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      const err = new Error(String(data?.error || `admin_web_config_failed_${res.status}`));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function loadRemoteAdminWebConfig() {
    if (isLocalDev()) {
      return false;
    }
    try {
      const data = await callAdminWebConfig("get");
      state.staticWebMatrix = normalizeStaticWebMatrix(data?.static_web_matrix || state.staticWebMatrix);
      state.appMaskMatrix = normalizeAppMaskMatrix(data?.app_mask_matrix || state.appMaskMatrix);
      saveStaticWebMatrix();
      saveAppMaskMatrixLocal();
      return true;
    } catch (err) {
      recordDiag("admin_web_config:get", err);
      return false;
    }
  }

  async function saveRemoteAdminWebConfig() {
    const payload = {
      static_web_matrix: normalizeStaticWebMatrix(state.staticWebMatrix),
      app_mask_matrix: normalizeAppMaskMatrix(state.appMaskMatrix),
    };
    if (isLocalDev()) {
      state.staticWebMatrix = normalizeStaticWebMatrix(payload.static_web_matrix);
      state.appMaskMatrix = normalizeAppMaskMatrix(payload.app_mask_matrix);
      saveStaticWebMatrix();
      saveAppMaskMatrixLocal();
      return { ok: true, local_only: true, ...payload };
    }
    const data = await callAdminWebConfig("save", payload, true);
    state.staticWebMatrix = normalizeStaticWebMatrix(data?.static_web_matrix || payload.static_web_matrix);
    state.appMaskMatrix = normalizeAppMaskMatrix(data?.app_mask_matrix || payload.app_mask_matrix);
    saveStaticWebMatrix();
    saveAppMaskMatrixLocal();
    return data;
  }

  async function loadGovernanceFromDb() {
    let moduleRows = [];
    let usecaseRows = [];
    let clubModuleRows = [];
    let rightsRows = [];

    try {
      moduleRows = await sb("/rest/v1/module_catalog?select=module_key,label,is_active,sort_order&order=sort_order.asc,module_key.asc", { method: "GET" }, true);
    } catch (err) {
      recordDiag("module_catalog", err);
      moduleRows = [];
    }
    try {
      usecaseRows = await sb("/rest/v1/module_usecases?select=module_key,usecase_key,is_active,sort_order&order=sort_order.asc,usecase_key.asc", { method: "GET" }, true);
    } catch (err) {
      recordDiag("module_usecases", err);
      usecaseRows = [];
    }
    if (Array.isArray(moduleRows) && moduleRows.length) {
      const catalog = buildCatalogFromDb(moduleRows, usecaseRows);
      if (catalog.length) {
        state.moduleCatalog = mergeModuleCatalog(defaultModuleCatalog(), state.moduleCatalog, catalog);
      }
    }
    state.moduleDefaultRights = normalizeModuleRights(state.moduleDefaultRights, state.moduleCatalog);

    try {
      clubModuleRows = await sb("/rest/v1/club_module_usecases?select=club_id,module_key,usecase_key,is_enabled", { method: "GET" }, true);
    } catch (err) {
      recordDiag("club_module_usecases", err);
      clubModuleRows = [];
    }
    if (Array.isArray(clubModuleRows) && clubModuleRows.length) {
      state.clubModuleConfig = buildClubConfigMapFromDb(clubModuleRows, state.moduleCatalog, state.clubs);
    }

    try {
      rightsRows = await sb("/rest/v1/club_role_permissions?select=club_id,role_key,module_key,can_view,can_write,can_update,can_delete", { method: "GET" }, true);
    } catch (err) {
      recordDiag("club_role_permissions", err);
      rightsRows = [];
    }
    if (Array.isArray(rightsRows) && rightsRows.length) {
      const usecases = new Set(allUsecasesWithModule(state.moduleCatalog).map((u) => u.usecaseId));
      const clubsSorted = [...new Set(rightsRows.map((r) => String(r.club_id || "")).filter(Boolean))].sort();
      const refClubId = clubsSorted[0] || "";
      if (refClubId) {
        CORE_ROLES.forEach((role) => {
          state.moduleDefaultRights[role] = state.moduleDefaultRights[role] || {};
          rightsRows
            .filter((r) => String(r.club_id) === refClubId && String(r.role_key) === role && usecases.has(String(r.module_key || "")))
            .forEach((r) => {
              state.moduleDefaultRights[role][String(r.module_key)] = rightSet({
                view: Boolean(r.can_view),
                write: Boolean(r.can_write),
                update: Boolean(r.can_update),
                delete: Boolean(r.can_delete),
              });
            });
        });
      }
      state.moduleDefaultRights = normalizeModuleRights(state.moduleDefaultRights, state.moduleCatalog);
    }
  }

  async function saveModuleCatalogToDb() {
    const modulesPayload = state.moduleCatalog.map((m, idx) => ({
      module_key: m.id,
      label: m.label,
      is_active: Boolean(m.active),
      sort_order: (idx + 1) * 10,
    }));
    const usecasesPayload = [];
    state.moduleCatalog.forEach((m, midx) => {
      m.usecases.forEach((u, uidx) => {
        usecasesPayload.push({
          module_key: m.id,
          usecase_key: u,
          label: usecaseLabel(u),
          is_active: Boolean(m.active),
          sort_order: ((midx + 1) * 100) + (uidx + 1),
        });
      });
    });

    if (modulesPayload.length) {
      await sb("/rest/v1/module_catalog?on_conflict=module_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(modulesPayload),
      }, true);
    }
    if (usecasesPayload.length) {
      await sb("/rest/v1/module_usecases?on_conflict=module_key,usecase_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(usecasesPayload),
      }, true);
    }
  }

  async function saveClubConfigToDb(clubId, config) {
    const cid = String(clubId || "").trim();
    if (!cid || !config) return;
    const rows = [];
    state.moduleCatalog.forEach((m) => {
      const moduleCfg = config.modules?.[m.id];
      const moduleEnabled = Boolean(moduleCfg?.enabled);
      m.usecases.forEach((u) => {
        const usecaseEnabled = moduleEnabled && Boolean(moduleCfg?.usecases?.[u]);
        rows.push({
          club_id: cid,
          module_key: m.id,
          usecase_key: u,
          is_enabled: usecaseEnabled,
        });
      });
    });
    if (!rows.length) return;
    await sb("/rest/v1/club_module_usecases?on_conflict=club_id,module_key,usecase_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    }, true);
  }

  async function saveRoleDefaultsToDb(role) {
    const roleKey = String(role || "");
    if (!CORE_ROLES.includes(roleKey)) return;
    const usecases = allUsecasesWithModule(state.moduleCatalog).map((u) => u.usecaseId);
    if (!usecases.length) return;
    const clubIds = [...new Set(state.clubs.map((c) => String(c.id || "")).filter(Boolean))];
    const rows = [];
    clubIds.forEach((clubId) => {
      usecases.forEach((usecase) => {
        const rights = rightSet(state.moduleDefaultRights?.[roleKey]?.[usecase] || { view: false });
        rows.push({
          club_id: clubId,
          role_key: roleKey,
          module_key: usecase,
          can_view: rights.view,
          can_read: rights.read,
          can_write: rights.write,
          can_update: rights.update,
          can_delete: rights.delete,
        });
      });
    });
    if (!rows.length) return;
    await sb("/rest/v1/club_role_permissions?on_conflict=club_id,role_key,module_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    }, true);
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

  function clubDisplayName(club) {
    const code = String(club?.code || "").trim();
    const name = String(club?.name || "").trim();
    if (code && name && code !== name) return `${code} Â· ${name}`;
    if (code) return code;
    if (name && !/^club\s+[0-9a-f]{6,}$/i.test(name)) return name;
    return "Unbenannter Verein";
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
    let aclRoleRows = [];
    try {
      aclRoleRows = await sb("/rest/v1/club_user_roles?select=user_id,club_id,role_key,created_at", { method: "GET" }, true);
    } catch (err) {
      recordDiag("club_user_roles", err);
      aclRoleRows = [];
    }
    if (Array.isArray(aclRoleRows) && aclRoleRows.length) pushSource("club_user_roles");

    const clubMap = new Map();

    (Array.isArray(clubRows) ? clubRows : []).forEach((row) => {
      const id = normalizeClubId(row?.club_id) || syntheticClubId(row?.club_code, row?.club_name);
      const existing = clubMap.get(id) || {};
      clubMap.set(id, {
        id,
        code: String(existing.code || row?.club_code || ""),
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
          code: "",
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
          code: "",
          name: `Club ${clubId.slice(0, 8)}`,
          status: "active",
          created_at: row?.created_at || null,
        });
      }
    });
    (Array.isArray(aclRoleRows) ? aclRoleRows : []).forEach((row) => {
      const clubId = normalizeClubId(row?.club_id);
      if (!clubId) return;
      if (!clubMap.has(clubId)) {
        clubMap.set(clubId, {
          id: clubId,
          code: "",
          name: `Club ${clubId.slice(0, 8)}`,
          status: "active",
          created_at: row?.created_at || null,
        });
      }
    });

    if (!clubMap.size) {
      clubMap.set("legacy-single-club", {
        id: "legacy-single-club",
        code: "",
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
    (Array.isArray(aclRoleRows) ? aclRoleRows : []).forEach((row) => {
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

    const roleAssignments = [];
    (Array.isArray(roleRows) ? roleRows : []).forEach((row) => {
      const clubId = normalizeClubId(row?.club_id);
      const userId = String(row?.user_id || "").trim();
      const role = String(row?.role || "").trim().toLowerCase();
      if (!clubId || !userId || !role) return;
      roleAssignments.push({ user_id: userId, club_id: clubId, role_key: role, created_at: row?.created_at || null });
    });
    (Array.isArray(aclRoleRows) ? aclRoleRows : []).forEach((row) => {
      const clubId = normalizeClubId(row?.club_id);
      const userId = String(row?.user_id || "").trim();
      const role = String(row?.role_key || "").trim().toLowerCase();
      if (!clubId || !userId || !role) return;
      roleAssignments.push({ user_id: userId, club_id: clubId, role_key: role, created_at: row?.created_at || null });
    });
    const seenAssignments = new Set();
    const dedupAssignments = roleAssignments.filter((row) => {
      const key = `${row.user_id}::${row.club_id}::${row.role_key}`;
      if (seenAssignments.has(key)) return false;
      seenAssignments.add(key);
      return true;
    });

    return {
      clubs: [...clubMap.values()],
      memberships: dedupeMemberships(membershipRows),
      roleAssignments: dedupAssignments,
    };
  }

  async function loadClubIdentitiesFromSettings() {
    const byClubId = new Map();
    let rows = [];
    try {
      rows = await sb("/rest/v1/rpc/get_club_identity_map", { method: "POST", body: "{}" }, true);
    } catch (err) {
      recordDiag("rpc.get_club_identity_map", err);
      rows = [];
    }

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const clubId = String(row?.club_id || "").trim();
      const code = String(row?.club_code || "").trim().toUpperCase();
      const name = String(row?.club_name || "").trim();
      if (!clubId) return;
      if (!byClubId.has(clubId)) byClubId.set(clubId, {});
      const entry = byClubId.get(clubId);
      if (code) entry.code = code;
      if (name) entry.name = name;
    });
    return byClubId;
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
              <td><a class="feed-btn feed-btn--ghost" href="${esc(page.route)}">Ã–ffnen</a></td>
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

  function renderStaticWebTables() {
    const targets = ["fcp", "vdan"];
    targets.forEach((target) => {
      const body = document.querySelector(`#adminStaticPages${target === "fcp" ? "Fcp" : "Vdan"}Table tbody`);
      if (!body) return;
      body.innerHTML = state.staticWebPages.map((page) => {
        const route = String(page?.route || "").trim();
        const row = state.staticWebMatrix?.[route]?.[target] || { visible: false, brand: target };
        const brand = String(row.brand || target) === "vdan" ? "vdan" : "fcp";
        return `
          <tr>
            <td>${esc(page.label || route)}</td>
            <td><code>${esc(route)}</code></td>
            <td><input type="checkbox" data-static-web-route="${esc(route)}" data-static-web-target="${esc(target)}" data-static-web-field="visible" ${row.visible ? "checked" : ""} /></td>
            <td><input type="checkbox" data-static-web-route="${esc(route)}" data-static-web-target="${esc(target)}" data-static-web-field="brand" data-static-web-brand="vdan" ${brand === "vdan" ? "checked" : ""} /></td>
            <td><input type="checkbox" data-static-web-route="${esc(route)}" data-static-web-target="${esc(target)}" data-static-web-field="brand" data-static-web-brand="fcp" ${brand === "fcp" ? "checked" : ""} /></td>
            <td class="small">${esc(page.note || "")}</td>
          </tr>
        `;
      }).join("");
    });
  }

  function renderAppMaskBrandTable() {
    const body = document.querySelector("#adminAppMaskBrandTable tbody");
    if (!body) return;
    body.innerHTML = state.appMaskPages.map((page) => {
      const route = String(page?.route || "").trim();
      const brand = String(state.appMaskMatrix?.[route] || page?.default_brand || "fcp_tactical").trim().toLowerCase();
      return `
        <tr>
          <td>${esc(page.label || route)}</td>
          <td><code>${esc(route)}</code></td>
          <td><input type="checkbox" data-app-mask-route="${esc(route)}" data-app-mask-brand="vdan_default" ${brand === "vdan_default" ? "checked" : ""} /></td>
          <td><input type="checkbox" data-app-mask-route="${esc(route)}" data-app-mask-brand="fcp_tactical" ${brand === "fcp_tactical" ? "checked" : ""} /></td>
          <td><input type="checkbox" data-app-mask-route="${esc(route)}" data-app-mask-brand="fcp_brand" ${brand === "fcp_brand" ? "checked" : ""} /></td>
          <td class="small">${esc(page.note || "")}</td>
        </tr>
      `;
    }).join("");
  }

  function updateStaticWebField(route, target, field, value) {
    const safeRoute = String(route || "").trim();
    const safeTarget = String(target || "").trim().toLowerCase();
    if (!safeRoute || !["fcp", "vdan"].includes(safeTarget)) return;
    if (!state.staticWebMatrix[safeRoute]) state.staticWebMatrix[safeRoute] = defaultStaticWebMatrix()[safeRoute];
    if (field === "visible") {
      state.staticWebMatrix[safeRoute][safeTarget].visible = Boolean(value);
    }
    if (field === "brand") {
      state.staticWebMatrix[safeRoute][safeTarget].brand = String(value || "").trim().toLowerCase() === "vdan" ? "vdan" : "fcp";
    }
    state.staticWebMatrix = normalizeStaticWebMatrix(state.staticWebMatrix);
    renderStaticWebTables();
  }

  function updateAppMaskBrand(route, brand) {
    const safeRoute = String(route || "").trim();
    if (!safeRoute) return;
    const safeBrand = String(brand || "").trim().toLowerCase();
    state.appMaskMatrix[safeRoute] = safeBrand === "vdan_default" || safeBrand === "fcp_brand" ? safeBrand : "fcp_tactical";
    state.appMaskMatrix = normalizeAppMaskMatrix(state.appMaskMatrix);
    renderAppMaskBrandTable();
  }

  function usecaseLabel(id) {
    return String(id || "").replaceAll("_", " ");
  }

  function setSmallMsg(id, text = "", isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "var(--danger)" : "";
  }

  async function callEdge(functionName, payload = {}) {
    const { url, key } = cfg();
    const token = session()?.access_token;
    if (!token) throw new Error("auth_required");
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
    if (!res.ok || data?.ok === false) throw new Error(String(data?.error || `function_${functionName}_failed_${res.status}`));
    return data;
  }

  function setClubRequestsMsg(text = "", isError = false) {
    setSmallMsg("adminClubRequestsMsg", text, isError);
  }

  function renderClubRequests() {
    const body = document.querySelector("#adminClubRequestsTable tbody");
    if (!body) return;
    const rows = Array.isArray(state.clubRequests) ? state.clubRequests : [];
    body.innerHTML = rows.map((row) => `
      <tr>
        <td>${esc(row.club_name || "-")}</td>
        <td>${esc(row.requester_email || "-")}</td>
        <td>
          <button type="button" class="feed-btn feed-btn--ghost" data-club-request-approve="${esc(row.id)}">Freigabe</button>
          <button type="button" class="feed-btn feed-btn--ghost" data-club-request-reject="${esc(row.id)}">Ablehnen</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="3" class="small">Keine offenen Vereinsanfragen.</td></tr>`;
  }

  async function loadClubRequests() {
    try {
      const rows = await sb("/rest/v1/club_registration_requests?select=id,club_name,requester_email,status,created_at&status=eq.pending&order=created_at.desc", { method: "GET" }, true);
      state.clubRequests = Array.isArray(rows) ? rows : [];
      renderClubRequests();
      setClubRequestsMsg(state.clubRequests.length ? `${state.clubRequests.length} offene Vereinsanfragen.` : "Keine offenen Vereinsanfragen.");
    } catch (err) {
      state.clubRequests = [];
      renderClubRequests();
      setClubRequestsMsg(`Vereinsanfragen konnten nicht geladen werden: ${String(err?.message || "request_failed")}`, true);
    }
  }

  function renderModuleCatalogEditor() {
    const body = document.querySelector("#adminModuleCatalogTable tbody");
    if (!body) return;
    body.innerHTML = state.moduleCatalog.map((m) => `
      <tr>
        <td><input type="text" data-module-catalog-field="id" data-module-id="${esc(m.id)}" value="${esc(m.id)}" /></td>
        <td><input type="text" data-module-catalog-field="label" data-module-id="${esc(m.id)}" value="${esc(m.label)}" /></td>
        <td><input type="text" data-module-catalog-field="usecases" data-module-id="${esc(m.id)}" value="${esc(m.usecases.join(", "))}" /></td>
        <td><input type="checkbox" data-module-catalog-field="active" data-module-id="${esc(m.id)}" ${m.active ? "checked" : ""} /></td>
      </tr>
    `).join("");
  }

  function applyCatalogEditsFromTable() {
    const body = document.querySelector("#adminModuleCatalogTable tbody");
    if (!body) return;
    const next = [];
    body.querySelectorAll("tr").forEach((tr) => {
      const id = sanitizeKey(tr.querySelector('[data-module-catalog-field="id"]')?.value || "");
      if (!id) return;
      const label = String(tr.querySelector('[data-module-catalog-field="label"]')?.value || "").trim() || id;
      const usecasesRaw = String(tr.querySelector('[data-module-catalog-field="usecases"]')?.value || "");
      const usecases = [...new Set(usecasesRaw.split(",").map((v) => sanitizeKey(v)).filter(Boolean))];
      const active = Boolean(tr.querySelector('[data-module-catalog-field="active"]')?.checked);
      next.push({ id, label, usecases, active });
    });
    state.moduleCatalog = normalizeModuleCatalog(next);
  }

  function renderRoleDefaultsEditor() {
    const body = document.querySelector("#adminRoleDefaultsTable tbody");
    if (!body) return;
    const roleSel = document.getElementById("adminRoleDefaultsRole");
    const role = String(roleSel?.value || "member");
    const rows = allUsecasesWithModule(state.moduleCatalog);
    body.innerHTML = rows.map((row) => {
      const rights = rightSet(state.moduleDefaultRights?.[role]?.[row.usecaseId] || { view: false });
      const viewDis = rights.view ? "" : "disabled";
      return `
        <tr>
          <td>${esc(row.moduleLabel)}</td>
          <td><code>${esc(row.usecaseId)}</code></td>
          <td><input type="checkbox" data-default-role="${esc(role)}" data-default-usecase="${esc(row.usecaseId)}" data-default-right="view" ${rights.view ? "checked" : ""} /></td>
          <td><input type="checkbox" ${rights.read ? "checked" : ""} disabled /></td>
          <td><input type="checkbox" data-default-role="${esc(role)}" data-default-usecase="${esc(row.usecaseId)}" data-default-right="write" ${rights.write ? "checked" : ""} ${viewDis} /></td>
          <td><input type="checkbox" data-default-role="${esc(role)}" data-default-usecase="${esc(row.usecaseId)}" data-default-right="update" ${rights.update ? "checked" : ""} ${viewDis} /></td>
          <td><input type="checkbox" data-default-role="${esc(role)}" data-default-usecase="${esc(row.usecaseId)}" data-default-right="delete" ${rights.delete ? "checked" : ""} ${viewDis} /></td>
        </tr>
      `;
    }).join("");
  }

  function updateDefaultRight(role, usecaseId, right, checked) {
    if (!CORE_ROLES.includes(role)) return;
    if (!state.moduleDefaultRights[role]) state.moduleDefaultRights[role] = {};
    const current = rightSet(state.moduleDefaultRights[role][usecaseId] || { view: false });
    if (right === "view") {
      current.view = Boolean(checked);
      current.read = current.view;
      if (!current.view) {
        current.write = false;
        current.update = false;
        current.delete = false;
      }
    } else if (["write", "update", "delete"].includes(right)) {
      if (!current.view) return;
      current[right] = Boolean(checked);
    }
    state.moduleDefaultRights[role][usecaseId] = rightSet(current);
    renderRoleDefaultsEditor();
  }

  function selectedClub() {
    return state.clubMetrics.find((c) => String(c.id) === String(state.selectedClubId))
      || state.clubs.find((c) => String(c.id) === String(state.selectedClubId))
      || null;
  }

  function ensureClubConfig(clubId) {
    if (!clubId) return null;
    if (!state.clubModuleConfig[clubId]) {
      state.clubModuleConfig[clubId] = defaultClubConfigFor(state.moduleCatalog);
    }
    state.clubModuleConfig[clubId] = normalizeClubConfig(state.clubModuleConfig[clubId], state.moduleCatalog);
    return state.clubModuleConfig[clubId];
  }

  function renderClubDetail() {
    const card = document.getElementById("adminClubDetailCard");
    const title = document.getElementById("adminClubDetailTitle");
    const meta = document.getElementById("adminClubDetailMeta");
    const body = document.querySelector("#adminClubModulesTable tbody");
    const club = selectedClub();
    if (!card || !title || !meta || !body) return;
    if (!club) {
      card.classList.add("hidden");
      card.setAttribute("hidden", "");
      return;
    }
    card.classList.remove("hidden");
    card.removeAttribute("hidden");
    title.textContent = `Club-Detail: ${clubDisplayName(club)}`;
    meta.textContent = `Club-ID: ${club.id} â€¢ Mitglieder (Personen): ${club.members || 0} â€¢ Rollen-Zuordnungen: ${club.roleAssignments || 0} â€¢ Status: ${club.status || "active"}`;
    const cfg = ensureClubConfig(club.id);
    body.innerHTML = state.moduleCatalog.map((m) => {
      const mc = cfg.modules[m.id] || { enabled: false, usecases: {} };
      const usecasesHtml = m.usecases.map((u) => {
        const checked = mc.usecases?.[u] ? "checked" : "";
        const dis = mc.enabled ? "" : "disabled";
        return `<label class="small" style="display:inline-flex;align-items:center;gap:6px;margin-right:10px;">
          <input type="checkbox" data-club-module-usecase="${esc(u)}" data-club-module-id="${esc(m.id)}" ${checked} ${dis} />
          ${esc(usecaseLabel(u))}
        </label>`;
      }).join("");
      return `
        <tr>
          <td>${esc(m.label)}</td>
          <td><input type="checkbox" data-club-module-enabled="${esc(m.id)}" ${mc.enabled ? "checked" : ""} /></td>
          <td>${usecasesHtml || "-"}</td>
          <td class="small"><code>${esc(m.id)}</code></td>
        </tr>
      `;
    }).join("");
  }

  function openClubDetail(clubId) {
    state.selectedClubId = String(clubId || "");
    renderClubDetail();
    switchSection("clubs");
  }

  function computeClubMetrics() {
    const byClub = new Map();
    state.clubs.forEach((club) => {
      byClub.set(String(club.id), {
        ...club,
        members: 0,
        roleAssignments: 0,
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
    state.clubRoleAssignments.forEach((ra) => {
      const club = byClub.get(String(ra.club_id));
      if (!club) return;
      club.roleAssignments += 1;
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
          <td>${esc(clubDisplayName(c))}</td>
          <td>${c.members}</td>
          <td>${c.roleAssignments || 0}</td>
          <td>${state.loginSignalAvailable ? c.activeMembers : "n/a"}</td>
          <td>${normalizeDate(c.lastActivity)}</td>
          <td>${esc(c.status || "active")}</td>
          <td class="small">${esc(c.id)}</td>
        </tr>
      `).join("") || `<tr><td colspan="7" class="small">Keine Daten.</td></tr>`;
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
      <tr data-club-row-id="${esc(c.id)}" style="cursor:pointer;">
        <td>${esc(clubDisplayName(c))}</td>
        <td>${normalizeDate(c.created_at)}</td>
        <td>${c.members}</td>
        <td>${c.roleAssignments || 0}</td>
        <td>${state.loginSignalAvailable ? c.activeMembers : "n/a"}</td>
        <td>${state.loginSignalAvailable ? c.neverLoggedIn : "n/a"}</td>
        <td>${esc(c.status || "active")}</td>
        <td>
          <a class="feed-btn feed-btn--ghost" href="/app/mitgliederverwaltung/?club_id=${encodeURIComponent(String(c.id || ""))}#members">Vereins-Board</a>
          <button type="button" class="feed-btn feed-btn--ghost" data-open-club-id="${esc(c.id)}">Module</button>
        </td>
        <td class="small">${esc(c.id)}</td>
      </tr>
    `).join("") || `<tr><td colspan="9" class="small">Keine Vereine gefunden.</td></tr>`;
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

  function governanceStatusClass(status) {
    const s = String(status || "").toLowerCase();
    if (s === "red") return "gov-status gov-status--red";
    if (s === "yellow") return "gov-status gov-status--yellow";
    return "gov-status gov-status--green";
  }

  async function loadGovernanceHealth() {
    let healthRows = [];
    let issueRows = [];
    try {
      healthRows = await sb("/rest/v1/rpc/governance_health_snapshot", { method: "POST", body: "{}" }, true);
    } catch (err) {
      recordDiag("rpc.governance_health_snapshot", err);
      healthRows = [];
    }
    try {
      issueRows = await sb("/rest/v1/rpc/governance_health_issues", { method: "POST", body: JSON.stringify({ p_club_id: null }) }, true);
    } catch (err) {
      recordDiag("rpc.governance_health_issues", err);
      issueRows = [];
    }
    state.governanceHealth = Array.isArray(healthRows) ? healthRows : [];
    state.governanceIssues = Array.isArray(issueRows) ? issueRows : [];
  }

  function renderGovernanceAnalytics() {
    const healthRows = Array.isArray(state.governanceHealth) ? state.governanceHealth : [];
    const issueRows = Array.isArray(state.governanceIssues) ? state.governanceIssues : [];

    const kpiGovGreen = document.getElementById("kpiGovGreen");
    const kpiGovYellow = document.getElementById("kpiGovYellow");
    const kpiGovRed = document.getElementById("kpiGovRed");
    const kpiGovIssues = document.getElementById("kpiGovIssues");
    const kpiGovRulesOpen = document.getElementById("kpiGovRulesOpen");
    const govMsg = document.getElementById("adminGovernanceMsg");

    const green = healthRows.filter((r) => String(r?.health_status || "").toLowerCase() === "green").length;
    const yellow = healthRows.filter((r) => String(r?.health_status || "").toLowerCase() === "yellow").length;
    const red = healthRows.filter((r) => String(r?.health_status || "").toLowerCase() === "red").length;
    const totalIssues = healthRows.reduce((sum, row) => sum + Number(row?.total_issues || 0), 0);
    const openRuleCount = new Set(issueRows.map((r) => String(r?.rule_key || "").trim()).filter(Boolean)).size;

    if (kpiGovGreen) kpiGovGreen.textContent = String(green);
    if (kpiGovYellow) kpiGovYellow.textContent = String(yellow);
    if (kpiGovRed) kpiGovRed.textContent = String(red);
    if (kpiGovIssues) kpiGovIssues.textContent = String(totalIssues);
    if (kpiGovRulesOpen) kpiGovRulesOpen.textContent = String(openRuleCount);
    if (govMsg) {
      govMsg.textContent = healthRows.length
        ? "Zentrale Audit-Quelle aktiv (Snapshot + Drilldown)."
        : "Keine Governance-Health-Daten sichtbar (RPC/Permissions prÃ¼fen).";
    }

    const healthBody = document.querySelector("#adminGovernanceHealthTable tbody");
    if (healthBody) {
      healthBody.innerHTML = healthRows.map((row) => `
        <tr>
          <td>${esc(row?.club_name || row?.club_code || "Unbenannter Verein")}</td>
          <td><span class="${governanceStatusClass(row?.health_status)}">${esc(row?.health_status || "green")}</span></td>
          <td>${Number(row?.total_issues || 0)}</td>
          <td>${Number(row?.identity_gaps || 0)}</td>
          <td>${Number(row?.roles_without_membership || 0)}</td>
          <td>${Number(row?.duplicate_identities || 0)}</td>
          <td>${Number(row?.members_without_identity_link || 0)}</td>
          <td>${Number(row?.club_name_or_code_missing || 0)}</td>
          <td class="small">${esc(row?.club_id || "-")}</td>
        </tr>
      `).join("") || `<tr><td colspan="9" class="small">Keine Governance-Health-Daten.</td></tr>`;
    }

    const issueBody = document.querySelector("#adminGovernanceIssuesTable tbody");
    if (issueBody) {
      issueBody.innerHTML = issueRows.slice(0, 300).map((row) => `
        <tr>
          <td><code>${esc(row?.rule_key || "-")}</code></td>
          <td>${esc(row?.club_name || row?.club_code || row?.club_id || "-")}</td>
          <td class="small">${esc(row?.ref_1 || "-")}</td>
          <td class="small">${esc(row?.ref_2 || "-")}</td>
          <td>${esc(row?.detail || "-")}</td>
        </tr>
      `).join("") || `<tr><td colspan="5" class="small">Keine offenen Governance-Issues.</td></tr>`;
    }
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
    state.clubMetrics = [];
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
    const identities = await loadClubIdentitiesFromSettings();
    state.clubs = (fallback.clubs || []).map((club) => {
      const patch = identities.get(String(club.id)) || {};
      const next = {
        ...club,
        code: String(patch.code || club.code || "").trim(),
        name: String(patch.name || club.name || "").trim(),
      };
      if (!next.name || /^club\s+[0-9a-f]{6,}$/i.test(next.name)) {
        next.name = next.code || "Unbenannter Verein";
      }
      return next;
    });
    state.memberships = fallback.memberships;
    state.clubRoleAssignments = Array.isArray(fallback.roleAssignments) ? fallback.roleAssignments : [];
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
    state.staticWebPages = normalizeStaticWebPages();
    state.staticWebMatrix = loadStaticWebMatrix();
    state.appMaskPages = normalizeAppMaskPages();
    state.appMaskMatrix = loadAppMaskMatrix();
    rolePageMatrix = loadRoleMatrix();
    state.moduleCatalog = loadModuleCatalog();
    state.moduleDefaultRights = loadModuleRights(state.moduleCatalog);
    state.clubModuleConfig = loadAllClubConfigs(state.moduleCatalog);
    renderModulesTables();
    renderStaticWebTables();
    renderAppMaskBrandTable();
    renderModuleCatalogEditor();
    renderRoleDefaultsEditor();
    renderClubDetail();
    renderClubRequests();
    if (!hasRuntimeConfig()) {
      setMsg("Preflight: Supabase Runtime-Config fehlt oder ist Platzhalter. Admin-Board lÃ¤uft im Readiness-Modus (kein Live-Connect).", true);
      document.querySelectorAll(".admin-card").forEach((card) => card.classList.add("is-missing"));
      return;
    }

    await waitForAuthReady();
    const allowed = await enforceSuperadmin();
    if (!allowed) return;

    await loadRemoteAdminWebConfig();
    renderStaticWebTables();
    renderAppMaskBrandTable();
    await loadClubRequests();

    document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchSection(String(btn.getAttribute("data-admin-section") || "dashboard")));
    });

    document.getElementById("adminStaticWebSave")?.addEventListener("click", async () => {
      try {
        const data = await saveRemoteAdminWebConfig();
        if (data?.local_only) {
          setSmallMsg("adminStaticWebMsg", "Web-Plan lokal gespeichert. Live-Sync in die Runtime-DB greift ausserhalb von localhost.");
        } else {
          setSmallMsg("adminStaticWebMsg", "Web-Plan serverseitig gespeichert. Live-Trennung der statischen Seiten bleibt repo- und deploy-gesteuert.");
        }
      } catch (err) {
        setSmallMsg("adminStaticWebMsg", `Web-Plan konnte nicht gespeichert werden: ${String(err?.message || "request_failed")}`, true);
      }
    });
    document.getElementById("adminStaticWebReset")?.addEventListener("click", () => {
      state.staticWebMatrix = defaultStaticWebMatrix();
      renderStaticWebTables();
      setSmallMsg("adminStaticWebMsg", "Web-Draft auf Repo-Stand zurÃ¼ckgesetzt.");
    });
    document.getElementById("adminStaticWebCopy")?.addEventListener("click", async (e) => {
      await copyText(e.currentTarget, staticWebMatrixAsJson(), "Web JSON kopiert");
      setSmallMsg("adminStaticWebMsg", "Web-JSON aus aktuellem Draft kopiert.");
    });
    document.getElementById("adminAppMaskBrandSave")?.addEventListener("click", async () => {
      try {
        const data = await saveRemoteAdminWebConfig();
        if (data?.local_only) {
          setSmallMsg("adminAppMaskBrandMsg", "Masken-Brand lokal gespeichert. Live-Sync in die Runtime-DB greift ausserhalb von localhost.");
        } else {
          setSmallMsg("adminAppMaskBrandMsg", "Masken-Brand serverseitig gespeichert. Die App-Masken ziehen den Override live beim Laden.");
        }
      } catch (err) {
        setSmallMsg("adminAppMaskBrandMsg", `Masken-Brand konnte nicht gespeichert werden: ${String(err?.message || "request_failed")}`, true);
      }
    });
    document.getElementById("adminAppMaskBrandReset")?.addEventListener("click", () => {
      state.appMaskMatrix = defaultAppMaskMatrix();
      renderAppMaskBrandTable();
      setSmallMsg("adminAppMaskBrandMsg", "Masken-Brand auf Default zurueckgesetzt.");
    });
    document.getElementById("adminAppMaskBrandCopy")?.addEventListener("click", async (e) => {
      await copyText(e.currentTarget, appMaskMatrixAsJson(), "Masken JSON kopiert");
      setSmallMsg("adminAppMaskBrandMsg", "Masken-JSON aus aktuellem Stand kopiert.");
    });
    document.addEventListener("change", (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;
      const route = String(input.getAttribute("data-static-web-route") || "").trim();
      const target = String(input.getAttribute("data-static-web-target") || "").trim();
      const field = String(input.getAttribute("data-static-web-field") || "").trim();
      if (!route || !target || !field) return;
      if (field === "visible") {
        updateStaticWebField(route, target, "visible", input.checked);
        return;
      }
      if (field === "brand") {
        updateStaticWebField(route, target, "brand", String(input.getAttribute("data-static-web-brand") || "fcp"));
        return;
      }
      const appMaskRoute = String(input.getAttribute("data-app-mask-route") || "").trim();
      const appMaskBrand = String(input.getAttribute("data-app-mask-brand") || "").trim();
      if (appMaskRoute && appMaskBrand) {
        updateAppMaskBrand(appMaskRoute, appMaskBrand);
      }
    });

    document.getElementById("adminMemberSearch")?.addEventListener("input", applyMemberFilter);
    document.getElementById("adminMemberFilter")?.addEventListener("change", applyMemberFilter);
    document.querySelector("#adminClubsTable tbody")?.addEventListener("click", (event) => {
      const src = event.target;
      if (!(src instanceof Element)) return;
      if (src.closest("a,button,input,select,textarea,label")) {
        const btn = src.closest("[data-open-club-id]");
        if (!btn) return;
        openClubDetail(String(btn.getAttribute("data-open-club-id") || ""));
        return;
      }
      const row = src.closest("tr[data-club-row-id]");
      if (row) {
        const clubId = String(row.getAttribute("data-club-row-id") || "").trim();
        if (!clubId) return;
        window.location.assign(`/app/mitgliederverwaltung/?club_id=${encodeURIComponent(clubId)}#members`);
        return;
      }
      const btn = src.closest("[data-open-club-id]");
      if (!btn) return;
      openClubDetail(String(btn.getAttribute("data-open-club-id") || ""));
    });
    document.querySelector("#adminClubRequestsTable tbody")?.addEventListener("click", async (event) => {
      const src = event.target;
      if (!(src instanceof Element)) return;
      const approveBtn = src.closest("[data-club-request-approve]");
      const rejectBtn = src.closest("[data-club-request-reject]");
      if (!approveBtn && !rejectBtn) return;
      const requestId = String((approveBtn || rejectBtn)?.getAttribute(approveBtn ? "data-club-request-approve" : "data-club-request-reject") || "").trim();
      if (!requestId) return;
      try {
        if (approveBtn) {
          setClubRequestsMsg("Freigabe wird verarbeitet...");
          await callEdge("club-request-decision", { request_id: requestId, action: "approve" });
          setClubRequestsMsg("Vereinsanfrage freigegeben.");
        } else {
          const reason = String(window.prompt("Optionaler Hinweis fuer die Ablehnung:", "") || "").trim();
          setClubRequestsMsg("Ablehnung wird verarbeitet...");
          await callEdge("club-request-decision", { request_id: requestId, action: "reject", rejection_reason: reason || null });
          setClubRequestsMsg("Vereinsanfrage abgelehnt.");
        }
        await loadClubRequests();
        await loadCoreData();
        const clubRows = computeClubMetrics();
        const userRows = computeUserMetrics();
        state.clubMetrics = clubRows;
        state.membersFiltered = userRows;
        renderDashboard(clubRows, userRows);
        renderClubs(clubRows);
        applyMemberFilter();
      } catch (err) {
        setClubRequestsMsg(`Aktion fehlgeschlagen: ${String(err?.message || "request_failed")}`, true);
      }
    });
    document.getElementById("adminClubDetailClose")?.addEventListener("click", () => {
      state.selectedClubId = "";
      renderClubDetail();
    });
    document.getElementById("adminClubDetailSave")?.addEventListener("click", async () => {
      const club = selectedClub();
      let dbOk = true;
      if (club) {
        try {
          await saveClubConfigToDb(club.id, ensureClubConfig(club.id));
        } catch (err) {
          recordDiag("club_module_usecases(save)", err);
          dbOk = false;
        }
      }
      const localOk = saveAllClubConfigs(state.clubModuleConfig, state.moduleCatalog);
      const ok = dbOk && localOk;
      setSmallMsg("adminClubDetailMsg", ok ? "Modulzusammensetzung gespeichert." : "Speichern nur teilweise erfolgreich (DB/Local prÃ¼fen).", !ok);
    });
    document.getElementById("adminClubDetailReset")?.addEventListener("click", () => {
      const club = selectedClub();
      if (!club) return;
      state.clubModuleConfig[club.id] = defaultClubConfigFor(state.moduleCatalog);
      renderClubDetail();
      setSmallMsg("adminClubDetailMsg", "Standardmodell fÃ¼r diesen Club geladen.");
    });
    document.querySelector("#adminClubModulesTable tbody")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const club = selectedClub();
      if (!club) return;
      const cfg = ensureClubConfig(club.id);
      const moduleByEnabled = String(target.getAttribute("data-club-module-enabled") || "");
      if (moduleByEnabled) {
        if (!cfg.modules[moduleByEnabled]) return;
        cfg.modules[moduleByEnabled].enabled = Boolean(target.checked);
        if (!cfg.modules[moduleByEnabled].enabled) {
          Object.keys(cfg.modules[moduleByEnabled].usecases || {}).forEach((u) => { cfg.modules[moduleByEnabled].usecases[u] = false; });
        } else {
          Object.keys(cfg.modules[moduleByEnabled].usecases || {}).forEach((u) => { cfg.modules[moduleByEnabled].usecases[u] = true; });
        }
        renderClubDetail();
        return;
      }
      const moduleId = String(target.getAttribute("data-club-module-id") || "");
      const usecaseId = String(target.getAttribute("data-club-module-usecase") || "");
      if (!moduleId || !usecaseId) return;
      if (!cfg.modules[moduleId]) return;
      if (!cfg.modules[moduleId].enabled) return;
      cfg.modules[moduleId].usecases[usecaseId] = Boolean(target.checked);
    });

    document.getElementById("adminModuleCatalogSave")?.addEventListener("click", async () => {
      applyCatalogEditsFromTable();
      const ok1 = saveModuleCatalog(state.moduleCatalog);
      state.moduleDefaultRights = normalizeModuleRights(state.moduleDefaultRights, state.moduleCatalog);
      const ok2 = saveModuleRights(state.moduleDefaultRights, state.moduleCatalog);
      Object.keys(state.clubModuleConfig).forEach((clubId) => {
        state.clubModuleConfig[clubId] = normalizeClubConfig(state.clubModuleConfig[clubId], state.moduleCatalog);
      });
      const ok3 = saveAllClubConfigs(state.clubModuleConfig, state.moduleCatalog);
      let ok4 = true;
      try {
        await saveModuleCatalogToDb();
      } catch (err) {
        recordDiag("module_catalog/save", err);
        ok4 = false;
      }
      renderModuleCatalogEditor();
      renderRoleDefaultsEditor();
      renderClubDetail();
      setSmallMsg("adminModuleCatalogMsg", ok1 && ok2 && ok3 && ok4 ? "Modul-Katalog gespeichert." : "Konnte Modul-Katalog nicht vollstÃ¤ndig speichern.", !(ok1 && ok2 && ok3 && ok4));
    });
    document.getElementById("adminModuleCatalogReset")?.addEventListener("click", () => {
      state.moduleCatalog = defaultModuleCatalog();
      state.moduleDefaultRights = defaultModuleRights(state.moduleCatalog);
      Object.keys(state.clubModuleConfig).forEach((clubId) => {
        state.clubModuleConfig[clubId] = defaultClubConfigFor(state.moduleCatalog);
      });
      saveModuleCatalog(state.moduleCatalog);
      saveModuleRights(state.moduleDefaultRights, state.moduleCatalog);
      saveAllClubConfigs(state.clubModuleConfig, state.moduleCatalog);
      renderModuleCatalogEditor();
      renderRoleDefaultsEditor();
      renderClubDetail();
      setSmallMsg("adminModuleCatalogMsg", "Modul-Katalog auf Standard zurÃ¼ckgesetzt.");
    });

    document.getElementById("adminRoleDefaultsRole")?.addEventListener("change", () => {
      renderRoleDefaultsEditor();
      setSmallMsg("adminRoleDefaultsMsg", "");
    });
    document.querySelector("#adminRoleDefaultsTable tbody")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const role = String(target.getAttribute("data-default-role") || "");
      const usecase = String(target.getAttribute("data-default-usecase") || "");
      const right = String(target.getAttribute("data-default-right") || "");
      if (!role || !usecase || !right) return;
      updateDefaultRight(role, usecase, right, Boolean(target.checked));
    });
    document.getElementById("adminRoleDefaultsSave")?.addEventListener("click", async () => {
      const role = String(document.getElementById("adminRoleDefaultsRole")?.value || "member");
      const localOk = saveModuleRights(state.moduleDefaultRights, state.moduleCatalog);
      let dbOk = true;
      try {
        await saveRoleDefaultsToDb(role);
      } catch (err) {
        recordDiag("club_role_permissions/save_defaults", err);
        dbOk = false;
      }
      const ok = localOk && dbOk;
      setSmallMsg("adminRoleDefaultsMsg", ok ? "Standard-Rollenrechte gespeichert." : "Speichern nur teilweise erfolgreich (DB/Local prÃ¼fen).", !ok);
    });
    document.getElementById("adminRoleDefaultsReset")?.addEventListener("click", () => {
      state.moduleDefaultRights = defaultModuleRights(state.moduleCatalog);
      saveModuleRights(state.moduleDefaultRights, state.moduleCatalog);
      renderRoleDefaultsEditor();
      setSmallMsg("adminRoleDefaultsMsg", "Standard-Rollenrechte auf App-Default zurÃ¼ckgesetzt.");
    });
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

    setMsg("Admin-Board lÃ¤dt...");
    await loadCoreData();
    await loadGovernanceFromDb();
    await loadGovernanceHealth();
    renderModuleCatalogEditor();
    renderRoleDefaultsEditor();
    if (state.users.length === 0 && state.clubs.length === 0) {
      const diag = state.diagnostics.length ? ` Diagnose: ${state.diagnostics.slice(0, 4).join(" | ")}` : "";
      setMsg("Keine DatensÃ¤tze sichtbar. Wahrscheinlich fehlen Select-Policies (RLS) oder Profile/Club-Daten fÃ¼r diesen User." + diag, true);
    }
    const clubRows = computeClubMetrics();
    state.clubMetrics = clubRows;
    const userRows = computeUserMetrics();
    state.membersFiltered = userRows;
    renderDashboard(clubRows, userRows);
    renderClubs(clubRows);
    renderGovernanceAnalytics();
    renderClubDetail();
    applyMemberFilter();

    if (!state.loginSignalAvailable) {
      const sourceLabel = state.sources.length ? ` Quellen: ${state.sources.join(", ")}.` : "";
      const diag = state.diagnostics.length ? ` Diagnose: ${state.diagnostics.slice(0, 3).join(" | ")}` : "";
      setMsg(`Hinweis: Last-Login-Signal nicht verfÃ¼gbar. KPIs/Spalten wurden als n/a markiert.${sourceLabel}${diag}`, false);
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

