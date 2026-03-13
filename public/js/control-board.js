;(() => {
  const STORAGE_KEY = "vdan_control_board_state_v1";
  const DEFAULT_SMOKE = [
    "Maske laedt ohne JS-/Renderfehler",
    "Rollen-/Zugriffsverhalten passt",
    "Hauptaktion / Happy Path funktioniert",
    "Leere und Fehler-States geprueft",
    "Mobile Layout geprueft",
  ];

  const WAVE_ORDER = ["W1", "W2", "W3", "W4"];
  const WAVE_LABELS = {
    W1: "Welle 1 - Referenzmasken",
    W2: "Welle 2 - Ausbau / Kernverwaltung",
    W3: "Welle 3 - Ergaenzende Fachmasken",
    W4: "Welle 4 - Interne Tools / Querschnitt",
  };

  const ITEMS = [
    { id: "fangliste", label: "Fangliste", route: "/app/fangliste/", group: "Kernmodule", wave: "W1", type: "mask", owner: "user+codex", open: ["Workflow-Audit: Zweck, Rollen und Hauptstates dokumentieren", "Workflow-Audit: Datenquellen, RPCs und Offline-Pfade erfassen", "Komponenten-Audit: Liste, Filter, Dialoge und Aktionen gegen Standards mappen", "Komponenten-Audit: Abweichungen und Spezialkomponenten bewerten", "Smoke: Happy Path fuer Eintrag erfassen und Kein-Fang pruefen"] },
    { id: "arbeitseinsaetze", label: "Arbeitseinsaetze", route: "/app/arbeitseinsaetze/", group: "Kernmodule", wave: "W1", type: "mask", owner: "user+codex", open: ["Workflow-Audit: Anmeldung, Check-in und Check-out als Ablauf dokumentieren", "Workflow-Audit: Rollen, Event-Status und Offline-Queue festhalten", "Komponenten-Audit: Listen, Check-in-Aktionen und Statusbausteine klassifizieren", "Komponenten-Audit: Mobile und QR-bezogene Sonderfaelle markieren", "Smoke: Anmeldung und Check-in-Flow manuell bestaetigen"] },
    { id: "ausweis", label: "Mitgliedsausweis", route: "/app/ausweis/", group: "Kernmodule", wave: "W3", type: "mask", owner: "user+codex", open: ["Ausweis-Lifecycle gegen Registry abstimmen", "Komponenten-Audit erstellen"] },
    { id: "gewaesserkarte", label: "Gewaesserkarte", route: "/app/gewaesserkarte/", group: "Kernmodule", wave: "W3", type: "mask", open: ["VDAN-only Verhalten pruefen", "Komponenten-Audit erstellen"] },
    { id: "zustaendigkeiten", label: "Zustaendigkeiten", route: "/app/zustaendigkeiten/", group: "Kernmodule", wave: "W3", type: "mask", open: ["Workflow-Audit erstellen", "Offline-Verhalten pruefen"] },
    { id: "einstellungen", label: "Einstellungen", route: "/app/einstellungen/", group: "Kernmodule", wave: "W1", type: "mask", open: ["Workflow-Audit: Account, Notifications und Portal-Praeferenzen aufteilen", "Workflow-Audit: RPC-Fallbacks und Preview-Gates explizit markieren", "Komponenten-Audit: Formularbausteine, Info-States und Aktionsleisten mappen", "Komponenten-Audit: Standardabweichungen fuer Settings-Formulare festhalten", "Smoke: Account-Ansicht, Edit-Flow und Notification-Abschnitt pruefen"] },
    { id: "zugang_pruefen", label: "Zugang pruefen", route: "/app/zugang-pruefen/", group: "Kernmodule", wave: "W3", type: "mask", open: ["Gate-Finalisierung klaeren", "Komponenten-Audit erstellen"] },
    { id: "mitglieder", label: "Mitglieder", route: "/app/mitglieder/", group: "Admin / Betrieb", wave: "W1", type: "mask", open: ["Workflow-Audit: Listenansicht, Detailansicht und Admin-Aktionen dokumentieren", "Workflow-Audit: Rollen, Datenquellen und Policy-Annahmen pruefen", "Komponenten-Audit: Tabellen-/Kartenwechsel, Filter und Detaildialog klassifizieren", "Komponenten-Audit: Tabellenstandard gegen reale Umsetzung abgleichen", "Smoke: Listenwechsel, Detailoeffnung und Schliessen bestaetigen"] },
    { id: "mitgliederverwaltung", label: "Mitglieder-Registry", route: "/app/mitgliederverwaltung/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Fehlende Teilbereiche priorisieren", "ACL-Pilot-Stub durch echte Backend-Logik ersetzen", "Komponenten-Audit erstellen"] },
    { id: "bewerbungen", label: "Bewerbungen", route: "/app/bewerbungen/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Workflow-Audit erstellen", "Komponenten-Audit erstellen"] },
    { id: "dokumente", label: "Dokumente", route: "/app/dokumente/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Betriebsreife pruefen", "Komponenten-Audit erstellen"] },
    { id: "sitzungen", label: "Sitzungen", route: "/app/sitzungen/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Workflow-Audit erstellen", "Komponenten-Audit erstellen"] },
    { id: "arbeitseinsaetze_cockpit", label: "Arbeitseinsatz Cockpit", route: "/app/arbeitseinsaetze/cockpit/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Workflow-Audit erstellen", "Komponenten-Audit erstellen"] },
    { id: "termine_cockpit", label: "Termine Cockpit", route: "/app/termine/cockpit/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Workflow-Audit erstellen", "Komponenten-Audit erstellen"] },
    { id: "fangliste_cockpit", label: "Fangliste Cockpit", route: "/app/fangliste/cockpit/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Reporting-Pruefung dokumentieren", "Komponenten-Audit erstellen"] },
    { id: "admin_panel", label: "Admin Board", route: "/app/admin-panel/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Platzhalterbereiche entscheiden", "Komponenten-Audit erstellen"] },
    { id: "vereine", label: "Vereins-Setup", route: "/app/vereine/", group: "Admin / Betrieb", wave: "W2", type: "mask", open: ["Setup-Flow dokumentieren", "Komponenten-Audit erstellen"] },
    { id: "component_library", label: "Component Library", route: "/app/component-library/", group: "Interne Tools", wave: "W4", type: "mask", open: ["Standardbibliothek mit realen IDs schaerfen", "Studio-Contract vervollstaendigen"] },
    { id: "template_studio", label: "Template Studio", route: "/app/template-studio/", group: "Interne Tools", wave: "W4", type: "mask", open: ["Studio-Contract vervollstaendigen", "Sidebar-/Slot-Strategie klaeren"] },
    { id: "ui_demo", label: "UI Neumorph Demo", route: "/app/ui-neumorph-demo/", group: "Interne Tools", wave: "W4", type: "mask", open: ["Referenzcharakter dokumentieren", "Standard-Match pruefen"] },
    { id: "notes", label: "Notes", route: "/app/notes/", group: "Interne Tools", wave: "W4", type: "mask", open: ["Nur Demo oder echtes Werkzeug entscheiden", "Komponenten-Audit erstellen"] },
    { id: "token_alignment", label: "Token Angleich", route: "Querschnitt", group: "Querschnitt", wave: "W4", type: "track", open: ["token_map.md mit realen Komponenten abgleichen", "Hardcoded-Farben und Sonderwerte identifizieren", "Rueckbauplan fuer Token-Abweichungen erstellen"] },
    { id: "studio_contract", label: "Studio Contract", route: "Querschnitt", group: "Querschnitt", wave: "W4", type: "track", open: ["Nicht compliant Masken auf data-studio-* bringen", "Contract-Report auf gruen ziehen"] },
    { id: "component_audit", label: "Komponenten-Audit Standard", route: "Querschnitt", group: "Querschnitt", wave: "W4", type: "track", open: ["COMPONENT_STANDARDS.md weiter schaerfen", "Pilot-Audits fuer Kernmasken durchziehen"] },
    { id: "release_ops", label: "Release / Ops", route: "Querschnitt", group: "Querschnitt", wave: "W4", type: "track", open: ["Runtime-Sanity-Tests protokollieren", "Mail-Template-/Domain-Cutover abschliessen", "Secret-Rotation dokumentieren"] },
  ];

  const ITEM_MAP = new Map(ITEMS.map((item) => [item.id, item]));
  const GROUPS = [...new Set(ITEMS.map((item) => item.group))];

  const state = {
    selectedId: "overview",
    search: "",
    filters: {
      openOnly: false,
      issuesOnly: false,
      smokeOpenOnly: false,
    },
    collapsedGroups: {},
    items: {},
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function fmtDate(value) {
    const d = new Date(value || "");
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("de-DE");
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setMsg(text = "", danger = false) {
    const el = document.getElementById("controlBoardMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function copyText(text, successMessage) {
    const payload = String(text || "").trim();
    if (!payload) return Promise.resolve(false);
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(payload).then(() => {
        setMsg(successMessage || "Kopiert.");
        return true;
      }).catch(() => {
        window.prompt("Bitte kopieren:", payload);
        setMsg(successMessage || "Kopiert.");
        return true;
      });
    }
    window.prompt("Bitte kopieren:", payload);
    setMsg(successMessage || "Kopiert.");
    return Promise.resolve(true);
  }

  function defaultItemState(item) {
    return {
      status: "todo",
      owner: item.owner || "",
      tasks: (Array.isArray(item.open) ? item.open : []).map((text, idx) => ({
        id: `task:${item.id}:${idx + 1}`,
        text,
        done: false,
        created_at: nowIso(),
        completed_at: "",
      })),
      smokeTests: DEFAULT_SMOKE.map((label, idx) => ({
        id: `smoke:${item.id}:${idx + 1}`,
        label,
        checked: false,
        checked_at: "",
      })),
      issues: [],
      notes: [],
      updated_at: "",
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  function loadState() {
    let parsed = {};
    try {
      parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      parsed = {};
    }

    state.selectedId = ITEM_MAP.has(parsed.selectedId) ? parsed.selectedId : "overview";
    state.search = String(parsed.search || "");
    state.filters = {
      openOnly: Boolean(parsed?.filters?.openOnly),
      issuesOnly: Boolean(parsed?.filters?.issuesOnly),
      smokeOpenOnly: Boolean(parsed?.filters?.smokeOpenOnly),
    };
    state.collapsedGroups = typeof parsed?.collapsedGroups === "object" && parsed.collapsedGroups
      ? Object.fromEntries(Object.entries(parsed.collapsedGroups).map(([key, value]) => [String(key), Boolean(value)]))
      : {};
    state.items = {};

    ITEMS.forEach((item) => {
      const incoming = parsed?.items?.[item.id];
      const fallback = defaultItemState(item);
      state.items[item.id] = {
        status: ["todo", "ready", "doing", "blocked", "review", "done"].includes(String(incoming?.status || "")) ? String(incoming.status) : fallback.status,
        owner: String(incoming?.owner || fallback.owner || ""),
        tasks: Array.isArray(incoming?.tasks) && incoming.tasks.length
          ? incoming.tasks.map((task) => ({
            id: String(task?.id || `task:${item.id}:${Math.random().toString(36).slice(2, 8)}`),
            text: String(task?.text || "").trim(),
            done: Boolean(task?.done),
            created_at: String(task?.created_at || nowIso()),
            completed_at: String(task?.completed_at || ""),
          })).filter((task) => task.text)
          : fallback.tasks,
        smokeTests: Array.isArray(incoming?.smokeTests) && incoming.smokeTests.length
          ? incoming.smokeTests.map((test) => ({
            id: String(test?.id || `smoke:${item.id}:${Math.random().toString(36).slice(2, 8)}`),
            label: String(test?.label || "").trim(),
            checked: Boolean(test?.checked),
            checked_at: String(test?.checked_at || ""),
          })).filter((test) => test.label)
          : fallback.smokeTests,
        issues: Array.isArray(incoming?.issues)
          ? incoming.issues.map((issue) => ({
            id: String(issue?.id || `issue:${item.id}:${Math.random().toString(36).slice(2, 8)}`),
            title: String(issue?.title || "").trim(),
            detail: String(issue?.detail || "").trim(),
            component: String(issue?.component || "").trim(),
            standardId: String(issue?.standardId || "").trim(),
            componentRef: String(issue?.componentRef || "").trim(),
            severity: String(issue?.severity || "medium"),
            resolved: Boolean(issue?.resolved),
            created_at: String(issue?.created_at || nowIso()),
          })).filter((issue) => issue.title || issue.detail)
          : [],
        notes: Array.isArray(incoming?.notes)
          ? incoming.notes.map((note) => ({
            id: String(note?.id || `note:${item.id}:${Math.random().toString(36).slice(2, 8)}`),
            text: String(note?.text || "").trim(),
            created_at: String(note?.created_at || nowIso()),
          })).filter((note) => note.text)
          : [],
        updated_at: String(incoming?.updated_at || ""),
      };
    });
  }

  function touchItem(itemId) {
    if (!state.items[itemId]) return;
    state.items[itemId].updated_at = nowIso();
    saveState();
  }

  function selectedItem() {
    return ITEM_MAP.get(state.selectedId) || null;
  }

  function selectedItemState() {
    const item = selectedItem();
    if (!item) return null;
    return state.items[item.id] || null;
  }

  function filteredItems() {
    const q = String(state.search || "").trim().toLowerCase();
    return ITEMS.filter((item) => {
      const itemState = state.items[item.id];
      const task = taskStats(itemState);
      const smoke = smokeStats(itemState);
      const issues = openIssueCount(itemState);
      const hay = `${item.label} ${item.route} ${item.group}`.toLowerCase();
      const searchMatch = !q || hay.includes(q);
      if (!searchMatch) return false;
      if (state.filters.openOnly && task.open < 1) return false;
      if (state.filters.issuesOnly && issues < 1) return false;
      if (state.filters.smokeOpenOnly && smoke.done >= smoke.total) return false;
      return true;
    });
  }

  function taskStats(itemState) {
    const tasks = Array.isArray(itemState?.tasks) ? itemState.tasks : [];
    const open = tasks.filter((task) => !task.done).length;
    const done = tasks.filter((task) => task.done).length;
    return { open, done, total: tasks.length };
  }

  function smokeStats(itemState) {
    const tests = Array.isArray(itemState?.smokeTests) ? itemState.smokeTests : [];
    const done = tests.filter((test) => test.checked).length;
    return { done, total: tests.length };
  }

  function openIssueCount(itemState) {
    return (Array.isArray(itemState?.issues) ? itemState.issues : []).filter((issue) => !issue.resolved).length;
  }

  function taskProgress(itemState) {
    const task = taskStats(itemState);
    const percent = task.total ? Math.round((task.done / task.total) * 100) : 0;
    return { ...task, percent };
  }

  function waveProgress(wave) {
    const items = ITEMS.filter((item) => (item.wave || "W4") === wave);
    const totals = items.reduce((acc, item) => {
      const itemState = state.items[item.id];
      const task = taskStats(itemState);
      acc.items += 1;
      acc.itemDone += task.open === 0 ? 1 : 0;
      acc.open += task.open;
      acc.done += task.done;
      return acc;
    }, { items: 0, itemDone: 0, open: 0, done: 0 });
    const totalTasks = totals.open + totals.done;
    return {
      ...totals,
      percent: totalTasks ? Math.round((totals.done / totalTasks) * 100) : 0,
    };
  }

  function recentDoneTasks(limit = 8) {
    return ITEMS.flatMap((item) => {
      const itemState = state.items[item.id];
      return (itemState?.tasks || [])
        .filter((task) => task.done && task.completed_at)
        .map((task) => ({ item, task }));
    })
      .sort((a, b) => new Date(b.task.completed_at).getTime() - new Date(a.task.completed_at).getTime())
      .slice(0, limit);
  }

  function upcomingOpenTasks(limit = 8) {
    return [...ITEMS]
      .sort((a, b) => WAVE_ORDER.indexOf(a.wave || "W4") - WAVE_ORDER.indexOf(b.wave || "W4"))
      .flatMap((item) => {
        const itemState = state.items[item.id];
        return (itemState?.tasks || [])
          .filter((task) => !task.done)
          .map((task) => ({ item, task }));
      })
      .slice(0, limit);
  }

  function statusChip(status) {
    return `<span class="control-board__status-chip control-board__status-chip--${status === "done" ? "done" : status === "blocked" ? "blocked" : status === "review" ? "review" : "active"}">${esc(status)}</span>`;
  }

  function severityChip(severity) {
    return `<span class="control-board__chip is-${esc(severity)}">${esc(severity)}</span>`;
  }

  function waveChip(item) {
    const wave = item?.wave || "W4";
    return `<span class="control-board__wave-chip">${esc(WAVE_LABELS[wave] || wave)}</span>`;
  }

  function renderNav() {
    const root = document.getElementById("controlBoardNavGroups");
    if (!root) return;
    const filtered = filteredItems();
    const setFilterState = (id, active) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("is-active", Boolean(active));
    };
    setFilterState("controlBoardFilterOpen", state.filters.openOnly);
    setFilterState("controlBoardFilterIssues", state.filters.issuesOnly);
    setFilterState("controlBoardFilterSmoke", state.filters.smokeOpenOnly);
    root.innerHTML = `
      <div class="control-board__nav-group">
        <p class="control-board__nav-group-title">Uebersicht</p>
        <button type="button" class="admin-nav-btn ${state.selectedId === "overview" ? "is-active" : ""}" data-cb-nav="overview">Gesamtueberblick</button>
      </div>
      ${GROUPS.map((group) => {
        const items = filtered.filter((item) => item.group === group);
        if (!items.length) return "";
        const groupOpen = items.reduce((sum, item) => sum + taskStats(state.items[item.id]).open, 0);
        const groupIssues = items.reduce((sum, item) => sum + openIssueCount(state.items[item.id]), 0);
        const collapsed = Boolean(state.collapsedGroups[group]);
        return `
          <div class="control-board__nav-group ${collapsed ? "is-collapsed" : ""}">
            <button type="button" class="control-board__nav-group-toggle" data-cb-group-toggle="${esc(group)}">
              <p class="control-board__nav-group-title">${esc(group)}</p>
              <span class="control-board__chips">
                <span class="control-board__group-badge">${items.length}</span>
                <span class="control-board__group-badge">offen ${groupOpen}</span>
                <span class="control-board__group-badge">issues ${groupIssues}</span>
              </span>
            </button>
            <div class="control-board__nav-group-items">
              ${items.map((item) => {
              const itemState = state.items[item.id];
              const stats = taskStats(itemState);
              const issues = openIssueCount(itemState);
              const progress = taskProgress(itemState);
              return `
                <button type="button" class="admin-nav-btn ${state.selectedId === item.id ? "is-active" : ""}" data-cb-nav="${item.id}">
                  <span class="control-board__nav-main">
                    <strong>${esc(item.label)}</strong>
                    ${statusChip(itemState.status)}
                  </span>
                  <span class="control-board__nav-wave">${waveChip(item)}</span>
                  <span class="control-board__nav-route">${esc(item.route)}</span>
                  <span class="control-board__nav-meta">
                    <span class="control-board__nav-count">offen ${stats.open}</span>
                    <span class="control-board__nav-count">erledigt ${stats.done}</span>
                    <span class="control-board__nav-count">issues ${issues}</span>
                  </span>
                  <span class="control-board__nav-progress">
                    <span class="control-board__nav-progress-label">${progress.percent}% erledigt</span>
                    <span class="control-board__progress-bar" aria-hidden="true"><span style="width:${progress.percent}%"></span></span>
                  </span>
                </button>
              `;
            }).join("")}
            </div>
          </div>
        `;
      }).join("")}
    `;
  }

  function renderOverview() {
    const rows = [...ITEMS]
      .sort((a, b) => {
        const waveDelta = WAVE_ORDER.indexOf(a.wave || "W4") - WAVE_ORDER.indexOf(b.wave || "W4");
        if (waveDelta !== 0) return waveDelta;
        return a.label.localeCompare(b.label, "de");
      })
      .map((item) => ({ item, data: state.items[item.id] }));
    const totals = rows.reduce((acc, entry) => {
      const task = taskStats(entry.data);
      const smoke = smokeStats(entry.data);
      acc.items += 1;
      acc.open += task.open;
      acc.done += task.done;
      acc.smokeDone += smoke.done;
      acc.smokeTotal += smoke.total;
      acc.issues += openIssueCount(entry.data);
      return acc;
    }, { items: 0, open: 0, done: 0, smokeDone: 0, smokeTotal: 0, issues: 0 });

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    setText("cbOverviewItems", totals.items);
    setText("cbOverviewOpen", totals.open);
    setText("cbOverviewDone", totals.done);
    setText("cbOverviewSmoke", `${totals.smokeDone}/${totals.smokeTotal}`);
    setText("cbOverviewIssues", totals.issues);

    const waveRoot = document.getElementById("controlBoardWaveProgress");
    if (waveRoot) {
      waveRoot.innerHTML = WAVE_ORDER.map((wave) => {
        const progress = waveProgress(wave);
        return `
          <article class="control-board__wave-card">
            <div class="control-board__wave-head">
              <h4>${esc(WAVE_LABELS[wave])}</h4>
              <strong>${progress.percent}%</strong>
            </div>
            <div class="control-board__progress-bar" aria-hidden="true"><span style="width:${progress.percent}%"></span></div>
            <div class="control-board__wave-meta">
              <span>${progress.itemDone}/${progress.items} Masken ohne offene Punkte</span>
              <span>${progress.done} erledigt</span>
              <span>${progress.open} offen</span>
            </div>
          </article>
        `;
      }).join("");
    }

    const doneRoot = document.getElementById("controlBoardRecentDone");
    if (doneRoot) {
      const entries = recentDoneTasks();
      doneRoot.innerHTML = entries.length
        ? entries.map(({ item, task }) => `
            <article class="control-board__history-item">
              <strong>${esc(task.text)}</strong>
              <p>${esc(item.label)}</p>
              <div class="control-board__history-meta">
                <span>${esc(WAVE_LABELS[item.wave] || item.wave || "-")}</span>
                <span>${fmtDate(task.completed_at)}</span>
              </div>
            </article>
          `).join("")
        : '<div class="control-board__empty">Noch keine erledigten Punkte sichtbar.</div>';
    }

    const upcomingRoot = document.getElementById("controlBoardUpcomingOpen");
    if (upcomingRoot) {
      const entries = upcomingOpenTasks();
      upcomingRoot.innerHTML = entries.length
        ? entries.map(({ item, task }) => `
            <article class="control-board__history-item">
              <strong>${esc(task.text)}</strong>
              <p>${esc(item.label)}</p>
              <div class="control-board__history-meta">
                <span>${esc(WAVE_LABELS[item.wave] || item.wave || "-")}</span>
                <span>${esc(item.route)}</span>
              </div>
            </article>
          `).join("")
        : '<div class="control-board__empty">Aktuell keine offenen Punkte mehr.</div>';
    }

    const tbody = document.querySelector("#controlBoardOverviewTable tbody");
    const report = document.getElementById("controlBoardOverviewReport");
    if (report) report.textContent = formatOverviewExport(false);
    if (!tbody) return;
    tbody.innerHTML = rows.map(({ item, data }) => {
      const task = taskStats(data);
      const smoke = smokeStats(data);
      const issues = openIssueCount(data);
      return `
        <tr>
          <td><strong>${esc(item.label)}</strong><br /><span class="small">${esc(item.group)}</span></td>
          <td><div>${esc(item.route)}</div><div class="small">${esc(WAVE_LABELS[item.wave] || item.wave || "-")}</div></td>
          <td>${statusChip(data.status)}</td>
          <td>${task.open}</td>
          <td>${task.done}</td>
          <td>${smoke.done}/${smoke.total}</td>
          <td>${issues}</td>
          <td><button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-open="${item.id}">Oeffnen</button></td>
        </tr>
      `;
    }).join("");
  }

  function renderDetail() {
    const item = selectedItem();
    const itemState = selectedItemState();
    const detailSection = document.querySelector('[data-control-panel="detail"]');
    const overviewSection = document.querySelector('[data-control-panel="overview"]');
    if (!detailSection || !overviewSection) return;

    const isOverview = state.selectedId === "overview" || !item || !itemState;
    overviewSection.classList.toggle("is-active", isOverview);
    detailSection.classList.toggle("is-active", !isOverview);
    if (isOverview) return;

    const task = taskStats(itemState);
    const smoke = smokeStats(itemState);
    const issues = openIssueCount(itemState);
    const progress = taskProgress(itemState);

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    setText("controlBoardDetailTitle", item.label);
    setText("controlBoardDetailMeta", `${item.route} · ${item.group} · ${WAVE_LABELS[item.wave] || item.wave || "-"} · Typ ${item.type}`);
    setText("cbDetailOpen", task.open);
    setText("cbDetailDone", task.done);
    setText("cbDetailSmoke", `${smoke.done}/${smoke.total}`);
    setText("cbDetailIssues", issues);
    setText("cbDetailUpdated", itemState.updated_at ? fmtDate(itemState.updated_at) : "-");
    setText("cbDetailProgressText", `${progress.done}/${progress.total} Punkte erledigt (${progress.percent}%)`);
    const progressBar = document.getElementById("cbDetailProgressBar");
    if (progressBar) progressBar.style.width = `${progress.percent}%`;

    const statusEl = document.getElementById("controlBoardStatus");
    const ownerEl = document.getElementById("controlBoardOwner");
    if (statusEl) statusEl.value = itemState.status;
    if (ownerEl) ownerEl.value = itemState.owner || "";

    renderTaskLists(itemState);
    renderSmokeTests(itemState);
    renderIssues(itemState);
    renderNotes(itemState);
  }

  function renderTaskLists(itemState) {
    const openRoot = document.getElementById("controlBoardOpenTasks");
    const doneRoot = document.getElementById("controlBoardDoneTasks");
    if (!openRoot || !doneRoot) return;
    const tasks = Array.isArray(itemState.tasks) ? itemState.tasks : [];
    const renderTask = (task) => `
      <div class="control-board__list-row ${task.done ? "is-done" : ""}">
        <input class="control-board__check" type="checkbox" data-cb-task-toggle="${esc(task.id)}" ${task.done ? "checked" : ""} />
        <div class="control-board__row-body">
          <p class="control-board__row-title">${esc(task.text)}</p>
          <div class="control-board__row-meta">
            <span>${fmtDate(task.created_at)}</span>
            <span class="control-board__row-state">${task.done ? "erledigt" : "offen"}</span>
          </div>
        </div>
        <div class="control-board__row-actions">
          <button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-task-copy="${esc(task.id)}">Copy</button>
        </div>
      </div>
    `;
    const openTasks = tasks.filter((entry) => !entry.done);
    const doneTasks = tasks.filter((entry) => entry.done);
    openRoot.innerHTML = openTasks.length ? openTasks.map(renderTask).join("") : '<div class="control-board__empty">Keine offenen Punkte.</div>';
    doneRoot.innerHTML = doneTasks.length ? doneTasks.map(renderTask).join("") : '<div class="control-board__empty">Noch nichts als erledigt markiert.</div>';
  }

  function renderSmokeTests(itemState) {
    const root = document.getElementById("controlBoardSmokeTests");
    if (!root) return;
    const tests = Array.isArray(itemState.smokeTests) ? itemState.smokeTests : [];
    root.innerHTML = tests.length
      ? tests.map((test) => `
          <div class="control-board__list-row ${test.checked ? "is-done" : ""}">
            <input class="control-board__check" type="checkbox" data-cb-smoke-toggle="${esc(test.id)}" ${test.checked ? "checked" : ""} />
            <div class="control-board__row-body">
              <p class="control-board__row-title">${esc(test.label)}</p>
              <div class="control-board__row-meta">
                <span>${test.checked_at ? `bestaetigt ${fmtDate(test.checked_at)}` : "noch offen"}</span>
                <span class="control-board__row-state">${test.checked ? "ok" : "offen"}</span>
              </div>
            </div>
            <div class="control-board__row-actions">
              <button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-smoke-copy="${esc(test.id)}">Copy</button>
            </div>
          </div>
        `).join("")
      : '<div class="control-board__empty">Noch keine Smoke-Tests angelegt.</div>';
  }

  function renderIssues(itemState) {
    const root = document.getElementById("controlBoardIssues");
    if (!root) return;
    const issues = Array.isArray(itemState.issues) ? itemState.issues : [];
    root.innerHTML = issues.length
      ? issues.map((issue) => `
          <div class="control-board__issue ${issue.resolved ? "is-resolved" : ""}">
            <div class="control-board__issue-head">
              <div>
                <strong>${esc(issue.title || "Issue")}</strong>
                <div class="small">${fmtDate(issue.created_at)}</div>
              </div>
              <div class="control-board__chips">
                ${severityChip(issue.severity)}
                ${issue.resolved ? '<span class="control-board__chip">resolved</span>' : '<span class="control-board__chip">open</span>'}
              </div>
            </div>
            <div class="control-board__issue-meta">
              <span><strong>Komponente</strong> ${esc(issue.component || "-")}</span>
              <span><strong>Standard</strong> ${esc(issue.standardId || "-")}</span>
              <span><strong>Ref</strong> ${esc(issue.componentRef || "-")}</span>
            </div>
            <div class="control-board__issue-body">${esc(issue.detail || "-")}</div>
            <div class="admin-actions admin-actions--toolbar control-board__actions">
              <button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-issue-toggle="${esc(issue.id)}">${issue.resolved ? "Wieder oeffnen" : "Als geloest markieren"}</button>
              <button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-issue-copy="${esc(issue.id)}">Copy</button>
              <button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-issue-delete="${esc(issue.id)}">Loeschen</button>
            </div>
          </div>
        `).join("")
      : '<div class="control-board__empty">Noch keine Issues erfasst.</div>';
  }

  function renderNotes(itemState) {
    const root = document.getElementById("controlBoardNotes");
    if (!root) return;
    const notes = Array.isArray(itemState.notes) ? itemState.notes : [];
    root.innerHTML = notes.length
      ? notes.map((note) => `
          <div class="control-board__note">
            <div class="control-board__note-head">
              <strong>Notiz</strong>
              <span class="small">${fmtDate(note.created_at)}</span>
            </div>
            <div class="control-board__note-body">${esc(note.text)}</div>
            <div class="admin-actions admin-actions--toolbar control-board__actions">
              <button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-note-copy="${esc(note.id)}">Copy</button>
              <button type="button" class="control-board__btn control-board__btn--ghost control-board__btn--small" data-cb-note-delete="${esc(note.id)}">Loeschen</button>
            </div>
          </div>
        `).join("")
      : '<div class="control-board__empty">Noch keine Notizen hinterlegt.</div>';
  }

  function formatTaskExport(item, task) {
    return [
      `# Kontrollboard Punkt`,
      `- Bereich: ${item.label}`,
      `- Route/Scope: ${item.route}`,
      `- Status: ${state.items[item.id].status}`,
      `- Punkt: ${task.text}`,
      `- Erledigt: ${task.done ? "ja" : "nein"}`,
      `- Timestamp: ${task.created_at}`,
    ].join("\n");
  }

  function formatSmokeExport(item, test) {
    return [
      `# Kontrollboard Smoke-Test`,
      `- Bereich: ${item.label}`,
      `- Route/Scope: ${item.route}`,
      `- Test: ${test.label}`,
      `- Bestaetigt: ${test.checked ? "ja" : "nein"}`,
      `- Timestamp: ${test.checked_at || "-"}`,
    ].join("\n");
  }

  function formatIssueExport(item, itemState, issue) {
    const openTasks = itemState.tasks.filter((task) => !task.done).map((task) => `  - ${task.text}`).join("\n") || "  - keine";
    const pendingSmoke = itemState.smokeTests.filter((test) => !test.checked).map((test) => `  - ${test.label}`).join("\n") || "  - keine";
    return [
      `# Kontrollboard Issue`,
      `- Bereich: ${item.label}`,
      `- Route/Scope: ${item.route}`,
      `- Gruppenbereich: ${item.group}`,
      `- Status: ${itemState.status}`,
      `- Owner: ${itemState.owner || "-"}`,
      `- Komponente: ${issue.component || "-"}`,
      `- Standard-ID: ${issue.standardId || "-"}`,
      `- Komponenten-Ref: ${issue.componentRef || "-"}`,
      `- Severity: ${issue.severity}`,
      `- Resolved: ${issue.resolved ? "ja" : "nein"}`,
      `- Titel: ${issue.title || "-"}`,
      `- Beschreibung: ${issue.detail || "-"}`,
      `- Offene Punkte:\n${openTasks}`,
      `- Offene Smoke-Tests:\n${pendingSmoke}`,
      `- Timestamp: ${issue.created_at}`,
    ].join("\n");
  }

  function formatNoteExport(item, note) {
    return [
      `# Kontrollboard Notiz`,
      `- Bereich: ${item.label}`,
      `- Route/Scope: ${item.route}`,
      `- Timestamp: ${note.created_at}`,
      ``,
      note.text,
    ].join("\n");
  }

  function formatItemExport(item, itemState) {
    const tasksOpen = itemState.tasks.filter((task) => !task.done).map((task) => `- [ ] ${task.text}`).join("\n") || "- keine";
    const tasksDone = itemState.tasks.filter((task) => task.done).map((task) => `- [x] ${task.text}`).join("\n") || "- keine";
    const smoke = itemState.smokeTests.map((test) => `- [${test.checked ? "x" : " "}] ${test.label}`).join("\n") || "- keine";
    const issues = itemState.issues.map((issue) => `- ${issue.resolved ? "[resolved]" : "[open]"} ${issue.severity} :: ${issue.title || issue.detail || "Issue"}`).join("\n") || "- keine";
    const notes = itemState.notes.map((note) => `- ${note.text.split("\n")[0]}`).join("\n") || "- keine";
    return [
      `# Kontrollboard Bereich`,
      `- Bereich: ${item.label}`,
      `- Route/Scope: ${item.route}`,
      `- Gruppe: ${item.group}`,
      `- Typ: ${item.type}`,
      `- Status: ${itemState.status}`,
      `- Owner: ${itemState.owner || "-"}`,
      `- Zuletzt aktualisiert: ${itemState.updated_at || "-"}`,
      ``,
      `## Offen`,
      tasksOpen,
      ``,
      `## Erledigt`,
      tasksDone,
      ``,
      `## Smoke-Tests`,
      smoke,
      ``,
      `## Issues`,
      issues,
      ``,
      `## Notizen`,
      notes,
    ].join("\n");
  }

  function formatOverviewExport(compact = false) {
    if (compact) {
      return [...ITEMS]
        .sort((a, b) => {
          const waveDelta = WAVE_ORDER.indexOf(a.wave || "W4") - WAVE_ORDER.indexOf(b.wave || "W4");
          if (waveDelta !== 0) return waveDelta;
          return a.label.localeCompare(b.label, "de");
        })
        .map((item) => {
          const itemState = state.items[item.id];
          const task = taskStats(itemState);
          const smoke = smokeStats(itemState);
          const issues = openIssueCount(itemState);
          return `- ${item.wave || "W4"} | ${item.label} | ${item.route} | status=${itemState.status} | offen=${task.open} | erledigt=${task.done} | smoke=${smoke.done}/${smoke.total} | issues=${issues}`;
        }).join("\n");
    }

    const grouped = WAVE_ORDER.map((wave) => {
      const waveItems = ITEMS.filter((item) => (item.wave || "W4") === wave);
      if (!waveItems.length) return "";
      const rows = waveItems.map((item) => {
        const itemState = state.items[item.id];
        const smoke = smokeStats(itemState);
        return `- [ ] ${item.label.padEnd(28, " ")} | Workflow [ ] | Komponenten [ ] | Smoke [${smoke.done === smoke.total ? "x" : " "}] | ${item.route}`;
      }).join("\n");
      return `## ${WAVE_LABELS[wave]}\n\n${rows}`;
    }).filter(Boolean).join("\n\n");

    return `# FCP Kontroll-Abarbeitung\n\n${grouped}`;
  }

  function switchTo(itemId) {
    state.selectedId = itemId;
    saveState();
    renderNav();
    renderOverview();
    renderDetail();
  }

  function addTask(done) {
    const item = selectedItem();
    const itemState = selectedItemState();
    if (!item || !itemState) return;
    const inputId = done ? "controlBoardNewDoneTask" : "controlBoardNewOpenTask";
    const input = document.getElementById(inputId);
    const text = String(input?.value || "").trim();
    if (!text) return;
    itemState.tasks.unshift({
      id: `task:${item.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
            text,
            done: Boolean(done),
            created_at: nowIso(),
            completed_at: done ? nowIso() : "",
        });
    if (input) input.value = "";
    touchItem(item.id);
    renderOverview();
    renderDetail();
  }

  function addSmoke() {
    const item = selectedItem();
    const itemState = selectedItemState();
    const input = document.getElementById("controlBoardNewSmoke");
    const label = String(input?.value || "").trim();
    if (!item || !itemState || !label) return;
    itemState.smokeTests.push({
      id: `smoke:${item.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      label,
      checked: false,
      checked_at: "",
    });
    if (input) input.value = "";
    touchItem(item.id);
    renderOverview();
    renderDetail();
  }

  function addIssue() {
    const item = selectedItem();
    const itemState = selectedItemState();
    if (!item || !itemState) return;
    const title = String(document.getElementById("controlBoardIssueTitle")?.value || "").trim();
    const detail = String(document.getElementById("controlBoardIssueDetail")?.value || "").trim();
    if (!title && !detail) {
      setMsg("Bitte mindestens Titel oder Beschreibung fuer das Issue eintragen.", true);
      return;
    }
    itemState.issues.unshift({
      id: `issue:${item.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      title,
      detail,
      component: String(document.getElementById("controlBoardIssueComponent")?.value || "").trim(),
      standardId: String(document.getElementById("controlBoardIssueStandardId")?.value || "").trim(),
      componentRef: String(document.getElementById("controlBoardIssueRef")?.value || "").trim(),
      severity: String(document.getElementById("controlBoardIssueSeverity")?.value || "medium").trim(),
      resolved: false,
      created_at: nowIso(),
    });
    ["controlBoardIssueTitle", "controlBoardIssueDetail", "controlBoardIssueComponent", "controlBoardIssueStandardId", "controlBoardIssueRef"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const severity = document.getElementById("controlBoardIssueSeverity");
    if (severity) severity.value = "medium";
    touchItem(item.id);
    renderOverview();
    renderDetail();
  }

  function addNote() {
    const item = selectedItem();
    const itemState = selectedItemState();
    const input = document.getElementById("controlBoardNewNote");
    const text = String(input?.value || "").trim();
    if (!item || !itemState || !text) return;
    itemState.notes.unshift({
      id: `note:${item.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      text,
      created_at: nowIso(),
    });
    if (input) input.value = "";
    touchItem(item.id);
    renderDetail();
  }

  function bindEvents() {
    document.getElementById("controlBoardSearch")?.addEventListener("input", (event) => {
      state.search = String(event.target?.value || "");
      saveState();
      renderNav();
    });

    document.getElementById("controlBoardFilterOpen")?.addEventListener("click", () => {
      state.filters.openOnly = !state.filters.openOnly;
      saveState();
      renderNav();
    });

    document.getElementById("controlBoardFilterIssues")?.addEventListener("click", () => {
      state.filters.issuesOnly = !state.filters.issuesOnly;
      saveState();
      renderNav();
    });

    document.getElementById("controlBoardFilterSmoke")?.addEventListener("click", () => {
      state.filters.smokeOpenOnly = !state.filters.smokeOpenOnly;
      saveState();
      renderNav();
    });

    document.getElementById("controlBoardStatus")?.addEventListener("change", (event) => {
      const item = selectedItem();
      if (!item) return;
      state.items[item.id].status = String(event.target?.value || "todo");
      touchItem(item.id);
      renderOverview();
    });

    document.getElementById("controlBoardOwner")?.addEventListener("change", (event) => {
      const item = selectedItem();
      if (!item) return;
      state.items[item.id].owner = String(event.target?.value || "").trim();
      touchItem(item.id);
    });

    document.getElementById("controlBoardAddOpenTask")?.addEventListener("click", () => addTask(false));
    document.getElementById("controlBoardAddDoneTask")?.addEventListener("click", () => addTask(true));
    document.getElementById("controlBoardAddSmoke")?.addEventListener("click", addSmoke);
    document.getElementById("controlBoardAddIssue")?.addEventListener("click", addIssue);
    document.getElementById("controlBoardAddNote")?.addEventListener("click", addNote);

    document.getElementById("controlBoardCopyItem")?.addEventListener("click", () => {
      const item = selectedItem();
      const itemState = selectedItemState();
      if (!item || !itemState) return;
      copyText(formatItemExport(item, itemState), `Bereichsreport fuer ${item.label} kopiert.`);
    });
    document.getElementById("controlBoardCopyOverview")?.addEventListener("click", () => {
      copyText(formatOverviewExport(false), "Gesamtueberblick kopiert.");
    });
    document.getElementById("controlBoardCopyCompact")?.addEventListener("click", () => {
      copyText(formatOverviewExport(true), "Kompakt-Report kopiert.");
    });
    document.getElementById("controlBoardResetState")?.addEventListener("click", () => {
      const ok = window.confirm("Lokalen Kontrollboard-Stand wirklich zuruecksetzen?");
      if (!ok) return;
      localStorage.removeItem(STORAGE_KEY);
      loadState();
      const search = document.getElementById("controlBoardSearch");
      if (search) search.value = "";
      renderNav();
      renderOverview();
      renderDetail();
      setMsg("Lokaler Stand wurde zurueckgesetzt.");
    });

    document.body.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const navBtn = target.closest("[data-cb-nav]");
      if (navBtn) {
        switchTo(String(navBtn.getAttribute("data-cb-nav") || "overview"));
        return;
      }

      const groupToggle = target.closest("[data-cb-group-toggle]");
      if (groupToggle) {
        const group = String(groupToggle.getAttribute("data-cb-group-toggle") || "");
        if (!group) return;
        state.collapsedGroups[group] = !state.collapsedGroups[group];
        saveState();
        renderNav();
        return;
      }

      const openBtn = target.closest("[data-cb-open]");
      if (openBtn) {
        switchTo(String(openBtn.getAttribute("data-cb-open") || "overview"));
        return;
      }

      const item = selectedItem();
      const itemState = selectedItemState();
      if (!item || !itemState) return;

      const taskToggle = target.closest("[data-cb-task-toggle]");
      if (taskToggle instanceof HTMLInputElement) {
        const task = itemState.tasks.find((entry) => entry.id === taskToggle.getAttribute("data-cb-task-toggle"));
        if (!task) return;
        task.done = Boolean(taskToggle.checked);
        task.completed_at = task.done ? nowIso() : "";
        touchItem(item.id);
        renderOverview();
        renderDetail();
        return;
      }

      const smokeToggle = target.closest("[data-cb-smoke-toggle]");
      if (smokeToggle instanceof HTMLInputElement) {
        const test = itemState.smokeTests.find((entry) => entry.id === smokeToggle.getAttribute("data-cb-smoke-toggle"));
        if (!test) return;
        test.checked = Boolean(smokeToggle.checked);
        test.checked_at = test.checked ? nowIso() : "";
        touchItem(item.id);
        renderOverview();
        renderDetail();
        return;
      }

      const taskCopy = target.closest("[data-cb-task-copy]");
      if (taskCopy) {
        const task = itemState.tasks.find((entry) => entry.id === taskCopy.getAttribute("data-cb-task-copy"));
        if (!task) return;
        copyText(formatTaskExport(item, task), "Punkt kopiert.");
        return;
      }

      const smokeCopy = target.closest("[data-cb-smoke-copy]");
      if (smokeCopy) {
        const test = itemState.smokeTests.find((entry) => entry.id === smokeCopy.getAttribute("data-cb-smoke-copy"));
        if (!test) return;
        copyText(formatSmokeExport(item, test), "Smoke-Test kopiert.");
        return;
      }

      const issueToggle = target.closest("[data-cb-issue-toggle]");
      if (issueToggle) {
        const issue = itemState.issues.find((entry) => entry.id === issueToggle.getAttribute("data-cb-issue-toggle"));
        if (!issue) return;
        issue.resolved = !issue.resolved;
        touchItem(item.id);
        renderOverview();
        renderDetail();
        return;
      }

      const issueCopy = target.closest("[data-cb-issue-copy]");
      if (issueCopy) {
        const issue = itemState.issues.find((entry) => entry.id === issueCopy.getAttribute("data-cb-issue-copy"));
        if (!issue) return;
        copyText(formatIssueExport(item, itemState, issue), "Issue-Report kopiert.");
        return;
      }

      const issueDelete = target.closest("[data-cb-issue-delete]");
      if (issueDelete) {
        itemState.issues = itemState.issues.filter((entry) => entry.id !== issueDelete.getAttribute("data-cb-issue-delete"));
        touchItem(item.id);
        renderOverview();
        renderDetail();
        return;
      }

      const noteCopy = target.closest("[data-cb-note-copy]");
      if (noteCopy) {
        const note = itemState.notes.find((entry) => entry.id === noteCopy.getAttribute("data-cb-note-copy"));
        if (!note) return;
        copyText(formatNoteExport(item, note), "Notiz kopiert.");
        return;
      }

      const noteDelete = target.closest("[data-cb-note-delete]");
      if (noteDelete) {
        itemState.notes = itemState.notes.filter((entry) => entry.id !== noteDelete.getAttribute("data-cb-note-delete"));
        touchItem(item.id);
        renderDetail();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadState();
    const search = document.getElementById("controlBoardSearch");
    if (search) search.value = state.search;
    bindEvents();
    renderNav();
    renderOverview();
    renderDetail();
    setMsg("Kontrollboard bereit.");
  });
})();
