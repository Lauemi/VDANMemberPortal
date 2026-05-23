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
    activeClubId: "",
  };

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  async function waitForAuthReady(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.VDAN_AUTH?.loadSession) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return Boolean(window.VDAN_AUTH?.loadSession);
  }

  async function sb(path, withAuth = false) {
    await waitForAuthReady();
    const { url, key } = cfg();
    const headers = new Headers();
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    let token = session()?.access_token || "";
    if (withAuth && !token && navigator.onLine && window.VDAN_AUTH?.refreshSession) {
      const refreshed = await window.VDAN_AUTH.refreshSession().catch(() => null);
      token = String(refreshed?.access_token || session()?.access_token || "").trim();
    }
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
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

  async function loadActiveClubId() {
    const uid = currentUserId();
    if (!uid) return "";
    const rows = await sb(`/rest/v1/profiles?select=club_id&id=eq.${encodeURIComponent(uid)}&limit=1`, true).catch(() => []);
    return String(rows?.[0]?.club_id || "").trim();
  }

  async function sbAuth(path, init = {}) {
    await waitForAuthReady();
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    let token = session()?.access_token || "";
    if (!token && navigator.onLine && window.VDAN_AUTH?.refreshSession) {
      const refreshed = await window.VDAN_AUTH.refreshSession().catch(() => null);
      token = String(refreshed?.access_token || session()?.access_token || "").trim();
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
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
    const clubFilter = state.activeClubId ? `&club_id=eq.${encodeURIComponent(state.activeClubId)}` : "";
    const [terms, works] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,club_id,title,location,starts_at,ends_at,status&status=eq.published&starts_at=gte.${encodeURIComponent(dayStartIso)}${clubFilter}&order=starts_at.asc`, true),
      sb(`/rest/v1/work_events?select=id,club_id,title,location,starts_at,ends_at,status&status=eq.published&starts_at=gte.${encodeURIComponent(dayStartIso)}${clubFilter}&order=starts_at.asc`, true),
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
      body.innerHTML = `<p class="small" style="padding:12px 0;">Keine passenden Termine oder Arbeitseinsätze gefunden.</p>`;
      return;
    }

    body.innerHTML = state.rows.map((row) => {
      const isOpen = state.selectedRowId === row.rowId;
      const config = configForRow(row);
      const myRegistration = myRegistrationForRow(row);
      const isStructured = String(config?.planning_mode || "") === "structured";
      const canRsvp = Boolean(config) && state.plannerAvailable && !isStructured;
      const rsvpLabel = myRegistration ? "Zusage zurücknehmen" : "Zusagen";
      const availabilityText = !state.plannerAvailable
        ? "Teilnahmefunktion noch nicht aktiv."
        : !config
          ? "Teilnahme noch nicht freigeschaltet."
          : isStructured
            ? "Teilnahme über Helferplanung mit Slots."
            : registrationStatusLabel(myRegistration?.status);

      // Date display
      const d = new Date(row.starts_at);
      const isValidDate = !Number.isNaN(d.getTime());
      const day = isValidDate ? d.getDate() : "-";
      const month = isValidDate ? d.toLocaleDateString("de-DE", { month: "short" }) : "";

      // Kind chip
      const kindLower = String(row.kindLabel || "").toLowerCase();
      const isArbeit = kindLower.includes("arbeit");
      const kindChipClass = isArbeit ? "event-chip--arbeitseinsatz" : "event-chip--termin";

      // Status chip
      const statusLbl = statusLabel(row.status);
      const statusLower = String(row.status || "").toLowerCase();
      const statusChipClass = statusLower.includes("abgesagt") || statusLower.includes("abgebrochen")
        ? "event-chip--warn"
        : statusLower === "aktiv" || statusLower === "geplant" || statusLower === "offen"
          ? "event-chip--ok"
          : "event-chip--neutral";

      const timeStr = formatTimeRange(row.starts_at, row.ends_at);
      const metaParts = [timeStr, row.location ? esc(row.location) : ""].filter(Boolean).join(" · ");

      return `
        <button type="button" class="event-row events-overview__row${isOpen ? " is-open" : ""}" data-open-row="${esc(row.rowId)}">
          <div class="event-row__datebox">
            <span class="event-row__day">${day}</span>
            <span class="event-row__month">${esc(month)}</span>
          </div>
          <div class="event-row__main">
            <div class="event-row__title">${esc(row.title || "-")}</div>
            <div class="event-row__meta">${metaParts}</div>
          </div>
          <div class="event-row__chips">
            <span class="event-chip ${kindChipClass}">${esc(row.kindLabel)}</span>
            <span class="event-chip ${statusChipClass}">${esc(statusLbl)}</span>
          </div>
        </button>
        ${isOpen ? `
          <div class="event-row__detail">
            <div class="event-row__detail-info">
              <strong>${esc(row.title || "-")}</strong>
              <span>${esc(row.kindLabel)} · ${esc(formatDate(row.starts_at))} · ${esc(timeStr)}</span>
              ${row.location ? `<span>📍 ${esc(row.location)}</span>` : ""}
              <span>${esc(availabilityText)}</span>
            </div>
            <div class="event-row__detail-actions">
              <button type="button" class="feed-btn" data-rsvp-row="${esc(row.rowId)}" ${!canRsvp ? "disabled" : ""}>${esc(rsvpLabel)}</button>
            </div>
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
    await waitForAuthReady();
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
      state.activeClubId = await loadActiveClubId().catch(() => "");
      if (session()?.access_token && !state.activeClubId) {
        state.all = [];
        renderAll();
        setMsg("Kein aktiver Vereinskontext für Termine / Events gefunden.");
        return;
      }
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
  document.addEventListener("vdan:session", init);
})();
