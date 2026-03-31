;(() => {
  const root = document.getElementById("fcpMasterboardApp");
  if (!root) return;

  const BOOT_MASTER = window.__FCP_MASTERBOARD_BOOTSTRAP__ || { nodes: [] };
  const BOOT_OPS = window.__FCP_PROCESS_CONTROL_BOOTSTRAP__ || { processes: [] };

  const lanes = [
    { key: "marketing", title: "Ebene 1 — Marketing", subtitle: "Website, Demo, Positionierung", className: "c-marketing" },
    { key: "flow", title: "Ebene 2 — Core Flows", subtitle: "Registrierung, Login, Welcome", className: "c-entry" },
    { key: "onboarding", title: "Ebene 3 — Onboarding", subtitle: "CSV, Gewässer, Karten, Setup", className: "c-onboarding" },
    { key: "config", title: "Ebene 4 — Konfiguration", subtitle: "Mitgliedschaft, Preise, Rollen, Stammdaten", className: "c-config" },
    { key: "operations", title: "Ebene 5 — Fachmodule", subtitle: "Mitglieder, Gewässer, Sitzungen, Feed", className: "c-operativ" },
    { key: "system", title: "Ebene 6 — System", subtitle: "Auth, API, Runtime, Audit, Reporting", className: "c-system" },
    { key: "legal", title: "Ebene 7 — Legal", subtitle: "DSGVO, Verträge, Protokolle", className: "c-legal" },
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

  const state = {
    master: [],
    ops: [],
    loaded: false,
  };

  const pageMsg = document.getElementById("masterboardPageMsg");
  const drawer = document.getElementById("masterboardDrawer");
  const overlay = document.getElementById("masterboardOverlay");
  const drawerBody = document.getElementById("masterboardDrawerBody");
  const laneBoard = document.getElementById("masterboardLaneBoard");
  const processList = document.getElementById("masterboardProcessList");
  const masterView = document.getElementById("masterboardMasterView");
  const opsView = document.getElementById("masterboardOpsView");

  function setMsg(text = "", danger = false) {
    if (!pageMsg) return;
    pageMsg.textContent = text;
    pageMsg.style.color = danger ? "#ef5350" : "";
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

  function statusDot(s) {
    return s === "erfuellt" ? "🟢" : s === "teilweise" ? "🟡" : "🔴";
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

  function isFocusNode(node) {
    return ["registration", "invite", "auth", "welcome", "csv"].includes(String(node.node_id || node.id || ""));
  }

  function matchesNode(node) {
    const lane = currentLaneFilter();
    const status = currentStatusFilter();
    const signal = currentSignalFilter();
    const search = currentSearch();
    const gaps = Array.isArray(node.gaps) ? node.gaps : [];
    const visible = Array.isArray(node.progress_visible) ? node.progress_visible : [];
    const invisible = Array.isArray(node.progress_invisible) ? node.progress_invisible : [];
    const decisions = Array.isArray(node.decisions_open) ? node.decisions_open : [];
    const refs = Array.isArray(node.refs) ? node.refs : [];
    const laneOk = lane === "all" || node.lane === lane;
    const statusOk = status === "all" || node.status === status;
    const signalOk = signal === "all"
      || (signal === "risk" && node.risk_level === "hoch")
      || (signal === "gap" && gaps.length > 0)
      || (signal === "focus" && isFocusNode(node));
    if (!laneOk || !statusOk || !signalOk) return false;
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
    ].join(" ").toLowerCase();
    return hay.includes(search);
  }

  function listHtml(arr, empty = "Noch nichts hinterlegt.") {
    if (!Array.isArray(arr) || !arr.length) return `<div class="small">${esc(empty)}</div>`;
    return arr.map((item) => `<div class="item">${esc(item)}</div>`).join("");
  }

  function openDrawer() {
    drawer.classList.add("open");
    overlay.classList.add("show");
    drawer.setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    overlay.classList.remove("show");
    drawer.setAttribute("aria-hidden", "true");
  }

  function updateStats() {
    const nodes = state.master;
    const gaps = nodes.filter((n) => Array.isArray(n.gaps) && n.gaps.length > 0).length;
    const risks = nodes.filter((n) => n.risk_level === "hoch").length;
    document.getElementById("masterboardStatNodes").textContent = String(nodes.length);
    document.getElementById("masterboardStatGaps").textContent = String(gaps);
    document.getElementById("masterboardStatRisks").textContent = String(risks);
    document.getElementById("masterboardStatProcesses").textContent = String(state.ops.length);
  }

  function renderMaster() {
    laneBoard.innerHTML = "";
    lanes.forEach((lane, index) => {
      const laneItems = state.master.filter((node) => node.lane === lane.key && matchesNode(node));
      if (!laneItems.length) return;
      const section = document.createElement("section");
      section.className = "lane";
      section.innerHTML = `
        <div class="lane-head">
          <div>
            <div class="lane-title">${esc(lane.title)}</div>
            <div class="lane-sub">${esc(lane.subtitle)}</div>
          </div>
          <div class="lane-meta">${laneItems.length} Boxen sichtbar</div>
        </div>
        <div class="cards"></div>
      `;
      const cards = section.querySelector(".cards");
      laneItems.forEach((node) => {
        const card = document.createElement("article");
        card.className = `mb-card ${lane.className}`;
        const gaps = Array.isArray(node.gaps) ? node.gaps : [];
        const visible = Array.isArray(node.progress_visible) ? node.progress_visible : [];
        let signals = "";
        if (node.risk_level === "hoch") signals += '<span class="signal signal-risk" title="Hohes Risiko">!</span>';
        if (gaps.length) signals += '<span class="signal signal-gap" title="Lücken offen">~</span>';
        if (isFocusNode(node)) signals += '<span class="signal signal-focus" title="Golden Path relevant">✦</span>';
        card.innerHTML = `
          <div class="signals">${signals}</div>
          <div class="card-head">
            <span class="badge">${esc(laneLabels[node.lane] || node.lane)}</span>
            <span class="card-status">${statusDot(node.status)} ${esc(node.status)}</span>
          </div>
          <h3 class="card-title">${esc(node.title)}</h3>
          <div class="card-sub">Launch: ${esc(node.launch_class)} · Risiko: ${esc(node.risk_level)}</div>
          <div class="card-tags"><span class="mini">${esc(visible[0] || "Keine Kurznotiz")}</span></div>
        `;
        card.addEventListener("click", () => openMasterDrawer(node.node_id));
        cards.appendChild(card);
      });
      laneBoard.appendChild(section);
      if (index < lanes.length - 1) {
        const connector = document.createElement("div");
        connector.className = "flow-connector";
        connector.innerHTML = '<div class="line"></div><div class="label">Weiter zur nächsten Ebene</div><div class="line"></div>';
        laneBoard.appendChild(connector);
      }
    });
    updateStats();
  }

  function renderOps() {
    processList.innerHTML = "";
    state.ops.forEach((proc) => {
      const screens = Array.isArray(proc.screens) ? proc.screens : [];
      const uiCount = screens.filter((s) => s.checked_ui).length;
      const smokeCount = screens.filter((s) => s.checked_smoke).length;
      const openBugs = (Array.isArray(proc.bugs) ? proc.bugs : []).filter((b) => b.status !== "closed").length;
      const row = document.createElement("div");
      row.className = "process-row process-table";
      row.innerHTML = `
        <div>
          <div style="font-weight:900">${esc(proc.title)}</div>
          <div class="small">${esc((Array.isArray(proc.related_nodes) ? proc.related_nodes : []).join(", "))}</div>
        </div>
        <div><span class="pill ${proc.status === "erfuellt" ? "ok" : proc.status === "teilweise" ? "mid" : "bad"}">${statusDot(proc.status)} ${esc(proc.status)}</span></div>
        <div>${screens.length}</div>
        <div>${uiCount} / ${screens.length}</div>
        <div>${smokeCount} / ${screens.length}</div>
        <div>${openBugs}</div>
        <div>${esc(proc.last_reviewed_at || "-")}</div>
      `;
      row.addEventListener("click", () => openOpsDrawer(proc.process_id));
      processList.appendChild(row);
    });
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
    const node = state.master.find((entry) => entry.node_id === nodeId);
    if (!node) return;
    setDrawerMeta(laneLabels[node.lane] || node.lane, node.title, `${node.title} · Launch ${node.launch_class} · Risiko ${node.risk_level}`);
    drawerBody.innerHTML = `
      <section class="panel two">
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
      <section class="panel"><h3>Fortschritt sichtbar</h3><textarea id="mbNodeVisible">${esc(textareaValue(node.progress_visible))}</textarea></section>
      <section class="panel"><h3>Fortschritt unsichtbar</h3><textarea id="mbNodeInvisible">${esc(textareaValue(node.progress_invisible))}</textarea></section>
      <section class="panel"><h3>Gaps</h3><textarea id="mbNodeGaps">${esc(textareaValue(node.gaps))}</textarea></section>
      <section class="panel"><h3>Entscheidungen offen</h3><textarea id="mbNodeDecisions">${esc(textareaValue(node.decisions_open))}</textarea></section>
      <section class="panel"><h3>Referenzen</h3><textarea id="mbNodeRefs">${esc(textareaValue(node.refs))}</textarea></section>
      <section class="panel">
        <div class="btnrow">
          <button type="button" class="primary" id="mbNodeSave">In DB speichern</button>
          <button type="button" id="mbNodeClose">Schließen</button>
        </div>
      </section>
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
    const proc = state.ops.find((entry) => entry.process_id === processId);
    if (!proc) return;
    setDrawerMeta("Operatives Kontrollboard", proc.title, "Status, Review und Prozessdaten");
    drawerBody.innerHTML = `
      <section class="panel two">
        <label><span>Titel</span><input id="mbProcessTitle" type="text" value="${esc(proc.title)}" /></label>
        <label><span>Owner</span><input id="mbProcessOwner" type="text" value="${esc(proc.owner || "")}" /></label>
        <label><span>Status</span>
          <select id="mbProcessStatus">
            ${["offen", "teilweise", "erfuellt"].map((value) => `<option value="${value}"${value === proc.status ? " selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <label><span>Priorität</span>
          <select id="mbProcessPriority">
            ${["niedrig", "normal", "mittel", "hoch", "kritisch"].map((value) => `<option value="${value}"${value === proc.priority ? " selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <label><span>Letztes Review</span><input id="mbProcessReviewed" type="date" value="${esc(proc.last_reviewed_at || "")}" /></label>
        <label><span>Related Nodes</span><textarea id="mbProcessNodes">${esc(textareaValue(proc.related_nodes))}</textarea></label>
      </section>
      <section class="panel"><h3>Summary</h3><textarea id="mbProcessSummary">${esc(proc.summary || "")}</textarea></section>
      <section class="panel"><h3>Review-Notiz</h3><textarea id="mbProcessReview">${esc(proc.review_note || "")}</textarea></section>
      <section class="panel"><h3>Screens (JSON)</h3><textarea id="mbProcessScreens">${esc(prettyJson(proc.screens))}</textarea></section>
      <section class="panel"><h3>Smoke Checks (JSON)</h3><textarea id="mbProcessSmoke">${esc(prettyJson(proc.smoke_checks))}</textarea></section>
      <section class="panel"><h3>Bugs (JSON)</h3><textarea id="mbProcessBugs">${esc(prettyJson(proc.bugs))}</textarea></section>
      <section class="panel">
        <div class="btnrow">
          <button type="button" class="primary" id="mbProcessSave">In DB speichern</button>
          <button type="button" id="mbProcessClose">Schließen</button>
        </div>
      </section>
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
    state.master = Array.isArray(masterRows) ? masterRows : [];
    state.ops = Array.isArray(processRows) ? processRows : [];
    state.loaded = true;
    renderMaster();
    renderOps();
    updateStats();
  }

  async function seedFromBootstrap() {
    const masterNodes = Array.isArray(BOOT_MASTER?.nodes) ? BOOT_MASTER.nodes : [];
    const processes = Array.isArray(BOOT_OPS?.processes) ? BOOT_OPS.processes : [];
    const result = await rpc("fcp_masterboard_seed", {
      p_nodes: masterNodes,
      p_processes: processes,
    });
    await loadState();
    setMsg(`Bootstrap übernommen: ${result?.nodes_upserted || 0} Knoten, ${result?.processes_upserted || 0} Prozesse.`);
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

  function bindEvents() {
    lanes.forEach((lane) => {
      const opt = document.createElement("option");
      opt.value = lane.key;
      opt.textContent = lane.title.replace(/^Ebene \d+ — /, "");
      document.getElementById("masterboardLaneFilter").appendChild(opt);
    });

    ["masterboardSearch", "masterboardLaneFilter", "masterboardStatusFilter", "masterboardSignalFilter"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderMaster);
      document.getElementById(id)?.addEventListener("change", renderMaster);
    });

    document.getElementById("masterboardRefreshBtn")?.addEventListener("click", () => {
      loadState().then(() => setMsg("Board-Zustand aus der DB neu geladen.")).catch((err) => setMsg(err.message || "Board konnte nicht geladen werden.", true));
    });
    document.getElementById("masterboardSeedBtn")?.addEventListener("click", () => {
      seedFromBootstrap().catch((err) => setMsg(err.message || "Bootstrap konnte nicht übernommen werden.", true));
    });
    document.getElementById("masterboardExportMasterBtn")?.addEventListener("click", () => {
      exportJson("fcp_masterboard_state_export.json", { nodes: state.master });
    });
    document.getElementById("masterboardExportOpsBtn")?.addEventListener("click", () => {
      exportJson("fcp_process_control_state_export.json", { processes: state.ops });
    });

    document.querySelectorAll("[data-masterboard-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-masterboard-tab]").forEach((node) => node.classList.remove("active"));
        btn.classList.add("active");
        const master = btn.getAttribute("data-masterboard-tab") === "master";
        masterView.classList.toggle("hidden", !master);
        opsView.classList.toggle("hidden", master);
      });
    });

    document.getElementById("masterboardDrawerClose")?.addEventListener("click", closeDrawer);
    overlay?.addEventListener("click", closeDrawer);
  }

  async function init() {
    bindEvents();
    try {
      await loadState();
      if (!state.master.length && Array.isArray(BOOT_MASTER?.nodes) && BOOT_MASTER.nodes.length) {
        setMsg("Board-Tabellen sind noch leer. Du kannst den bestehenden JSON-Stand per ‚Bootstrap übernehmen‘ einmalig in die DB schreiben.");
      } else {
        setMsg("Masterboard ist live an die DB angebunden.");
      }
    } catch (err) {
      const hint = "Falls du bereits Superadmin im Portal bist, fehlt vermutlich noch dein Eintrag in public.system_superadmins oder role=superadmin.";
      setMsg(`${err.message || "Board konnte nicht geladen werden."} ${hint}`, true);
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
