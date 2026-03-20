;(() => {
  const FILTER_KEY = "app:filter:events-overview:v1";
  const state = {
    all: [],
    rows: [],
    selectedRowId: "",
    plannerConfigs: [],
    plannerRegistrations: [],
    myRegistrations: [],
    plannerAvailable: true,
  };

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  async function sb(path) {
    const { url, key } = cfg();
    const headers = new Headers();
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    const res = await fetch(`${url}${path}`, { method: "GET", headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function currentUserId() {
    return session()?.user?.id || null;
  }

  async function sbAuth(path, init = {}) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.detail || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ([]));
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setMsg(text = "") {
    const el = document.getElementById("eventsOverviewMsg");
    if (el) el.textContent = text;
  }

  function loadFilter() {
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveFilter(payload) {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(payload || {}));
    } catch {
      // ignore
    }
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso || "-") : d.toLocaleDateString("de-DE");
  }

  function formatTimeRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
    return `${start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function statusLabel(status) {
    const map = {
      draft: "Entwurf",
      published: "Veröffentlicht",
      cancelled: "Abgesagt",
      archived: "Archiviert",
    };
    return map[String(status || "").toLowerCase()] || String(status || "-");
  }

  function todayStartIso() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    return dayStart.toISOString();
  }

  function registrationStatusLabel(status) {
    const map = {
      pending: "Zugesagt, wartet auf Freigabe",
      approved: "Zugesagt",
      rejected: "Abgelehnt",
    };
    return map[String(status || "").toLowerCase()] || "Noch nicht zugesagt";
  }

  function isMissingPlannerSchema(error) {
    return String(error?.message || "").toLowerCase().includes("event_planner");
  }

  async function listAllEvents() {
    const dayStartIso = todayStartIso();
    const [terms, works] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,title,location,starts_at,ends_at,status&status=eq.published&starts_at=gte.${encodeURIComponent(dayStartIso)}&order=starts_at.asc`),
      sb(`/rest/v1/work_events?select=id,title,location,starts_at,ends_at,status&status=eq.published&starts_at=gte.${encodeURIComponent(dayStartIso)}&order=starts_at.asc`),
    ]);

    const termRows = (Array.isArray(terms) ? terms : []).map((row) => ({
      ...row,
      kind: "termin",
      kindLabel: "Termin",
      rowId: `termin:${row.id}`,
    }));

    const workRows = (Array.isArray(works) ? works : []).map((row) => ({
      ...row,
      kind: "arbeitseinsatz",
      kindLabel: "Arbeitseinsatz",
      rowId: `arbeit:${row.id}`,
    }));

    return [...termRows, ...workRows].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  async function loadPlannerState() {
    try {
      const [configs, registrations] = await Promise.all([
        sbAuth("/rest/v1/event_planner_configs?select=id,base_kind,base_club_event_id,base_work_event_id,approval_mode,planning_mode,required_people,max_participants_enabled&order=created_at.asc"),
        sbAuth("/rest/v1/event_planner_registrations?select=id,planner_config_id,slot_id,auth_uid,status,note_member&order=created_at.desc"),
      ]);
      state.plannerConfigs = Array.isArray(configs) ? configs : [];
      state.plannerRegistrations = Array.isArray(registrations) ? registrations : [];
      state.myRegistrations = state.plannerRegistrations.filter((row) => row.auth_uid === currentUserId());
      state.plannerAvailable = true;
    } catch (error) {
      if (!isMissingPlannerSchema(error)) throw error;
      state.plannerAvailable = false;
      state.plannerConfigs = [];
      state.plannerRegistrations = [];
      state.myRegistrations = [];
    }
  }

  function configForRow(row) {
    return state.plannerConfigs.find((config) => {
      if (row.kind === "termin") return String(config.base_club_event_id || "") === String(row.id || "");
      return String(config.base_work_event_id || "") === String(row.id || "");
    }) || null;
  }

  function myRegistrationForRow(row) {
    const config = configForRow(row);
    if (!config) return null;
    return state.myRegistrations.find((registration) => registration.planner_config_id === config.id && !registration.slot_id) || null;
  }

  async function registerForPlanner(plannerId) {
    return sbAuth("/rest/v1/rpc/event_planner_register", {
      method: "POST",
      body: JSON.stringify({
        p_planner_config_id: plannerId,
        p_slot_id: null,
        p_note_member: null,
      }),
    });
  }

  async function unregisterFromPlanner(registrationId) {
    return sbAuth("/rest/v1/rpc/event_planner_unregister", {
      method: "POST",
      body: JSON.stringify({
        p_registration_id: registrationId,
      }),
    });
  }

  function applyFilters() {
    const search = String(document.getElementById("eventsOverviewSearch")?.value || "").trim().toLowerCase();
    const kind = String(document.getElementById("eventsOverviewTypeFilter")?.value || "alle");
    saveFilter({ search, kind });

    state.rows = state.all.filter((row) => {
      if (kind !== "alle" && row.kind !== kind) return false;
      if (!search) return true;
      const hay = `${row.title || ""} ${row.location || ""} ${row.kindLabel || ""}`.toLowerCase();
      return hay.includes(search);
    });
  }

  function renderTable() {
    const body = document.getElementById("eventsOverviewTableBody");
    if (!body) return;
    if (!state.rows.length) {
      body.innerHTML = `<p class="small" style="padding:12px;">Keine passenden Termine oder Arbeitseinsätze gefunden.</p>`;
      return;
    }

    body.innerHTML = state.rows.map((row) => {
      const isOpen = state.selectedRowId === row.rowId;
      const config = configForRow(row);
      const myRegistration = myRegistrationForRow(row);
      const isStructured = String(config?.planning_mode || "") === "structured";
      const rsvpLabel = myRegistration ? "Zusage zurücknehmen" : "Zum Termin zusagen";
      const availabilityText = !state.plannerAvailable
        ? "Teilnahmefunktion ist in dieser Umgebung noch nicht aktiv."
        : !config
          ? "Für diesen Termin ist die Teilnahme noch nicht freigeschaltet."
          : isStructured
            ? "Für diesen Termin läuft die Teilnahme über die Helferplanung mit Slots."
          : registrationStatusLabel(myRegistration?.status);
      return `
        <button type="button" class="catch-table__row events-overview__row${isOpen ? " is-open" : ""}" data-open-row="${esc(row.rowId)}" style="grid-template-columns:1fr .9fr 1.6fr 1fr 1fr .8fr;">
          <span>${esc(formatDate(row.starts_at))}</span>
          <span>${esc(formatTimeRange(row.starts_at, row.ends_at))}</span>
          <span><strong>${esc(row.title || "-")}</strong></span>
          <span>${esc(row.kindLabel)}</span>
          <span>${esc(row.location || "-")}</span>
          <span>${esc(statusLabel(row.status))}</span>
        </button>
        ${isOpen ? `
          <div class="events-overview__detail">
            <div class="events-overview__detail-copy">
              <strong>${esc(row.title || "-")}</strong>
              <span>${esc(row.kindLabel)} am ${esc(formatDate(row.starts_at))} um ${esc(formatTimeRange(row.starts_at, row.ends_at))}</span>
              <span>${esc(availabilityText)}</span>
            </div>
            <button type="button" class="feed-btn" data-rsvp-row="${esc(row.rowId)}" ${!config || !state.plannerAvailable || isStructured ? "disabled" : ""}>${esc(rsvpLabel)}</button>
          </div>
        ` : ""}
      `;
    }).join("");
  }

  function renderAll() {
    applyFilters();
    renderTable();
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    const filter = loadFilter();
    const searchEl = document.getElementById("eventsOverviewSearch");
    const typeEl = document.getElementById("eventsOverviewTypeFilter");
    if (searchEl && filter.search) searchEl.value = String(filter.search);
    if (typeEl && ["alle", "termin", "arbeitseinsatz"].includes(String(filter.kind || ""))) typeEl.value = String(filter.kind);

    try {
      setMsg("");
      const [events] = await Promise.all([
        listAllEvents(),
        loadPlannerState(),
      ]);
      state.all = events;
      renderAll();
    } catch (err) {
      setMsg(err?.message || "Termine / Events konnten nicht geladen werden.");
    }

    searchEl?.addEventListener("input", renderAll);
    typeEl?.addEventListener("change", renderAll);
    document.getElementById("eventsOverviewTableBody")?.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const rsvpBtn = target.closest("[data-rsvp-row]");
      if (rsvpBtn) {
        const rowId = String(rsvpBtn.getAttribute("data-rsvp-row") || "").trim();
        const row = state.all.find((entry) => entry.rowId === rowId);
        if (!row) return;

        const config = configForRow(row);
        const myRegistration = myRegistrationForRow(row);
        if (!config || !state.plannerAvailable) {
          setMsg("Für diesen Termin ist die Teilnahme aktuell noch nicht freigeschaltet.");
          return;
        }
        if (String(config.planning_mode || "") === "structured") {
          setMsg("Für diesen Termin läuft die Teilnahme über die Helferplanung mit Slots.");
          return;
        }

        try {
          if (myRegistration) {
            await unregisterFromPlanner(myRegistration.id);
            setMsg("Zusage zurückgenommen.");
          } else {
            await registerForPlanner(config.id);
            setMsg("Zusage gespeichert.");
          }
          await loadPlannerState();
          renderTable();
          document.dispatchEvent(new CustomEvent("vdan:notifications-refresh"));
        } catch (error) {
          setMsg(error?.message || "Zusage konnte nicht gespeichert werden.");
        }
        return;
      }

      const rowBtn = target.closest("[data-open-row]");
      if (!rowBtn) return;
      const rowId = String(rowBtn.getAttribute("data-open-row") || "").trim();
      state.selectedRowId = state.selectedRowId === rowId ? "" : rowId;
      renderTable();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
