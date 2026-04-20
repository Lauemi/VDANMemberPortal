;(() => {
  const root = document.getElementById("fcpMasterboardApp");
  if (!root) return;

  const BOOT_MASTER = window.__FCP_MASTERBOARD_BOOTSTRAP__ || { nodes: [] };
  const BOOT_OPS = window.__FCP_PROCESS_CONTROL_BOOTSTRAP__ || { processes: [] };

  const lanes = [
    { key: "marketing", title: "Ebene 1 — Marketing", subtitle: "Website, Demo, Positionierung", className: "c-marketing" },
    { key: "flow", title: "Ebene 2 — Core Flows", subtitle: "Registrierung, Login, Welcome", className: "c-entry" },
    { key: "onboarding", title: "Ebene 3 — Onboarding", subtitle: "CSV, Gewaesser, Karten, Setup", className: "c-onboarding" },
    { key: "config", title: "Ebene 4 — Konfiguration", subtitle: "Mitgliedschaft, Preise, Rollen, Stammdaten", className: "c-config" },
    { key: "operations", title: "Ebene 5 — Fachmodule", subtitle: "Mitglieder, Gewaesser, Sitzungen, Feed", className: "c-operativ" },
    { key: "system", title: "Ebene 6 — System", subtitle: "Auth, API, Runtime, Audit, Reporting", className: "c-system" },
    { key: "legal", title: "Ebene 7 — Legal", subtitle: "DSGVO, Vertraege, Protokolle", className: "c-legal" },
  ];
  const laneLabels = {
    marketing: "Marketing",
    flow: "Flow",
    onboarding: "Onboarding",
    config: "Config",
    operations: "Module",
    system: "System",
    legal: "Legal",
  };
  const statusLabels = {
    offen: "Offen",
    teilweise: "Teilweise",
    erfuellt: "Erfuellt",
    geschlossen: "Geschlossen",
  };

  const state = {
    master: [],
    ops: [],
    loaded: false,
    source: "loading",
    mode: "lead",
    activeTab: "master",
    highlightNodeId: "",
    highlightProcessId: "",
  };

  const pageMsg = document.getElementById("masterboardPageMsg");
  const drawer = document.getElementById("masterboardDrawer");
  const overlay = document.getElementById("masterboardOverlay");
  const drawerBody = document.getElementById("masterboardDrawerBody");
  const laneBoard = document.getElementById("masterboardLaneBoard");
  const processList = document.getElementById("masterboardProcessList");
  const masterView = document.getElementById("masterboardMasterView");
  const opsView = document.getElementById("masterboardOpsView");
  const sourceBadge = document.getElementById("masterboardSourceBadge");
  const blockersList = document.getElementById("masterboardTopBlockers");
  const blockersSummary = document.getElementById("masterboardTopBlockersSummary");
  let lastDrawerFocus = null;

  const NON_BILLING_CLUB_LOGIC_IDS = new Set(["pricing-model", "cards-onboard", "p-cards-pricing"]);
  const LEAD_PRIORITY = new Map([
    ["csv", 100],
    ["p-billing", 95],
    ["billing-stripe", 90],
    ["p-onboarding", 85],
    ["membership-model", 80],
    ["p-members", 75],
    ["p-waters", 70],
    ["waters-onboard", 65],
  ]);

  function setMsg(text = "", danger = false) {
    if (!pageMsg) return;
    pageMsg.textContent = text;
    pageMsg.style.color = danger ? "#ef5350" : "";
  }

  function setSource(source = "loading") {
    state.source = source;
    if (!sourceBadge) return;
    sourceBadge.className = "masterboard-source__badge";
    if (source === "live") {
      sourceBadge.classList.add("is-live");
      sourceBadge.textContent = "Live DB";
      return;
    }
    if (source === "fallback") {
      sourceBadge.classList.add("is-fallback");
      sourceBadge.textContent = "Bootstrap";
      return;
    }
    sourceBadge.classList.add("is-loading");
    sourceBadge.textContent = "Lade…";
  }

  function esc(value = "") {
    return String(value).replace(/[&<>"]/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[m]));
  }

  function cfg() {
    const body = document.body;
    return {
      url: String(window.__APP_SUPABASE_URL || body?.dataset?.supabaseUrl || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || body?.dataset?.supabaseKey || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function rpc(name, payload = {}) {
    const { url, key } = cfg();
    const token = session()?.access_token;
    const headers = new Headers();
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.message || err?.hint || err?.details || err?.error || `RPC ${name} failed (${res.status})`;
      const error = new Error(msg);
      error.status = res.status;
      throw error;
    }
    return res.json().catch(() => []);
  }

  function statusDot(value) {
    return value === "erfuellt" || value === "geschlossen"
      ? "🟢"
      : value === "teilweise"
        ? "🟡"
        : "🔴";
  }

  function statusText(value = "") {
    return statusLabels[value] || value || "-";
  }

  function currentLaneFilter() {
    return document.getElementById("masterboardLaneFilter")?.value || "all";
  }

  function currentStatusFilter() {
    return document.getElementById("masterboardStatusFilter")?.value || "all";
  }

  function currentSignalFilter() {
    return document.getElementById("masterboardSignalFilter")?.value || "all";
  }

  function currentSearch() {
    return String(document.getElementById("masterboardSearch")?.value || "").trim().toLowerCase();
  }

  function currentMode() {
    return state.mode || "lead";
  }

  function currentTab() {
    return state.activeTab || "master";
  }

  function isFocusNode(node) {
    return ["registration", "invite", "auth", "welcome", "csv"].includes(String(node.node_id || node.id || ""));
  }

  function launchWeight(value = "") {
    if (value === "L1") return 3;
    if (value === "L2") return 2;
    if (value === "L3") return 1;
    return 0;
  }

  function priorityWeight(value = "") {
    if (value === "kritisch") return 4;
    if (value === "hoch") return 3;
    if (value === "mittel") return 2;
    if (value === "normal") return 1;
    return 0;
  }

  function statusWeight(value = "") {
    if (value === "offen") return 3;
    if (value === "teilweise") return 2;
    return 0;
  }

  function normalizeScreenStatus(value = "") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "done") return "erfuellt";
    if (raw === "closed") return "geschlossen";
    if (raw === "partial") return "teilweise";
    return raw || "offen";
  }

  function isClosedBug(bug = {}) {
    const status = String(bug.status || "").trim().toLowerCase();
    return status === "closed" || status === "geschlossen" || status === "done" || status === "erfuellt";
  }

  function normalizeMasterNode(node = {}) {
    return {
      node_id: node.node_id || node.id || "",
      title: node.title || "",
      lane: node.lane || "",
      status: normalizeScreenStatus(node.status || "offen"),
      launch_class: node.launch_class || "L0",
      risk_level: node.risk_level || "niedrig",
      progress_visible: Array.isArray(node.progress_visible) ? node.progress_visible : [],
      progress_invisible: Array.isArray(node.progress_invisible) ? node.progress_invisible : [],
      gaps: Array.isArray(node.gaps) ? node.gaps : [],
      decisions_open: Array.isArray(node.decisions_open) ? node.decisions_open : [],
      refs: Array.isArray(node.refs) ? node.refs : [],
      last_verified_at: node.last_verified_at || null,
    };
  }

  function normalizeScreen(screen = {}) {
    return {
      id: screen.id || "",
      title: screen.title || "",
      path: screen.path || "",
      notes: screen.notes || "",
      status: normalizeScreenStatus(screen.status || "offen"),
      checked_ui: !!screen.checked_ui,
      checked_smoke: !!screen.checked_smoke,
      checked_function: !!screen.checked_function,
      checked_access: !!screen.checked_access,
      bugs_open: Number(screen.bugs_open || 0),
      build_ref: screen.build_ref || "",
    };
  }

  function normalizeProcess(proc = {}) {
    return {
      process_id: proc.process_id || proc.id || "",
      title: proc.title || "",
      status: normalizeScreenStatus(proc.status || "offen"),
      priority: proc.priority || "normal",
      related_nodes: Array.isArray(proc.related_nodes) ? proc.related_nodes : [],
      summary: proc.summary || "",
      owner: proc.owner || "",
      screens: Array.isArray(proc.screens) ? proc.screens.map(normalizeScreen) : [],
      smoke_checks: Array.isArray(proc.smoke_checks) ? proc.smoke_checks : [],
      bugs: Array.isArray(proc.bugs) ? proc.bugs : [],
      review_note: proc.review_note || "",
      last_reviewed_at: proc.last_reviewed_at || null,
    };
  }

  function applyState(masterRows = [], processRows = [], source = "live") {
    state.master = (Array.isArray(masterRows) ? masterRows : []).map(normalizeMasterNode);
    state.ops = (Array.isArray(processRows) ? processRows : []).map(normalizeProcess);
    state.loaded = true;
    setSource(source);
    renderAll();
  }

  function findNode(nodeId = "") {
    return state.master.find((entry) => entry.node_id === nodeId) || null;
  }

  function findProcess(processId = "") {
    return state.ops.find((entry) => entry.process_id === processId) || null;
  }

  function relatedProcessesForNode(nodeId = "") {
    return state.ops.filter((proc) => Array.isArray(proc.related_nodes) && proc.related_nodes.includes(nodeId));
  }

  function relatedNodesForProcess(proc = {}) {
    return (Array.isArray(proc.related_nodes) ? proc.related_nodes : [])
      .map((nodeId) => findNode(nodeId))
      .filter(Boolean);
  }

  function screensForNode(nodeId = "") {
    return relatedProcessesForNode(nodeId).flatMap((proc) =>
      (Array.isArray(proc.screens) ? proc.screens : []).map((screen) => ({ ...screen, process_id: proc.process_id, process_title: proc.title }))
    );
  }

  function realRoutePath(screen = {}) {
    const path = String(screen.path || "").trim();
    return path.startsWith("/") ? path : "";
  }

  function firstRouteForNode(node = {}) {
    return screensForNode(node.node_id).find((screen) => realRoutePath(screen)) || null;
  }

  function firstRouteForProcess(proc = {}) {
    return (Array.isArray(proc.screens) ? proc.screens : []).find((screen) => realRoutePath(screen)) || null;
  }

  function nodeRefsWithProcessPaths(node = {}) {
    const refs = Array.isArray(node.refs) ? [...node.refs] : [];
    screensForNode(node.node_id).forEach((screen) => {
      if (screen.path) refs.push(screen.path);
    });
    return Array.from(new Set(refs));
  }

  function processRefs(proc = {}) {
    const refs = [];
    relatedNodesForProcess(proc).forEach((node) => {
      (Array.isArray(node.refs) ? node.refs : []).forEach((ref) => refs.push(ref));
    });
    return Array.from(new Set(refs));
  }

  function classifyRef(ref = "") {
    const value = String(ref || "").trim();
    if (!value) return { type: "unknown", label: "Anker" };
    if (value.startsWith("/")) return { type: "route", label: "Screen" };
    if (value.startsWith("(neu)")) return { type: "target", label: "Zielmaske" };
    if (value.startsWith("public.")) return { type: "db", label: "DB" };
    if (value.includes("supabase/functions/")) return { type: "edge", label: "Edge" };
    if (value.includes("supabase/migrations/")) return { type: "migration", label: "Migration" };
    if (value.includes("src/pages/")) return { type: "page", label: "Page" };
    if (value.includes("public/js/")) return { type: "js", label: "JS" };
    if (value.includes("public/css/")) return { type: "css", label: "CSS" };
    if (value.includes("docs/")) return { type: "docs", label: "Docs" };
    if (value.includes("rpc") || value.endsWith("()")) return { type: "rpc", label: "RPC" };
    return { type: "ref", label: "Ref" };
  }

  function workTypeForNode(node) {
    const refs = nodeRefsWithProcessPaths(node);
    const text = refs.join(" ").toLowerCase();
    if (text.includes("src/pages") || text.includes("public/js") || text.includes("public/css") || text.includes("/app/") || text.includes("/registrieren")) return "UI";
    if (text.includes("supabase/functions") || text.includes("rpc") || text.includes("function")) return "Flow";
    if (text.includes("public.") || text.includes("supabase/migrations")) return "DB";
    return "Flow";
  }

  function workTypeForProcess(proc) {
    const screens = Array.isArray(proc.screens) ? proc.screens : [];
    const paths = screens.map((entry) => String(entry.path || "").toLowerCase()).join(" ");
    if (paths.includes("/app/") || paths.includes("/registrieren") || paths.includes("/verein") || paths.includes("/vereinssignin")) return "UI";
    if (paths.includes("(neu)") || paths.includes("rpc") || paths.includes("checkout")) return "Flow";
    return "Flow";
  }

  function nextActionForNode(node) {
    const gaps = Array.isArray(node.gaps) ? node.gaps : [];
    const decisions = Array.isArray(node.decisions_open) ? node.decisions_open : [];
    const screens = screensForNode(node.node_id);
    const openScreen = screens.find((entry) => entry.status !== "erfuellt");
    const visible = Array.isArray(node.progress_visible) ? node.progress_visible : [];
    if (gaps[0]) return { label: "Gap schliessen", text: gaps[0] };
    if (decisions[0]) return { label: "Entscheidung treffen", text: decisions[0] };
    if (openScreen?.notes) return { label: "Screen fuehren", text: openScreen.notes };
    if (visible[0]) return { label: "Naechster sichtbarer Schritt", text: visible[0] };
    return { label: "Kein naechster Schritt", text: "Kein naechster Schritt hinterlegt." };
  }

  function nextActionForProcess(proc) {
    const screens = Array.isArray(proc.screens) ? proc.screens : [];
    const smoke = Array.isArray(proc.smoke_checks) ? proc.smoke_checks : [];
    const bugs = Array.isArray(proc.bugs) ? proc.bugs : [];
    const openScreen = screens.find((entry) => entry.status !== "erfuellt");
    if (openScreen?.notes) return { label: "Screen stabilisieren", text: openScreen.notes };
    const openSmoke = smoke.find((entry) => !entry.done);
    if (openSmoke?.title) return { label: "Smoke schliessen", text: openSmoke.title };
    const openBug = bugs.find((entry) => !isClosedBug(entry));
    if (openBug?.title) return { label: "Bug schliessen", text: openBug.title };
    if (proc.summary) return { label: "Arbeitsrichtung", text: proc.summary };
    return { label: "Kein naechster Schritt", text: "Kein naechster Schritt hinterlegt." };
  }

  function isLeadershipRelevantNode(node) {
    if (NON_BILLING_CLUB_LOGIC_IDS.has(node.node_id)) return false;
    if (node.node_id === "csv" || node.node_id === "billing-stripe") return true;
    return node.status !== "erfuellt" && (node.risk_level === "hoch" || launchWeight(node.launch_class) >= 2);
  }

  function isLeadershipRelevantProcess(proc) {
    if (NON_BILLING_CLUB_LOGIC_IDS.has(proc.process_id)) return false;
    if (proc.process_id === "p-billing" || proc.process_id === "p-onboarding") return true;
    return proc.status !== "erfuellt" && priorityWeight(proc.priority) >= 3;
  }

  function blockerEntries() {
    const processEntries = state.ops
      .filter(isLeadershipRelevantProcess)
      .map((proc) => {
        const next = nextActionForProcess(proc);
        return {
          kind: "process",
          id: proc.process_id,
          title: proc.title,
          status: proc.status,
          owner: proc.owner || "-",
          next: next.text,
          nextLabel: next.label,
          score: (LEAD_PRIORITY.get(proc.process_id) || 0) + priorityWeight(proc.priority) * 10 + statusWeight(proc.status),
        };
      });
    const nodeEntries = state.master
      .filter(isLeadershipRelevantNode)
      .map((node) => {
        const next = nextActionForNode(node);
        return {
          kind: "node",
          id: node.node_id,
          title: node.title,
          status: node.status,
          owner: "michael",
          next: next.text,
          nextLabel: next.label,
          score: (LEAD_PRIORITY.get(node.node_id) || 0) + launchWeight(node.launch_class) * 10 + statusWeight(node.status),
        };
      });
    return [...processEntries, ...nodeEntries]
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 3);
  }

  function blockerSummaryText(entries = []) {
    if (!entries.length) return "Aktuell keine fuehrungsrelevanten Blocker offen.";
    const labels = entries.map((entry) => {
      if (entry.id === "csv") return "CSV-Smoke-Test";
      if (entry.id === "p-billing" || entry.id === "billing-stripe") return "Billing-End-to-End";
      if (entry.id === "p-onboarding") return "Onboarding-Flow-Freeze";
      if (entry.id === "membership-model" || entry.id === "p-members") return "Mitglieder-Modell klaeren";
      if (entry.id === "p-waters" || entry.id === "waters-onboard") return "Gewaesser-Fix";
      return entry.title;
    });
    return `Wirklich offen sind gerade: ${labels.join(" · ")}. Jeder Blocker fuehrt jetzt direkt in den passenden Arbeitskontext.`;
  }

  function matchesNode(node) {
    const lane = currentLaneFilter();
    const status = currentStatusFilter();
    const signal = currentSignalFilter();
    const search = currentSearch();
    const mode = currentMode();
    const gaps = Array.isArray(node.gaps) ? node.gaps : [];
    const visible = Array.isArray(node.progress_visible) ? node.progress_visible : [];
    const invisible = Array.isArray(node.progress_invisible) ? node.progress_invisible : [];
    const decisions = Array.isArray(node.decisions_open) ? node.decisions_open : [];
    const refs = nodeRefsWithProcessPaths(node);
    const processes = relatedProcessesForNode(node.node_id);
    const laneOk = lane === "all" || node.lane === lane;
    const statusOk = status === "all" || node.status === status;
    const signalOk = signal === "all"
      || (signal === "risk" && node.risk_level === "hoch")
      || (signal === "gap" && gaps.length > 0)
      || (signal === "focus" && isFocusNode(node));
    const modeOk = mode === "detail" || isLeadershipRelevantNode(node);
    if (!laneOk || !statusOk || !signalOk || !modeOk) return false;
    if (!search) return true;
    const hay = [
      node.node_id,
      node.title,
      node.lane,
      node.status,
      node.launch_class,
      node.risk_level,
      ...visible,
      ...invisible,
      ...gaps,
      ...decisions,
      ...refs,
      ...processes.map((proc) => `${proc.process_id} ${proc.title}`),
    ].join(" ").toLowerCase();
    return hay.includes(search);
  }

  function matchesProcess(proc) {
    const lane = currentLaneFilter();
    const status = currentStatusFilter();
    const signal = currentSignalFilter();
    const search = currentSearch();
    const mode = currentMode();
    const relatedNodes = relatedNodesForProcess(proc);
    const screens = Array.isArray(proc.screens) ? proc.screens : [];
    const bugs = Array.isArray(proc.bugs) ? proc.bugs : [];
    const smoke = Array.isArray(proc.smoke_checks) ? proc.smoke_checks : [];
    const laneOk = lane === "all" || relatedNodes.some((node) => node.lane === lane);
    const statusOk = status === "all" || proc.status === status;
    const signalOk = signal === "all"
      || (signal === "risk" && bugs.some((bug) => String(bug.severity || "").toLowerCase() === "hoch" && !isClosedBug(bug)))
      || (signal === "gap" && (bugs.some((bug) => !isClosedBug(bug)) || smoke.some((item) => !item.done)))
      || (signal === "focus" && relatedNodes.some(isFocusNode));
    const modeOk = mode === "detail" || isLeadershipRelevantProcess(proc);
    if (!laneOk || !statusOk || !signalOk || !modeOk) return false;
    if (!search) return true;
    const hay = [
      proc.process_id,
      proc.title,
      proc.summary,
      proc.owner,
      proc.review_note,
      ...proc.related_nodes,
      ...screens.map((screen) => `${screen.title} ${screen.path} ${screen.notes}`),
      ...bugs.map((bug) => `${bug.title} ${bug.status} ${bug.severity}`),
      ...smoke.map((item) => item.title || ""),
      ...relatedNodes.map((node) => `${node.title} ${node.node_id}`),
      ...processRefs(proc),
    ].join(" ").toLowerCase();
    return hay.includes(search);
  }

  function visibleNodes() {
    return state.master.filter(matchesNode);
  }

  function visibleProcesses() {
    return state.ops.filter(matchesProcess);
  }

  function listHtml(arr, empty = "Noch nichts hinterlegt.") {
    if (!Array.isArray(arr) || !arr.length) return `<div class="small">${esc(empty)}</div>`;
    return arr.map((item) => `<div class="item">${esc(item)}</div>`).join("");
  }

  function screenStateBadges(screen = {}) {
    return [
      screen.checked_ui ? '<span class="mini is-good">UI</span>' : '<span class="mini">UI offen</span>',
      screen.checked_smoke ? '<span class="mini is-good">Smoke</span>' : '<span class="mini">Smoke offen</span>',
      screen.checked_function ? '<span class="mini is-good">Funktion</span>' : '<span class="mini">Funktion offen</span>',
      screen.checked_access ? '<span class="mini is-good">Access</span>' : '<span class="mini">Access offen</span>',
    ].join("");
  }

  function openDrawer() {
    lastDrawerFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawer.classList.add("open");
    overlay.classList.add("show");
    drawer.setAttribute("aria-hidden", "false");
    drawer.inert = false;
    const closeBtn = document.getElementById("masterboardDrawerClose");
    if (closeBtn instanceof HTMLElement) {
      window.requestAnimationFrame(() => closeBtn.focus());
    }
  }

  function closeDrawer() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && drawer.contains(active)) {
      active.blur();
    }
    drawer.classList.remove("open");
    overlay.classList.remove("show");
    drawer.setAttribute("aria-hidden", "true");
    drawer.inert = true;
    if (lastDrawerFocus instanceof HTMLElement && document.contains(lastDrawerFocus)) {
      window.requestAnimationFrame(() => lastDrawerFocus.focus());
    }
  }

  function setHighlight({ nodeId = "", processId = "" } = {}) {
    state.highlightNodeId = nodeId;
    state.highlightProcessId = processId;
  }

  function updateStats() {
    const nodes = visibleNodes();
    const processes = visibleProcesses();
    const gaps = nodes.filter((n) => Array.isArray(n.gaps) && n.gaps.length > 0).length;
    const risks = nodes.filter((n) => n.risk_level === "hoch").length;
    document.getElementById("masterboardStatNodes").textContent = String(nodes.length);
    document.getElementById("masterboardStatGaps").textContent = String(gaps);
    document.getElementById("masterboardStatRisks").textContent = String(risks);
    document.getElementById("masterboardStatProcesses").textContent = String(processes.length);
  }

  function renderTopBlockers() {
    if (!blockersList) return;
    const entries = blockerEntries();
    if (blockersSummary) blockersSummary.textContent = blockerSummaryText(entries);
    if (!entries.length) {
      blockersList.innerHTML = '<div class="small">Keine fuehrungsrelevanten Blocker offen.</div>';
      return;
    }
    blockersList.innerHTML = entries.map((entry, index) => `
      <button
        type="button"
        class="blocker-item blocker-item--button"
        data-action="${entry.kind === "process" ? "open-process" : "open-node"}"
        data-id="${esc(entry.id)}"
      >
        <div class="blocker-item__head">
          <span class="blocker-item__index">${index + 1}</span>
          <span class="blocker-item__title">${esc(entry.title)}</span>
          <span class="blocker-item__status">${statusDot(entry.status)} ${esc(statusText(entry.status))}</span>
        </div>
        <div class="blocker-item__meta">Owner: ${esc(entry.owner)} · ${esc(entry.nextLabel)}: ${esc(entry.next)}</div>
      </button>
    `).join("");
  }

  function renderRelationChips(items = [], type = "process", empty = "Keine Relationen.") {
    if (!items.length) return `<div class="small">${esc(empty)}</div>`;
    return `<div class="chip-list">${items.map((item) => {
      const id = type === "process" ? item.process_id : item.node_id;
      const title = type === "process" ? item.title : item.title;
      const action = type === "process" ? "open-process" : "open-node";
      return `<button type="button" class="chip" data-action="${action}" data-id="${esc(id)}">${esc(title)}</button>`;
    }).join("")}</div>`;
  }

  function renderRefChips(refs = [], limit = 5) {
    if (!refs.length) return '<div class="small">Keine betroffenen Dateien oder Referenzen hinterlegt.</div>';
    return `<div class="chip-list">${refs.slice(0, limit).map((ref) => {
      const meta = classifyRef(ref);
      const action = meta.type === "route" ? "open-route" : "search-ref";
      return `
        <button type="button" class="chip chip--ref chip--${esc(meta.type)}" data-action="${action}" data-ref="${esc(ref)}">
          <span class="chip__kicker">${esc(meta.label)}</span>${esc(ref)}
        </button>
      `;
    }).join("")}</div>`;
  }

  function renderScreenList(screens = [], empty = "Keine Screens verknuepft.") {
    if (!screens.length) return `<div class="small">${esc(empty)}</div>`;
    return `<div class="screen-list">${screens.map((screen) => {
      const route = realRoutePath(screen);
      const action = route ? `<button type="button" class="chip chip--route" data-action="open-route" data-ref="${esc(route)}">Screen oeffnen</button>` : "";
      return `
        <article class="screen-item">
          <div class="screen-item__head">
            <div>
              <div class="screen-item__title">${esc(screen.title || screen.id || "Screen")}</div>
              <div class="small">${statusDot(screen.status)} ${esc(statusText(screen.status))} · ${esc(screen.path || "-")}</div>
            </div>
            ${action}
          </div>
          <div class="chip-list chip-list--compact">${screenStateBadges(screen)}</div>
          <div class="small">${esc(screen.notes || "Keine Screen-Notiz hinterlegt.")}</div>
        </article>
      `;
    }).join("")}</div>`;
  }

  function renderMaster() {
    laneBoard.innerHTML = "";
    const visible = visibleNodes();
    lanes.forEach((lane, index) => {
      const laneItems = visible.filter((node) => node.lane === lane.key);
      if (!laneItems.length) return;
      const section = document.createElement("section");
      section.className = "lane";
      section.innerHTML = `
        <div class="lane-head">
          <div>
            <div class="lane-title">${esc(lane.title)}</div>
            <div class="lane-sub">${esc(lane.subtitle)}</div>
          </div>
          <div class="lane-meta">${laneItems.length} Knoten im aktuellen Fokus</div>
        </div>
        <div class="cards"></div>
      `;
      const cards = section.querySelector(".cards");
      laneItems.forEach((node) => {
        const card = document.createElement("article");
        const relatedProcesses = relatedProcessesForNode(node.node_id);
        const relatedScreens = screensForNode(node.node_id);
        const gaps = Array.isArray(node.gaps) ? node.gaps : [];
        const next = nextActionForNode(node);
        const refs = nodeRefsWithProcessPaths(node);
        const workType = workTypeForNode(node);
        const highlight = state.highlightNodeId === node.node_id || relatedProcesses.some((proc) => proc.process_id === state.highlightProcessId);
        let signals = "";
        if (node.risk_level === "hoch") signals += '<span class="signal signal-risk" title="Risiko hoch">!</span>';
        if (gaps.length) signals += '<span class="signal signal-gap" title="Luecke offen">~</span>';
        if (isFocusNode(node)) signals += '<span class="signal signal-focus" title="Golden Path relevant">✦</span>';
        card.className = `mb-card ${lane.className}${highlight ? " is-highlighted" : ""}`;
        card.innerHTML = `
          <div class="signals">${signals}</div>
          <div class="card-head">
            <span class="badge">${esc(laneLabels[node.lane] || node.lane)}</span>
            <span class="card-status">${statusDot(node.status)} ${esc(statusText(node.status))}</span>
          </div>
          <h3 class="card-title">${esc(node.title)}</h3>
          <div class="card-sub">Launch ${esc(node.launch_class)} · Risiko ${esc(node.risk_level)} · Typ ${esc(workType)}</div>
          <div class="card-next">
            <span class="card-next__label">${esc(next.label)}</span>
            <div>${esc(next.text)}</div>
          </div>
          <div class="card-summary">
            <div class="mini">Prozesse ${relatedProcesses.length}</div>
            <div class="mini">Screens ${relatedScreens.length}</div>
            <div class="mini">Refs ${refs.length}</div>
          </div>
          <div class="card-section">
            <div class="card-section__label">Prozess-Relationen</div>
            ${renderRelationChips(relatedProcesses.slice(0, 3), "process", "Keine Prozesse verknuepft.")}
          </div>
          <div class="card-section">
            <div class="card-section__label">Arbeitsanker</div>
            ${renderRefChips(refs, 3)}
          </div>
        `;
        card.addEventListener("click", (event) => {
          if (event.target instanceof Element && event.target.closest("[data-action]")) return;
          openMasterDrawer(node.node_id);
        });
        cards.appendChild(card);
      });
      laneBoard.appendChild(section);
      if (index < lanes.length - 1) {
        const connector = document.createElement("div");
        connector.className = "flow-connector";
        connector.innerHTML = '<div class="line"></div><div class="label">Weiter zur naechsten Ebene</div><div class="line"></div>';
        laneBoard.appendChild(connector);
      }
    });
  }

  function renderOps() {
    processList.innerHTML = "";
    const visible = visibleProcesses();
    visible.forEach((proc) => {
      const screens = Array.isArray(proc.screens) ? proc.screens : [];
      const uiCount = screens.filter((screen) => screen.checked_ui).length;
      const smokeCount = screens.filter((screen) => screen.checked_smoke).length;
      const openBugs = (Array.isArray(proc.bugs) ? proc.bugs : []).filter((bug) => !isClosedBug(bug)).length;
      const next = nextActionForProcess(proc);
      const relatedNodes = relatedNodesForProcess(proc);
      const highlight = state.highlightProcessId === proc.process_id || relatedNodes.some((node) => node.node_id === state.highlightNodeId);
      const row = document.createElement("div");
      row.className = `process-row process-table${highlight ? " is-highlighted" : ""}`;
      row.innerHTML = `
        <div class="process-primary">
          <div class="process-primary__head">
            <div style="font-weight:900">${esc(proc.title)}</div>
            <span class="pill ${proc.status === "erfuellt" ? "ok" : proc.status === "teilweise" ? "mid" : "bad"}">${statusDot(proc.status)} ${esc(statusText(proc.status))}</span>
          </div>
          <div class="small">${esc(next.label)}: ${esc(next.text)}</div>
          <div class="process-row__meta">Typ ${esc(workTypeForProcess(proc))} · Owner ${esc(proc.owner || "-")} · Review ${esc(proc.last_reviewed_at || "-")}</div>
          <div class="process-row__section">
            <div class="card-section__label">Related Nodes</div>
            ${renderRelationChips(relatedNodes, "node", "Keine Nodes verknuepft.")}
          </div>
          <div class="process-row__section">
            <div class="card-section__label">Screens</div>
            <div class="chip-list chip-list--compact">
              ${screens.map((screen) => {
                const route = realRoutePath(screen);
                const action = route ? "open-route" : "open-process";
                const payload = route ? `data-ref="${esc(route)}"` : `data-id="${esc(proc.process_id)}"`;
                return `<button type="button" class="chip chip--screen" data-action="${action}" ${payload}>${esc(screen.title)}</button>`;
              }).join("") || '<span class="small">Keine Screens</span>'}
            </div>
          </div>
        </div>
        <div>${screens.length}</div>
        <div>${uiCount} / ${screens.length}</div>
        <div>${smokeCount} / ${screens.length}</div>
        <div>${openBugs}</div>
        <div>${esc(proc.priority)}</div>
        <div><button type="button" class="chip chip--open" data-action="open-process" data-id="${esc(proc.process_id)}">Workbench</button></div>
      `;
      row.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("[data-action]")) return;
        openOpsDrawer(proc.process_id);
      });
      processList.appendChild(row);
    });
  }

  function renderAll() {
    renderTopBlockers();
    renderMaster();
    renderOps();
    updateStats();
  }

  function setDrawerMeta(lane, title, sub) {
    document.getElementById("masterboardDrawerLane").textContent = lane;
    document.getElementById("masterboardDrawerTitle").textContent = title;
    document.getElementById("masterboardDrawerSub").textContent = sub;
  }

  function textareaValue(arr) {
    return Array.isArray(arr) ? arr.join("\n") : "";
  }

  function parseLines(value) {
    return String(value || "")
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function prettyJson(value) {
    return JSON.stringify(value || [], null, 2);
  }

  function parseJsonTextarea(value, fallback = []) {
    const text = String(value || "").trim();
    if (!text) return fallback;
    return JSON.parse(text);
  }

  function setTab(tab = "master") {
    state.activeTab = tab === "ops" ? "ops" : "master";
    document.querySelectorAll("[data-masterboard-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-masterboard-tab") === state.activeTab);
    });
    const master = state.activeTab === "master";
    masterView.classList.toggle("hidden", !master);
    opsView.classList.toggle("hidden", master);
    updateStats();
  }

  function setSearch(term = "") {
    const input = document.getElementById("masterboardSearch");
    if (input) input.value = term;
    renderAll();
  }

  function openRoute(ref = "") {
    const route = String(ref || "").trim();
    if (!route.startsWith("/")) return;
    window.location.href = route;
  }

  function branchSummaryForNode(node) {
    const route = firstRouteForNode(node);
    if (route) return `Bestehende Folgeflaeche: ${route.title} (${route.path})`;
    const target = screensForNode(node).find((screen) => String(screen.path || "").startsWith("(neu)"));
    if (target) return `Zielmaske offen: ${target.title} (${target.path})`;
    return "Noch keine explizite Zielmaske verknuepft.";
  }

  function branchSummaryForProcess(proc) {
    const route = firstRouteForProcess(proc);
    if (route) return `Bestehende Folgeflaeche: ${route.title} (${route.path})`;
    const target = (Array.isArray(proc.screens) ? proc.screens : []).find((screen) => String(screen.path || "").startsWith("(neu)"));
    if (target) return `Zielmaske offen: ${target.title} (${target.path})`;
    return "Noch keine explizite Zielmaske verknuepft.";
  }

  async function saveMasterNode(nodeId) {
    const payload = {
      p_node_id: nodeId,
      p_title: document.getElementById("mbNodeTitle").value.trim(),
      p_lane: document.getElementById("mbNodeLane").value,
      p_status: document.getElementById("mbNodeStatus").value,
      p_launch_class: document.getElementById("mbNodeLaunch").value,
      p_risk_level: document.getElementById("mbNodeRisk").value,
      p_progress_visible: parseLines(document.getElementById("mbNodeVisible").value),
      p_progress_invisible: parseLines(document.getElementById("mbNodeInvisible").value),
      p_gaps: parseLines(document.getElementById("mbNodeGaps").value),
      p_decisions_open: parseLines(document.getElementById("mbNodeDecisions").value),
      p_refs: parseLines(document.getElementById("mbNodeRefs").value),
      p_last_verified_at: document.getElementById("mbNodeVerified").value || null,
    };
    await rpc("fcp_masterboard_node_upsert", payload);
    await loadState();
    openMasterDrawer(nodeId);
    setMsg(`Masterboard-Knoten ${payload.p_title} gespeichert.`);
  }

  function openMasterDrawer(nodeId) {
    const node = findNode(nodeId);
    if (!node) return;
    setHighlight({ nodeId: node.node_id });
    renderAll();
    const relatedProcesses = relatedProcessesForNode(node.node_id);
    const screens = screensForNode(node.node_id);
    const refs = nodeRefsWithProcessPaths(node);
    const next = nextActionForNode(node);
    const targetScreens = screens.filter((screen) => String(screen.path || "").startsWith("(neu)"));
    const followUpAreas = [
      ...node.gaps.map((item) => `Gap: ${item}`),
      ...node.decisions_open.map((item) => `Entscheidung: ${item}`),
      ...node.progress_invisible.map((item) => `Unsichtbarer Fortschritt: ${item}`),
    ];
    setDrawerMeta(laneLabels[node.lane] || node.lane, node.title, `${statusText(node.status)} · Launch ${node.launch_class} · Risiko ${node.risk_level}`);
    drawerBody.innerHTML = `
      <section class="panel workbench-hero">
        <div class="workbench-grid">
          <div class="workbench-kpi"><span>Status</span><strong>${statusDot(node.status)} ${esc(statusText(node.status))}</strong></div>
          <div class="workbench-kpi"><span>Prozesse</span><strong>${relatedProcesses.length}</strong></div>
          <div class="workbench-kpi"><span>Screens</span><strong>${screens.length}</strong></div>
          <div class="workbench-kpi"><span>Arbeitsanker</span><strong>${refs.length}</strong></div>
        </div>
        <div class="workbench-next">
          <div class="eyebrow">Naechste Aktion</div>
          <strong>${esc(next.label)}</strong>
          <p class="subtitle">${esc(next.text)}</p>
        </div>
        <div class="chip-list">
          ${firstRouteForNode(node) ? `<button type="button" class="chip chip--open" data-action="open-route" data-ref="${esc(firstRouteForNode(node).path)}">Erste relevante Maske oeffnen</button>` : ""}
          ${relatedProcesses[0] ? `<button type="button" class="chip chip--open" data-action="open-process" data-id="${esc(relatedProcesses[0].process_id)}">Zu verknuepftem Prozess</button>` : ""}
          ${refs[0] ? `<button type="button" class="chip chip--ref" data-action="search-ref" data-ref="${esc(refs[0])}">Arbeitsanker im Board filtern</button>` : ""}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>Board → Process</h3>
          <div class="small">Welche Prozesse dieser Knoten wirklich beruehrt</div>
        </div>
        ${renderRelationChips(relatedProcesses, "process", "Keine Prozesse verknuepft.")}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>Betroffene Screens und Flaechen</h3>
          <div class="small">UI-Sicht und reale Routen statt nur Zaehler</div>
        </div>
        ${renderScreenList(screens, "Keine betroffenen Screens hinterlegt.")}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>Betroffene Dateien / Arbeitsanker</h3>
          <div class="small">DB, RPC, UI, Docs und Screens in einer Sicht</div>
        </div>
        ${renderRefChips(refs, refs.length)}
      </section>

      <section class="panel two">
        <div>
          <div class="panel-head">
            <h3>Folgeflaechen</h3>
            <div class="small">${esc(branchSummaryForNode(node))}</div>
          </div>
          ${renderScreenList(targetScreens, "Keine expliziten Ziel- oder Spezialmasken hinterlegt.")}
        </div>
        <div>
          <div class="panel-head">
            <h3>Fuehrungsrelevante Folgepunkte</h3>
            <div class="small">Gaps, Entscheidungen und unsichtbarer Fortschritt</div>
          </div>
          ${listHtml(followUpAreas, "Keine Folgepunkte hinterlegt.")}
        </div>
      </section>

      <details class="panel advanced-panel">
        <summary>Erweiterte Pflege</summary>
        <div class="advanced-panel__body">
          <section class="two">
            <label><span>Titel</span><input id="mbNodeTitle" type="text" value="${esc(node.title)}" /></label>
            <label><span>Ebene</span>
              <select id="mbNodeLane">
                ${lanes.map((lane) => `<option value="${esc(lane.key)}"${lane.key === node.lane ? " selected" : ""}>${esc(lane.title)}</option>`).join("")}
              </select>
            </label>
            <label><span>Status</span>
              <select id="mbNodeStatus">
                ${["offen", "teilweise", "erfuellt"].map((value) => `<option value="${value}"${value === node.status ? " selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label><span>Launch-Klasse</span>
              <select id="mbNodeLaunch">
                ${["L0", "L1", "L2", "L3"].map((value) => `<option value="${value}"${value === node.launch_class ? " selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label><span>Risiko</span>
              <select id="mbNodeRisk">
                ${["niedrig", "mittel", "hoch"].map((value) => `<option value="${value}"${value === node.risk_level ? " selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label><span>Last Verified</span><input id="mbNodeVerified" type="date" value="${esc(node.last_verified_at || "")}" /></label>
          </section>
          <section><h3>Fortschritt sichtbar</h3><textarea id="mbNodeVisible">${esc(textareaValue(node.progress_visible))}</textarea></section>
          <section><h3>Fortschritt unsichtbar</h3><textarea id="mbNodeInvisible">${esc(textareaValue(node.progress_invisible))}</textarea></section>
          <section><h3>Gaps</h3><textarea id="mbNodeGaps">${esc(textareaValue(node.gaps))}</textarea></section>
          <section><h3>Entscheidungen offen</h3><textarea id="mbNodeDecisions">${esc(textareaValue(node.decisions_open))}</textarea></section>
          <section><h3>Referenzen</h3><textarea id="mbNodeRefs">${esc(textareaValue(node.refs))}</textarea></section>
          <div class="btnrow">
            <button type="button" class="primary" id="mbNodeSave">In DB speichern</button>
            <button type="button" id="mbNodeClose">Schliessen</button>
          </div>
        </div>
      </details>
    `;
    document.getElementById("mbNodeSave").addEventListener("click", () => {
      saveMasterNode(nodeId).catch((err) => setMsg(err.message || "Masterboard-Knoten konnte nicht gespeichert werden.", true));
    });
    document.getElementById("mbNodeClose").addEventListener("click", closeDrawer);
    openDrawer();
  }

  async function saveProcess(processId) {
    const payload = {
      p_process_id: processId,
      p_title: document.getElementById("mbProcessTitle").value.trim(),
      p_status: document.getElementById("mbProcessStatus").value,
      p_priority: document.getElementById("mbProcessPriority").value,
      p_related_nodes: parseLines(document.getElementById("mbProcessNodes").value),
      p_summary: document.getElementById("mbProcessSummary").value.trim(),
      p_owner: document.getElementById("mbProcessOwner").value.trim(),
      p_screens: parseJsonTextarea(document.getElementById("mbProcessScreens").value, []),
      p_smoke_checks: parseJsonTextarea(document.getElementById("mbProcessSmoke").value, []),
      p_bugs: parseJsonTextarea(document.getElementById("mbProcessBugs").value, []),
      p_review_note: document.getElementById("mbProcessReview").value.trim(),
      p_last_reviewed_at: document.getElementById("mbProcessReviewed").value || null,
    };
    await rpc("fcp_process_control_upsert", payload);
    await loadState();
    openOpsDrawer(processId);
    setMsg(`Prozess ${payload.p_title} gespeichert.`);
  }

  function openOpsDrawer(processId) {
    const proc = findProcess(processId);
    if (!proc) return;
    setHighlight({ processId: proc.process_id });
    setTab("ops");
    renderAll();
    const relatedNodes = relatedNodesForProcess(proc);
    const refs = processRefs(proc);
    const next = nextActionForProcess(proc);
    const targetScreens = proc.screens.filter((screen) => String(screen.path || "").startsWith("(neu)"));
    const openBugs = proc.bugs.filter((bug) => !isClosedBug(bug));
    const openSmoke = proc.smoke_checks.filter((entry) => !entry.done);
    setDrawerMeta("Operatives Kontrollboard", proc.title, `${statusText(proc.status)} · Prioritaet ${proc.priority} · Owner ${proc.owner || "-"}`);
    drawerBody.innerHTML = `
      <section class="panel workbench-hero">
        <div class="workbench-grid">
          <div class="workbench-kpi"><span>Status</span><strong>${statusDot(proc.status)} ${esc(statusText(proc.status))}</strong></div>
          <div class="workbench-kpi"><span>Related Nodes</span><strong>${relatedNodes.length}</strong></div>
          <div class="workbench-kpi"><span>Screens</span><strong>${proc.screens.length}</strong></div>
          <div class="workbench-kpi"><span>Offene Bugs</span><strong>${openBugs.length}</strong></div>
        </div>
        <div class="workbench-next">
          <div class="eyebrow">Naechste Aktion</div>
          <strong>${esc(next.label)}</strong>
          <p class="subtitle">${esc(next.text)}</p>
        </div>
        <div class="chip-list">
          ${firstRouteForProcess(proc) ? `<button type="button" class="chip chip--open" data-action="open-route" data-ref="${esc(firstRouteForProcess(proc).path)}">Relevanten Screen oeffnen</button>` : ""}
          ${relatedNodes[0] ? `<button type="button" class="chip chip--open" data-action="open-node" data-id="${esc(relatedNodes[0].node_id)}">Zum verknuepften Knoten</button>` : ""}
          ${refs[0] ? `<button type="button" class="chip chip--ref" data-action="search-ref" data-ref="${esc(refs[0])}">Arbeitsanker im Board filtern</button>` : ""}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>Process → Board</h3>
          <div class="small">Welche Board-Knoten diesen Prozess fachlich tragen</div>
        </div>
        ${renderRelationChips(relatedNodes, "node", "Keine Nodes verknuepft.")}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>Screens / Workbench-Flaechen</h3>
          <div class="small">Mit echter Routen-Sicht statt nur Summen</div>
        </div>
        ${renderScreenList(proc.screens, "Keine Screens hinterlegt.")}
      </section>

      <section class="panel two">
        <div>
          <div class="panel-head">
            <h3>Offene Bugs</h3>
            <div class="small">Fuehrungsrelevante Stoerungen</div>
          </div>
          ${listHtml(openBugs.map((bug) => `${bug.severity || "-"} · ${bug.title}`), "Keine offenen Bugs.")}
        </div>
        <div>
          <div class="panel-head">
            <h3>Offene Smoke-Checks</h3>
            <div class="small">Was noch nicht belastbar geschlossen ist</div>
          </div>
          ${listHtml(openSmoke.map((item) => item.title), "Keine offenen Smoke-Checks.")}
        </div>
      </section>

      <section class="panel two">
        <div>
          <div class="panel-head">
            <h3>Betroffene Dateien / Folgeflaechen</h3>
            <div class="small">Aus den verknuepften Nodes und Screens</div>
          </div>
          ${renderRefChips(refs, refs.length)}
        </div>
        <div>
          <div class="panel-head">
            <h3>Zielmaske / Spezialmaske</h3>
            <div class="small">${esc(branchSummaryForProcess(proc))}</div>
          </div>
          ${renderScreenList(targetScreens, "Keine expliziten Ziel- oder Spezialmasken hinterlegt.")}
        </div>
      </section>

      <details class="panel advanced-panel">
        <summary>Erweiterte Pflege</summary>
        <div class="advanced-panel__body">
          <section class="two">
            <label><span>Titel</span><input id="mbProcessTitle" type="text" value="${esc(proc.title)}" /></label>
            <label><span>Owner</span><input id="mbProcessOwner" type="text" value="${esc(proc.owner || "")}" /></label>
            <label><span>Status</span>
              <select id="mbProcessStatus">
                ${["offen", "teilweise", "erfuellt"].map((value) => `<option value="${value}"${value === proc.status ? " selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label><span>Prioritaet</span>
              <select id="mbProcessPriority">
                ${["niedrig", "normal", "mittel", "hoch", "kritisch"].map((value) => `<option value="${value}"${value === proc.priority ? " selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label><span>Letztes Review</span><input id="mbProcessReviewed" type="date" value="${esc(proc.last_reviewed_at || "")}" /></label>
            <label><span>Related Nodes</span><textarea id="mbProcessNodes">${esc(textareaValue(proc.related_nodes))}</textarea></label>
          </section>
          <section><h3>Summary</h3><textarea id="mbProcessSummary">${esc(proc.summary || "")}</textarea></section>
          <section><h3>Review-Notiz</h3><textarea id="mbProcessReview">${esc(proc.review_note || "")}</textarea></section>
          <section><h3>Screens (JSON)</h3><textarea id="mbProcessScreens">${esc(prettyJson(proc.screens))}</textarea></section>
          <section><h3>Smoke Checks (JSON)</h3><textarea id="mbProcessSmoke">${esc(prettyJson(proc.smoke_checks))}</textarea></section>
          <section><h3>Bugs (JSON)</h3><textarea id="mbProcessBugs">${esc(prettyJson(proc.bugs))}</textarea></section>
          <div class="btnrow">
            <button type="button" class="primary" id="mbProcessSave">In DB speichern</button>
            <button type="button" id="mbProcessClose">Schliessen</button>
          </div>
        </div>
      </details>
    `;
    document.getElementById("mbProcessSave").addEventListener("click", () => {
      saveProcess(processId).catch((err) => setMsg(err.message || "Prozess konnte nicht gespeichert werden.", true));
    });
    document.getElementById("mbProcessClose").addEventListener("click", closeDrawer);
    openDrawer();
  }

  async function loadState() {
    const [masterRows, processRows] = await Promise.all([
      rpc("fcp_masterboard_nodes_get", {}),
      rpc("fcp_process_controls_get", {}),
    ]);
    applyState(masterRows, processRows, "live");
  }

  function loadBootstrapFallback() {
    applyState(BOOT_MASTER?.nodes || [], BOOT_OPS?.processes || [], "fallback");
  }

  async function seedFromBootstrap() {
    const masterNodes = Array.isArray(BOOT_MASTER?.nodes) ? BOOT_MASTER.nodes : [];
    const processes = Array.isArray(BOOT_OPS?.processes) ? BOOT_OPS.processes : [];
    const result = await rpc("fcp_masterboard_seed", {
      p_nodes: masterNodes,
      p_processes: processes,
    });
    await loadState();
    setMsg(`Bootstrap uebernommen: ${result?.nodes_upserted || 0} Knoten, ${result?.processes_upserted || 0} Prozesse.`);
  }

  function exportJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleActionTrigger(event) {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    const actionNode = target.closest("[data-action]");
    if (!(actionNode instanceof HTMLElement)) return false;
    const action = actionNode.dataset.action;
    if (!action) return false;
    event.preventDefault();
    event.stopPropagation();
    if (action === "open-node") {
      openMasterDrawer(actionNode.dataset.id || "");
      return true;
    }
    if (action === "open-process") {
      openOpsDrawer(actionNode.dataset.id || "");
      return true;
    }
    if (action === "open-route") {
      openRoute(actionNode.dataset.ref || "");
      return true;
    }
    if (action === "search-ref") {
      setSearch(actionNode.dataset.ref || "");
      return true;
    }
    return false;
  }

  function bindEvents() {
    lanes.forEach((lane) => {
      const opt = document.createElement("option");
      opt.value = lane.key;
      opt.textContent = lane.title.replace(/^Ebene \d+ — /, "");
      document.getElementById("masterboardLaneFilter").appendChild(opt);
    });

    ["masterboardSearch", "masterboardLaneFilter", "masterboardStatusFilter", "masterboardSignalFilter"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderAll);
      document.getElementById(id)?.addEventListener("change", renderAll);
    });

    document.getElementById("masterboardRefreshBtn")?.addEventListener("click", () => {
      setSource("loading");
      loadState()
        .then(() => setMsg("Board-Zustand live aus der DB neu geladen."))
        .catch((err) => {
          setMsg(err.message || "Board konnte nicht geladen werden.", true);
        });
    });
    document.getElementById("masterboardSeedBtn")?.addEventListener("click", () => {
      seedFromBootstrap().catch((err) => setMsg(err.message || "Bootstrap konnte nicht uebernommen werden.", true));
    });
    document.getElementById("masterboardExportMasterBtn")?.addEventListener("click", () => {
      exportJson("fcp_masterboard_state_export.json", { nodes: state.master });
    });
    document.getElementById("masterboardExportOpsBtn")?.addEventListener("click", () => {
      exportJson("fcp_process_control_state_export.json", { processes: state.ops });
    });

    document.querySelectorAll("[data-masterboard-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.getAttribute("data-masterboard-tab") || "master"));
    });

    document.querySelectorAll("[data-masterboard-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.getAttribute("data-masterboard-mode") === "detail" ? "detail" : "lead";
        document.querySelectorAll("[data-masterboard-mode]").forEach((node) => node.classList.remove("active"));
        btn.classList.add("active");
        renderAll();
      });
    });

    root.addEventListener("click", handleActionTrigger, true);
    drawer.addEventListener("click", (event) => {
      handleActionTrigger(event);
    });

    document.getElementById("masterboardDrawerClose")?.addEventListener("click", closeDrawer);
    overlay?.addEventListener("click", closeDrawer);
  }

  async function init() {
    bindEvents();
    setTab("master");
    setSource("loading");
    try {
      await loadState();
      if (!state.master.length && Array.isArray(BOOT_MASTER?.nodes) && BOOT_MASTER.nodes.length) {
        setMsg("Board-Tabellen sind noch leer. Du kannst den bestehenden JSON-Stand per 'Bootstrap uebernehmen' einmalig in die DB schreiben.");
      } else {
        setMsg("Masterboard ist live an die DB angebunden und fuehrt jetzt ueber Relationen in den Arbeitskontext.");
      }
    } catch (err) {
      loadBootstrapFallback();
      const hint = "Falls du bereits Superadmin im Portal bist, fehlt vermutlich noch dein Eintrag in public.system_superadmins oder role=superadmin.";
      setMsg(`Live-DB nicht erreichbar. Bootstrap-Fallback aktiv. ${err.message || "Board konnte nicht geladen werden."} ${hint}`, true);
    }
  }

  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", () => {
      init();
    }, { once: true });
  }
})();
